import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  parseBody,
  json,
  jsonError,
} from "@/lib/api/helpers";

const UpdateCampaignSchema = z.object({
  message: z.string().max(5000).optional(),
  deadline: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { campaignId } = await params;

  const campaign = await prisma.documentCampaign.findFirst({
    where: {
      id: campaignId,
      client: { firmId: user.firmId },
    },
    include: {
      client: { select: { id: true, displayName: true, email: true } },
      documents: {
        orderBy: { createdAt: "asc" },
        include: { extraction: { select: { status: true } } },
      },
    },
  });
  if (!campaign) return jsonError("Not found", 404);
  return json({ campaign });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { campaignId } = await params;
  const campaign = await prisma.documentCampaign.findFirst({
    where: { id: campaignId, client: { firmId: user.firmId } },
  });
  if (!campaign) return jsonError("Not found", 404);

  const { data, error: parseError } = await parseBody(req, UpdateCampaignSchema);
  if (parseError) return parseError;

  const updated = await prisma.documentCampaign.update({
    where: { id: campaignId },
    data: {
      ...(data.message !== undefined ? { message: data.message } : {}),
      ...(data.deadline !== undefined
        ? { deadline: data.deadline ? new Date(data.deadline) : null }
        : {}),
      ...(data.status !== undefined
        ? {
            status: data.status,
            completedAt:
              data.status === "COMPLETED" ? new Date() : undefined,
          }
        : {}),
      updatedAt: new Date(),
    },
  });

  return json({ campaign: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { campaignId } = await params;
  const campaign = await prisma.documentCampaign.findFirst({
    where: { id: campaignId, client: { firmId: user.firmId } },
    select: { id: true, status: true },
  });
  if (!campaign) return jsonError("Not found", 404);
  if (campaign.status !== "DRAFT") {
    return jsonError("Only DRAFT campaigns can be deleted; cancel instead", 400);
  }
  // Unlink the documents (they still belong to the client) before removing
  // the campaign. SET NULL handles this on the cascade, but explicit is
  // clearer.
  await prisma.document.updateMany({
    where: { campaignId: campaign.id },
    data: { campaignId: null },
  });
  await prisma.documentCampaign.delete({ where: { id: campaign.id } });
  return json({ deleted: true });
}
