import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  parseBody,
  json,
  jsonError,
  getClientScoped,
  getClientRecordForUser,
  getSearchParams,
} from "@/lib/api/helpers";
import { logAuditEvent } from "@/lib/audit/logger";
import { encrypt, safeMaskTIN } from "@/lib/security/pii";

const CreateEntitySchema = z.object({
  entityType: z.enum([
    "INDIVIDUAL_1040",
    "S_CORP_1120S",
    "PARTNERSHIP_1065",
    "SOLE_PROP_SCHEDULE_C",
    "NONPROFIT_990N",
    "NONPROFIT_990EZ",
    "NONPROFIT_990",
    "NONPROFIT_990PF",
    "NONPROFIT_990T",
  ]),
  legalName: z.string().min(1).max(300),
  tin: z.string().max(11).optional(),
  tinType: z.enum(["SSN", "EIN"]).optional(),
  filingStatus: z.enum(["SINGLE", "MFJ", "MFS", "HOH", "QSS"]).optional(),
  dateOfBirth: z.string().optional(),
  dateOfFormation: z.string().optional(),
  stateOfFormation: z.string().max(2).optional(),
  address: z.any().optional(),
  metadata: z.any().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { clientId } = await params;

  if (user.role === "CLIENT") {
    const ownClient = await getClientRecordForUser(user.id, user.firmId);
    if (!ownClient || ownClient.id !== clientId) {
      return jsonError("Not found", 404);
    }
  } else {
    const client = await getClientScoped(clientId, user.firmId);
    if (!client) return jsonError("Not found", 404);
  }

  const searchParams = getSearchParams(req);
  const entityType = searchParams.get("entityType");
  const isActive = searchParams.get("isActive");

  const entities = await prisma.entity.findMany({
    where: {
      clientId,
      ...(entityType ? { entityType: entityType as never } : {}),
      ...(isActive !== null && isActive !== "" ? { isActive: isActive === "true" } : {}),
    },
    include: {
      _count: { select: { taxReturns: true } },
    },
    orderBy: { legalName: "asc" },
  });

  // List endpoints never return full TINs — mask every row.
  const masked = entities.map((e) => ({ ...e, tin: safeMaskTIN(e.tin) }));
  return json({ entities: masked });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { clientId } = await params;

  const client = await getClientScoped(clientId, user.firmId);
  if (!client) return jsonError("Not found", 404);

  const { data, error: parseError } = await parseBody(req, CreateEntitySchema);
  if (parseError) return parseError;

  const entity = await prisma.entity.create({
    data: {
      ...data,
      clientId,
      tin: data.tin ? encrypt(data.tin) : undefined,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      dateOfFormation: data.dateOfFormation ? new Date(data.dateOfFormation) : undefined,
    },
  });

  await logAuditEvent({
    userId: user.id,
    eventType: "ENTITY_CREATED",
    eventCategory: "CLIENT",
    description: `Entity "${entity.legalName}" (${entity.entityType}) created`,
    metadata: { entityId: entity.id, clientId, entityType: entity.entityType },
  });

  // Don't echo the freshly-encrypted TIN back as ciphertext; mask in the
  // response so the client knows the value was accepted without leaking it.
  return json({ entity: { ...entity, tin: safeMaskTIN(entity.tin) } }, 201);
}
