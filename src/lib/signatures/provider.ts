/**
 * Provider abstraction for e-signature services. BoldSign is the first
 * implementation. Adding DocuSign / HelloSign / etc. later is one file
 * each + a registry entry.
 *
 * The provider's job is narrow: take a PDF and signer info, return an
 * opaque providerDocumentId, and translate webhook/poll payloads back
 * into our canonical SignatureStatus enum.
 */

import type { SignatureStatus } from "@/generated/prisma/enums";

export interface SendSignatureRequestInput {
  /** Stable id from our side; some providers echo this back in webhooks. */
  ourRequestId: string;
  /** Display name in the signing UI (and email subject suffix). */
  documentName: string;
  /** PDF bytes. */
  pdf: Buffer;
  /** Filename hint for the provider's UI. */
  pdfFilename: string;
  signer: {
    email: string;
    name: string;
  };
  ccEmails?: string[];
  subject?: string;
  message?: string;
  /** Optional ISO-8601 expiry; provider clamps to its own max if shorter. */
  expiresAt?: Date;
}

export interface SendSignatureRequestResult {
  providerDocumentId: string;
  /** Optional embedded signing link the client can also reach via email. */
  signerUrl?: string;
}

export interface SignatureProviderStatus {
  status: SignatureStatus;
  viewedAt?: Date;
  signedAt?: Date;
  declinedAt?: Date;
  expiresAt?: Date;
  /** Provider-side error or decline note when present. */
  message?: string;
}

export interface SignatureProvider {
  readonly name: string;
  /** True when the provider has the credentials it needs to talk to the API. */
  isConfigured(): boolean;
  send(input: SendSignatureRequestInput): Promise<SendSignatureRequestResult>;
  fetchStatus(providerDocumentId: string): Promise<SignatureProviderStatus>;
  cancel(providerDocumentId: string, reason?: string): Promise<void>;
  /** Download the fully-signed PDF. Throws if not yet completed. */
  downloadSigned(providerDocumentId: string): Promise<Buffer>;
  /**
   * Parse a webhook payload into our canonical status. Returns null when
   * the event isn't one we care about (e.g. provider-side internal events).
   * Throws on signature/secret mismatch.
   */
  parseWebhook(payload: unknown, signature?: string): {
    providerDocumentId: string;
    status: SignatureProviderStatus;
  } | null;
}
