import { NextRequest } from "next/server";
import {
  requireAuth,
  json,
  jsonError,
  getReturnScoped,
} from "@/lib/api/helpers";
import { generateDocumentRequests } from "@/lib/documents/request-triggers";
import { logAuditEvent } from "@/lib/audit/logger";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { returnId } = await params;

  const taxReturn = await getReturnScoped(returnId, user.firmId);
  if (!taxReturn) return jsonError("Not found", 404);

  const count = await generateDocumentRequests(returnId);

  if (count > 0) {
    await logAuditEvent({
      returnId,
      userId: user.id,
      eventType: "DOCUMENTS_AUTO_REQUESTED",
      eventCategory: "DOCUMENT",
      description: `${count} document(s) automatically requested based on intake answers`,
      metadata: { count },
    });
  }

  return json({ generated: count });
}
