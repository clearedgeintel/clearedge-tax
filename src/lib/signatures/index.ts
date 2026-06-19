import { prisma } from "@/lib/db";
import { downloadObject, uploadObject } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit/logger";
import type {
  SignatureDocumentType,
  SignatureStatus,
} from "@/generated/prisma/enums";
import type { SignatureProvider, SignatureProviderStatus } from "./provider";
import { boldsign } from "./boldsign";

/**
 * High-level operations for signature requests. The provider abstraction
 * lets us swap BoldSign for DocuSign / HelloSign / etc. with no callers
 * having to know.
 */

function providerByName(name: string): SignatureProvider {
  if (name === "boldsign") return boldsign;
  throw new Error(`Unknown signature provider: ${name}`);
}

export interface CreateSignatureRequestInput {
  /** Optional: scope the request to a tax return. Engagement letters are
   *  often client-only; Form 8879 should always have a returnId. */
  returnId?: string;
  clientId: string;
  documentType: SignatureDocumentType;
  /** Supabase Storage key for the source PDF the staff already uploaded. */
  sourceStorageKey: string;
  /** Document title shown in the signing UI and email subject. */
  documentName: string;
  signerEmail: string;
  signerName: string;
  ccEmails?: string[];
  subject?: string;
  message?: string;
  expiresAt?: Date;
  createdBy: string;
}

/**
 * Create a signature request row in DRAFT, push the PDF to BoldSign, and
 * flip to SENT on success. The DB row is always created — that way, even
 * an API failure leaves a visible artifact with status=FAILED that staff
 * can retry.
 */
