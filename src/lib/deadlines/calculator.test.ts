import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityType } from "@/generated/prisma/enums";
import {
  computeDeadlines,
  daysUntilDeadline,
  deadlineSeverity,
} from "./calculator";

const findFiling = (deadlines: ReturnType<typeof computeDeadlines>) =>
  deadlines.find((d) => d.deadlineType === "FILING");
const findQ4 = (deadlines: ReturnType<typeof computeDeadlines>) =>
  deadlines.find((d) => d.deadlineType === "ESTIMATED_Q4");

describe("computeDeadlines — INDIVIDUAL_1040", () => {
  it("emits all 6 deadlines and the FILING entry has an extension", () => {
    const out = computeDeadlines("INDIVIDUAL_1040", 2024);
    expect(out).toHaveLength(6);
    const filing = findFiling(out)!;
    expect(filing.jurisdiction).toBe("FEDERAL");
    expect(filing.extensionDueDate).not.toBeNull();
  });

  it("FILING for income year T is due April 15 of T+1", () => {
    // taxYear 2024 → due April 15, 2025 (Tuesday → no weekend adjust).
    const filing = findFiling(computeDeadlines("INDIVIDUAL_1040", 2024))!;
    expect(filing.originalDueDate.toISOString().slice(0, 10)).toBe("2025-04-15");
    expect(filing.dueDate.toISOString().slice(0, 10)).toBe("2025-04-15");
  });

  it("April 15 falling on a Saturday rolls forward to the following Monday", () => {
    // taxYear 2016 → April 15, 2017 = Saturday → Monday April 17, 2017.
    const filing = findFiling(computeDeadlines("INDIVIDUAL_1040", 2016))!;
    expect(filing.originalDueDate.toISOString().slice(0, 10)).toBe("2017-04-15");
    expect(filing.dueDate.toISOString().slice(0, 10)).toBe("2017-04-17");
  });

  it("Q1 estimated stays in the income year (April 15 of T)", () => {
    // Quarterly payments belong to the income year itself, not T+1.
    const out = computeDeadlines("INDIVIDUAL_1040", 2024);
    const q1 = out.find((d) => d.deadlineType === "ESTIMATED_Q1")!;
    expect(q1.originalDueDate.toISOString().slice(0, 10)).toBe("2024-04-15");
  });

  it("Q4 estimated falls in January of T+1", () => {
    const q4 = findQ4(computeDeadlines("INDIVIDUAL_1040", 2024))!;
    expect(q4.originalDueDate.toISOString().slice(0, 10)).toBe("2025-01-15");
  });

  it("extension is exactly 6 months after the original FILING deadline", () => {
    const filing = findFiling(computeDeadlines("INDIVIDUAL_1040", 2024))!;
    // 2025-04-15 + 6 months = 2025-10-15 (Wednesday → no adjustment).
    expect(filing.extensionDueDate!.toISOString().slice(0, 10)).toBe("2025-10-15");
  });
});

describe("computeDeadlines — S_CORP_1120S", () => {
  it("FILING for income year T is due March 15 of T+1", () => {
    // taxYear 2023 → March 15, 2024 (Friday → no weekend adjust).
    const filing = findFiling(computeDeadlines("S_CORP_1120S", 2023))!;
    expect(filing.originalDueDate.toISOString().slice(0, 10)).toBe("2024-03-15");
    expect(filing.dueDate.toISOString().slice(0, 10)).toBe("2024-03-15");
  });

  it("rolls March 15 forward when it falls on a Sunday", () => {
    // taxYear 2019 → March 15, 2020 = Sunday → Monday March 16, 2020.
    const filing = findFiling(computeDeadlines("S_CORP_1120S", 2019))!;
    expect(filing.originalDueDate.toISOString().slice(0, 10)).toBe("2020-03-15");
    expect(filing.dueDate.toISOString().slice(0, 10)).toBe("2020-03-16");
  });
});

describe("computeDeadlines — nonprofits", () => {
  it("NONPROFIT_990N has a single FILING entry, no extension", () => {
    const out = computeDeadlines("NONPROFIT_990N", 2024);
    expect(out).toHaveLength(1);
    expect(out[0].deadlineType).toBe("FILING");
    expect(out[0].extensionDueDate).toBeNull();
  });

  it("NONPROFIT_990 FILING (income year T) is due May 15 of T+1, extends 6 months", () => {
    const filing = findFiling(computeDeadlines("NONPROFIT_990", 2024))!;
    expect(filing.originalDueDate.toISOString().slice(0, 10)).toBe("2025-05-15");
    // May 15 + 6 months = Nov 15, 2025 = Saturday → adjusted Monday Nov 17.
    expect(filing.extensionDueDate!.toISOString().slice(0, 10)).toBe("2025-11-17");
  });
});

