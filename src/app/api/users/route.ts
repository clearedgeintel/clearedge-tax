import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  parseBody,
  json,
  jsonError,
  getPagination,
  getSearchParams,
} from "@/lib/api/helpers";
import { logAuditEvent } from "@/lib/audit/logger";
import type { UserRole } from "@/generated/prisma/enums";

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  password: z.string().min(8).max(128),
  role: z.enum(["CLIENT", "PREPARER", "MANAGER", "ADMIN"]),
});

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth("ADMIN");
  if (error) return error;

  const { page, limit, skip } = getPagination(req);
  const params = getSearchParams(req);
  const role = params.get("role") as UserRole | null;
  const isActive = params.get("isActive");
  const search = params.get("search");

  const where = {
    firmId: user.firmId,
    ...(role ? { role } : {}),
    ...(isActive !== null && isActive !== "" ? { isActive: isActive === "true" } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return json({ users, total, page, limit });
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth("ADMIN");
  if (error) return error;

  const { data, error: parseError } = await parseBody(req, CreateUserSchema);
  if (parseError) return parseError;

  // Check for existing email
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existing) {
    return jsonError("Email already in use", 409);
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const newUser = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      passwordHash,
      role: data.role,
      firmId: user.firmId,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  await logAuditEvent({
    userId: user.id,
    eventType: "USER_CREATED",
    eventCategory: "ADMIN",
    description: `User "${newUser.name}" (${newUser.role}) created`,
    metadata: { newUserId: newUser.id, role: newUser.role },
    critical: true,
  });

  return json({ user: newUser }, 201);
}
