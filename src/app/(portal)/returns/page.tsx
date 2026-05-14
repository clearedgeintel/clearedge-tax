import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { RETURN_STATUS_LABELS, ENTITY_TYPE_LABELS } from "@/types/entities";
import { format } from "date-fns";

export default async function ClientReturns() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const client = await prisma.client.findFirst({
    where: { userId: session.user.id, firmId: session.user.firmId! },
  });

  if (!client) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Returns</h1>
        <p className="mt-2 text-gray-600">Your account is being set up.</p>
      </div>
    );
  }

  const returns = await prisma.taxReturn.findMany({
    where: { entity: { clientId: client.id } },
    orderBy: { taxYear: "desc" },
    include: {
      entity: { select: { legalName: true, entityType: true } },
      preparer: { select: { name: true } },
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

  // Status step order for progress display
  const statusSteps = ["INTAKE", "PREPARATION", "REVIEW", "APPROVED", "EXPORTED"];

  function getStepIndex(status: string): number {
    if (status === "INTAKE_BLOCKED") return 0;
    if (status === "PREPARATION_BLOCKED") return 1;
    if (status === "REVISION") return 2;
    return statusSteps.indexOf(status);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">My Returns</h1>
      <p className="mt-2 text-gray-600">Your tax returns and their current status.</p>

      {returns.length === 0 ? (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          No returns yet. Your tax preparer will set up your returns.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {returns.map((ret) => {
            const dl = ret.deadlines[0];
            const stepIdx = getStepIndex(ret.status);

            return (
              <div
                key={ret.id}
                className="rounded-lg border border-gray-200 bg-white p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {ret.entity.legalName}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {ENTITY_TYPE_LABELS[ret.entity.entityType]} &middot; Tax Year {ret.taxYear}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded text-xs font-medium ${statusColors[ret.status]}`}>
                    {RETURN_STATUS_LABELS[ret.status]}
                  </span>
                </div>

                {/* Progress steps */}
                <div className="mt-4 flex items-center gap-1">
                  {statusSteps.map((step, i) => (
                    <div key={step} className="flex-1 flex items-center gap-1">
                      <div
                        className={`h-1.5 flex-1 rounded-full ${
                          i <= stepIdx ? "bg-blue-500" : "bg-gray-200"
                        }`}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                  <span>Intake</span>
                  <span>Prep</span>
                  <span>Review</span>
                  <span>Approved</span>
                  <span>Exported</span>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm">
                  <div className="flex gap-4 text-xs text-gray-500">
                    {ret.preparer && <span>Preparer: {ret.preparer.name}</span>}
                    {dl && <span>Due: {format(dl.dueDate, "MMM d, yyyy")}</span>}
                    <span>{ret._count.interviewResponses} answers</span>
                    <span>{ret._count.documents} docs</span>
                  </div>
                  {ret.status === "INTAKE" && (
                    <Link
                      href={`/returns/${ret.id}/interview`}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                    >
                      Continue Interview
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
