import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/utils/permissions";
import {
  PageHeader,
  Stat,
  Card,
  CardHeader,
  Badge,
  EmptyState,
  Button,
  ReturnStatusPill,
} from "@/components/ui";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FileText,
  Users as UsersIcon,
} from "lucide-react";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isAdmin(session.user.role)) redirect("/staff/dashboard");

  const firmId = session.user.firmId!;
  const now = new Date();
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    firm,
    activeClients,
    activeUsers,
    returnsTotal,
    returnsByStatus,
    blockedReturns,
    upcomingDeadlines,
    recentEvents,
  ] = await Promise.all([
    prisma.firm.findUnique({ where: { id: firmId } }),
    prisma.client.count({ where: { firmId, isActive: true } }),
    prisma.user.count({ where: { firmId, isActive: true } }),
    prisma.taxReturn.count({
      where: { entity: { client: { firmId } } },
    }),
    prisma.taxReturn.groupBy({
      by: ["status"],
      where: { entity: { client: { firmId } } },
      _count: { status: true },
    }),
    prisma.taxReturn.findMany({
      where: {
        entity: { client: { firmId } },
        isBlocked: true,
      },
      include: {
        entity: { select: { legalName: true, entityType: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.deadline.findMany({
      where: {
        taxReturn: { entity: { client: { firmId } } },
        dueDate: { gte: now, lte: sevenDaysOut },
      },
      include: {
        taxReturn: {
          select: {
            id: true,
            taxYear: true,
            entity: { select: { legalName: true } },
          },
        },
      },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    prisma.auditEvent.findMany({
      where: {
        OR: [
          { user: { firmId } },
          { taxReturn: { entity: { client: { firmId } } } },
        ],
      },
      include: {
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  returnsByStatus.forEach((r) => {
    statusCounts[r.status] = r._count.status;
  });
  const inFlight =
    (statusCounts.INTAKE || 0) +
    (statusCounts.INTAKE_BLOCKED || 0) +
    (statusCounts.PREPARATION || 0) +
    (statusCounts.PREPARATION_BLOCKED || 0) +
    (statusCounts.REVIEW || 0) +
    (statusCounts.REVISION || 0);
  const exported = statusCounts.EXPORTED || 0;

  return (
    <>
      <PageHeader
        eyebrow="Firm administration"
        title={`Welcome, ${session.user.name.split(" ")[0]}`}
        description={
          firm
            ? `${firm.name} — firm-wide health and activity.`
            : "Firm-wide health and activity."
        }
        actions={
          <Button href="/admin/users" variant="secondary" size="sm">
            Manage users
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Active clients"
          value={activeClients}
          tone="brand"
          href="/staff/clients"
        />
        <Stat
          label="Active users"
          value={activeUsers}
          tone="accent"
          href="/admin/users"
        />
        <Stat
          label="Returns in flight"
          value={inFlight}
          description={`${returnsTotal} total · ${exported} exported`}
          tone="neutral"
          href="/staff/returns"
        />
        <Stat
          label="Blocked returns"
          value={blockedReturns.length}
          description="Waiting on K-1 or other upstream"
          tone={blockedReturns.length > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card flush>
          <CardHeader
            title="Returns by status"
            description="Across every active engagement"
          />
          <div className="divide-y divide-border-subtle">
            {(
              [
                "INTAKE",
                "INTAKE_BLOCKED",
                "PREPARATION",
                "PREPARATION_BLOCKED",
                "REVIEW",
                "REVISION",
                "APPROVED",
                "EXPORTED",
              ] as const
            ).map((s) => (
              <div
                key={s}
                className="flex items-center justify-between px-5 py-2.5"
              >
                <ReturnStatusPill status={s} />
                <span className="text-sm font-semibold tabular-nums text-ink">
                  {statusCounts[s] || 0}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card flush>
          <CardHeader
            title="Deadlines in the next 7 days"
            description="Federal and state filings, extensions, estimated payments"
            actions={
              <Link
                href="/staff/queue"
                className="text-xs font-medium text-brand-700 hover:text-brand-800"
              >
                Work queue →
              </Link>
            }
          />
          {upcomingDeadlines.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<CheckCircle2 className="h-5 w-5" />}
                title="Nothing due this week"
                description="No upcoming deadlines within the next 7 days."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {upcomingDeadlines.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink truncate">
                      {d.taxReturn.entity.legalName}
                    </div>
                    <div className="text-xs text-ink-subtle">
                      {d.deadlineType.replace(/_/g, " ")} · TY {d.taxReturn.taxYear}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-medium text-ink">
                      {format(d.dueDate, "MMM d")}
                    </div>
                    <div className="text-[10px] text-ink-subtle">
                      {formatDistanceToNow(d.dueDate, { addSuffix: true })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card flush>
          <CardHeader
            title="Blocked returns"
            description="Returns awaiting K-1 or other upstream resolution"
          />
          {blockedReturns.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<CheckCircle2 className="h-5 w-5" />}
                title="No blockers"
                description="Every active return can advance to the next phase."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {blockedReturns.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-ink-subtle shrink-0" />
                      <Link
                        href={`/staff/returns/${r.id}`}
                        className="text-sm font-medium text-ink hover:text-brand-700 truncate"
                      >
                        {r.entity.legalName}
                      </Link>
                    </div>
                    <div className="mt-0.5 text-xs text-ink-subtle truncate">
                      {r.blockedReason || "Blocked"}
                    </div>
                  </div>
                  <ReturnStatusPill status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card flush>
          <CardHeader
            title="Recent activity"
            description="Audit events from the firm"
            actions={
              <Link
                href="/admin/audit"
                className="text-xs font-medium text-brand-700 hover:text-brand-800"
              >
                Audit log →
              </Link>
            }
          />
          {recentEvents.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Calendar className="h-5 w-5" />}
                title="No activity yet"
                description="Once your team starts working, events will appear here."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {recentEvents.map((e) => (
                <li key={e.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-ink truncate">
                        {e.description}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-ink-subtle">
                        <span>{e.user?.name || "System"}</span>
                        <span>·</span>
                        <Badge tone="neutral">{e.eventCategory}</Badge>
                      </div>
                    </div>
                    <span className="text-[11px] text-ink-subtle shrink-0">
                      {formatDistanceToNow(e.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {!firm && (
        <Card className="mt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-ink">
                Firm record not found
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                Your admin account isn&apos;t linked to a firm yet. Contact
                support or visit firm settings to set one up.
              </p>
              <Button href="/admin/firm" variant="primary" size="sm" className="mt-3">
                <UsersIcon className="h-4 w-4" /> Open firm settings
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
