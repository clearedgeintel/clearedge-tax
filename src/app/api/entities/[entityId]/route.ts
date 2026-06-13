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
import { logAuditEvent, logPIIAccess } from "@/lib/audit/logger";
import { decrypt, encrypt, safeMaskTIN } from "@/lib/security/pii";
import { isStaff } from "@/lib/utils/permissions";

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
  if (!entityDetail) return jsonError("Not found", 404);

  // TIN handling: mask by default. Staff can request the full value with
  // `?fullTin=1`, which logs a PII_FULL_VIEW audit event.
  const url = new URL(_req.url);
  const wantsFull = url.searchParams.get("fullTin") === "1";
  let tinForResponse: string;
  if (wantsFull && isStaff(user.role) && entityDetail.tin) {
    try {
      tinForResponse = decrypt(entityDetail.tin);
      await logPIIAccess(user.id, "tin", { entityId }, "fullTin=1 requested");
    } catch {
      tinForResponse = safeMaskTIN(entityDetail.tin);
    }
  } else {
    tinForResponse = safeMaskTIN(entityDetail.tin);
  }

  return json({
    entity: { ...entityDetail, tin: tinForResponse },
    tinMasked: !wantsFull || !isStaff(user.role),
  });
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
      tin: data.tin !== undefined ? encrypt(data.tin) : undefined,
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

  return json({ entity: { ...updated, tin: safeMaskTIN(updated.tin) } });
}
