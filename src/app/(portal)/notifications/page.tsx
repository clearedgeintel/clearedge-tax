import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { RETURN_STATUS_LABELS } from "@/types/entities";
import { daysUntilDeadline } from "@/lib/deadlines/calculator";
import { format } from "date-fns";
import {
  PageHeader,
  Card,
  Badge,
  EmptyState,
} from "@/components/ui";
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  FileText,
  Upload,
  ArrowRight,
} from "lucide-react";

type Urgency = "high" | "medium" | "low";
type ItemType = "document" | "deadline" | "status" | "interview";

interface ActionItem {
  id: string;
  type: ItemType;
  title: string;
  description: string;
  urgency: Urgency;
  href: string;
  date?: Date;
}

const URGENCY_TONE: Record<Urgency, "danger" | "warning" | "info"> = {
  high: "danger",
  medium: "warning",
  low: "info",
};

const URGENCY_BORDER: Record<Urgency, string> = {
  high: "border-l-danger",
  medium: "border-l-warning",
  low: "border-l-info",
};

const TYPE_ICON: Record<ItemType, React.ReactNode> = {
  document: <Upload className="h-4 w-4" />,
  deadline: <CalendarClock className="h-4 w-4" />,
  status: <CheckCircle2 className="h-4 w-4" />,
  interview: <FileText className="h-4 w-4" />,
};

const TYPE_LABEL: Record<ItemType, string> = {
  document: "Upload needed",
  deadline: "Deadline",
  status: "Status update",
  interview: "Action needed",
};

export default async function ClientNotifications() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const client = await prisma.client.findFirst({
    where: { userId: session.user.id, firmId: session.user.firmId! },
  });

  if (!client) {
    return (
      <>
        <PageHeader
          title="Notifications"
          description="Your account is being set up."
        />
        <EmptyState
          icon={<Bell className="h-5 w-5" />}
          title="No notifications yet"
        />
      </>
    );
  }

  const actionItems: ActionItem[] = [];

  const requestedDocs = await prisma.document.findMany({
    where: { clientId: client.id, status: "REQUESTED" },
    include: {
      taxReturn: { select: { entity: { select: { legalName: true } } } },
    },
  });
  for (const doc of requestedDocs) {
    actionItems.push({
      id: `doc-${doc.id}`,
      type: "document",
      title: `Upload: ${doc.label}`,
      description: doc.taxReturn
        ? `Requested for ${doc.taxReturn.entity.legalName}`
        : "Document requested by your preparer",
      urgency: "high",
      href: "/documents",
      date: doc.requestedAt,
    });
  }

  const rejectedDocs = await prisma.document.findMany({
    where: { clientId: client.id, status: "REJECTED" },
    include: {
      taxReturn: { select: { entity: { select: { legalName: true } } } },
    },
  });
  for (const doc of rejectedDocs) {
    actionItems.push({
      id: `doc-rej-${doc.id}`,
      type: "document",
      title: `Re-upload: ${doc.label}`,
      description:
        "This document was rejected. Please upload a corrected version.",
      urgency: "high",
      href: "/documents",
      date: doc.updatedAt,
    });
  }

  const intakeReturns = await prisma.taxReturn.findMany({
    where: {
      entity: { clientId: client.id },
      status: "INTAKE",
    },
    include: {
      entity: { select: { legalName: true } },
      _count: { select: { interviewResponses: true } },
    },
  });
  for (const ret of intakeReturns) {
    actionItems.push({
      id: `interview-${ret.id}`,
      type: "interview",
      title: `Complete interview: ${ret.entity.legalName}`,
      description: `${ret._count.interviewResponses} question${ret._count.interviewResponses === 1 ? "" : "s"} answered so far`,
      urgency: "medium",
      href: `/returns/${ret.id}/interview`,
    });
  }

  const urgentDeadlines = await prisma.deadline.findMany({
    where: {
      taxReturn: { entity: { clientId: client.id } },
      dueDate: {
        gte: new Date(),
        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    },
    include: {
      taxReturn: { select: { entity: { select: { legalName: true } } } },
    },
  });
  for (const dl of urgentDeadlines) {
    const days = daysUntilDeadline(dl.dueDate);
    actionItems.push({
      id: `deadline-${dl.id}`,
      type: "deadline",
      title:
        days === 0
          ? "Deadline today"
          : `Deadline in ${days} day${days === 1 ? "" : "s"}`,
      description: `${dl.deadlineType.replace(/_/g, " ")} for ${dl.taxReturn.entity.legalName}`,
      urgency: days <= 3 ? "high" : "medium",
      href: "/returns",
      date: dl.dueDate,
    });
  }

  const statusReturns = await prisma.taxReturn.findMany({
    where: {
      entity: { clientId: client.id },
      status: { in: ["APPROVED", "REVISION", "EXPORTED"] },
      updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    include: { entity: { select: { legalName: true } } },
  });
  for (const ret of statusReturns) {
    actionItems.push({
      id: `status-${ret.id}`,
      type: "status",
      title: `${ret.entity.legalName}: ${RETURN_STATUS_LABELS[ret.status]}`,
      description:
        ret.status === "APPROVED"
          ? "Your return has been approved and is ready for export."
          : ret.status === "EXPORTED"
            ? "Your return has been exported for filing."
            : "Your preparer has requested revisions.",
      urgency: "low",
      href: "/returns",
      date: ret.updatedAt,
    });
  }

  const urgencyOrder: Record<Urgency, number> = { high: 0, medium: 1, low: 2 };
  actionItems.sort((a, b) => {
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return (b.date?.getTime() || 0) - (a.date?.getTime() || 0);
  });

  const highCount = actionItems.filter((i) => i.urgency === "high").length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description={
          actionItems.length > 0
            ? `You have ${actionItems.length} item${actionItems.length === 1 ? "" : "s"} that need your attention.`
            : "You're all caught up."
        }
        meta={
          highCount > 0 && (
            <Badge tone="danger">
              {highCount} urgent
            </Badge>
          )
        }
      />

      {actionItems.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Inbox zero"
          description="Nothing requires your attention right now. We'll let you know when something does."
        />
      ) : (
        <div className="space-y-3">
          {actionItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`block rounded-lg border border-border-subtle border-l-4 ${URGENCY_BORDER[item.urgency]} bg-surface px-5 py-4 hover:shadow-sm transition-shadow`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-ink-subtle">
                      {TYPE_ICON[item.type]}
                    </span>
                    <h3 className="text-sm font-semibold text-ink truncate">
                      {item.title}
                    </h3>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {item.description}
                  </p>
                  {item.date && (
                    <p className="mt-1 text-xs text-ink-subtle">
                      {format(item.date, "MMM d, yyyy")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge tone={URGENCY_TONE[item.urgency]}>
                    {TYPE_LABEL[item.type]}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-ink-subtle" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
