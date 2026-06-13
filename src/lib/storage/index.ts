import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  // Lazy-thrown when the helper is actually used, so the build doesn't
  // explode if the env vars are absent at import time.
  console.warn(
    "[storage] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — storage endpoints will fail at runtime"
  );
}

const DOCUMENTS_BUCKET = "documents";
const DEFAULT_DOWNLOAD_TTL_SECONDS = 60;

let cachedClient: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Storage not configured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedClient;
}

const SAFE_NAME_RE = /[^\w.\-]+/g;

export function buildDocumentStorageKey(opts: {
  firmId: string;
  clientId: string;
  documentId: string;
  filename: string;
}): string {
  const safeName = opts.filename.replace(SAFE_NAME_RE, "_").slice(0, 200);
  // Timestamp prefix prevents key reuse if a document is re-uploaded after
  // rejection. Storage objects from earlier uploads stay addressable for audit.
  return `${opts.firmId}/${opts.clientId}/${opts.documentId}/${Date.now()}-${safeName}`;
}

export async function createUploadUrl(storageKey: string): Promise<{
  uploadUrl: string;
  token: string;
}> {
  const { data, error } = await getClient()
    .storage.from(DOCUMENTS_BUCKET)
    .createSignedUploadUrl(storageKey);
  if (error) throw error;
  return { uploadUrl: data.signedUrl, token: data.token };
}

export async function createDownloadUrl(
  storageKey: string,
  expiresInSeconds: number = DEFAULT_DOWNLOAD_TTL_SECONDS
): Promise<string> {
  const { data, error } = await getClient()
    .storage.from(DOCUMENTS_BUCKET)
    .createSignedUrl(storageKey, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteObject(storageKey: string): Promise<void> {
  const { error } = await getClient()
    .storage.from(DOCUMENTS_BUCKET)
    .remove([storageKey]);
  if (error) throw error;
}
