import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, json, jsonError } from "@/lib/api/helpers";
import { syncSignatureRequest } from "@/lib/signatures";

/**
 * Fetch a single signature request, with an optional refresh from the
 * provider. Pass ?sync=1 to force a status pull before returning.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ signatureId: string }> }
) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { signatureId } = await params;
  const { searchParams } = new URL(req.url);
  const shouldSync = searchParams.get("sync") === "1";

  const row = await prisma.signatureRequest.findFirst({
    where: { id: signatureId, client: { firmId: user.firmId } },
  });
  if (!row) return jsonError("Not found", 404);

  if (shouldSync && row.providerDocumentId) {
    try {
      await syncSignatureRequest(signatureId);
    } catch {
      // Best-effort; return the existing row state if sync fails.
    }
  }

  const fresh = await prisma.signatureRequest.findUnique({
    where: { id: signatureId },
  });
  return json({ signatureRequest: fresh });
}
