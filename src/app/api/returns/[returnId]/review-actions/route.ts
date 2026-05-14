import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  parseBody,
  json,
  jsonError,
  getReturnScoped,
} from "@/lib/api/helpers";
import { transitionReturn } from "@/lib/sequencing/status-machine";
import { isManager } from "@/lib/utils/permissions";
import type { ReturnStatus, ReviewActionType } from "@/generated/prisma/enums";

const CreateReviewActionSchema = z.object({
  action: z.enum([
    "SUBMITTED_FOR_REVIEW",
    "APPROVED",
    "REJECTED",
    "REVISION_COMPLETE",
    "EXPORTED",
  ]),
  notes: z.string().max(5000).optional(),
});

// Maps review actions to the corresponding status transitions
const ACTION_TO_STATUS: Record<string, ReturnStatus> = {
  SUBMITTED_FOR_REVIEW: "REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REVISION",
  REVISION_COMPLETE: "REVIEW",
  EXPORTED: "EXPORTED",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { returnId } = await params;

  const taxReturn = await getReturnScoped(returnId, user.firmId);
  if (!taxReturn) return jsonError("Not found", 404);

  const actions = await prisma.reviewAction.findMany({
    where: { returnId },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
  });

  return json({ actions });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { returnId } = await params;

  const taxReturn = await getReturnScoped(returnId, user.firmId);
  if (!taxReturn) return jsonError("Not found", 404);

  const { data, error: parseError } = await parseBody(req, CreateReviewActionSchema);
  if (parseError) return parseError;

  // APPROVED, REJECTED, EXPORTED require MANAGER+
  if (
    (data.action === "APPROVED" || data.action === "REJECTED" || data.action === "EXPORTED") &&
    !isManager(user.role)
  ) {
    return jsonError("Only managers can approve, reject, or export returns", 403);
  }

  // Create the review action record
  const reviewAction = await prisma.reviewAction.create({
    data: {
      returnId,
      userId: user.id,
      action: data.action as ReviewActionType,
      notes: data.notes,
    },
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
  });

  // Trigger the corresponding status transition
  const nextStatus = ACTION_TO_STATUS[data.action];
  if (nextStatus) {
    const result = await transitionReturn(returnId, nextStatus, user.id, data.notes);
    if (!result.success) {
      return jsonError(result.error || "Status transition failed", 400);
    }
  }

  return json({ reviewAction }, 201);
}
