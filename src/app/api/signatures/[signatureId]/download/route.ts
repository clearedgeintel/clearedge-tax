import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, json, jsonError } from "@/lib/api/helpers";
import { createDownloadUrl } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit/logger";

/**
 * Returns a short-lived signed URL for the signed PDF (snapshotted when the
 * webhook reported SIGNED). Staff-only and scoped to the firm. Logs a
 * SIGNATURE_DOWNLOADED audit event so any retrieval of the binding signed
 * document is traceable.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ signatureId: string }> }
) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { signatureId } = await params;

  const row = await prisma.signatureRequest.findFirst({
    where: { id: signatureId, client: { firmId: user.firmId } },
    select: { id: true, returnId: true, signedPdfStorageKey: true, status: true },
  });
  if (!row) return jsonError("Not found", 404);
  if (!row.signedPdfStorageKey) {
    return jsonError(
      "Signed PDF not available yet — status is " + row.status,
      404
    );
  }

  const downloadUrl = await createDownloadUrl(row.signedPdfStorageKey, 60);

  await logAuditEvent({
    returnId: row.returnId || undefined,
    userId: user.id,
    eventType: "SIGNATURE_DOWNLOADED",
    eventCategory: "SIGNATURE",
    description: `Downloaded signed PDF for signature request ${row.id}`,
    metadata: { signatureRequestId: row.id },
    critical: true,
  });

  return json({ downloadUrl, expiresInSeconds: 60 });
}
