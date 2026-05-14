import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { RETURN_STATUS_LABELS } from "@/types/entities";
import { daysUntilDeadline } from "@/lib/deadlines/calculator";
import { format } from "date-fns";

interface ActionItem {
  id: string;
  type: "document" | "deadline" | "status" | "interview";
  title: string;
  description: string;
  urgency: "high" | "medium" | "low";
  href: string;
  date?: Date;
}

export default async function ClientNotifications() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const client = await prisma.client.findFirst({
    where: { userId: session.user.id, firmId: session.user.firmId! },
  });

  if (!client) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="mt-2 text-gray-600">Your account is being set up.</p>
      </div>
    );
  }

  // Gather action items
  const actionItems: ActionItem[] = [];

  // 1. Requested documents
  const requestedDocs = await prisma.document.findMany({
    where: { clientId: client.id, status: "REQUESTED" },
    include: { taxReturn: { select: { entity: { select: { legalName: true } } } } },
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

  // 2. Rejected documents (need re-upload)
  const rejectedDocs = await prisma.document.findMany({
    where: { clientId: client.id, status: "REJECTED" },
    include: { taxReturn: { select: { entity: { select: { legalName: true } } } } },
  });
  for (const doc of rejectedDocs) {
    actionItems.push({
      id: `doc-rej-${doc.id}`,
      type: "document",
      title: `Re-upload: ${doc.label}`,
      description: "This document was rejected. Please upload a corrected version.",
      urgency: "high",
      href: "/documents",
      date: doc.updatedAt,
    });
  }

  // 3. Returns in INTAKE (need interview completion)
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
      description: `${ret._count.interviewResponses} questions answered so far`,
      urgency: "medium",
      href: `/returns/${ret.id}/interview`,
    });
  }

  // 4. Upcoming deadlines (7 days or less)
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
      title: `Deadline in ${days} day${days !== 1 ? "s" : ""}`,
      description: `${dl.deadlineType.replace(/_/g, " ")} for ${dl.taxReturn.entity.legalName}`,
      urgency: days <= 3 ? "high" : "medium",
      href: "/returns",
      date: dl.dueDate,
    });
  }

  // 5. Status changes (recently approved or revision needed)
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
      description: ret.status === "APPROVED"
        ? "Your return has been approved and is ready for export."
        : ret.status === "EXPORTED"
        ? "Your return has been exported for filing."
        : "Your preparer has requested revisions.",
      urgency: "low",
      href: "/returns",
      date: ret.updatedAt,
    });
  }

  // Sort: high urgency first, then by date
  actionItems.sort((a, b) => {
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return (b.date?.getTime() || 0) - (a.date?.getTime() || 0);
  });

  const urgencyStyles = {
    high: "border-l-red-500 bg-red-50",
    medium: "border-l-amber-500 bg-amber-50",
    low: "border-l-blue-500 bg-blue-50",
  };

  const typeIcons: Record<string, string> = {
    document: "Upload needed",
    deadline: "Deadline",
    status: "Status update",
    interview: "Action needed",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
      <p className="mt-2 text-gray-600">
        {actionItems.length > 0
          ? `You have ${actionItems.length} item${actionItems.length !== 1 ? "s" : ""} requiring attention.`
          : "You're all caught up."}
      </p>

      {actionItems.length === 0 ? (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          No pending actions. Check back later.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {actionItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`block p-4 rounded-lg border-l-4 border border-gray-200 hover:shadow-sm transition-shadow ${urgencyStyles[item.urgency]}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{item.title}</h3>
                  <p className="mt-0.5 text-sm text-gray-600">{item.description}</p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 ml-4">
                  {typeIcons[item.type]}
                </span>
              </div>
              {item.date && (
                <p className="mt-1 text-xs text-gray-400">
                  {format(item.date, "MMM d, yyyy")}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
