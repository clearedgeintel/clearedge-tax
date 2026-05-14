import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { RETURN_STATUS_LABELS, ENTITY_TYPE_LABELS } from "@/types/entities";
import { daysUntilDeadline, deadlineSeverity } from "@/lib/deadlines/calculator";
import { format } from "date-fns";

export default async function StaffQueue() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const firmId = session.user.firmId!;
  const userId = session.user.id;

  // Get returns assigned to current user as preparer or reviewer
  const assignedReturns = await prisma.taxReturn.findMany({
    where: {
      entity: { client: { firmId } },
      status: { notIn: ["EXPORTED"] },
      OR: [{ preparerId: userId }, { reviewerId: userId }],
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Work Queue</h1>
      <p className="mt-2 text-gray-600">
        Returns assigned to you, sorted by deadline urgency.
      </p>

      {assignedReturns.length === 0 ? (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          No returns in your queue.
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Entity</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Filing Deadline</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {assignedReturns.map((ret) => {
                const filingDeadline = ret.deadlines[0];
                const days = filingDeadline ? daysUntilDeadline(filingDeadline.dueDate) : null;
                const severity = days !== null ? deadlineSeverity(days) : "normal";
                const severityColors: Record<string, string> = {
                  overdue: "text-red-700 bg-red-50",
                  critical: "text-red-600 bg-red-50",
                  warning: "text-amber-600 bg-amber-50",
                  normal: "text-green-600 bg-green-50",
                };
                const statusColors: Record<string, string> = {
                  INTAKE: "bg-blue-100 text-blue-700",
                  INTAKE_BLOCKED: "bg-red-100 text-red-700",
                  PREPARATION: "bg-yellow-100 text-yellow-700",
                  PREPARATION_BLOCKED: "bg-red-100 text-red-700",
                  REVIEW: "bg-purple-100 text-purple-700",
                  REVISION: "bg-orange-100 text-orange-700",
                  APPROVED: "bg-green-100 text-green-700",
                  EXPORTED: "bg-gray-100 text-gray-700",
                };
                const myRole = ret.preparerId === userId ? "Preparer" : "Reviewer";

                return (
                  <tr key={ret.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/staff/returns/${ret.id}/interview`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {ret.entity.legalName}
                      </Link>
                      <p className="text-xs text-gray-400">{ret.taxYear}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {ret.entity.client.displayName}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {ENTITY_TYPE_LABELS[ret.entity.entityType]}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColors[ret.status] || ""}`}>
                        {RETURN_STATUS_LABELS[ret.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {filingDeadline ? (
                        <div>
                          <span className="text-gray-600">{format(filingDeadline.dueDate, "MMM d, yyyy")}</span>
                          <span className={`ml-2 inline-flex px-2 py-0.5 rounded text-xs font-medium ${severityColors[severity]}`}>
                            {days! < 0 ? `${Math.abs(days!)}d overdue` : `${days}d`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{myRole}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
