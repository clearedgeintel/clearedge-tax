import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  json,
  getPagination,
  getSearchParams,
} from "@/lib/api/helpers";
import type { ReturnStatus } from "@/generated/prisma/enums";

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { page, limit, skip } = getPagination(req);
  const params = getSearchParams(req);

  const status = params.get("status") as ReturnStatus | null;
  const preparerId = params.get("preparerId");
  const reviewerId = params.get("reviewerId");
  const taxYear = params.get("taxYear");
  const search = params.get("search");
  const isBlocked = params.get("isBlocked");

  const where = {
    entity: { client: { firmId: user.firmId } },
    ...(status ? { status } : {}),
    ...(preparerId ? { preparerId } : {}),
    ...(reviewerId ? { reviewerId } : {}),
    ...(taxYear ? { taxYear: parseInt(taxYear, 10) } : {}),
    ...(isBlocked !== null && isBlocked !== "" ? { isBlocked: isBlocked === "true" } : {}),
    ...(search
      ? { entity: { client: { firmId: user.firmId }, legalName: { contains: search, mode: "insensitive" as const } } }
      : {}),
  };

  const [returns, total] = await Promise.all([
    prisma.taxReturn.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        entity: {
          select: {
            id: true,
            legalName: true,
            entityType: true,
            client: { select: { id: true, displayName: true } },
          },
        },
        preparer: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
        deadlines: {
          where: { isPastDue: false },
          orderBy: { dueDate: "asc" },
          take: 1,
        },
        _count: { select: { documents: true, interviewResponses: true } },
      },
    }),
    prisma.taxReturn.count({ where }),
  ]);

  return json({ returns, total, page, limit });
}
