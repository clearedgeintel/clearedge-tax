import { NextRequest } from "next/server";
import { z } from "zod";
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

const CreateClientSchema = z.object({
  displayName: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  notes: z.string().max(5000).optional(),
});

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { page, limit, skip } = getPagination(req);
  const params = getSearchParams(req);
  const search = params.get("search");
  const isActive = params.get("isActive");

  const where = {
    firmId: user.firmId,
    ...(user.role === "CLIENT" ? { userId: user.id } : {}),
    ...(search
      ? { displayName: { contains: search, mode: "insensitive" as const } }
      : {}),
    ...(isActive !== null && isActive !== undefined && isActive !== ""
      ? { isActive: isActive === "true" }
      : {}),
  };

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      skip,
      take: limit,
      orderBy: { displayName: "asc" },
      include: {
        _count: { select: { entities: true, documents: true } },
      },
    }),
    prisma.client.count({ where }),
  ]);

  return json({ clients, total, page, limit });
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { data, error: parseError } = await parseBody(req, CreateClientSchema);
  if (parseError) return parseError;

  const client = await prisma.client.create({
    data: { ...data, firmId: user.firmId },
  });

  await logAuditEvent({
    userId: user.id,
    eventType: "CLIENT_CREATED",
    eventCategory: "CLIENT",
    description: `Client "${client.displayName}" created`,
    metadata: { clientId: client.id },
  });

  return json({ client }, 201);
}
