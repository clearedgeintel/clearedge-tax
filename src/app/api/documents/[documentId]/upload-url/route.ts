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
import { buildDocumentStorageKey, createUploadUrl } from "@/lib/storage";

const RequestSchema = z.object({
  filename: z.string().min(1).max(255),
});

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { documentId } = await params;

  const document = await prisma.document.findFirst({
    where: { id: documentId, client: { firmId: user.firmId } },
    include: { client: { select: { id: true, userId: true, firmId: true } } },
  });
  if (!document) return jsonError("Not found", 404);

  const isOwningClient =
    user.role === "CLIENT" && document.client.userId === user.id;
  if (!isOwningClient && !isStaff(user.role)) {
    return jsonError("Forbidden", 403);
  }

  if (document.status === "ACCEPTED") {
    return jsonError("Document already accepted; re-upload not permitted", 400);
  }

  const { data, error: parseError } = await parseBody(req, RequestSchema);
  if (parseError) return parseError;

  const storageKey = buildDocumentStorageKey({
    firmId: document.client.firmId!,
    clientId: document.client.id,
    documentId: document.id,
    filename: data.filename,
  });

  const { uploadUrl, token } = await createUploadUrl(storageKey);

  return json({
    uploadUrl,
    token,
    storageKey,
    maxFileSize: MAX_FILE_SIZE_BYTES,
  });
}
