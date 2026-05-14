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

const CreateRelationshipSchema = z.object({
  toEntityId: z.string().min(1),
  relationshipType: z.enum([
    "SPOUSE",
    "DEPENDENT",
    "HOUSEHOLD_MEMBER",
    "PARENT_ENTITY",
    "SHAREHOLDER",
    "PARTNER",
    "OFFICER",
    "BOARD_MEMBER",
  ]),
  ownershipPct: z.number().min(0).max(100).optional(),
  metadata: z.any().optional(),
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

  const [outgoing, incoming] = await Promise.all([
    prisma.entityRelationship.findMany({
      where: { fromEntityId: entityId },
      include: { toEntity: { select: { id: true, legalName: true, entityType: true } } },
    }),
    prisma.entityRelationship.findMany({
      where: { toEntityId: entityId },
      include: { fromEntity: { select: { id: true, legalName: true, entityType: true } } },
    }),
  ]);

  return json({ outgoing, incoming });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> }
) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { entityId } = await params;

  const fromEntity = await getEntityScoped(entityId, user.firmId);
  if (!fromEntity) return jsonError("Not found", 404);

  const { data, error: parseError } = await parseBody(req, CreateRelationshipSchema);
  if (parseError) return parseError;

  // Verify target entity belongs to same firm
  const toEntity = await getEntityScoped(data.toEntityId, user.firmId);
  if (!toEntity) return jsonError("Target entity not found", 404);

  const relationship = await prisma.entityRelationship.create({
    data: {
      fromEntityId: entityId,
      toEntityId: data.toEntityId,
      relationshipType: data.relationshipType,
      ownershipPct: data.ownershipPct,
      metadata: data.metadata,
    },
    include: {
      toEntity: { select: { id: true, legalName: true, entityType: true } },
      fromEntity: { select: { id: true, legalName: true, entityType: true } },
    },
  });

  await logAuditEvent({
    userId: user.id,
    eventType: "RELATIONSHIP_CREATED",
    eventCategory: "CLIENT",
    description: `Relationship ${data.relationshipType} created between "${fromEntity.legalName}" and "${toEntity.legalName}"`,
    metadata: { relationshipId: relationship.id, fromEntityId: entityId, toEntityId: data.toEntityId },
  });

  return json({ relationship }, 201);
}
