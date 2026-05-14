import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  json,
  jsonError,
  getReturnScoped,
} from "@/lib/api/helpers";
import { daysUntilDeadline, deadlineSeverity } from "@/lib/deadlines/calculator";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { returnId } = await params;

  const taxReturn = await getReturnScoped(returnId, user.firmId);
  if (!taxReturn) return jsonError("Not found", 404);

  const deadlines = await prisma.deadline.findMany({
    where: { returnId },
    orderBy: { dueDate: "asc" },
  });

  const enriched = deadlines.map((d) => {
    const daysRemaining = daysUntilDeadline(d.dueDate);
    return {
      ...d,
      daysRemaining,
      severity: deadlineSeverity(daysRemaining),
    };
  });

  return json({ deadlines: enriched });
}
