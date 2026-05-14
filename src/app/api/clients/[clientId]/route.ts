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
} from "@/lib/api/helpers";
import { logAuditEvent } from "@/lib/audit/logger";

const UpdateClientSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  notes: z.string().max(5000).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { clientId } = await params;

  // CLIENT users can only view their own record
  if (user.role === "CLIENT") {
    const ownClient = await getClientRecordForUser(user.id, user.firmId);
    if (!ownClient || ownClient.id !== clientId) {
      return jsonError("Not found", 404);
    }
  }

  const client = await getClientScoped(clientId, user.firmId);
  if (!client) return jsonError("Not found", 404);

  const clientWithEntities = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      entities: {
        where: { isActive: true },
        include: {
          _count: { select: { taxReturns: true } },
        },
      },
      _count: { select: { documents: true } },
    },
  });

  return json({ client: clientWithEntities });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { clientId } = await params;

  const client = await getClientScoped(clientId, user.firmId);
  if (!client) return jsonError("Not found", 404);

  const { data, error: parseError } = await parseBody(req, UpdateClientSchema);
  if (parseError) return parseError;

  const updated = await prisma.client.update({
    where: { id: clientId },
    data: { ...data, updatedAt: new Date() },
  });

  await logAuditEvent({
    userId: user.id,
    eventType: "CLIENT_UPDATED",
    eventCategory: "CLIENT",
    description: `Client "${updated.displayName}" updated`,
    metadata: { clientId, changes: Object.keys(data) },
  });

  return json({ client: updated });
}
