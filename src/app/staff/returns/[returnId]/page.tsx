import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { isStaff, isManager } from "@/lib/utils/permissions";
import { RETURN_STATUS_LABELS, ENTITY_TYPE_LABELS } from "@/types/entities";
import { daysUntilDeadline, deadlineSeverity } from "@/lib/deadlines/calculator";
import { format } from "date-fns";
import ReviewPanel from "./ReviewPanel";

interface Props {
  params: Promise<{ returnId: string }>;
}

export default async function ReturnDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) redirect("/login");

  const { returnId } = await params;

  const taxReturn = await prisma.taxReturn.findFirst({
    where: { id: returnId, entity: { client: { firmId: session.user.firmId! } } },
    include: {
      entity: {
        include: {
          client: { select: { id: true, displayName: true } },
        },
      },
      preparer: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
      deadlines: { orderBy: { dueDate: "asc" } },
      documents: { orderBy: { createdAt: "desc" } },
      reviewActions: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, role: true } } },
      },
      k1sReceivedByReturn: {
        include: {
          sourceReturn: {
            select: { id: true, status: true, entity: { select: { legalName: true } } },
          },
        },
      },
      k1sIssuedByReturn: {
        include: {
          targetReturn: {
            select: { id: true, status: true, entity: { select: { legalName: true } } },
          },
        },
      },
      _count: { select: { interviewResponses: true } },
    },
  });

  if (!taxReturn) redirect("/staff/returns");

  // Audit trail for this return
  const auditEvents = await prisma.auditEvent.findMany({
    where: { returnId },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { user: { select: { name: true } } },
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

  const docStatusStyles: Record<string, string> = {
    REQUESTED: "bg-orange-100 text-orange-700",
    UPLOADED: "bg-blue-100 text-blue-700",
    ACCEPTED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
  };

  const canReview = isManager(session.user.role);

  return (
    <div>
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">
                {taxReturn.entity.legalName}
              </h1>
              <span className={`px-2.5 py-1 rounded text-xs font-medium ${statusColors[taxReturn.status]}`}>
                {RETURN_STATUS_LABELS[taxReturn.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {ENTITY_TYPE_LABELS[taxReturn.entity.entityType]} &middot; Tax Year {taxReturn.taxYear} &middot; Client: {taxReturn.entity.client.displayName}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/staff/returns/${returnId}/interview`}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              Open Interview
            </Link>
          </div>
        </div>
      </div>

      <div className="p-8 grid grid-cols-3 gap-8">
        {/* Main column */}
        <div className="col-span-2 space-y-8">
          {/* Review Panel */}
          {(taxReturn.status === "REVIEW" || taxReturn.status === "REVISION" || taxReturn.status === "APPROVED") && canReview && (
            <ReviewPanel
              returnId={returnId}
              currentStatus={taxReturn.status}
            />
          )}

          {/* Blocked alert */}
          {taxReturn.isBlocked && taxReturn.blockedReason && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="text-sm font-semibold text-red-800">Blocked</h3>
              <p className="mt-1 text-sm text-red-700">{taxReturn.blockedReason}</p>
            </div>
          )}

          {/* K-1 Dependencies */}
          {(taxReturn.k1sReceivedByReturn.length > 0 || taxReturn.k1sIssuedByReturn.length > 0) && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900">K-1 Links</h2>
              <div className="mt-3 space-y-2">
                {taxReturn.k1sReceivedByReturn.map((k1) => (
                  <div key={k1.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200 text-sm">
                    <span>Receiving K-1 from <strong>{k1.sourceReturn.entity.legalName}</strong></span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${statusColors[k1.sourceReturn.status]}`}>
                        {RETURN_STATUS_LABELS[k1.sourceReturn.status]}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${k1.isResolved ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                        {k1.isResolved ? "Resolved" : "Pending"}
                      </span>
                    </div>
                  </div>
                ))}
                {taxReturn.k1sIssuedByReturn.map((k1) => (
                  <div key={k1.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200 text-sm">
                    <span>Issuing K-1 to <strong>{k1.targetReturn.entity.legalName}</strong></span>
                    <span className={`px-2 py-0.5 rounded text-xs ${k1.isResolved ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                      {k1.isResolved ? "Resolved" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Documents ({taxReturn.documents.length})
            </h2>
            {taxReturn.documents.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No documents.</p>
            ) : (
              <div className="mt-3 rounded-lg border border-gray-200 bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Label</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Category</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {taxReturn.documents.map((doc) => (
                      <tr key={doc.id}>
                        <td className="px-4 py-2 text-gray-900">{doc.label}</td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{doc.category.replace(/_/g, " ")}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${docStatusStyles[doc.status]}`}>
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{format(doc.createdAt, "MMM d")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Review History */}
          {taxReturn.reviewActions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Review History</h2>
              <div className="mt-3 space-y-2">
                {taxReturn.reviewActions.map((action) => (
                  <div key={action.id} className="p-3 bg-gray-50 rounded border border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800">
                        {action.action.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-gray-400">
                        {action.user.name} &middot; {format(action.createdAt, "MMM d, h:mm a")}
                      </span>
                    </div>
                    {action.notes && (
                      <p className="mt-1 text-sm text-gray-600">{action.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Trail */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Audit Trail</h2>
            {auditEvents.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No audit events.</p>
            ) : (
              <div className="mt-3 rounded-lg border border-gray-200 bg-white divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {auditEvents.map((event) => (
                  <div key={event.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                    <div>
                      <p className="text-gray-800">{event.description}</p>
                      <p className="text-xs text-gray-400">
                        {event.user?.name || "System"} &middot; {format(event.createdAt, "MMM d, h:mm:ss a")}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded flex-shrink-0">
                      {event.eventCategory}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info card */}
          <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Details</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500">Preparer</span>
                <p className="font-medium">{taxReturn.preparer?.name || "Unassigned"}</p>
              </div>
              <div>
                <span className="text-gray-500">Reviewer</span>
                <p className="font-medium">{taxReturn.reviewer?.name || "Unassigned"}</p>
              </div>
              <div>
                <span className="text-gray-500">Interview Progress</span>
                <p className="font-medium">{taxReturn._count.interviewResponses} responses</p>
              </div>
              <div>
                <span className="text-gray-500">Extension Filed</span>
                <p className="font-medium">{taxReturn.extensionFiled ? "Yes" : "No"}</p>
              </div>
              {taxReturn.statusNote && (
                <div>
                  <span className="text-gray-500">Note</span>
                  <p className="text-gray-700">{taxReturn.statusNote}</p>
                </div>
              )}
            </div>
          </div>

          {/* Deadlines */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Deadlines</h3>
            <div className="space-y-2">
              {taxReturn.deadlines.map((dl) => {
                const days = daysUntilDeadline(dl.dueDate);
                const severity = deadlineSeverity(days);
                const sevColors: Record<string, string> = {
                  overdue: "text-red-600",
                  critical: "text-red-500",
                  warning: "text-amber-500",
                  normal: "text-green-600",
                };
                return (
                  <div key={dl.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{dl.deadlineType.replace(/_/g, " ")}</span>
                    <div className="text-right">
                      <span className="text-gray-800">{format(dl.dueDate, "MMM d")}</span>
                      <span className={`ml-2 text-xs font-medium ${sevColors[severity]}`}>
                        {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
