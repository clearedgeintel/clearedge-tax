import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, parseBody, json, jsonError } from "@/lib/api/helpers";
import { isStaff } from "@/lib/utils/permissions";
import { logAuditEvent } from "@/lib/audit/logger";

const UpdateExtractionSchema = z.object({
  status: z.enum(["SUCCESS", "REVIEWED"]).optional(),
  fields: z.unknown().optional(),
});

/**
 * PATCH the DocumentExtraction row for a document. Two use cases:
 *   - Flip SUCCESS → REVIEWED to mark the extraction reviewed by staff.
 *   - Edit the extracted fields (full-object replacement, validated
 *     loosely — the JSON shape is per-category).
 *
 * Staff-only. Logs DOCUMENT_EXTRACTION_REVIEWED on a SUCCESS → REVIEWED
 * transition with critical=true.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;
  if (!isStaff(user.role)) return jsonError("Staff only", 403);

  const { documentId } = await params;

  const document = await prisma.document.findFirst({
    where: { id: documentId, client: { firmId: user.firmId } },
    include: { extraction: true },
  });
  if (!document) return jsonError("Not found", 404);
  if (!document.extraction) {
    return jsonError("Document has no extraction yet", 404);
  }

  const { data, error: parseError } = await parseBody(req, UpdateExtractionSchema);
  if (parseError) return parseError;

  const previousStatus = document.extraction.status;
  const updateData: Record<string, unknown> = {};
  if (data.status) updateData.status = data.status;
  if (data.fields !== undefined) updateData.fields = data.fields;

  if (data.status === "REVIEWED") {
    updateData.reviewedBy = user.id;
    updateData.reviewedAt = new Date();
  }

  const updated = await prisma.documentExtraction.update({
    where: { documentId },
    data: updateData,
  });

  if (
    data.status === "REVIEWED" &&
    previousStatus !== "REVIEWED"
  ) {
    await logAuditEvent({
      returnId: document.returnId || undefined,
      userId: user.id,
      eventType: "DOCUMENT_EXTRACTION_REVIEWED",
      eventCategory: "DOCUMENT",
      description: `Marked extracted fields reviewed for ${document.label}`,
      metadata: {
        documentId,
        category: document.category,
        editedFields: data.fields !== undefined,
      },
      critical: true,
    });
  } else if (data.fields !== undefined) {
    await logAuditEvent({
      returnId: document.returnId || undefined,
      userId: user.id,
      eventType: "DOCUMENT_EXTRACTION_EDITED",
      eventCategory: "DOCUMENT",
      description: `Edited extracted fields for ${document.label}`,
      metadata: { documentId, category: document.category },
    });
  }

  return json({ extraction: updated });
}
