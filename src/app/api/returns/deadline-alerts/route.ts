import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, json } from "@/lib/api/helpers";
import { daysUntilDeadline, deadlineSeverity } from "@/lib/deadlines/calculator";

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const firmId = user.firmId;

  // Get all upcoming deadlines for active returns (not exported)
  const deadlines = await prisma.deadline.findMany({
    where: {
      taxReturn: {
        entity: { client: { firmId } },
        status: { notIn: ["EXPORTED"] },
      },
      dueDate: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // include 7 days overdue
      },
    },
    orderBy: { dueDate: "asc" },
    include: {
      taxReturn: {
        select: {
          id: true,
          status: true,
          taxYear: true,
          preparer: { select: { id: true, name: true } },
          entity: {
            select: {
              legalName: true,
              entityType: true,
              client: { select: { displayName: true } },
            },
          },
        },
      },
    },
  });

  const alerts = deadlines.map((dl) => {
    const days = daysUntilDeadline(dl.dueDate);
    const severity = deadlineSeverity(days);
    return {
      id: dl.id,
      returnId: dl.taxReturn.id,
      entityName: dl.taxReturn.entity.legalName,
      clientName: dl.taxReturn.entity.client.displayName,
      entityType: dl.taxReturn.entity.entityType,
      returnStatus: dl.taxReturn.status,
      preparerName: dl.taxReturn.preparer?.name || null,
      deadlineType: dl.deadlineType,
      jurisdiction: dl.jurisdiction,
      dueDate: dl.dueDate.toISOString(),
      daysRemaining: days,
      severity,
      isExtended: dl.isExtended,
    };
  });

  // Separate by severity for easy consumption
  const overdue = alerts.filter((a) => a.severity === "overdue");
  const critical = alerts.filter((a) => a.severity === "critical");
  const warning = alerts.filter((a) => a.severity === "warning");

  return json({
    alerts,
    summary: {
      overdue: overdue.length,
      critical: critical.length,
      warning: warning.length,
      total: alerts.length,
    },
  });
}
