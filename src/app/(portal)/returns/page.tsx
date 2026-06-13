import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ENTITY_TYPE_LABELS } from "@/types/entities";
import { format } from "date-fns";
import {
  PageHeader,
  Card,
  Button,
  EmptyState,
  ReturnStatusPill,
} from "@/components/ui";
import { FileText } from "lucide-react";

const STATUS_STEPS = ["INTAKE", "PREPARATION", "REVIEW", "APPROVED", "EXPORTED"];

function stepIndex(status: string): number {
  if (status === "INTAKE_BLOCKED") return 0;
  if (status === "PREPARATION_BLOCKED") return 1;
  if (status === "REVISION") return 2;
  return STATUS_STEPS.indexOf(status);
}

export default async function ClientReturns() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const client = await prisma.client.findFirst({
    where: { userId: session.user.id, firmId: session.user.firmId! },
  });

  if (!client) {
    return (
      <>
        <PageHeader
          title="My returns"
          description="Your tax returns and their current status."
        />
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="No active engagement"
          description="Your account hasn't been linked to a client record yet. Contact your preparer."
        />
      </>
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

  return (
    <>
      <PageHeader
        title="My returns"
        description="Your tax returns and where each one stands in our workflow."
      />

      {returns.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="No returns yet"
          description="Your tax preparer will set up your returns when work begins."
        />
      ) : (
        <div className="space-y-4">
          {returns.map((ret) => {
            const dl = ret.deadlines[0];
            const idx = stepIndex(ret.status);
            return (
              <Card key={ret.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-ink truncate">
                      {ret.entity.legalName}
                    </h3>
                    <p className="text-sm text-ink-muted">
                      {ENTITY_TYPE_LABELS[ret.entity.entityType]} · Tax year{" "}
                      {ret.taxYear}
                    </p>
                  </div>
                  <ReturnStatusPill status={ret.status} />
                </div>

                <div className="mt-4">
                  <div className="flex items-center gap-1">
                    {STATUS_STEPS.map((step, i) => (
                      <div
                        key={step}
                        className={`h-1.5 flex-1 rounded-full ${
                          i <= idx ? "bg-brand-500" : "bg-border-subtle"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-ink-subtle">
                    <span>Intake</span>
                    <span>Prep</span>
                    <span>Review</span>
                    <span>Approved</span>
                    <span>Exported</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
                    {ret.preparer && <span>Preparer: {ret.preparer.name}</span>}
                    {dl && <span>Due {format(dl.dueDate, "MMM d, yyyy")}</span>}
                    <span>{ret._count.interviewResponses} answers</span>
                    <span>{ret._count.documents} docs</span>
                  </div>
                  {ret.status === "INTAKE" && (
                    <Button href={`/returns/${ret.id}/interview`} size="sm">
                      Continue interview
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
