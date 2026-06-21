import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json, jsonError } from "@/lib/api/helpers";
import { notifyDeadlineReminder } from "@/lib/comms/notify";
import { logAuditEvent } from "@/lib/audit/logger";

/**
 * Cron sweep that sends deadline reminders for upcoming and past-due
 * filings + estimated payments. Designed to be hit by a daily scheduler
 * (Vercel cron, Railway cron, GitHub Actions, etc.). Idempotent within a
 * day: each reminder window writes a Communication row tagged with
 * `scope: deadline-reminder` and the deadlineId in metadata; subsequent
 * runs in the same window skip deadlines that already have a row at the
 * same window.
 *
 * Authentication: protected by a shared secret in the `Authorization`
 * header (Bearer <CRON_SECRET>). The scheduler must include this header.
 * In the absence of CRON_SECRET, the endpoint refuses to run.
 *
 * Windows (days remaining):
 *   30 → first nudge
 *   14 → second nudge
 *    7 → final week
 *    3 → critical
 *    1 → tomorrow
 *    0 → due today
 *   -7 → past-due follow-up
 *
 * Pass `?dry=1` to compute the set without sending (useful for cron
 * setup validation).
 */

const REMINDER_WINDOWS = [
  { days: 30, label: "30-day" },
  { days: 14, label: "14-day" },
  { days: 7, label: "7-day" },
  { days: 3, label: "3-day" },
  { days: 1, label: "1-day" },
  { days: 0, label: "today" },
  { days: -7, label: "past-due-7" },
];

function dayIndex(now: Date, target: Date): number {
  const ms = target.getTime() - now.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

interface SweepResult {
  scanned: number;
  windows: { label: string; deadlines: number; sent: number; skipped: number }[];
  dryRun: boolean;
}

async function runSweep(now: Date, dryRun: boolean): Promise<SweepResult> {
  const result: SweepResult = { scanned: 0, windows: [], dryRun };

  for (const window of REMINDER_WINDOWS) {
    // Pull deadlines whose dueDate falls on the same calendar day as
    // now + window.days, anywhere in the system. The scope is bounded by
    // the Deadline → TaxReturn → entity → client → firm join.
    const targetDay = new Date(now);
    targetDay.setHours(0, 0, 0, 0);
    targetDay.setDate(targetDay.getDate() + window.days);
    const nextDay = new Date(targetDay);
    nextDay.setDate(nextDay.getDate() + 1);

    const deadlines = await prisma.deadline.findMany({
      where: { dueDate: { gte: targetDay, lt: nextDay } },
      select: {
        id: true,
        taxReturn: { select: { id: true, status: true } },
      },
    });

    let sent = 0;
    let skipped = 0;

    for (const d of deadlines) {
      result.scanned += 1;

      // Don't bother reminding on terminal statuses.
      if (
        d.taxReturn.status === "EXPORTED" ||
        d.taxReturn.status === "APPROVED"
      ) {
        skipped += 1;
        continue;
      }

      // Skip if we've already sent this exact window for this deadline.
      const already = await prisma.communication.findFirst({
        where: {
          templateId: "deadline-reminder@v1",
          returnId: d.taxReturn.id,
          metadata: {
            path: ["deadlineId"],
            equals: d.id,
          } as never,
        },
        select: { id: true, metadata: true },
      });
      if (already) {
        // Check the window — same window in metadata → skip.
        const meta = already.metadata as { window?: string } | null;
        if (meta?.window === window.label) {
          skipped += 1;
          continue;
        }
      }

      if (dryRun) {
        sent += 1; // would have sent
        continue;
      }

      const outcome = await notifyDeadlineReminder({ deadlineId: d.id });
      if (outcome.sent) {
        // Stamp the window onto the most recently created Communication row
        // for this deadline so the next sweep can detect it.
        await prisma.communication.updateMany({
          where: {
            templateId: "deadline-reminder@v1",
            returnId: d.taxReturn.id,
            metadata: {
              path: ["deadlineId"],
              equals: d.id,
            } as never,
            // Race-safe: pick whichever row was just written.
            createdAt: { gte: new Date(Date.now() - 60_000) },
          },
          data: {
            metadata: {
              deadlineId: d.id,
              window: window.label,
              scope: "deadline-reminder",
            } as never,
          },
        });
        sent += 1;
      } else {
        skipped += 1;
      }
    }

    result.windows.push({
      label: window.label,
      deadlines: deadlines.length,
      sent,
      skipped,
    });
  }

  return result;
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return jsonError(
      "CRON_SECRET is not configured; refuse to run",
      503
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return jsonError("Unauthorized", 401);
  }

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dry") === "1";

  const result = await runSweep(new Date(), dryRun);

  if (!dryRun) {
    const totalSent = result.windows.reduce((s, w) => s + w.sent, 0);
    if (totalSent > 0) {
      await logAuditEvent({
        eventType: "DEADLINE_REMINDERS_SWEPT",
        eventCategory: "DEADLINE",
        description: `Sent ${totalSent} deadline reminder(s) across ${result.scanned} candidate deadline(s)`,
        metadata: { ...result } as never,
        critical: true,
      });
    }
  }

  return json(result);
}

// GET also allowed for easier manual checks from a browser when the secret
// is present in the URL? No — we keep the secret out of URLs and require
// POST so it lives only in the Authorization header.
