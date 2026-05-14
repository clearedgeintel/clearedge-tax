import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  parseBody,
  json,
  jsonError,
} from "@/lib/api/helpers";
import { logAuditEvent } from "@/lib/audit/logger";

const UpdateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.enum(["CLIENT", "PREPARER", "MANAGER", "ADMIN"]).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { user, error } = await requireAuth("ADMIN");
  if (error) return error;

  const { userId } = await params;

  const targetUser = await prisma.user.findFirst({
    where: { id: userId, firmId: user.firmId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          assignedReturns: true,
          reviewingReturns: true,
        },
      },
    },
  });

  if (!targetUser) return jsonError("Not found", 404);

  return json({ user: targetUser });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { user, error } = await requireAuth("ADMIN");
  if (error) return error;

  const { userId } = await params;

  const targetUser = await prisma.user.findFirst({
    where: { id: userId, firmId: user.firmId },
  });
  if (!targetUser) return jsonError("Not found", 404);

  const { data, error: parseError } = await parseBody(req, UpdateUserSchema);
  if (parseError) return parseError;

  // Prevent admin from demoting themselves
  if (userId === user.id && data.role && data.role !== "ADMIN") {
    return jsonError("Cannot change your own role", 400);
  }

  // Prevent admin from deactivating themselves
  if (userId === user.id && data.isActive === false) {
    return jsonError("Cannot deactivate your own account", 400);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { ...data, updatedAt: new Date() },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      updatedAt: true,
    },
  });

  await logAuditEvent({
    userId: user.id,
    eventType: "USER_UPDATED",
    eventCategory: "ADMIN",
    description: `User "${updated.name}" updated`,
    metadata: { targetUserId: userId, changes: Object.keys(data) },
    critical: true,
  });

  return json({ user: updated });
}
