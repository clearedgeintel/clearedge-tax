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
import { computeDeadlines } from "@/lib/deadlines/calculator";
import { logAuditEvent } from "@/lib/audit/logger";

const CreateReturnSchema = z.object({
  taxYear: z.number().int().min(2024),
  filingJurisdictions: z.array(z.string()).optional(),
  preparerId: z.string().optional(),
  reviewerId: z.string().optional(),
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

  const returns = await prisma.taxReturn.findMany({
    where: { entityId },
    orderBy: { taxYear: "desc" },
    include: {
      preparer: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
      deadlines: { orderBy: { dueDate: "asc" } },
      _count: { select: { documents: true, interviewResponses: true } },
    },
  });

  return json({ returns });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> }
) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { entityId } = await params;

  const entity = await getEntityScoped(entityId, user.firmId);
  if (!entity) return jsonError("Not found", 404);

  const { data, error: parseError } = await parseBody(req, CreateReturnSchema);
  if (parseError) return parseError;

  // Check uniqueness
  const existing = await prisma.taxReturn.findUnique({
    where: { entityId_taxYear: { entityId, taxYear: data.taxYear } },
  });
  if (existing) {
    return jsonError(`A return already exists for tax year ${data.taxYear}`, 409);
  }

  // Create return and auto-compute deadlines in a transaction
  const deadlineData = computeDeadlines(entity.entityType, data.taxYear);

  const taxReturn = await prisma.$transaction(async (tx) => {
    const created = await tx.taxReturn.create({
      data: {
        entityId,
        taxYear: data.taxYear,
        filingJurisdictions: data.filingJurisdictions || [],
        preparerId: data.preparerId,
        reviewerId: data.reviewerId,
      },
    });

    if (deadlineData.length > 0) {
      await tx.deadline.createMany({
        data: deadlineData.map((d) => ({
          returnId: created.id,
          deadlineType: d.deadlineType,
          jurisdiction: d.jurisdiction,
          dueDate: d.dueDate,
          originalDueDate: d.originalDueDate,
          extensionDueDate: d.extensionDueDate,
        })),
      });
    }

    return created;
  });

  const returnWithDeadlines = await prisma.taxReturn.findUnique({
    where: { id: taxReturn.id },
    include: {
      deadlines: { orderBy: { dueDate: "asc" } },
      entity: { select: { id: true, legalName: true, entityType: true } },
    },
  });

  await logAuditEvent({
    returnId: taxReturn.id,
    userId: user.id,
    eventType: "RETURN_CREATED",
    eventCategory: "RETURN",
    description: `Tax return created for ${entity.legalName} (${data.taxYear})`,
    metadata: { entityId, taxYear: data.taxYear },
    critical: true,
  });

  return json({ return: returnWithDeadlines }, 201);
}
