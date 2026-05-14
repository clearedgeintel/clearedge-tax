import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { RETURN_STATUS_LABELS } from "@/types/entities";
import { daysUntilDeadline, deadlineSeverity } from "@/lib/deadlines/calculator";
import { format } from "date-fns";

export default async function ClientDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Find this user's client record
  const client = await prisma.client.findFirst({
    where: { userId: session.user.id, firmId: session.user.firmId! },
  });

  if (!client) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {session.user.name}</h1>
        <p className="mt-2 text-gray-600">
          Your account is being set up. Please check back soon.
        </p>
      </div>
    );
  }

  // Get active returns through entities
  const returns = await prisma.taxReturn.findMany({
    where: {
      entity: { clientId: client.id },
      status: { notIn: ["EXPORTED"] },
    },
    include: {
      entity: { select: { legalName: true, entityType: true } },
      deadlines: {
        where: { deadlineType: "FILING" },
        orderBy: { dueDate: "asc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Count documents needed
  const docsNeeded = await prisma.document.count({
    where: { clientId: client.id, status: "REQUESTED" },
  });

  // Find nearest deadline
  const nextDeadline = await prisma.deadline.findFirst({
    where: {
      taxReturn: { entity: { clientId: client.id } },
      dueDate: { gte: new Date() },
    },
    orderBy: { dueDate: "asc" },
    include: {
      taxReturn: { select: { entity: { select: { legalName: true } } } },
    },
  });

  const nextDays = nextDeadline ? daysUntilDeadline(nextDeadline.dueDate) : null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Welcome, {session.user.name}</h1>
      <p className="mt-2 text-gray-600">
        Your tax returns and documents are shown below.
      </p>

      {/* Stat cards */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/returns"
          className="rounded-lg border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow"
        >
          <h3 className="font-semibold text-gray-900">Active Returns</h3>
          <p className="mt-1 text-3xl font-bold text-blue-600">{returns.length}</p>
          <p className="mt-1 text-sm text-gray-500">
            {returns.length > 0
              ? `For tax year ${returns[0].taxYear}`
              : "No active returns"}
          </p>
        </Link>

        <Link
          href="/documents"
          className="rounded-lg border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow"
        >
          <h3 className="font-semibold text-gray-900">Documents Needed</h3>
          <p className={`mt-1 text-3xl font-bold ${docsNeeded > 0 ? "text-orange-600" : "text-green-600"}`}>
            {docsNeeded}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {docsNeeded > 0 ? "Outstanding requests" : "All caught up"}
          </p>
        </Link>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="font-semibold text-gray-900">Next Deadline</h3>
          {nextDeadline ? (
            <>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {format(nextDeadline.dueDate, "MMM d")}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {nextDays}d away &middot; {nextDeadline.taxReturn.entity.legalName}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-3xl font-bold text-gray-400">--</p>
              <p className="mt-1 text-sm text-gray-500">No upcoming deadlines</p>
            </>
          )}
        </div>
      </div>

      {/* Returns list */}
      {returns.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Your Returns</h2>
          <div className="mt-4 space-y-3">
            {returns.map((ret) => {
              const dl = ret.deadlines[0];
              const days = dl ? daysUntilDeadline(dl.dueDate) : null;
              const severity = days !== null ? deadlineSeverity(days) : "normal";
              const statusColors: Record<string, string> = {
                INTAKE: "bg-blue-100 text-blue-700",
                INTAKE_BLOCKED: "bg-red-100 text-red-700",
                PREPARATION: "bg-yellow-100 text-yellow-700",
                PREPARATION_BLOCKED: "bg-red-100 text-red-700",
                REVIEW: "bg-purple-100 text-purple-700",
                REVISION: "bg-orange-100 text-orange-700",
                APPROVED: "bg-green-100 text-green-700",
              };
              return (
                <Link
                  key={ret.id}
                  href={
                    ret.status === "INTAKE"
                      ? `/returns/${ret.id}/interview`
                      : "/returns"
                  }
                  className="block rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {ret.entity.legalName}
                      </h3>
                      <p className="text-sm text-gray-500">Tax Year {ret.taxYear}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {dl && (
                        <span className="text-xs text-gray-500">
                          Due {format(dl.dueDate, "MMM d")}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[ret.status] || "bg-gray-100 text-gray-600"}`}>
                        {RETURN_STATUS_LABELS[ret.status]}
                      </span>
                    </div>
                  </div>
                  {ret.status === "INTAKE" && (
                    <p className="mt-2 text-xs text-blue-600">
                      Click to continue your tax interview &rarr;
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
