import { prisma } from "@/lib/db";
import type { ReturnStatus } from "@/generated/prisma/enums";
import { sendEmail } from "./email";
import {
  documentRequestEmail,
  statusChangeEmail,
} from "./templates";

/**
 * High-level notification triggers. Each function is best-effort: a failure
 * to send (no API key, no client email on file, network blip) is logged but
 * does not throw, because the caller is typically inside a critical write
 * path (interview save, status transition) and we don't want comms to break
 * those flows.
 */

function portalBaseUrl(): string {
  return (
    process.env.PORTAL_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  );
}

interface ClientContact {
  clientId: string;
  email: string | null;
  name: string;
}

async function resolveClientContact(
  returnId: string
): Promise<{ contact: ClientContact; returnLegalName: string; taxYear: number } | null> {
  const taxReturn = await prisma.taxReturn.findUnique({
    where: { id: returnId },
    select: {
      taxYear: true,
      entity: {
        select: {
          legalName: true,
          client: {
            select: {
              id: true,
              displayName: true,
              email: true,
              user: { select: { email: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!taxReturn) return null;
  const client = taxReturn.entity.client;
  return {
    contact: {
      clientId: client.id,
      email: client.email || client.user?.email || null,
      name: client.user?.name || client.displayName,
    },
    returnLegalName: taxReturn.entity.legalName,
    taxYear: taxReturn.taxYear,
  };
}

/**
 * Send "we need the following documents" — one email per call, batching
 * however many docs the caller passes. Safe to call inside an interview
 * save: failures swallow.
 */
export async function notifyDocumentsRequested(opts: {
  returnId: string;
  documentLabels: string[];
}): Promise<void> {
  if (opts.documentLabels.length === 0) return;
  try {
    const resolved = await resolveClientContact(opts.returnId);
    if (!resolved || !resolved.contact.email) return;
    const rendered = documentRequestEmail({
      clientName: resolved.contact.name,
      documentLabels: opts.documentLabels,
      returnLegalName: resolved.returnLegalName,
      portalUrl: `${portalBaseUrl()}/documents`,
    });
    await sendEmail({
      to: resolved.contact.email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      templateId: rendered.templateId,
      clientId: resolved.contact.clientId,
      returnId: opts.returnId,
      metadata: { documentLabels: opts.documentLabels },
    });
  } catch (e) {
    console.error("[notify] documents requested failed", e);
  }
}

const CLIENT_FACING_STATUSES = new Set<ReturnStatus>([
  "APPROVED",
  "REVISION",
  "EXPORTED",
  "INTAKE_BLOCKED",
  "PREPARATION_BLOCKED",
]);

/**
 * Send a status-change email if the new status is one the client cares
 * about. Internal transitions (INTAKE→PREPARATION, PREPARATION→REVIEW) are
 * silent.
 */
export async function notifyStatusChange(opts: {
  returnId: string;
  newStatus: ReturnStatus;
  note?: string;
}): Promise<void> {
  if (!CLIENT_FACING_STATUSES.has(opts.newStatus)) return;
  try {
    const resolved = await resolveClientContact(opts.returnId);
    if (!resolved || !resolved.contact.email) return;
    const rendered = statusChangeEmail({
      clientName: resolved.contact.name,
      returnLegalName: resolved.returnLegalName,
      taxYear: resolved.taxYear,
      newStatus: opts.newStatus as
        | "APPROVED"
        | "REVISION"
        | "EXPORTED"
        | "PREPARATION_BLOCKED"
        | "INTAKE_BLOCKED",
      note: opts.note,
      portalUrl: `${portalBaseUrl()}/returns`,
    });
    await sendEmail({
      to: resolved.contact.email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      templateId: rendered.templateId,
      clientId: resolved.contact.clientId,
      returnId: opts.returnId,
      metadata: { newStatus: opts.newStatus, note: opts.note },
    });
  } catch (e) {
    console.error("[notify] status change failed", e);
  }
}
