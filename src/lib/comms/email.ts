import { Resend } from "resend";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Outbound email sender. Every send attempt is recorded in the
 * Communication table so we always have an audit trail of what went out
 * (or tried to). When RESEND_API_KEY isn't set — for example in CI or a
 * developer's local environment — the helper still logs the attempt but
 * leaves the row in QUEUED status and reports `stubbed`. That lets the
 * rest of the app exercise the comms flow without flipping a real send
 * to a real client.
 */

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.RESEND_FROM_EMAIL || "no-reply@clearedgetax.com";

let resend: Resend | null = null;
function getResend(): Resend | null {
  if (apiKey && !resend) resend = new Resend(apiKey);
  return resend;
}

export interface SendEmailOpts {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Which client the message is about (required for Communication scoping). */
  clientId: string;
  /** Optional: the return the message relates to. */
  returnId?: string;
  /** Optional: a stable identifier for the template that produced this email. */
  templateId?: string;
  /** Optional: extra metadata stored on the Communication row. */
  metadata?: Record<string, unknown>;
}

export type SendResult =
  | { id: string; status: "sent" }
  | { id: string; status: "stubbed"; reason: string }
  | { id: string; status: "failed"; error: string };

export async function sendEmail(opts: SendEmailOpts): Promise<SendResult> {
  const communication = await prisma.communication.create({
    data: {
      clientId: opts.clientId,
      returnId: opts.returnId,
      channel: "EMAIL",
      templateId: opts.templateId,
      subject: opts.subject,
      body: opts.text,
      direction: "OUTBOUND",
      status: "QUEUED",
      metadata: opts.metadata
        ? (opts.metadata as Prisma.InputJsonValue)
        : undefined,
    },
  });

  const client = getResend();
  if (!client) {
    return {
      id: communication.id,
      status: "stubbed",
      reason: "RESEND_API_KEY not set — email logged but not sent",
    };
  }

  try {
    const result = await client.emails.send({
      from: fromAddress,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    await prisma.communication.update({
      where: { id: communication.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        metadata: {
          ...(opts.metadata || {}),
          providerId: result.data?.id,
        } as Prisma.InputJsonValue,
      },
    });
    return { id: communication.id, status: "sent" };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await prisma.communication.update({
      where: { id: communication.id },
      data: {
        status: "FAILED",
        metadata: { ...(opts.metadata || {}), error } as Prisma.InputJsonValue,
      },
    });
    return { id: communication.id, status: "failed", error };
  }
}

/** Test/inspection helper — surfaces whether the helper would actually send. */
export function emailConfigured(): boolean {
  return !!apiKey;
}
