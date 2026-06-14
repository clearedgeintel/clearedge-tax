import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  parseBody,
  json,
  jsonError,
} from "@/lib/api/helpers";
import { isStaff } from "@/lib/utils/permissions";
import { logDocumentEvent } from "@/lib/audit/logger";
import type { DocumentStatus } from "@/generated/prisma/enums";
import { extractDocument } from "@/lib/extraction/extract";

const UpdateDocumentSchema = z.object({
  status: z.enum(["UPLOADED", "ACCEPTED", "REJECTED"]).optional(),
  storageKey: z.string().optional(),
  mimeType: z.string().optional(),
  fileSize: z.number().int().positive().optional(),
});

const VALID_STATUS_TRANSITIONS: Record<string, DocumentStatus[]> = {
  REQUESTED: ["UPLOADED"],
  UPLOADED: ["ACCEPTED", "REJECTED"],
  REJECTED: ["UPLOADED"],
  ACCEPTED: [],
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { documentId } = await params;

  const document = await prisma.document.findFirst({
    where: { id: documentId, client: { firmId: user.firmId } },
  });
  if (!document) return jsonError("Not found", 404);

  const { data, error: parseError } = await parseBody(req, UpdateDocumentSchema);
  if (parseError) return parseError;

  if (data.status) {
    // Validate status transition
    const allowed = VALID_STATUS_TRANSITIONS[document.status] || [];
    if (!allowed.includes(data.status)) {
      return jsonError(
        `Cannot transition from ${document.status} to ${data.status}`,
        400
      );
    }

    // Only staff can ACCEPT/REJECT
    if ((data.status === "ACCEPTED" || data.status === "REJECTED") && !isStaff(user.role)) {
      return jsonError("Only staff can accept or reject documents", 403);
    }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.status) updateData.status = data.status;
  if (data.storageKey) updateData.storageKey = data.storageKey;
  if (data.mimeType) updateData.mimeType = data.mimeType;
  if (data.fileSize) updateData.fileSize = data.fileSize;

  if (data.status === "UPLOADED") {
    updateData.uploadedBy = user.id;
    updateData.uploadedAt = new Date();
  }

  const updated = await prisma.document.update({
    where: { id: documentId },
    data: updateData,
  });

  if (data.status) {
    const eventType = `DOCUMENT_${data.status}`;
    await logDocumentEvent(
      document.returnId || "",
      user.id,
      eventType,
      documentId,
      document.label
    );
  }

  // Kick off AI extraction when the document first becomes UPLOADED. Run as
  // a fire-and-forget so the response returns immediately — the UI shows
  // PENDING and refreshes to show the result. A manual retry endpoint
  // covers the case where the background job dies before completion.
  if (data.status === "UPLOADED") {
    void extractDocument(documentId, user.id).catch((e) => {
      console.error(`[extraction] documentId=${documentId} failed`, e);
    });
  }

  return json({ document: updated });
}
