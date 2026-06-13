import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, json, jsonError } from "@/lib/api/helpers";
import { isStaff } from "@/lib/utils/permissions";
import { createDownloadUrl } from "@/lib/storage";

const DOWNLOAD_TTL_SECONDS = 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { documentId } = await params;

  const document = await prisma.document.findFirst({
    where: { id: documentId, client: { firmId: user.firmId } },
    include: { client: { select: { userId: true } } },
  });
  if (!document) return jsonError("Not found", 404);

  const isOwningClient =
    user.role === "CLIENT" && document.client.userId === user.id;
  if (!isOwningClient && !isStaff(user.role)) {
    return jsonError("Forbidden", 403);
  }

  if (!document.storageKey) {
    return jsonError("Document has no uploaded file", 404);
  }

  const downloadUrl = await createDownloadUrl(
    document.storageKey,
    DOWNLOAD_TTL_SECONDS
  );

  return json({ downloadUrl, expiresInSeconds: DOWNLOAD_TTL_SECONDS });
}
