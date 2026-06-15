import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit/logger";
import {
  notifyCampaignDocumentsRequested,
  notifyDocumentsRequested,
} from "@/lib/comms/notify";
import type { CampaignDocItem } from "./templates";

/**
 * High-level operations for DocumentCampaigns. A campaign is a per-(client,
 * taxYear) bundle of document requests that's collected before any specific
 * return is created. Documents created through a campaign live at the
 * client level (no returnId) and can later be linked to specific returns by
 * either auto-attach at return-creation time or manual association by
 * staff.
 */

export interface CreateCampaignInput {
  clientId: string;
  taxYear: number;
  items: CampaignDocItem[];
  message?: string;
  deadline?: Date | null;
  createdBy: string;
}

export interface CreateCampaignResult {
  campaignId: string;
  documentCount: number;
}

/**
 * Create a new campaign in DRAFT status with one Document(REQUESTED) row
 * per requested item. Throws if a campaign already exists for this
 * (clientId, taxYear) — enforced by a unique index at the schema level.
 */
export async function createCampaign(
  input: CreateCampaignInput
): Promise<CreateCampaignResult> {
  const result = await prisma.$transaction(async (tx) => {
    const campaign = await tx.documentCampaign.create({
      data: {
        clientId: input.clientId,
        taxYear: input.taxYear,
        message: input.message,
        deadline: input.deadline,
        createdBy: input.createdBy,
      },
    });

    if (input.items.length > 0) {
      await tx.document.createMany({
        data: input.items.map((item) => ({
          clientId: input.clientId,
          campaignId: campaign.id,
          taxYear: input.taxYear,
          category: item.category,
          label: item.label,
          status: "REQUESTED" as const,
        })),
      });
    }

    return { campaignId: campaign.id, documentCount: input.items.length };
  });

  await logAuditEvent({
    userId: input.createdBy,
    eventType: "CAMPAIGN_CREATED",
    eventCategory: "DOCUMENT",
    description: `Created tax-year ${input.taxYear} document campaign with ${result.documentCount} item(s)`,
    metadata: {
      campaignId: result.campaignId,
      clientId: input.clientId,
      taxYear: input.taxYear,
      itemCount: result.documentCount,
    },
  });

  return result;
}

/**
 * Mark a campaign as SENT, stamp sentAt, and email the client. Idempotent:
 * already-SENT or further-along campaigns return without re-sending.
 */
export async function sendCampaign(
  campaignId: string,
  actorUserId: string
): Promise<{ alreadySent: boolean; documentsNotified: number }> {
  const campaign = await prisma.documentCampaign.findUnique({
    where: { id: campaignId },
    include: {
      documents: { where: { status: "REQUESTED" }, select: { label: true } },
    },
  });
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "DRAFT") {
    return { alreadySent: true, documentsNotified: 0 };
  }

  await prisma.documentCampaign.update({
    where: { id: campaignId },
    data: { status: "SENT", sentAt: new Date() },
  });

  const labels = campaign.documents.map((d) => d.label);

  // The notify helper expects a returnId to scope an email. Since campaigns
  // are pre-return, we send a single batched email referencing only the
  // client. We reach into notify via a synthetic dummy: pick any of the
  // client's returns if one exists; otherwise fall back to a manual email
  // through sendEmail. Simpler: just route through notifyDocumentsRequested
  // with the most recent active return for the client, or skip if none.
  // For v1, we use a dedicated path that doesn't require a returnId.
  await notifyCampaignSent(campaignId, labels);

  await logAuditEvent({
    userId: actorUserId,
    eventType: "CAMPAIGN_SENT",
    eventCategory: "DOCUMENT",
    description: `Sent tax-year ${campaign.taxYear} document campaign to client`,
    metadata: {
      campaignId,
      clientId: campaign.clientId,
      taxYear: campaign.taxYear,
      itemCount: labels.length,
    },
    critical: true,
  });

  return { alreadySent: false, documentsNotified: labels.length };
}

async function notifyCampaignSent(
  campaignId: string,
  labels: string[]
): Promise<void> {
  if (labels.length === 0) return;
  const campaign = await prisma.documentCampaign.findUnique({
    where: { id: campaignId },
    select: { clientId: true, taxYear: true },
  });
  if (!campaign) return;

  // Prefer scoping the email to an existing return (so the email reuses
  // the return's entity name and the existing notifyDocumentsRequested
  // template); fall back to the client-level campaign helper when no
  // return exists yet — which is the common case for pre-return
  // collection. Either path goes through the same email-sender +
  // Communication-row audit trail.
  const someReturn = await prisma.taxReturn.findFirst({
    where: { entity: { clientId: campaign.clientId }, taxYear: campaign.taxYear },
    select: { id: true },
  });
  if (someReturn) {
    await notifyDocumentsRequested({
      returnId: someReturn.id,
      documentLabels: labels,
    });
    return;
  }
  await notifyCampaignDocumentsRequested({
    clientId: campaign.clientId,
    taxYear: campaign.taxYear,
    documentLabels: labels,
  });
}

/**
 * When the campaign's documents are all ACCEPTED or REJECTED-and-resolved,
 * call this to flip the campaign to COMPLETED. Idempotent.
 */
export async function maybeCompleteCampaign(
  campaignId: string
): Promise<boolean> {
  const campaign = await prisma.documentCampaign.findUnique({
    where: { id: campaignId },
    include: {
      documents: { select: { status: true } },
    },
  });
  if (!campaign) return false;
  if (campaign.status === "COMPLETED" || campaign.status === "CANCELLED") {
    return false;
  }
  const unresolved = campaign.documents.filter(
    (d) => d.status === "REQUESTED" || d.status === "UPLOADED"
  );
  if (unresolved.length > 0) {
    if (campaign.status === "SENT" && campaign.documents.some((d) => d.status !== "REQUESTED")) {
      // At least one upload landed — move to IN_PROGRESS so the dashboard
      // reflects activity.
      await prisma.documentCampaign.update({
        where: { id: campaignId },
        data: { status: "IN_PROGRESS" },
      });
      return true;
    }
    return false;
  }
  await prisma.documentCampaign.update({
    where: { id: campaignId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  return true;
}

/**
 * When a new TaxReturn is created for a client/year, link any matching
 * campaign documents so they appear under the return's document list.
 * Returns the count of newly-linked documents.
 *
 * Only links docs that aren't already attached to another return — the
 * campaign-level docs that are still client-only.
 */
export async function linkCampaignDocumentsToReturn(opts: {
  returnId: string;
  clientId: string;
  taxYear: number;
}): Promise<number> {
  const { count } = await prisma.document.updateMany({
    where: {
      clientId: opts.clientId,
      taxYear: opts.taxYear,
      returnId: null,
      campaign: { taxYear: opts.taxYear },
    },
    data: { returnId: opts.returnId },
  });
  return count;
}
