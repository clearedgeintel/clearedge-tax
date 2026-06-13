import { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireAuth,
  parseBody,
  json,
  jsonError,
  getReturnScoped,
} from "@/lib/api/helpers";
import { transitionReturn } from "@/lib/sequencing/status-machine";
import { isManager } from "@/lib/utils/permissions";
import type { ReturnStatus } from "@/generated/prisma/enums";

const TransitionSchema = z.object({
  nextStatus: z.enum([
    "INTAKE",
    "INTAKE_BLOCKED",
    "PREPARATION",
    "PREPARATION_BLOCKED",
    "REVIEW",
    "REVISION",
    "PARTNER_REVIEW",
    "APPROVED",
    "EXPORTED",
  ]),
  note: z.string().max(2000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { returnId } = await params;

  const taxReturn = await getReturnScoped(returnId, user.firmId);
  if (!taxReturn) return jsonError("Not found", 404);

  const { data, error: parseError } = await parseBody(req, TransitionSchema);
  if (parseError) return parseError;

  // APPROVED requires MANAGER+
  if (data.nextStatus === "APPROVED" && !isManager(user.role)) {
    return jsonError("Only managers can approve returns", 403);
  }

  // EXPORTED requires MANAGER+
  if (data.nextStatus === "EXPORTED" && !isManager(user.role)) {
    return jsonError("Only managers can export returns", 403);
  }

  const result = await transitionReturn(
    returnId,
    data.nextStatus as ReturnStatus,
    user.id,
    data.note
  );

  if (!result.success) {
    return jsonError(result.error || "Transition failed", 400);
  }

  return json({ return: result.return });
}
