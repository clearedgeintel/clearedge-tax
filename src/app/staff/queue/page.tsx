import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ENTITY_TYPE_LABELS } from "@/types/entities";
import { daysUntilDeadline, deadlineSeverity } from "@/lib/deadlines/calculator";
import { format } from "date-fns";
import {
  PageHeader,
  Card,
  Badge,
  EmptyState,
  ReturnStatusPill,
} from "@/components/ui";
import { Inbox, ArrowRight } from "lucide-react";

const SEVERITY_TONE: Record<
  ReturnType<typeof deadlineSeverity>,
  "danger" | "warning" | "success" | "neutral"
> = {
  overdue: "danger",
  critical: "danger",
  warning: "warning",
  normal: "success",
};

export default async function StaffQueue() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const firmId = session.user.firmId!;
  const userId = session.user.id;

  const assignedReturns = await prisma.taxReturn.findMany({
    where: {
      entity: { client: { firmId } },
      status: { notIn: ["EXPORTED"] },
      OR: [{ preparerId: userId }, { reviewerId: userId }],
    },
    include: {
      entity: {
        select: {
          legalName: true,
          entityType: true,
          client: { select: { displayName: true } },
        },
      },
      preparer: { select: { name: true } },
      reviewer: { select: { name: true } },
      deadlines: {
        where: { deadlineType: "FILING" },
        orderBy: { dueDate: "asc" },
        take: 1,
      },
      _count: { select: { documents: true, interviewResponses: true } },
    },
  });

  // Sort by deadline urgency (closest first), nulls last.
  assignedReturns.sort((a, b) => {
    const ad = a.deadlines[0]?.dueDate?.getTime();
    const bd = b.deadlines[0]?.dueDate?.getTime();
    if (ad === undefined && bd === undefined) return 0;
    if (ad === undefined) return 1;
    if (bd === undefined) return -1;
    return ad - bd;
  });

  const blockedCount = assignedReturns.filter((r) => r.isBlocked).length;

  return (
    <>
      <PageHeader
        eyebrow="Staff"
        title="Work queue"
        description="Returns assigned to you, sorted by deadline urgency."
        meta={
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge tone="brand">{assignedReturns.length} assigned</Badge>
            {blockedCount > 0 && (
              <Badge tone="warning">{blockedCount} blocked</Badge>
            )}
          </div>
        }
      />

      {assignedReturns.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="No returns in your queue"
          description="When something is assigned to you as preparer or reviewer, it will show up here."
        />
      ) : (
        <Card flush>
          <table className="w-full text-sm">
            <thead className="bg-surface-muted border-b border-border-subtle text-xs uppercase tracking-wide text-ink-subtle">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Entity</th>
                <th className="text-left px-5 py-3 font-medium">Client</th>
                <th className="text-left px-5 py-3 font-medium">Type</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-left px-5 py-3 font-medium">Filing deadline</th>
                <th className="text-left px-5 py-3 font-medium">Role</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {assignedReturns.map((ret) => {
                const filingDeadline = ret.deadlines[0];
                const days = filingDeadline
                  ? daysUntilDeadline(filingDeadline.dueDate)
                  : null;
                const severity =
                  days !== null ? deadlineSeverity(days) : "normal";
                const myRole =
                  ret.preparerId === userId ? "Preparer" : "Reviewer";

                return (
                  <tr key={ret.id} className="hover:bg-surface-muted/60">
                    <td className="px-5 py-3">
                      <Link
                        href={`/staff/returns/${ret.id}`}
                        className="font-medium text-ink hover:text-brand-700"
                      >
                        {ret.entity.legalName}
                      </Link>
                      <p className="text-xs text-ink-subtle">TY {ret.taxYear}</p>
                    </td>
                    <td className="px-5 py-3 text-sm text-ink-muted">
                      {ret.entity.client.displayName}
                    </td>
                    <td className="px-5 py-3 text-xs text-ink-muted">
                      {ENTITY_TYPE_LABELS[ret.entity.entityType]}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <ReturnStatusPill status={ret.status} />
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {filingDeadline ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-ink">
                            {format(filingDeadline.dueDate, "MMM d, yyyy")}
                          </span>
                          <Badge tone={SEVERITY_TONE[severity]}>
                            {days! < 0
                              ? `${Math.abs(days!)}d overdue`
                              : days === 0
                                ? "Today"
                                : `${days}d`}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-xs text-ink-subtle">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={myRole === "Preparer" ? "info" : "brand"}>
                        {myRole}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/staff/returns/${ret.id}`}
                        className="inline-flex items-center text-ink-subtle hover:text-brand-700"
                        aria-label="Open return"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
