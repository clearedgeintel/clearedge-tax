import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { RETURN_STATUS_LABELS, ENTITY_TYPE_LABELS } from "@/types/entities";
import { daysUntilDeadline, deadlineSeverity } from "@/lib/deadlines/calculator";
import { format } from "date-fns";
import type { ReturnStatus } from "@/generated/prisma/enums";

interface Props {
  searchParams: Promise<{ status?: string; isBlocked?: string }>;
}

export default async function StaffReturns({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const firmId = session.user.firmId!;
  const params = await searchParams;
  const statusFilter = params.status as ReturnStatus | undefined;
  const blockedFilter = params.isBlocked;

  const returns = await prisma.taxReturn.findMany({
    where: {
      entity: { client: { firmId } },
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(blockedFilter === "true" ? { isBlocked: true } : {}),
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

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Returns</h1>
          <p className="mt-2 text-gray-600">
            {returns.length} return{returns.length !== 1 ? "s" : ""}
            {statusFilter ? ` in ${RETURN_STATUS_LABELS[statusFilter]}` : ""}
            {blockedFilter === "true" ? " (blocked)" : ""}
          </p>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/staff/returns"
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            !statusFilter && !blockedFilter
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All
        </Link>
        {(Object.keys(RETURN_STATUS_LABELS) as ReturnStatus[]).map((status) => (
          <Link
            key={status}
            href={`/staff/returns?status=${status}`}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === status
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {RETURN_STATUS_LABELS[status]}
          </Link>
        ))}
      </div>

      {returns.length === 0 ? (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          No returns found.
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Entity</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Year</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Preparer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Deadline</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {returns.map((ret) => {
                const filingDeadline = ret.deadlines[0];
                const days = filingDeadline ? daysUntilDeadline(filingDeadline.dueDate) : null;
                const severity = days !== null ? deadlineSeverity(days) : "normal";
                const severityColors: Record<string, string> = {
                  overdue: "text-red-700 bg-red-50",
                  critical: "text-red-600 bg-red-50",
                  warning: "text-amber-600 bg-amber-50",
                  normal: "text-green-600 bg-green-50",
                };

                return (
                  <tr key={ret.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/staff/returns/${ret.id}/interview`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {ret.entity.legalName}
                      </Link>
                      <p className="text-xs text-gray-400">
                        {ENTITY_TYPE_LABELS[ret.entity.entityType]}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{ret.entity.client.displayName}</td>
                    <td className="px-4 py-3 text-gray-600">{ret.taxYear}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColors[ret.status] || ""}`}>
                        {RETURN_STATUS_LABELS[ret.status]}
                      </span>
                      {ret.isBlocked && ret.blockedReason && (
                        <p className="text-xs text-red-500 mt-0.5">{ret.blockedReason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {ret.preparer?.name || "--"}
                    </td>
                    <td className="px-4 py-3">
                      {filingDeadline ? (
                        <div>
                          <span className="text-gray-600 text-xs">{format(filingDeadline.dueDate, "MMM d")}</span>
                          <span className={`ml-1.5 inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${severityColors[severity]}`}>
                            {days! < 0 ? `${Math.abs(days!)}d late` : `${days}d`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {ret._count.interviewResponses} answers &middot; {ret._count.documents} docs
                    </td>
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
