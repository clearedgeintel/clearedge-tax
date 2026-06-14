import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, json, jsonError } from "@/lib/api/helpers";
import { isStaff } from "@/lib/utils/permissions";
import { extractDocument } from "@/lib/extraction/extract";

/**
 * Manually re-trigger extraction on a document. Staff-only.
 *
 * Useful when:
 *   - The background extraction kicked off by the UPLOADED PATCH died.
 *   - A FAILED extraction looks recoverable (e.g., we added support for the
 *     category since last attempt).
 *   - We want to overwrite an existing SUCCESS row with a re-run.
 *
 * Synchronous: this endpoint awaits the extraction so the caller can show
 * the result inline. Returns the final status.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;
  if (!isStaff(user.role)) return jsonError("Staff only", 403);

  const { documentId } = await params;

  const document = await prisma.document.findFirst({
    where: { id: documentId, client: { firmId: user.firmId } },
    select: { id: true, status: true },
  });
  if (!document) return jsonError("Not found", 404);
  if (document.status === "REQUESTED") {
    return jsonError(
      "Document has no upload yet; cannot extract",
      400
    );
  }

  // Allow rerun: reset SUCCESS rows back to PENDING so extractDocument
  // doesn't short-circuit them.
  await prisma.documentExtraction.upsert({
    where: { documentId },
    create: { documentId, status: "PENDING" },
    update: { status: "PENDING", errorMessage: null, fields: undefined },
  });

  const result = await extractDocument(documentId, user.id);

  const extraction = await prisma.documentExtraction.findUnique({
    where: { documentId },
  });

  return json({ result, extraction });
}
