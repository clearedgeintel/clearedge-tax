/**
 * Plain-text + HTML templates for the outbound emails the platform sends.
 *
 * Templates are pure functions that return `{ subject, text, html, templateId }`.
 * They never read from the database or the network. Add new templates here
 * and reference their `templateId` from the call site.
 */

interface Rendered {
  subject: string;
  text: string;
  html: string;
  templateId: string;
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 12px 0;color:#0f172a;line-height:1.5">${htmlEscape(text)}</p>`;
}

function wrap(body: string): string {
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;margin:0">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px">
<tr><td style="padding:24px">${body}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b">ClearEdge Tax · sent automatically</td></tr>
</table></body></html>`;
}

interface DocumentRequestArgs {
  clientName: string;
  documentLabels: string[];
  returnLegalName?: string;
  portalUrl: string;
}

/**
 * "We need the following documents from you" — sent when one or more new
 * Document(REQUESTED) rows are created for a client.
 */
export function documentRequestEmail(args: DocumentRequestArgs): Rendered {
  const heading =
    args.documentLabels.length === 1
      ? `We need a document from you`
      : `We need ${args.documentLabels.length} documents from you`;

  const list = args.documentLabels.map((l) => `  • ${l}`).join("\n");
  const text =
    `Hi ${args.clientName},\n\n` +
    (args.returnLegalName
      ? `For your ${args.returnLegalName} return, your preparer is waiting on:\n\n`
      : `Your preparer is waiting on:\n\n`) +
    `${list}\n\n` +
    `Upload them here: ${args.portalUrl}\n\n` +
    `Thanks,\nClearEdge Tax`;

  const htmlList = args.documentLabels
    .map((l) => `<li style="margin-bottom:4px">${htmlEscape(l)}</li>`)
    .join("");
  const body =
    `<h2 style="margin:0 0 16px 0;color:#1b4377;font-size:18px">${htmlEscape(heading)}</h2>` +
    paragraph(`Hi ${args.clientName},`) +
    paragraph(
      args.returnLegalName
        ? `For your ${args.returnLegalName} return, your preparer is waiting on:`
        : `Your preparer is waiting on:`
    ) +
    `<ul style="margin:0 0 16px 20px;color:#0f172a">${htmlList}</ul>` +
    paragraph("Upload them at the link below.") +
    `<p style="margin:0 0 24px 0"><a href="${args.portalUrl}" style="display:inline-block;background:#1b4377;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">Open documents</a></p>` +
    paragraph("Thanks,\nClearEdge Tax");

  return {
    subject: heading,
    text,
    html: wrap(body),
    templateId: "document-request@v1",
  };
}

interface StatusChangeArgs {
  clientName: string;
  returnLegalName: string;
  taxYear: number;
  newStatus:
    | "APPROVED"
    | "REVISION"
    | "EXPORTED"
    | "PREPARATION_BLOCKED"
    | "INTAKE_BLOCKED";
  preparerName?: string;
  note?: string;
  portalUrl: string;
}

/**
 * Status notification — fired when a return advances to a state the client
 * should know about (approved, revision requested, exported, blocked).
 */
export function statusChangeEmail(args: StatusChangeArgs): Rendered {
  const subjectByStatus: Record<StatusChangeArgs["newStatus"], string> = {
    APPROVED: `Your ${args.returnLegalName} (${args.taxYear}) return is approved`,
    REVISION: `Action needed: revisions requested on your ${args.returnLegalName} return`,
    EXPORTED: `Your ${args.returnLegalName} (${args.taxYear}) return has been filed`,
    PREPARATION_BLOCKED: `Your ${args.returnLegalName} return is waiting on upstream data`,
    INTAKE_BLOCKED: `Your ${args.returnLegalName} return is waiting on upstream data`,
  };

  const bodyText: Record<StatusChangeArgs["newStatus"], string> = {
    APPROVED:
      "Your return has been reviewed and approved by your manager. It is ready for export.",
    REVISION:
      "Your preparer has requested revisions on your return. Please review the notes and address the items they've flagged.",
    EXPORTED:
      "Your return has been exported for filing. We'll let you know if anything additional is needed.",
    PREPARATION_BLOCKED:
      "Your return is waiting on data from a related entity (such as a K-1). It will resume automatically once the upstream return is approved.",
    INTAKE_BLOCKED:
      "Your return is waiting on data from a related entity (such as a K-1). It will resume automatically once the upstream return is approved.",
  };

  const text =
    `Hi ${args.clientName},\n\n` +
    `${bodyText[args.newStatus]}\n\n` +
    (args.note ? `Preparer note: ${args.note}\n\n` : "") +
    `View details: ${args.portalUrl}\n\n` +
    `Thanks,\nClearEdge Tax`;

  const body =
    `<h2 style="margin:0 0 16px 0;color:#1b4377;font-size:18px">${htmlEscape(subjectByStatus[args.newStatus])}</h2>` +
    paragraph(`Hi ${args.clientName},`) +
    paragraph(bodyText[args.newStatus]) +
    (args.note
      ? `<blockquote style="margin:0 0 16px 0;padding:12px 16px;background:#f1f5f9;border-left:3px solid #1b4377;color:#334155;font-size:14px">${htmlEscape(args.note)}</blockquote>`
      : "") +
    `<p style="margin:0 0 24px 0"><a href="${args.portalUrl}" style="display:inline-block;background:#1b4377;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">View return</a></p>` +
    paragraph("Thanks,\nClearEdge Tax");

  return {
    subject: subjectByStatus[args.newStatus],
    text,
    html: wrap(body),
    templateId: `status-change-${args.newStatus.toLowerCase()}@v1`,
  };
}

interface DeadlineReminderArgs {
  clientName: string;
  returnLegalName: string;
  deadlineLabel: string;
  dueDate: string; // pre-formatted, e.g., "April 15, 2026"
  daysRemaining: number;
  portalUrl: string;
}

/**
 * Upcoming deadline reminder. Used by a scheduled job, not surfaced
 * inline from the request path.
 */
export function deadlineReminderEmail(args: DeadlineReminderArgs): Rendered {
  const subject =
    args.daysRemaining <= 0
      ? `Overdue: ${args.deadlineLabel} for ${args.returnLegalName}`
      : `${args.daysRemaining} day${args.daysRemaining === 1 ? "" : "s"} until ${args.deadlineLabel}`;

  const text =
    `Hi ${args.clientName},\n\n` +
    `Reminder: ${args.deadlineLabel} for your ${args.returnLegalName} return is due ${args.dueDate}` +
    (args.daysRemaining > 0
      ? ` (${args.daysRemaining} day${args.daysRemaining === 1 ? "" : "s"} away).`
      : args.daysRemaining === 0
        ? ` — that's today.`
        : ` — ${Math.abs(args.daysRemaining)} day${Math.abs(args.daysRemaining) === 1 ? "" : "s"} ago.`) +
    `\n\nDetails: ${args.portalUrl}\n\nThanks,\nClearEdge Tax`;

  const body =
    `<h2 style="margin:0 0 16px 0;color:#1b4377;font-size:18px">${htmlEscape(subject)}</h2>` +
    paragraph(`Hi ${args.clientName},`) +
    paragraph(
      `${args.deadlineLabel} for your ${args.returnLegalName} return is due ${args.dueDate}.`
    ) +
    `<p style="margin:0 0 24px 0"><a href="${args.portalUrl}" style="display:inline-block;background:#1b4377;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">Open return</a></p>` +
    paragraph("Thanks,\nClearEdge Tax");

  return {
    subject,
    text,
    html: wrap(body),
    templateId: "deadline-reminder@v1",
  };
}