export async function createSignatureRequest(
  input: CreateSignatureRequestInput
): Promise<{ id: string; status: SignatureStatus; signerUrl?: string }> {
  const provider = providerByName("boldsign");

  const row = await prisma.signatureRequest.create({
    data: {
      returnId: input.returnId,
      clientId: input.clientId,
      documentType: input.documentType,
      status: "DRAFT",
      provider: provider.name,
      signerEmail: input.signerEmail,
      signerName: input.signerName,
      subject: input.subject,
      message: input.message,
      ccEmails: input.ccEmails || [],
      sourceStorageKey: input.sourceStorageKey,
      expiresAt: input.expiresAt,
      createdBy: input.createdBy,
    },
  });

  try {
    const pdf = await downloadObject(input.sourceStorageKey);
    const sendResult = await provider.send({
      ourRequestId: row.id,
      documentName: input.documentName,
      pdf,
      pdfFilename: input.sourceStorageKey.split("/").pop() || "document.pdf",
      signer: { email: input.signerEmail, name: input.signerName },
      ccEmails: input.ccEmails,
      subject: input.subject,
      message: input.message,
      expiresAt: input.expiresAt,
    });

    const updated = await prisma.signatureRequest.update({
      where: { id: row.id },
      data: {
        status: "SENT",
        providerDocumentId: sendResult.providerDocumentId,
        sentAt: new Date(),
        errorMessage: null,
      },
    });

    await logAuditEvent({
      returnId: input.returnId,
      userId: input.createdBy,
      eventType: "SIGNATURE_REQUEST_SENT",
      eventCategory: "SIGNATURE",
      description: `Sent ${input.documentType} for signature to ${input.signerEmail}`,
      metadata: {
        signatureRequestId: row.id,
        provider: provider.name,
        providerDocumentId: sendResult.providerDocumentId,
      },
      critical: true,
    });

    return {
      id: updated.id,
      status: updated.status,
      signerUrl: sendResult.signerUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.signatureRequest.update({
      where: { id: row.id },
      data: { status: "FAILED", errorMessage: message },
    });
    await logAuditEvent({
      returnId: input.returnId,
      userId: input.createdBy,
      eventType: "SIGNATURE_REQUEST_FAILED",
      eventCategory: "SIGNATURE",
      description: `Signature request to ${input.signerEmail} failed`,
      metadata: { signatureRequestId: row.id, error: message },
    });
    return { id: row.id, status: "FAILED" };
  }
}

/**
 * Pull current status from the provider and update the row. Returns the
 * updated row's status. Idempotent.
 */
export async function syncSignatureRequest(id: string): Promise<SignatureStatus> {
  const row = await prisma.signatureRequest.findUnique({ where: { id } });
  if (!row) throw new Error("Signature request not found");
  if (!row.providerDocumentId) return row.status;

  const provider = providerByName(row.provider);
  const status = await provider.fetchStatus(row.providerDocumentId);
  await applyProviderStatus(row.id, status);
  return status.status;
}

/**
 * Cancel an in-flight request. Hits the provider's revoke endpoint, then
 * flips the local row. Idempotent: already-CANCELLED rows return without
 * calling the provider.
 */
export async function cancelSignatureRequest(
  id: string,
  actorUserId: string,
  reason?: string
): Promise<void> {
  const row = await prisma.signatureRequest.findUnique({ where: { id } });
  if (!row) throw new Error("Signature request not found");
  if (row.status === "CANCELLED" || row.status === "SIGNED" || row.status === "EXPIRED") {
    return;
  }

  if (row.providerDocumentId) {
    const provider = providerByName(row.provider);
    await provider.cancel(row.providerDocumentId, reason);
  }
  await prisma.signatureRequest.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  await logAuditEvent({
    returnId: row.returnId || undefined,
    userId: actorUserId,
    eventType: "SIGNATURE_REQUEST_CANCELLED",
    eventCategory: "SIGNATURE",
    description: `Cancelled signature request ${row.id}${reason ? ` (${reason})` : ""}`,
    metadata: { signatureRequestId: row.id, reason },
    critical: true,
  });
}

/**
 * Apply a status update from either fetchStatus or a webhook. Stamps
 * the appropriate timestamps for each status transition. On SIGNED
 * transitions, downloads the signed PDF from the provider and stashes
 * it in Supabase Storage so it can be retrieved later without another
 * provider round-trip.
 */
export async function applyProviderStatus(
  id: string,
  status: SignatureProviderStatus
): Promise<void> {
  const row = await prisma.signatureRequest.findUnique({ where: { id } });
  if (!row) return;

  const data: Record<string, unknown> = { status: status.status };
  if (status.viewedAt) data.viewedAt = status.viewedAt;
  if (status.signedAt) data.signedAt = status.signedAt;
  if (status.declinedAt) data.declinedAt = status.declinedAt;
  if (status.expiresAt) data.expiresAt = status.expiresAt;
  if (status.message) data.errorMessage = status.message;

  // First-time SIGNED transition → snapshot the signed PDF into storage.
  // Idempotent: if signedPdfStorageKey is already set, skip the download
  // (BoldSign sometimes resends Completed events).
  if (
    status.status === "SIGNED" &&
    row.providerDocumentId &&
    !row.signedPdfStorageKey
  ) {
    try {
      const provider = providerByName(row.provider);
      const pdf = await provider.downloadSigned(row.providerDocumentId);
      const filename = `${row.documentType.toLowerCase()}-signed.pdf`;
      const storageKey = `signatures/${row.clientId}/${row.id}/${filename}`;
      await uploadObject(storageKey, pdf, "application/pdf");
      data.signedPdfStorageKey = storageKey;
    } catch (e) {
      // Don't block the status flip on a download blip — the signed PDF can
      // be fetched later via a manual sync.
      console.error("[signatures] signed-PDF download failed", e);
    }
  }

  await prisma.signatureRequest.update({ where: { id }, data });
}

export async function findByProviderDocumentId(
  providerDocumentId: string
): Promise<{ id: string; status: SignatureStatus; returnId: string | null } | null> {
  const row = await prisma.signatureRequest.findFirst({
    where: { providerDocumentId },
    select: { id: true, status: true, returnId: true },
  });
  return row;
}

export { boldsign };