describe("computeDeadlines — unknown entity types", () => {
  it("returns an empty array rather than throwing", () => {
    expect(computeDeadlines("NOT_A_REAL_TYPE" as EntityType, 2024)).toEqual([]);
  });
});

describe("computeDeadlines — state jurisdictions", () => {
  it("defaults to FEDERAL when no jurisdictions list is provided (backward compat)", () => {
    const out = computeDeadlines("INDIVIDUAL_1040", 2024);
    expect(out.every((d) => d.jurisdiction === "FEDERAL")).toBe(true);
  });

  it("emits federal + MN deadlines for an INDIVIDUAL_1040 when both are requested", () => {
    const out = computeDeadlines("INDIVIDUAL_1040", 2024, ["FEDERAL", "MN"]);
    const federalFiling = out.find(
      (d) => d.jurisdiction === "FEDERAL" && d.deadlineType === "FILING"
    );
    const mnFiling = out.find(
      (d) => d.jurisdiction === "MN" && d.deadlineType === "FILING"
    );
    expect(federalFiling?.originalDueDate.toISOString().slice(0, 10)).toBe("2025-04-15");
    expect(mnFiling?.originalDueDate.toISOString().slice(0, 10)).toBe("2025-04-15");
  });

  it("TX has no individual income tax — emits no INDIVIDUAL_1040 deadlines for TX", () => {
    const out = computeDeadlines("INDIVIDUAL_1040", 2024, ["FEDERAL", "TX"]);
    expect(out.some((d) => d.jurisdiction === "TX")).toBe(false);
    // Federal still present.
    expect(out.some((d) => d.jurisdiction === "FEDERAL")).toBe(true);
  });

  it("TX franchise tax fires for S-corps on May 15", () => {
    const out = computeDeadlines("S_CORP_1120S", 2024, ["TX"]);
    const txFiling = out.find(
      (d) => d.jurisdiction === "TX" && d.deadlineType === "FILING"
    );
    expect(txFiling?.originalDueDate.toISOString().slice(0, 10)).toBe("2025-05-15");
  });

  it("silently skips unknown state codes rather than throwing", () => {
    const out = computeDeadlines("INDIVIDUAL_1040", 2024, [
      "FEDERAL",
      "MN",
      "ZZ", // not a real state code
    ]);
    expect(out.some((d) => d.jurisdiction === "ZZ")).toBe(false);
    // The valid jurisdictions still produce their deadlines.
    expect(out.some((d) => d.jurisdiction === "FEDERAL")).toBe(true);
    expect(out.some((d) => d.jurisdiction === "MN")).toBe(true);
  });

  it("state FILING gets the same 6-month extension as federal", () => {
    const out = computeDeadlines("INDIVIDUAL_1040", 2024, ["MN"]);
    const mnFiling = out.find(
      (d) => d.jurisdiction === "MN" && d.deadlineType === "FILING"
    );
    // 2025-04-15 + 6 months = 2025-10-15 (Wednesday → no weekend adjust).
    expect(mnFiling?.extensionDueDate?.toISOString().slice(0, 10)).toBe("2025-10-15");
  });
});

describe("daysUntilDeadline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("future deadline returns a positive count", () => {
    expect(daysUntilDeadline(new Date("2025-06-11T12:00:00Z"))).toBe(10);
  });

  it("past deadline returns a negative count", () => {
    expect(daysUntilDeadline(new Date("2025-05-22T12:00:00Z"))).toBe(-10);
  });

  it("same-day deadline is 0", () => {
    expect(daysUntilDeadline(new Date("2025-06-01T12:00:00Z"))).toBe(0);
  });
});

describe("deadlineSeverity", () => {
  it("buckets days into overdue/critical/warning/normal", () => {
    expect(deadlineSeverity(-1)).toBe("overdue");
    expect(deadlineSeverity(0)).toBe("critical");
    expect(deadlineSeverity(7)).toBe("critical");
    expect(deadlineSeverity(8)).toBe("warning");
    expect(deadlineSeverity(30)).toBe("warning");
    expect(deadlineSeverity(31)).toBe("normal");
    expect(deadlineSeverity(365)).toBe("normal");
  });
});
