import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  json,
  jsonError,
  getReturnScoped,
} from "@/lib/api/helpers";
import { isStaff } from "@/lib/utils/permissions";
import { loadInterview, filingStatusToJsonId } from "@/lib/interview/loader";
import { filterForRole } from "@/lib/interview/section-utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { returnId } = await params;

  const taxReturn = await getReturnScoped(returnId, user.firmId);
  if (!taxReturn) return jsonError("Not found", 404);

  // Load entity to get type and filing status
  const entity = await prisma.entity.findUnique({
    where: { id: taxReturn.entityId },
    select: { entityType: true, filingStatus: true },
  });

  if (!entity) return jsonError("Entity not found", 404);

  const interview = loadInterview(entity.entityType);

  // Filter by role
  const sections = filterForRole(interview.sections, isStaff(user.role));

  return json({
    metadata: interview.metadata,
    sections,
    entityType: entity.entityType,
    filingStatus: entity.filingStatus
      ? filingStatusToJsonId(entity.filingStatus)
      : undefined,
  });
}
