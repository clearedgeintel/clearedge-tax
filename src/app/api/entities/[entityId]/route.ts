import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  parseBody,
  json,
  jsonError,
  getEntityScoped,
} from "@/lib/api/helpers";
import { logAuditEvent } from "@/lib/audit/logger";

const UpdateEntitySchema = z.object({
  legalName: z.string().min(1).max(300).optional(),
  tin: z.string().max(11).optional(),
  tinType: z.enum(["SSN", "EIN"]).optional(),
  filingStatus: z.enum(["SINGLE", "MFJ", "MFS", "HOH", "QSS"]).optional(),
  dateOfBirth: z.string().optional(),
  dateOfFormation: z.string().optional(),
  stateOfFormation: z.string().max(2).optional(),
  address: z.any().optional(),
  metadata: z.any().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { entityId } = await params;

  const entity = await getEntityScoped(entityId, user.firmId);
  if (!entity) return jsonError("Not found", 404);

  const entityDetail = await prisma.entity.findUnique({
    where: { id: entityId },
    include: {
      client: { select: { id: true, displayName: true } },
      taxReturns: {
        orderBy: { taxYear: "desc" },
        include: {
          _count: { select: { documents: true, interviewResponses: true } },
          deadlines: { where: { isPastDue: false }, orderBy: { dueDate: "asc" }, take: 3 },
        },
      },
      relationshipsFrom: {
        include: { toEntity: { select: { id: true, legalName: true, entityType: true } } },
      },
      relationshipsTo: {
        include: { fromEntity: { select: { id: true, legalName: true, entityType: true } } },
      },
    },
  });

  return json({ entity: entityDetail });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> }
) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { entityId } = await params;

  const entity = await getEntityScoped(entityId, user.firmId);
  if (!entity) return jsonError("Not found", 404);

  const { data, error: parseError } = await parseBody(req, UpdateEntitySchema);
  if (parseError) return parseError;

  const updated = await prisma.entity.update({
    where: { id: entityId },
    data: {
      ...data,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      dateOfFormation: data.dateOfFormation ? new Date(data.dateOfFormation) : undefined,
      updatedAt: new Date(),
    },
  });

  await logAuditEvent({
    userId: user.id,
    eventType: "ENTITY_UPDATED",
    eventCategory: "CLIENT",
    description: `Entity "${updated.legalName}" updated`,
    metadata: { entityId, changes: Object.keys(data) },
  });

  return json({ entity: updated });
}
