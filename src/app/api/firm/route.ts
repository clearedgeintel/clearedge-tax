import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  parseBody,
  json,
  jsonError,
} from "@/lib/api/helpers";
import { AddressSchema } from "@/lib/api/schemas";
import { logAuditEvent } from "@/lib/audit/logger";

const UpdateFirmSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  ein: z.string().max(11).optional(),
  address: AddressSchema,
  phone: z.string().max(20).optional(),
});

export async function GET(_req: NextRequest) {
  const { user, error } = await requireAuth("ADMIN");
  if (error) return error;

  const firm = await prisma.firm.findUnique({
    where: { id: user.firmId },
    include: {
      _count: { select: { users: true, clients: true } },
    },
  });

  if (!firm) return jsonError("Firm not found", 404);

  return json({ firm });
}

export async function PATCH(req: NextRequest) {
  const { user, error } = await requireAuth("ADMIN");
  if (error) return error;

  const { data, error: parseError } = await parseBody(req, UpdateFirmSchema);
  if (parseError) return parseError;

  const updated = await prisma.firm.update({
    where: { id: user.firmId },
    data: { ...data, updatedAt: new Date() },
  });

  await logAuditEvent({
    userId: user.id,
    eventType: "FIRM_UPDATED",
    eventCategory: "ADMIN",
    description: `Firm settings updated`,
    metadata: { changes: Object.keys(data) },
    critical: true,
  });

  return json({ firm: updated });
}
