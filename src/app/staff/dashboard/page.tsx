import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { daysUntilDeadline, deadlineSeverity } from "@/lib/deadlines/calculator";
import { format, formatDistanceToNow } from "date-fns";
import {
  PageHeader,
  Stat,
  Card,
  CardHeader,
  Badge,
  EmptyState,
  ReturnStatusPill,
} from "@/components/ui";
import { Calendar, CheckCircle2, Inbox } from "lucide-react";

const SEVERITY_TONE: Record<
  ReturnType<typeof deadlineSeverity>,
  "danger" | "warning" | "success" | "neutral"
> = {
  overdue: "danger",
  critical: "danger",
  warning: "warning",
  normal: "success",
};

export default async function StaffDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const firmId = session.user.firmId!;

  const [intakeCount, prepCount, reviewCount, blockedCount] = await Promise.all([
    prisma.taxReturn.count({
      where: { entity: { client: { firmId } }, status: "INTAKE" },
    }),
    prisma.taxReturn.count({
      where: { entity: { client: { firmId } }, status: "PREPARATION" },
    }),
    prisma.taxReturn.count({
      where: { entity: { client: { firmId } }, status: "REVIEW" },
    }),
    prisma.taxReturn.count({
      where: { entity: { client: { firmId } }, isBlocked: true },
    }),
  ]);

  const now = new Date();
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcomingDeadlines = await prisma.deadline.findMany({
    where: {
      taxReturn: { entity: { client: { firmId } } },
      dueDate: { gte: now, lte: thirtyDaysOut },
    },
    orderBy: { dueDate: "asc" },
    take: 10,
    include: {
      taxReturn: {
        select: {
          id: true,
          taxYear: true,
          status: true,
          entity: { select: { legalName: true, entityType: true } },
        },
      },
    },
  });

  const recentActivity = await prisma.auditEvent.findMany({
    where: {
      OR: [
        { taxReturn: { entity: { client: { firmId } } } },
        { user: { firmId } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      user: { select: { name: true } },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Staff"
        title={`Hey, ${session.user.name.split(" ")[0]}`}
        description="Your firm's workload at a glance — open work, blockers, and what's due next."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="In intake"
          value={intakeCount}
          tone="brand"
          href="/staff/returns?status=INTAKE"
        />
        <Stat
          label="In preparation"
          value={prepCount}
          tone="accent"
          href="/staff/returns?status=PREPARATION"
        />
        <Stat
          label="Pending review"
          value={reviewCount}
          tone="warning"
          href="/staff/returns?status=REVIEW"
        />
        <Stat
          label="Blocked"
          value={blockedCount}
          tone={blockedCount > 0 ? "danger" : "neutral"}
          description="Waiting on K-1 or upstream"
          href="/staff/returns?isBlocked=true"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card flush>
            <CardHeader
              title="Upcoming deadlines"
              description="Filings, extensions, and estimated payments in the next 30 days"
              actions={
                <Link
                  href="/staff/queue"
                  className="text-xs font-medium text-brand-700 hover:text-brand-800"
                >
                  Open work queue →
                </Link>
              }
            />
            {upcomingDeadlines.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  title="Nothing due in the next 30 days"
                />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-muted border-b border-border-subtle text-xs uppercase tracking-wide text-ink-subtle">
                  <tr>
                    <th className="text-left px-5 py-2.5 font-medium">Entity</th>
                    <th className="text-left px-5 py-2.5 font-medium">Type</th>
                    <th className="text-left px-5 py-2.5 font-medium">Due</th>
                    <th className="text-left px-5 py-2.5 font-medium">When</th>
                    <th className="text-left px-5 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {upcomingDeadlines.map((dl) => {
                    const days = daysUntilDeadline(dl.dueDate);
                    const severity = deadlineSeverity(days);
                    return (
                      <tr key={dl.id} className="hover:bg-surface-muted/60">
                        <td className="px-5 py-2.5">
                          <Link
                            href={`/staff/returns/${dl.taxReturn.id}`}
                            className="font-medium text-ink hover:text-brand-700"
                          >
                            {dl.taxReturn.entity.legalName}
                          </Link>
                          <div className="text-xs text-ink-subtle">
                            TY {dl.taxReturn.taxYear}
                          </div>
                        </td>
                        <td className="px-5 py-2.5 text-xs text-ink-muted">
                          {dl.deadlineType.replace(/_/g, " ")}
                        </td>
                        <td className="px-5 py-2.5 text-sm text-ink whitespace-nowrap">
                          {format(dl.dueDate, "MMM d, yyyy")}
                        </td>
                        <td className="px-5 py-2.5 whitespace-nowrap">
                          <Badge tone={SEVERITY_TONE[severity]}>
                            {days < 0
                              ? `${Math.abs(days)}d overdue`
                              : days === 0
                                ? "Today"
                                : `${days}d left`}
                          </Badge>
                        </td>
                        <td className="px-5 py-2.5 whitespace-nowrap">
                          <ReturnStatusPill status={dl.taxReturn.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <Card flush>
          <CardHeader
            title="Recent activity"
            description="Audit events from the firm"
          />
          {recentActivity.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Inbox className="h-5 w-5" />}
                title="No recent activity"
              />
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {recentActivity.map((event) => (
                <li key={event.id} className="px-5 py-3">
                  <p className="text-sm text-ink">{event.description}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-ink-subtle">
                    <span>{event.user?.name || "System"}</span>
                    <span>·</span>
                    <Badge tone="neutral">{event.eventCategory}</Badge>
                    <span className="ml-auto inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDistanceToNow(event.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
