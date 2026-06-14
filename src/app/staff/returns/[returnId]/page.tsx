import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isStaff, isManager, isAdmin } from "@/lib/utils/permissions";
import { ENTITY_TYPE_LABELS } from "@/types/entities";
import { daysUntilDeadline, deadlineSeverity } from "@/lib/deadlines/calculator";
import { format } from "date-fns";
import {
  PageHeader,
  Card,
  CardHeader,
  Button,
  Badge,
  EmptyState,
  ReturnStatusPill,
  DocumentStatusPill,
} from "@/components/ui";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, FileText } from "lucide-react";
import ReviewPanel from "./ReviewPanel";
import AdvancePanel from "./AdvancePanel";
import ExtractionCell from "./ExtractionCell";

const SEVERITY_TEXT: Record<
  ReturnType<typeof deadlineSeverity>,
  string
> = {
  overdue: "text-danger",
  critical: "text-danger",
  warning: "text-warning",
  normal: "text-success",
};

interface Props {
  params: Promise<{ returnId: string }>;
}

export default async function ReturnDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) redirect("/login");

  const { returnId } = await params;

  const taxReturn = await prisma.taxReturn.findFirst({
    where: {
      id: returnId,
      entity: { client: { firmId: session.user.firmId! } },
    },
    include: {
      entity: {
        include: {
          client: { select: { id: true, displayName: true } },
        },
      },
      preparer: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
      partner: { select: { id: true, name: true } },
      deadlines: { orderBy: { dueDate: "asc" } },
      documents: {
        orderBy: { createdAt: "desc" },
        include: {
          extraction: {
            select: {
              status: true,
              fields: true,
              model: true,
              errorMessage: true,
              updatedAt: true,
            },
          },
        },
      },
      reviewActions: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, role: true } } },
      },
      k1sReceivedByReturn: {
        include: {
          sourceReturn: {
            select: {
              id: true,
              status: true,
              entity: { select: { legalName: true } },
            },
          },
        },
      },
      k1sIssuedByReturn: {
        include: {
          targetReturn: {
            select: {
              id: true,
              status: true,
              entity: { select: { legalName: true } },
            },
          },
        },
      },
      _count: { select: { interviewResponses: true } },
    },
  });

  if (!taxReturn) redirect("/staff/returns");

  const auditEvents = await prisma.auditEvent.findMany({
    where: { returnId },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { user: { select: { name: true } } },
  });

  const canManagerReview = isManager(session.user.role);
  const isAssignedPartner =
    !!taxReturn.partnerId && taxReturn.partnerId === session.user.id;
  const canPartnerApprove = isAssignedPartner || isAdmin(session.user.role);
  const hasPartner = !!taxReturn.partnerId;

  return (
    <>
      <PageHeader
        eyebrow={`Tax year ${taxReturn.taxYear}`}
        title={taxReturn.entity.legalName}
        description={`${ENTITY_TYPE_LABELS[taxReturn.entity.entityType]} · ${taxReturn.entity.client.displayName}`}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <ReturnStatusPill status={taxReturn.status} />
            {taxReturn.isBlocked && (
              <Badge tone="warning">
                <AlertTriangle className="h-3 w-3" /> Blocked
              </Badge>
            )}
            {taxReturn.extensionFiled && (
              <Badge tone="info">Extension filed</Badge>
            )}
          </div>
        }
        actions={
          <Button href={`/staff/returns/${returnId}/interview`} size="sm">
            Open interview
          </Button>
        }
      />

      {taxReturn.isBlocked && taxReturn.blockedReason && (
        <Card className="mb-4 border-warning/30 bg-warning-soft/40">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-warning">
                This return is blocked
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                {taxReturn.blockedReason}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {(taxReturn.status === "INTAKE" ||
            taxReturn.status === "PREPARATION") &&
            !taxReturn.isBlocked && (
              <AdvancePanel
                returnId={returnId}
                currentStatus={taxReturn.status}
              />
            )}

          {(taxReturn.status === "REVIEW" ||
            taxReturn.status === "REVISION" ||
            taxReturn.status === "APPROVED" ||
            taxReturn.status === "PARTNER_REVIEW") && (
            <ReviewPanel
              returnId={returnId}
              currentStatus={taxReturn.status}
              hasPartner={hasPartner}
              canPartnerApprove={canPartnerApprove}
              canManagerReview={canManagerReview}
            />
          )}

          {(taxReturn.k1sReceivedByReturn.length > 0 ||
            taxReturn.k1sIssuedByReturn.length > 0) && (
            <Card flush>
              <CardHeader
                title="K-1 links"
                description="Cross-entity dependencies that gate or are gated by this return"
              />
              <ul className="divide-y divide-border-subtle">
                {taxReturn.k1sReceivedByReturn.map((k1) => (
                  <li
                    key={k1.id}
                    className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ArrowDownLeft className="h-4 w-4 text-info shrink-0" />
                      <span className="text-ink-muted truncate">
                        Receiving from{" "}
                        <span className="font-medium text-ink">
                          {k1.sourceReturn.entity.legalName}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ReturnStatusPill status={k1.sourceReturn.status} />
                      <Badge tone={k1.isResolved ? "success" : "warning"}>
                        {k1.isResolved ? "Resolved" : "Pending"}
                      </Badge>
                    </div>
                  </li>
                ))}
                {taxReturn.k1sIssuedByReturn.map((k1) => (
                  <li
                    key={k1.id}
                    className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ArrowUpRight className="h-4 w-4 text-accent-600 shrink-0" />
                      <span className="text-ink-muted truncate">
                        Issuing to{" "}
                        <span className="font-medium text-ink">
                          {k1.targetReturn.entity.legalName}
                        </span>
                      </span>
                    </div>
                    <Badge tone={k1.isResolved ? "success" : "warning"}>
                      {k1.isResolved ? "Resolved" : "Pending"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card flush>
            <CardHeader
              title="Documents"
              description={`${taxReturn.documents.length} item${taxReturn.documents.length === 1 ? "" : "s"}`}
            />
            {taxReturn.documents.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<FileText className="h-5 w-5" />}
                  title="No documents yet"
                />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-muted border-b border-border-subtle text-xs uppercase tracking-wide text-ink-subtle">
                  <tr>
                    <th className="text-left px-5 py-2.5 font-medium">Label</th>
                    <th className="text-left px-5 py-2.5 font-medium">
                      Category
                    </th>
                    <th className="text-left px-5 py-2.5 font-medium">Status</th>
                    <th className="text-left px-5 py-2.5 font-medium">
                      Extraction
                    </th>
                    <th className="text-left px-5 py-2.5 font-medium">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {taxReturn.documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-surface-muted/60">
                      <td className="px-5 py-2.5 text-sm text-ink">
                        {doc.label}
                      </td>
                      <td className="px-5 py-2.5 text-xs text-ink-muted">
                        {doc.category.replace(/_/g, " ")}
                      </td>
                      <td className="px-5 py-2.5">
                        <DocumentStatusPill status={doc.status} />
                      </td>
                      <td className="px-5 py-2.5">
                        <ExtractionCell
                          documentId={doc.id}
                          documentLabel={doc.label}
                          documentStatus={doc.status}
                          extraction={
                            doc.extraction
                              ? {
                                  ...doc.extraction,
                                  updatedAt: doc.extraction.updatedAt.toISOString(),
                                }
                              : null
                          }
                        />
                      </td>
                      <td className="px-5 py-2.5 text-xs text-ink-muted">
                        {format(doc.updatedAt, "MMM d")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {taxReturn.reviewActions.length > 0 && (
            <Card flush>
              <CardHeader title="Review history" />
              <ul className="divide-y divide-border-subtle">
                {taxReturn.reviewActions.map((action) => (
                  <li key={action.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">
                        {action.action.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-ink-subtle">
                        {action.user.name} · {format(action.createdAt, "MMM d, h:mm a")}
                      </span>
                    </div>
                    {action.notes && (
                      <p className="mt-1 text-sm text-ink-muted">
                        {action.notes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card flush>
            <CardHeader
              title="Audit trail"
              description="Last 25 events for this return"
            />
            {auditEvents.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<FileText className="h-5 w-5" />}
                  title="No audit events yet"
                />
              </div>
            ) : (
              <ul className="divide-y divide-border-subtle max-h-96 overflow-y-auto">
                {auditEvents.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="text-ink truncate">{event.description}</p>
                      <p className="text-xs text-ink-subtle">
                        {event.user?.name || "System"} ·{" "}
                        {format(event.createdAt, "MMM d, h:mm a")}
                      </p>
                    </div>
                    <Badge tone="neutral">{event.eventCategory}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card flush>
            <CardHeader title="Details" />
            <dl className="divide-y divide-border-subtle">
              <DetailRow
                label="Preparer"
                value={taxReturn.preparer?.name || "Unassigned"}
              />
              <DetailRow
                label="Reviewer"
                value={taxReturn.reviewer?.name || "Unassigned"}
              />
              <DetailRow
                label="Partner"
                value={taxReturn.partner?.name || (
                  <span className="text-ink-subtle">No partner review</span>
                )}
              />
              <DetailRow
                label="Interview progress"
                value={`${taxReturn._count.interviewResponses} responses`}
              />
              <DetailRow
                label="Extension"
                value={taxReturn.extensionFiled ? "Filed" : "Not filed"}
              />
              {taxReturn.statusNote && (
                <DetailRow label="Status note" value={taxReturn.statusNote} />
              )}
            </dl>
          </Card>

          <Card flush>
            <CardHeader title="Deadlines" />
            {taxReturn.deadlines.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ink-subtle">
                No deadlines computed.
              </p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {taxReturn.deadlines.map((dl) => {
                  const days = daysUntilDeadline(dl.dueDate);
                  const severity = deadlineSeverity(days);
                  return (
                    <li
                      key={dl.id}
                      className="flex items-center justify-between gap-2 px-5 py-3 text-sm"
                    >
                      <span className="text-ink-muted">
                        {dl.deadlineType.replace(/_/g, " ")}
                      </span>
                      <div className="text-right">
                        <div className="text-sm text-ink whitespace-nowrap">
                          {format(dl.dueDate, "MMM d, yyyy")}
                        </div>
                        <div className={`text-xs font-medium ${SEVERITY_TEXT[severity]}`}>
                          {days < 0
                            ? `${Math.abs(days)}d overdue`
                            : days === 0
                              ? "Today"
                              : `${days}d left`}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-2.5">
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="text-sm text-ink text-right">{value}</dd>
    </div>
  );
}
