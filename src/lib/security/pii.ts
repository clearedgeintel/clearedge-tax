import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Application-level encryption for PII fields (SSN, EIN, etc.) stored in the
 * database. Uses AES-256-GCM with a 12-byte random IV per ciphertext, and a
 * 16-byte GCM auth tag. The same value encrypted twice produces different
 * ciphertexts.
 *
 * On-disk format: `enc:v1:<iv-b64url>:<ciphertext-b64url>:<tag-b64url>`
 *
 * The PII_ENCRYPTION_KEY env var must contain a 32-byte key encoded as
 * base64 (standard or URL-safe). Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * Behavior when the env var is missing:
 *   - encrypt() throws (writes fail loudly — refuse to store unprotected PII)
 *   - decrypt() with a plaintext-looking string returns it unchanged (legacy)
 *   - decrypt() with an encrypted-looking string throws (can't read what we
 *     can't decrypt)
 *   - isEncrypted() works without the key (string shape check only)
 *   - maskTIN() works without the key
 */

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const PREFIX = `enc:${VERSION}:`;
const IV_BYTES = 12;
const KEY_BYTES = 32;

function loadKey(): Buffer {
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "PII_ENCRYPTION_KEY is not set. Generate with " +
        '`node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"` ' +
        "and add it to .env (and your hosting provider's env)."
    );
  }
  // Accept standard or URL-safe base64.
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `PII_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes; got ${buf.length}. ` +
        "Did you paste the literal value or accidentally include quotes?"
    );
  }
  return buf;
}

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (!cachedKey) cachedKey = loadKey();
  return cachedKey;
}

/** Returns true if the string looks like our encrypted format. Cheap to call. */
export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/**
 * Encrypts a string. Returns the encoded ciphertext.
 * If the input already looks encrypted, returns it unchanged (idempotent).
 * Throws if the encryption key is not configured.
 */
export function encrypt(plaintext: string): string {
  if (isEncrypted(plaintext)) return plaintext;
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ct = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX.slice(0, -1),
    iv.toString("base64url"),
    ct.toString("base64url"),
    tag.toString("base64url"),
  ].join(":");
}

/**
 * Decrypts an encrypted string. If the value isn't in our encrypted format,
 * returns it unchanged — this lets us read legacy plaintext rows during
 * gradual migration.
 *
 * Throws if the value is in our encrypted format but the key can't decrypt
 * it (wrong key, tampered ciphertext, missing env var).
 */
export function decrypt(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  const parts = stored.split(":");
  // ["enc", "v1", iv, ct, tag]
  if (parts.length !== 5 || parts[0] !== "enc" || parts[1] !== VERSION) {
    throw new Error("Malformed encrypted value");
  }
  const [, , ivB64, ctB64, tagB64] = parts;
  const key = getKey();
  const iv = Buffer.from(ivB64, "base64url");
  const ct = Buffer.from(ctB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== 16) {
    throw new Error("Malformed encrypted value");
  }
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/**
 * Returns a masked representation of a TIN (SSN or EIN) suitable for showing
 * to users who shouldn't see the full value. Strips formatting first.
 *   SSN (9 digits): "***-**-1234"
 *   EIN (9 digits): "**-***1234"  (EINs are 9 digits too; same shape)
 *   anything else: a generic "****1234" with up to 4 trailing digits
 */
export function maskTIN(tin: string | null | undefined): string {
  if (!tin) return "";
  const digits = String(tin).replace(/\D/g, "");
  if (digits.length === 9) {
    // Display as SSN-style with two-digit middle by default. Callers that
    // care about EIN-style formatting can pre-format.
    return `***-**-${digits.slice(-4)}`;
  }
  if (digits.length === 0) return "";
  return `****${digits.slice(-4)}`;
}

/**
 * Convenience: decrypt-then-mask in one call. Returns "" for null/undefined
 * and never throws (returns "<encrypted>" if decryption fails, so we don't
 * leak ciphertext in API responses).
 */
export function safeMaskTIN(stored: string | null | undefined): string {
  if (!stored) return "";
  try {
    return maskTIN(decrypt(stored));
  } catch {
    return "<encrypted>";
  }
}
