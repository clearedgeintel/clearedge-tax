import { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireAuth,
  parseBody,
  json,
  jsonError,
  getClientScoped,
} from "@/lib/api/helpers";
import { createUploadUrl } from "@/lib/storage";

const RequestSchema = z.object({
  clientId: z.string(),
  filename: z.string().min(1).max(255),
});

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const SAFE_NAME_RE = /[^\w.\-]+/g;

/**
 * Mint a signed upload URL for a signature source PDF. Returns the
 * Supabase Storage key the caller should then pass to POST /api/signatures.
 * Same shape as the document upload-url endpoint, but keyed under a
 * dedicated `signatures/` prefix so the bucket layout stays readable.
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { data, error: parseError } = await parseBody(req, RequestSchema);
  if (parseError) return parseError;

  const client = await getClientScoped(data.clientId, user.firmId);
  if (!client) return jsonError("Client not found", 404);

  const safeName = data.filename.replace(SAFE_NAME_RE, "_").slice(0, 200);
  const storageKey = `signatures/${user.firmId}/${client.id}/${Date.now()}-${safeName}`;

  const { uploadUrl, token } = await createUploadUrl(storageKey);
  return json({ uploadUrl, token, storageKey, maxFileSize: MAX_FILE_SIZE_BYTES });
}
