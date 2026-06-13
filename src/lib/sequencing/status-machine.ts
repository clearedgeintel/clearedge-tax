import type { ReturnStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { logStatusChange } from "@/lib/audit/logger";
import { notifyStatusChange } from "@/lib/comms/notify";

const VALID_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  INTAKE: ["INTAKE_BLOCKED", "PREPARATION"],
  INTAKE_BLOCKED: ["INTAKE"],
  PREPARATION: ["PREPARATION_BLOCKED", "REVIEW"],
  PREPARATION_BLOCKED: ["PREPARATION"],
  REVIEW: ["APPROVED", "REVISION"],
  REVISION: ["REVIEW"],
  APPROVED: ["EXPORTED", "REVISION"],
  EXPORTED: [],
};

const BLOCKED_STATES: ReturnStatus[] = ["INTAKE_BLOCKED", "PREPARATION_BLOCKED"];
const UNBLOCKED_MAP: Record<string, ReturnStatus> = {
  INTAKE_BLOCKED: "INTAKE",
  PREPARATION_BLOCKED: "PREPARATION",
};

export function canTransition(
  current: ReturnStatus,
  next: ReturnStatus
): boolean {
  return VALID_TRANSITIONS[current]?.includes(next) ?? false;
}

export function isBlocked(status: ReturnStatus): boolean {
  return BLOCKED_STATES.includes(status);
}

export function getBlockedState(status: ReturnStatus): ReturnStatus | null {
  if (status === "INTAKE") return "INTAKE_BLOCKED";
  if (status === "PREPARATION") return "PREPARATION_BLOCKED";
  return null;
}

interface TransitionResult {
  success: boolean;
  error?: string;
  return?: Awaited<ReturnType<typeof prisma.taxReturn.findUnique>>;
}

export async function transitionReturn(
  returnId: string,
  nextStatus: ReturnStatus,
  actorId: string,
  note?: string
): Promise<TransitionResult> {
  const taxReturn = await prisma.taxReturn.findUnique({
    where: { id: returnId },
    include: {
      k1sReceivedByReturn: true,
    },
  });

  if (!taxReturn) {
    return { success: false, error: "Return not found" };
  }

  const currentStatus = taxReturn.status;

  // Validate transition
  if (!canTransition(currentStatus, nextStatus)) {
    return {
      success: false,
      error: `Cannot transition from ${currentStatus} to ${nextStatus}`,
    };
  }

  // If moving to PREPARATION, check K-1 dependencies
  if (nextStatus === "PREPARATION") {
    const unresolvedK1s = taxReturn.k1sReceivedByReturn.filter(
      (k1) => !k1.isResolved
    );
    if (unresolvedK1s.length > 0) {
      // Block instead of advancing
      const updated = await prisma.taxReturn.update({
        where: { id: returnId },
        data: {
          status: "INTAKE_BLOCKED",
          isBlocked: true,
          blockedReason: `Waiting for K-1 data from ${unresolvedK1s.length} upstream return(s)`,
        },
      });
      await logStatusChange(returnId, actorId, currentStatus, "INTAKE_BLOCKED", "K-1 dependency");
      await notifyStatusChange({
        returnId,
        newStatus: "INTAKE_BLOCKED",
        note: "Waiting on K-1 from an upstream return",
      });
      return { success: true, return: updated };
    }
  }

  // Build update data
  const updateData: Record<string, unknown> = {
    status: nextStatus,
    statusNote: note || null,
  };

  // Set timestamps based on transition
  if (nextStatus === "REVIEW") {
    updateData.submittedAt = new Date();
  } else if (nextStatus === "APPROVED") {
    updateData.approvedAt = new Date();
  } else if (nextStatus === "EXPORTED") {
    updateData.exportedAt = new Date();
  }

  // Clear blocked state if transitioning out of a blocked state
  if (isBlocked(currentStatus)) {
    updateData.isBlocked = false;
    updateData.blockedReason = null;
  }

  const updated = await prisma.taxReturn.update({
    where: { id: returnId },
    data: updateData,
  });

  await logStatusChange(returnId, actorId, currentStatus, nextStatus, note);

  // Notify the client about status changes they care about. Best-effort:
  // notifyStatusChange swallows errors so a comms blip can't roll back
  // the transition or its audit log entry.
  await notifyStatusChange({ returnId, newStatus: nextStatus, note });

  // If a business return was just APPROVED, resolve K-1 links and unblock downstream
  if (nextStatus === "APPROVED") {
    await resolveK1Links(returnId, actorId);
  }

  return { success: true, return: updated };
}

async function resolveK1Links(
  sourceReturnId: string,
  actorId: string
): Promise<void> {
  // Find all K1Links where this return is the source
  const k1Links = await prisma.k1Link.findMany({
    where: { sourceReturnId, isResolved: false },
    include: { targetReturn: true },
  });

  for (const link of k1Links) {
    // Mark K1Link as resolved
    await prisma.k1Link.update({
      where: { id: link.id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
      },
    });

    // Check if the target return can be unblocked
    const targetReturn = link.targetReturn;
    if (isBlocked(targetReturn.status)) {
      // Check if ALL K-1 dependencies for this target are now resolved
      const remainingUnresolved = await prisma.k1Link.count({
        where: {
          targetReturnId: targetReturn.id,
          isResolved: false,
        },
      });

      if (remainingUnresolved === 0) {
        const unblockedStatus = UNBLOCKED_MAP[targetReturn.status];
        if (unblockedStatus) {
          await prisma.taxReturn.update({
            where: { id: targetReturn.id },
            data: {
              status: unblockedStatus,
              isBlocked: false,
              blockedReason: null,
            },
          });
          await logStatusChange(
            targetReturn.id,
            actorId,
            targetReturn.status,
            unblockedStatus,
            "All K-1 dependencies resolved"
          );
        }
      }
    }
  }
}
