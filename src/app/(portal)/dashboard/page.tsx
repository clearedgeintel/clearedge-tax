import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { daysUntilDeadline } from "@/lib/deadlines/calculator";
import { format } from "date-fns";
import {
  PageHeader,
  Stat,
  Card,
  CardHeader,
  EmptyState,
  Button,
  ReturnStatusPill,
} from "@/components/ui";
import { ArrowRight, FileText, FolderOpen } from "lucide-react";

export default async function ClientDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const client = await prisma.client.findFirst({
    where: { userId: session.user.id, firmId: session.user.firmId! },
  });

  if (!client) {
    return (
      <>
        <PageHeader
          title={`Welcome, ${session.user.name}`}
          description="Your account is being set up."
        />
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="No active engagement"
          description="Your firm hasn't linked your account to a client record yet. Check back soon, or contact your preparer."
        />
      </>
    );
  }

  const [returns, docsNeeded, nextDeadline] = await Promise.all([
    prisma.taxReturn.findMany({
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
    }),
    prisma.document.count({
      where: { clientId: client.id, status: "REQUESTED" },
    }),
    prisma.deadline.findFirst({
      where: {
        taxReturn: { entity: { clientId: client.id } },
        dueDate: { gte: new Date() },
      },
      orderBy: { dueDate: "asc" },
      include: {
        taxReturn: { select: { entity: { select: { legalName: true } } } },
      },
    }),
  ]);

  const nextDays = nextDeadline ? daysUntilDeadline(nextDeadline.dueDate) : null;

  return (
    <>
      <PageHeader
        title={`Welcome, ${session.user.name.split(" ")[0]}`}
        description="Your tax returns and any documents we need from you."
        actions={
          docsNeeded > 0 && (
            <Button href="/documents" size="sm">
              Upload documents ({docsNeeded})
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat
          label="Active returns"
          value={returns.length}
          description={
            returns.length > 0
              ? `Most recent: TY ${returns[0].taxYear}`
              : "No active engagements"
          }
          tone="brand"
          href="/returns"
        />
        <Stat
          label="Documents needed"
          value={docsNeeded}
          description={
            docsNeeded > 0 ? "Outstanding requests" : "Caught up"
          }
          tone={docsNeeded > 0 ? "warning" : "success"}
          href="/documents"
        />
        <Stat
          label="Next deadline"
          value={
            nextDeadline
              ? format(nextDeadline.dueDate, "MMM d")
              : "—"
          }
          description={
            nextDeadline
              ? `${nextDays}d away · ${nextDeadline.taxReturn.entity.legalName}`
              : "No upcoming deadlines"
          }
          tone={nextDays !== null && nextDays <= 7 ? "danger" : "accent"}
        />
      </div>

      <div className="mt-6">
        <Card flush>
          <CardHeader
            title="Your returns"
            description="Continue an interview or check the status of work in progress."
          />
          {returns.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<FolderOpen className="h-5 w-5" />}
                title="No active returns"
                description="When your firm starts a return for you, it will appear here."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {returns.map((ret) => {
                const dl = ret.deadlines[0];
                return (
                  <li key={ret.id}>
                    <Link
                      href={
                        ret.status === "INTAKE"
                          ? `/returns/${ret.id}/interview`
                          : "/returns"
                      }
                      className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-muted/60"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-ink truncate">
                            {ret.entity.legalName}
                          </h3>
                          <ReturnStatusPill status={ret.status} />
                        </div>
                        <p className="text-xs text-ink-subtle">
                          Tax year {ret.taxYear}
                          {dl && ` · Due ${format(dl.dueDate, "MMM d, yyyy")}`}
                        </p>
                        {ret.status === "INTAKE" && (
                          <p className="mt-1 text-xs font-medium text-brand-700">
                            Continue your tax interview
                          </p>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-ink-subtle shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
