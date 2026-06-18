import { createHmac, timingSafeEqual } from "node:crypto";
import type { SignatureStatus } from "@/generated/prisma/enums";
import type {
  SendSignatureRequestInput,
  SendSignatureRequestResult,
  SignatureProvider,
  SignatureProviderStatus,
} from "./provider";

/**
 * BoldSign REST API client.
 *
 * Docs: https://developers.boldsign.com/
 *
 * Status mapping (BoldSign → ours):
 *   Sent       → SENT
 *   Viewed     → VIEWED
 *   Completed  → SIGNED
 *   Declined   → DECLINED
 *   Expired    → EXPIRED
 *   Revoked    → CANCELLED
 *   Failed     → FAILED
 *
 * When BOLDSIGN_API_KEY isn't set, every call throws with a clear error.
 * The service layer catches and writes a FAILED row so the request is
 * still visible and retriable.
 */

const API_BASE = "https://api.boldsign.com";

const BOLDSIGN_TO_OURS: Record<string, SignatureStatus> = {
  Sent: "SENT",
  Delivered: "SENT",
  Viewed: "VIEWED",
  InProgress: "VIEWED",
  Completed: "SIGNED",
  Signed: "SIGNED",
  Declined: "DECLINED",
  Expired: "EXPIRED",
  Revoked: "CANCELLED",
  Failed: "FAILED",
};

function mapStatus(boldsignStatus: string): SignatureStatus {
  return BOLDSIGN_TO_OURS[boldsignStatus] || "SENT";
}

interface BoldsignProperties {
  documentId: string;
  status: string;
  sentDate?: string;
  viewedDate?: string;
  completedDate?: string;
  declinedDate?: string;
  expiryDate?: string;
  signerDetails?: Array<{ status?: string; viewedDate?: string }>;
  messages?: string[];
}

class BoldSignProvider implements SignatureProvider {
  readonly name = "boldsign";

  isConfigured(): boolean {
    return !!process.env.BOLDSIGN_API_KEY;
  }

  private apiKey(): string {
    const key = process.env.BOLDSIGN_API_KEY;
    if (!key) {
      throw new Error(
        "BOLDSIGN_API_KEY is not set. The signature was recorded as FAILED; configure the key and retry."
      );
    }
    return key;
  }

  private webhookSecret(): string | null {
    return process.env.BOLDSIGN_WEBHOOK_SECRET || null;
  }

  async send(
    input: SendSignatureRequestInput
  ): Promise<SendSignatureRequestResult> {
    const apiKey = this.apiKey();

    const form = new FormData();
    const blob = new Blob([new Uint8Array(input.pdf)], {
      type: "application/pdf",
    });
    form.append("Files", blob, input.pdfFilename);

    // BoldSign accepts a JSON DocumentDetails payload alongside the file(s).
    const details = {
      title: input.documentName,
      message: input.message,
      signers: [
        {
          name: input.signer.name,
          emailAddress: input.signer.email,
          signerType: "Signer",
          signerOrder: 1,
          formFields: [
            {
              fieldType: "Signature",
              pageNumber: 1,
              bounds: { x: 100, y: 100, width: 200, height: 50 },
              isRequired: true,
            },
          ],
        },
      ],
      cc: (input.ccEmails || []).map((email) => ({ emailAddress: email })),
      expiryDateType: "Days",
      expiryValue: input.expiresAt
        ? Math.max(
            1,
            Math.ceil(
              (input.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            )
          )
        : 30,
      reminderSettings: {
        enableAutoReminder: true,
        reminderDays: 3,
        reminderCount: 3,
      },
      brandId: process.env.BOLDSIGN_BRAND_ID || undefined,
      // Round-trip metadata.
      labels: ["ClearEdgeTax", `req-${input.ourRequestId}`],
    };

    form.append("DocumentDetails", JSON.stringify(details));

    const res = await fetch(`${API_BASE}/v1/document/send`, {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
      },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`BoldSign send failed (${res.status}): ${body.slice(0, 500)}`);
    }

    const data = (await res.json()) as { documentId?: string; signerLinks?: { signLink: string }[] };
    if (!data.documentId) {
      throw new Error("BoldSign response missing documentId");
    }

    return {
      providerDocumentId: data.documentId,
      signerUrl: data.signerLinks?.[0]?.signLink,
    };
  }

