import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    taxReturn: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    k1Link: {
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit/logger", () => ({
  logStatusChange: vi.fn(),
}));

import {
  canTransition,
  isBlocked,
  getBlockedState,
  transitionReturn,
} from "./status-machine";
import { prisma } from "@/lib/db";
import { logStatusChange } from "@/lib/audit/logger";

// Loose typing for the mocked Prisma client: tests construct partial row
// fixtures, which `vi.mocked(..., { deep: true })` would otherwise reject.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedPrisma = prisma as unknown as Record<string, Record<string, any>>;
const mockedLogStatusChange = vi.mocked(logStatusChange);

const buildReturn = (overrides: Record<string, unknown> = {}) => ({
  id: "return-1",
  status: "INTAKE" as const,
  taxYear: 2025,
  k1sReceivedByReturn: [],
  // Enough shape for notify.resolveClientContact to traverse without
  // throwing; the null email then short-circuits before any send.
  entity: {
    legalName: "Test Entity",
    client: {
      id: "client-1",
      displayName: "Test Client",
      email: null,
      user: null,
    },
  },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("canTransition", () => {
  it("permits the documented happy-path transitions", () => {
    expect(canTransition("INTAKE", "PREPARATION")).toBe(true);
    expect(canTransition("PREPARATION", "REVIEW")).toBe(true);
    expect(canTransition("REVIEW", "APPROVED")).toBe(true);
    expect(canTransition("APPROVED", "EXPORTED")).toBe(true);
  });

  it("permits revisions and re-blocking", () => {
    expect(canTransition("REVIEW", "REVISION")).toBe(true);
    expect(canTransition("REVISION", "REVIEW")).toBe(true);
    expect(canTransition("APPROVED", "REVISION")).toBe(true);
    expect(canTransition("PREPARATION", "PREPARATION_BLOCKED")).toBe(true);
    expect(canTransition("PREPARATION_BLOCKED", "PREPARATION")).toBe(true);
  });

  it("rejects skipping stages and exits from terminal status", () => {
    expect(canTransition("INTAKE", "REVIEW")).toBe(false);
    expect(canTransition("INTAKE", "APPROVED")).toBe(false);
    expect(canTransition("EXPORTED", "REVISION")).toBe(false);
    expect(canTransition("PREPARATION", "INTAKE")).toBe(false);
  });
});

describe("isBlocked / getBlockedState", () => {
  it("isBlocked recognizes both blocked states", () => {
    expect(isBlocked("INTAKE_BLOCKED")).toBe(true);
    expect(isBlocked("PREPARATION_BLOCKED")).toBe(true);
    expect(isBlocked("INTAKE")).toBe(false);
    expect(isBlocked("APPROVED")).toBe(false);
  });

  it("getBlockedState maps unblocked → blocked counterparts only", () => {
    expect(getBlockedState("INTAKE")).toBe("INTAKE_BLOCKED");
    expect(getBlockedState("PREPARATION")).toBe("PREPARATION_BLOCKED");
    expect(getBlockedState("REVIEW")).toBeNull();
    expect(getBlockedState("APPROVED")).toBeNull();
  });
});

describe("transitionReturn", () => {
  it("fails fast when the return id is not found", async () => {
    mockedPrisma.taxReturn.findUnique.mockResolvedValue(null);
    const result = await transitionReturn("missing", "PREPARATION", "actor-1");
    expect(result).toEqual({ success: false, error: "Return not found" });
    expect(mockedPrisma.taxReturn.update).not.toHaveBeenCalled();
  });

  it("rejects transitions that are not in the allow-list", async () => {
    mockedPrisma.taxReturn.findUnique.mockResolvedValue(buildReturn());
    const result = await transitionReturn("return-1", "REVIEW", "actor-1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Cannot transition from INTAKE to REVIEW/);
    expect(mockedPrisma.taxReturn.update).not.toHaveBeenCalled();
  });

  it("advances INTAKE → PREPARATION when there are no unresolved K-1s", async () => {
    mockedPrisma.taxReturn.findUnique.mockResolvedValue(buildReturn());
    mockedPrisma.taxReturn.update.mockResolvedValue({ id: "return-1", status: "PREPARATION" });

    const result = await transitionReturn("return-1", "PREPARATION", "actor-1", "ok");
    expect(result.success).toBe(true);
    expect(mockedPrisma.taxReturn.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "return-1" },
        data: expect.objectContaining({ status: "PREPARATION", statusNote: "ok" }),
      })
    );
    expect(mockedLogStatusChange).toHaveBeenCalledWith(
      "return-1",
      "actor-1",
      "INTAKE",
      "PREPARATION",
      "ok"
    );
  });

  it("blocks INTAKE → PREPARATION when upstream K-1s are unresolved", async () => {
    mockedPrisma.taxReturn.findUnique.mockResolvedValue(
      buildReturn({
        k1sReceivedByReturn: [
          { id: "k1-1", isResolved: false },
          { id: "k1-2", isResolved: false },
        ],
      })
    );
    mockedPrisma.taxReturn.update.mockResolvedValue({ id: "return-1", status: "INTAKE_BLOCKED" });

    const result = await transitionReturn("return-1", "PREPARATION", "actor-1");
    expect(result.success).toBe(true);
    expect(mockedPrisma.taxReturn.update).toHaveBeenCalledWith({
      where: { id: "return-1" },
      data: {
        status: "INTAKE_BLOCKED",
        isBlocked: true,
        blockedReason: "Waiting for K-1 data from 2 upstream return(s)",
      },
    });
    expect(mockedLogStatusChange).toHaveBeenCalledWith(
      "return-1",
      "actor-1",
      "INTAKE",
      "INTAKE_BLOCKED",
      "K-1 dependency"
    );
  });

  it("clears isBlocked + blockedReason when leaving a blocked state", async () => {
    mockedPrisma.taxReturn.findUnique.mockResolvedValue(
      buildReturn({ status: "INTAKE_BLOCKED" })
    );
    mockedPrisma.taxReturn.update.mockResolvedValue({ id: "return-1", status: "INTAKE" });

    await transitionReturn("return-1", "INTAKE", "actor-1");

    expect(mockedPrisma.taxReturn.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "INTAKE",
          isBlocked: false,
          blockedReason: null,
        }),
      })
    );
  });

  it("stamps submittedAt when entering REVIEW", async () => {
    mockedPrisma.taxReturn.findUnique.mockResolvedValue(buildReturn({ status: "PREPARATION" }));
    mockedPrisma.taxReturn.update.mockResolvedValue({ id: "return-1", status: "REVIEW" });

    await transitionReturn("return-1", "REVIEW", "actor-1");

    const updateCall = mockedPrisma.taxReturn.update.mock.calls[0][0];
    expect(updateCall.data).toHaveProperty("submittedAt");
    expect(updateCall.data.submittedAt).toBeInstanceOf(Date);
  });

  it("APPROVED resolves outgoing K-1 links and unblocks downstream returns", async () => {
    // Source return becoming APPROVED.
    mockedPrisma.taxReturn.findUnique.mockResolvedValue(
      buildReturn({ status: "REVIEW" })
    );
    mockedPrisma.taxReturn.update.mockResolvedValue({ id: "return-1", status: "APPROVED" });

    // Two outgoing K-1 links to two downstream INTAKE_BLOCKED returns.
    mockedPrisma.k1Link.findMany.mockResolvedValue([
      {
        id: "link-1",
        sourceReturnId: "return-1",
        targetReturnId: "downstream-A",
        isResolved: false,
        targetReturn: { id: "downstream-A", status: "INTAKE_BLOCKED" },
      },
      {
        id: "link-2",
        sourceReturnId: "return-1",
        targetReturnId: "downstream-B",
        isResolved: false,
        targetReturn: { id: "downstream-B", status: "INTAKE_BLOCKED" },
      },
    ]);
    mockedPrisma.k1Link.update.mockResolvedValue({ id: "link-1", isResolved: true });
    // Downstream-A has no more unresolved K-1s; downstream-B still has 1.
    mockedPrisma.k1Link.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    await transitionReturn("return-1", "APPROVED", "actor-1");

    // Both links marked resolved.
    expect(mockedPrisma.k1Link.update).toHaveBeenCalledTimes(2);
    expect(mockedPrisma.k1Link.update).toHaveBeenNthCalledWith(1, {
      where: { id: "link-1" },
      data: expect.objectContaining({ isResolved: true, resolvedAt: expect.any(Date) }),
    });

    // Downstream-A unblocked (status INTAKE_BLOCKED → INTAKE); downstream-B left alone.
    const downstreamUpdates = mockedPrisma.taxReturn.update.mock.calls.filter(
      (c: unknown[]) => (c[0] as { where: { id: string } }).where.id === "downstream-A"
    );
    expect(downstreamUpdates).toHaveLength(1);
    expect(downstreamUpdates[0][0]).toEqual({
      where: { id: "downstream-A" },
      data: { status: "INTAKE", isBlocked: false, blockedReason: null },
    });
    const downstreamBUpdates = mockedPrisma.taxReturn.update.mock.calls.filter(
      (c: unknown[]) => (c[0] as { where: { id: string } }).where.id === "downstream-B"
    );
    expect(downstreamBUpdates).toHaveLength(0);

    expect(mockedLogStatusChange).toHaveBeenCalledWith(
      "downstream-A",
      "actor-1",
      "INTAKE_BLOCKED",
      "INTAKE",
      "All K-1 dependencies resolved"
    );
  });
});
