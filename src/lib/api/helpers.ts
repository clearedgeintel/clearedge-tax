import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasRole } from "@/lib/utils/permissions";
import { ZodSchema, ZodError } from "zod";
import type { UserRole } from "@/generated/prisma/enums";

// ─── Response helpers ───────────────────────────────────────────────────────

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// ─── Auth types ─────────────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  firmId: string;
}

type AuthSuccess = { user: SessionUser; error?: never };
type AuthFailure = { user?: never; error: NextResponse };

// ─── Auth guard ─────────────────────────────────────────────────────────────

export async function requireAuth(
  minRole?: UserRole
): Promise<AuthSuccess | AuthFailure> {
  const session = await auth();
  if (!session?.user) {
    return { error: jsonError("Unauthorized", 401) };
  }
  if (!session.user.firmId) {
    return { error: jsonError("No firm association", 403) };
  }
  if (minRole && !hasRole(session.user.role, minRole)) {
    return { error: jsonError("Forbidden", 403) };
  }
  return { user: session.user as SessionUser };
}

// ─── Request body parsing ───────────────────────────────────────────────────

type ParseSuccess<T> = { data: T; error?: never };
type ParseFailure = { data?: never; error: NextResponse };

export async function parseBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<ParseSuccess<T> | ParseFailure> {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    return { data };
  } catch (e) {
    if (e instanceof ZodError) {
      return {
        error: NextResponse.json(
          { error: "Validation failed", details: e.issues },
          { status: 400 }
        ),
      };
    }
    return { error: jsonError("Invalid request body", 400) };
  }
}

// ─── Query param parsing ────────────────────────────────────────────────────

export function getSearchParams(req: NextRequest) {
  return req.nextUrl.searchParams;
}

export function getPagination(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(params.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") || "25", 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

// ─── Firm-scoped lookups ────────────────────────────────────────────────────

export async function getClientScoped(clientId: string, firmId: string) {
  return prisma.client.findFirst({
    where: { id: clientId, firmId },
  });
}

export async function getEntityScoped(entityId: string, firmId: string) {
  return prisma.entity.findFirst({
    where: { id: entityId, client: { firmId } },
  });
}

export async function getReturnScoped(returnId: string, firmId: string) {
  return prisma.taxReturn.findFirst({
    where: { id: returnId, entity: { client: { firmId } } },
  });
}

export async function getClientRecordForUser(userId: string, firmId: string) {
  return prisma.client.findFirst({
    where: { userId, firmId },
  });
}