  async fetchStatus(
    providerDocumentId: string
  ): Promise<SignatureProviderStatus> {
    const apiKey = this.apiKey();
    const res = await fetch(
      `${API_BASE}/v1/document/properties?documentId=${encodeURIComponent(providerDocumentId)}`,
      { headers: { "X-API-KEY": apiKey } }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`BoldSign status fetch failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const props = (await res.json()) as BoldsignProperties;
    return this.translateProperties(props);
  }

  private translateProperties(props: BoldsignProperties): SignatureProviderStatus {
    return {
      status: mapStatus(props.status),
      viewedAt: props.viewedDate ? new Date(props.viewedDate) : undefined,
      signedAt: props.completedDate ? new Date(props.completedDate) : undefined,
      declinedAt: props.declinedDate ? new Date(props.declinedDate) : undefined,
      expiresAt: props.expiryDate ? new Date(props.expiryDate) : undefined,
      message: props.messages?.join("; "),
    };
  }

  async cancel(providerDocumentId: string, reason?: string): Promise<void> {
    const apiKey = this.apiKey();
    const res = await fetch(`${API_BASE}/v1/document/revoke`, {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documentId: providerDocumentId,
        message: reason || "Cancelled by firm staff",
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`BoldSign cancel failed (${res.status}): ${body.slice(0, 200)}`);
    }
  }

  async downloadSigned(providerDocumentId: string): Promise<Buffer> {
    const apiKey = this.apiKey();
    const res = await fetch(
      `${API_BASE}/v1/document/download?documentId=${encodeURIComponent(providerDocumentId)}`,
      { headers: { "X-API-KEY": apiKey } }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`BoldSign download failed (${res.status}): ${body.slice(0, 200)}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  parseWebhook(
    payload: unknown,
    signature?: string
  ): {
    providerDocumentId: string;
    status: SignatureProviderStatus;
  } | null {
    // Verify signature when a secret is configured. BoldSign signs the raw
    // request body with HMAC-SHA256 using the configured webhook secret.
    const secret = this.webhookSecret();
    if (secret && signature) {
      const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
      const expected = createHmac("sha256", secret).update(raw).digest("hex");
      const got = signature.replace(/^sha256=/, "");
      const a = Buffer.from(expected);
      const b = Buffer.from(got);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new Error("BoldSign webhook signature mismatch");
      }
    }

    if (!payload || typeof payload !== "object") return null;
    const data = payload as Record<string, unknown>;

    // BoldSign event shapes vary; we look for documentId + statuses we care
    // about. Unknown event types return null.
    const docId =
      (data.documentId as string | undefined) ||
      (data.DocumentId as string | undefined) ||
      ((data.data as Record<string, unknown> | undefined)?.documentId as string | undefined);
    if (!docId) return null;

    const statusRaw =
      (data.status as string | undefined) ||
      (data.eventType as string | undefined) ||
      ((data.data as Record<string, unknown> | undefined)?.status as string | undefined);
    if (!statusRaw) return null;

    return {
      providerDocumentId: docId,
      status: this.translateProperties({
        documentId: docId,
        status: statusRaw,
        viewedDate: (data.viewedDate as string | undefined) ?? undefined,
        completedDate: (data.completedDate as string | undefined) ?? undefined,
        declinedDate: (data.declinedDate as string | undefined) ?? undefined,
        expiryDate: (data.expiryDate as string | undefined) ?? undefined,
      }),
    };
  }
}

export const boldsign = new BoldSignProvider();

// Exposed for tests that exercise pure logic without making network calls.
export const __test = {
  mapStatus,
};
