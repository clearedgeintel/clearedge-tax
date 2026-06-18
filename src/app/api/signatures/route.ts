import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  parseBody,
  json,
  jsonError,
  getReturnScoped,
  getClientScoped,
} from "@/lib/api/helpers";
import { createSignatureRequest } from "@/lib/signatures";

const CreateSchema = z.object({
  returnId: z.string().optional(),
  clientId: z.string(),
  documentType: z.enum(["ENGAGEMENT_LETTER", "FORM_8879", "FORM_8453", "OTHER"]),
  sourceStorageKey: z.string().min(1),
  documentName: z.string().min(1).max(300),
  signerEmail: z.string().email(),
  signerName: z.string().min(1).max(200),
  ccEmails: z.array(z.string().email()).optional(),
  subject: z.string().max(200).optional(),
  message: z.string().max(5000).optional(),
  expiresAt: z.string().optional(),
});

/**
 * List signature requests scoped to a client or return.
 *   GET /api/signatures?returnId=...   → all for that return
 *   GET /api/signatures?clientId=...   → all for that client (any return)
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const returnId = searchParams.get("returnId");
  const clientId = searchParams.get("clientId");

  if (returnId) {
    const tr = await getReturnScoped(returnId, user.firmId);
    if (!tr) return jsonError("Not found", 404);
    const rows = await prisma.signatureRequest.findMany({
      where: { returnId },
      orderBy: { createdAt: "desc" },
    });
    return json({ signatureRequests: rows });
  }
  if (clientId) {
    const client = await getClientScoped(clientId, user.firmId);
    if (!client) return jsonError("Not found", 404);
    const rows = await prisma.signatureRequest.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    });
    return json({ signatureRequests: rows });
  }
  return jsonError("Provide returnId or clientId", 400);
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { data, error: parseError } = await parseBody(req, CreateSchema);
  if (parseError) return parseError;

  // Authorize: the caller must own the client (and the return if provided)
  // in their firm.
  const client = await getClientScoped(data.clientId, user.firmId);
  if (!client) return jsonError("Client not found", 404);
  if (data.returnId) {
    const tr = await getReturnScoped(data.returnId, user.firmId);
    if (!tr) return jsonError("Return not found", 404);
  }

  const result = await createSignatureRequest({
    returnId: data.returnId,
    clientId: data.clientId,
    documentType: data.documentType,
    sourceStorageKey: data.sourceStorageKey,
    documentName: data.documentName,
    signerEmail: data.signerEmail,
    signerName: data.signerName,
    ccEmails: data.ccEmails,
    subject: data.subject,
    message: data.message,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    createdBy: user.id,
  });

  return json({ signatureRequest: result }, 201);
}
