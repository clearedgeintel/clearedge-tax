import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { RETURN_STATUS_LABELS, ENTITY_TYPE_LABELS } from "@/types/entities";
import { daysUntilDeadline, deadlineSeverity } from "@/lib/deadlines/calculator";
import { format } from "date-fns";

export default async function StaffDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const firmId = session.user.firmId!;

  // Stats: count returns by status
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

  // Upcoming deadlines (next 30 days)
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

  // Recent activity (last 10 audit events)
  const recentActivity = await prisma.auditEvent.findMany({
    where: {
      OR: [
        { taxReturn: { entity: { client: { firmId } } } },
        { user: { firmId } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      user: { select: { name: true } },
    },
  });

  const stats = [
    { label: "In Intake", value: intakeCount, color: "text-blue-600", href: "/staff/returns?status=INTAKE" },
    { label: "In Preparation", value: prepCount, color: "text-yellow-600", href: "/staff/returns?status=PREPARATION" },
    { label: "Pending Review", value: reviewCount, color: "text-purple-600", href: "/staff/returns?status=REVIEW" },
    { label: "Blocked", value: blockedCount, color: "text-red-600", href: "/staff/returns?isBlocked=true" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Staff Dashboard</h1>
      <p className="mt-2 text-gray-600">
        Workload overview for {session.user.name}
      </p>

      {/* Stat cards */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-lg border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow"
          >
            <h3 className="text-sm font-medium text-gray-500">{stat.label}</h3>
            <p className={`mt-1 text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </Link>
        ))}
      </div>

      {/* Upcoming Deadlines */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Upcoming Deadlines</h2>
        {upcomingDeadlines.length === 0 ? (
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
            No returns with upcoming deadlines.
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Entity</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Due Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Days Left</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {upcomingDeadlines.map((dl) => {
                  const days = daysUntilDeadline(dl.dueDate);
                  const severity = deadlineSeverity(days);
                  const severityColors: Record<string, string> = {
                    overdue: "text-red-700 bg-red-50",
                    critical: "text-red-600 bg-red-50",
                    warning: "text-amber-600 bg-amber-50",
                    normal: "text-green-600 bg-green-50",
                  };
                  return (
                    <tr key={dl.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/staff/returns/${dl.taxReturn.id}/interview`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {dl.taxReturn.entity.legalName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {dl.deadlineType.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {format(dl.dueDate, "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${severityColors[severity]}`}>
                          {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {RETURN_STATUS_LABELS[dl.taxReturn.status]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
            No recent activity.
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
            {recentActivity.map((event) => (
              <div key={event.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-800">{event.description}</p>
                  <p className="text-xs text-gray-400">
                    {event.user?.name} &middot; {format(event.createdAt, "MMM d, h:mm a")}
                  </p>
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                  {event.eventCategory}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
