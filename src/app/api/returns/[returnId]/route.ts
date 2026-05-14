import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  parseBody,
  json,
  jsonError,
  getReturnScoped,
} from "@/lib/api/helpers";
import { logAuditEvent } from "@/lib/audit/logger";

const UpdateReturnSchema = z.object({
  preparerId: z.string().optional(),
  reviewerId: z.string().optional(),
  filingJurisdictions: z.array(z.string()).optional(),
  extensionFiled: z.boolean().optional(),
  statusNote: z.string().max(2000).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { returnId } = await params;

  const taxReturn = await getReturnScoped(returnId, user.firmId);
  if (!taxReturn) return jsonError("Not found", 404);

  const detail = await prisma.taxReturn.findUnique({
    where: { id: returnId },
    include: {
      entity: {
        include: {
          client: { select: { id: true, displayName: true } },
        },
      },
      preparer: { select: { id: true, name: true, email: true } },
      reviewer: { select: { id: true, name: true, email: true } },
      deadlines: { orderBy: { dueDate: "asc" } },
      documents: { orderBy: { createdAt: "desc" } },
      k1sReceivedByReturn: {
        include: {
          sourceReturn: {
            select: { id: true, status: true, entity: { select: { legalName: true } } },
          },
        },
      },
      k1sIssuedByReturn: {
        include: {
          targetReturn: {
            select: { id: true, status: true, entity: { select: { legalName: true } } },
          },
        },
      },
      _count: { select: { interviewResponses: true, reviewActions: true } },
    },
  });

  return json({ return: detail });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { returnId } = await params;

  const taxReturn = await getReturnScoped(returnId, user.firmId);
  if (!taxReturn) return jsonError("Not found", 404);

  const { data, error: parseError } = await parseBody(req, UpdateReturnSchema);
  if (parseError) return parseError;

  const updated = await prisma.taxReturn.update({
    where: { id: returnId },
    data: { ...data, updatedAt: new Date() },
  });

  await logAuditEvent({
    returnId,
    userId: user.id,
    eventType: "RETURN_UPDATED",
    eventCategory: "RETURN",
    description: `Return metadata updated`,
    metadata: { changes: Object.keys(data) },
  });

  return json({ return: updated });
}
