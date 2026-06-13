import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { RETURN_STATUS_LABELS, ENTITY_TYPE_LABELS } from "@/types/entities";
import { daysUntilDeadline, deadlineSeverity } from "@/lib/deadlines/calculator";
import { format } from "date-fns";
import type { ReturnStatus } from "@/generated/prisma/enums";
import {
  PageHeader,
  Card,
  Badge,
  EmptyState,
  ReturnStatusPill,
} from "@/components/ui";
import { FileText, AlertTriangle } from "lucide-react";

const SEVERITY_TONE: Record<
  ReturnType<typeof deadlineSeverity>,
  "danger" | "warning" | "success" | "neutral"
> = {
  overdue: "danger",
  critical: "danger",
  warning: "warning",
  normal: "success",
};

const ORDERED_STATUSES: ReturnStatus[] = [
  "INTAKE",
  "INTAKE_BLOCKED",
  "PREPARATION",
  "PREPARATION_BLOCKED",
  "REVIEW",
  "REVISION",
  "APPROVED",
  "EXPORTED",
];

interface Props {
  searchParams: Promise<{
    status?: string;
    isBlocked?: string;
    entityId?: string;
    clientId?: string;
  }>;
}

export default async function StaffReturns({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const firmId = session.user.firmId!;
  const params = await searchParams;
  const statusFilter = params.status as ReturnStatus | undefined;
  const blockedFilter = params.isBlocked === "true";

  const returns = await prisma.taxReturn.findMany({
    where: {
      entity: { client: { firmId } },
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(blockedFilter ? { isBlocked: true } : {}),
      ...(params.entityId ? { entityId: params.entityId } : {}),
      ...(params.clientId ? { entity: { clientId: params.clientId } } : {}),
    },
    orderBy: { updatedAt: "desc" },
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

  const noActiveFilter = !statusFilter && !blockedFilter;

  return (
    <>
      <PageHeader
        eyebrow="Staff"
        title="All returns"
        description={`${returns.length} return${returns.length === 1 ? "" : "s"}${
          statusFilter ? ` in ${RETURN_STATUS_LABELS[statusFilter]}` : ""
        }${blockedFilter ? " · blocked" : ""}.`}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterPill
          href="/staff/returns"
          active={noActiveFilter}
          label="All"
        />
        <FilterPill
          href="/staff/returns?isBlocked=true"
          active={blockedFilter}
          label="Blocked"
          tone="warning"
        />
        {ORDERED_STATUSES.map((status) => (
          <FilterPill
            key={status}
            href={`/staff/returns?status=${status}`}
            active={statusFilter === status}
            label={RETURN_STATUS_LABELS[status]}
          />
        ))}
      </div>

      {returns.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="No returns match"
          description="Try a different filter or clear the current one."
        />
      ) : (
        <Card flush>
          <table className="w-full text-sm">
            <thead className="bg-surface-muted border-b border-border-subtle text-xs uppercase tracking-wide text-ink-subtle">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Entity</th>
                <th className="text-left px-5 py-3 font-medium">Client</th>
                <th className="text-left px-5 py-3 font-medium">Year</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-left px-5 py-3 font-medium">Preparer</th>
                <th className="text-left px-5 py-3 font-medium">Deadline</th>
                <th className="text-left px-5 py-3 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {returns.map((ret) => {
                const filingDeadline = ret.deadlines[0];
                const days = filingDeadline
                  ? daysUntilDeadline(filingDeadline.dueDate)
                  : null;
                const severity =
                  days !== null ? deadlineSeverity(days) : "normal";

                return (
                  <tr key={ret.id} className="hover:bg-surface-muted/60">
                    <td className="px-5 py-3">
                      <Link
                        href={`/staff/returns/${ret.id}`}
                        className="font-medium text-ink hover:text-brand-700"
                      >
                        {ret.entity.legalName}
                      </Link>
                      <p className="text-xs text-ink-subtle">
                        {ENTITY_TYPE_LABELS[ret.entity.entityType]}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-sm text-ink-muted">
                      {ret.entity.client.displayName}
                    </td>
                    <td className="px-5 py-3 text-sm text-ink-muted tabular-nums">
                      {ret.taxYear}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <ReturnStatusPill status={ret.status} />
                        {ret.isBlocked && ret.blockedReason && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-warning">
                            <AlertTriangle className="h-3 w-3" />
                            {ret.blockedReason}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-ink-muted">
                      {ret.preparer?.name || (
                        <span className="text-ink-subtle">Unassigned</span>
                      )}
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
                    <td className="px-5 py-3 text-xs text-ink-muted">
                      {ret._count.interviewResponses} answers ·{" "}
                      {ret._count.documents} docs
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

function FilterPill({
  href,
  active,
  label,
  tone,
}: {
  href: string;
  active: boolean;
  label: string;
  tone?: "warning";
}) {
  const base =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors";
  if (active) {
    if (tone === "warning") {
      return (
        <Link
          href={href}
          className={`${base} bg-warning text-white shadow-sm`}
        >
          {label}
        </Link>
      );
    }
    return (
      <Link
        href={href}
        className={`${base} bg-brand-700 text-white shadow-sm`}
      >
        {label}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} bg-surface-muted text-ink-muted hover:bg-brand-50 hover:text-brand-700`}
    >
      {label}
    </Link>
  );
}
