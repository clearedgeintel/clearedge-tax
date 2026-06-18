import { NextRequest } from "next/server";
import {
  applyProviderStatus,
  boldsign,
  findByProviderDocumentId,
} from "@/lib/signatures";
import { logAuditEvent } from "@/lib/audit/logger";

/**
 * Webhook receiver for BoldSign status events.
 *
 * Configured URL in BoldSign:
 *   https://<your-host>/api/webhooks/boldsign
 *
 * Signature verification happens inside boldsign.parseWebhook, gated on
 * BOLDSIGN_WEBHOOK_SECRET being set. Unknown event types return 200 with
 * no action so BoldSign doesn't retry forever.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature =
    req.headers.get("x-boldsign-signature") ||
    req.headers.get("x-signature") ||
    undefined;

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  let parsed: ReturnType<typeof boldsign.parseWebhook>;
  try {
    parsed = boldsign.parseWebhook(payload, signature);
  } catch (e) {
    // Signature mismatch — let BoldSign know we rejected it.
    return new Response(
      e instanceof Error ? e.message : "signature mismatch",
      { status: 401 }
    );
  }

  if (!parsed) return new Response("ignored", { status: 200 });

  const row = await findByProviderDocumentId(parsed.providerDocumentId);
  if (!row) {
    // Webhook for a request we don't know about (e.g. cross-environment
    // collision). Acknowledge so BoldSign doesn't retry.
    return new Response("unknown document id", { status: 200 });
  }

  await applyProviderStatus(row.id, parsed.status);

  // Critical-priority audit on terminal transitions so they always flush
  // to the DB even on the buffered path.
  if (
    parsed.status.status === "SIGNED" ||
    parsed.status.status === "DECLINED" ||
    parsed.status.status === "EXPIRED"
  ) {
    await logAuditEvent({
      returnId: row.returnId || undefined,
      eventType: `SIGNATURE_${parsed.status.status}`,
      eventCategory: "SIGNATURE",
      description: `Signature request ${row.id} transitioned to ${parsed.status.status}`,
      metadata: {
        signatureRequestId: row.id,
        providerDocumentId: parsed.providerDocumentId,
      },
      critical: true,
    });
  }

  return new Response("ok", { status: 200 });
}
