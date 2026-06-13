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

  it("April 15 in a non-weekend year passes through unchanged", () => {
    // April 15, 2024 = Monday.
    const filing = findFiling(computeDeadlines("INDIVIDUAL_1040", 2024))!;
    expect(filing.originalDueDate.toISOString().slice(0, 10)).toBe("2024-04-15");
    expect(filing.dueDate.toISOString().slice(0, 10)).toBe("2024-04-15");
  });

  it("April 15 falling on a Saturday rolls forward to the following Monday", () => {
    // April 15, 2017 = Saturday → Monday April 17, 2017.
    const filing = findFiling(computeDeadlines("INDIVIDUAL_1040", 2017))!;
    expect(filing.originalDueDate.toISOString().slice(0, 10)).toBe("2017-04-15");
    expect(filing.dueDate.toISOString().slice(0, 10)).toBe("2017-04-17");
  });

  it("Q4 estimated payment falls in the following calendar year (January 15)", () => {
    const q4 = findQ4(computeDeadlines("INDIVIDUAL_1040", 2024))!;
    expect(q4.originalDueDate.toISOString().slice(0, 10)).toBe("2025-01-15");
  });

  it("extension is exactly 6 months after the original FILING deadline", () => {
    const filing = findFiling(computeDeadlines("INDIVIDUAL_1040", 2024))!;
    // 2024-04-15 + 6 months = 2024-10-15 (Tuesday → no adjustment).
    expect(filing.extensionDueDate!.toISOString().slice(0, 10)).toBe("2024-10-15");
  });
});

describe("computeDeadlines — S_CORP_1120S", () => {
  it("uses a March 15 federal filing deadline", () => {
    // March 15, 2024 = Friday → no weekend adjust.
    const filing = findFiling(computeDeadlines("S_CORP_1120S", 2023))!;
    expect(filing.originalDueDate.toISOString().slice(0, 10)).toBe("2024-03-15");
    expect(filing.dueDate.toISOString().slice(0, 10)).toBe("2024-03-15");
  });

  it("rolls March 15 forward when it falls on a Sunday", () => {
    // March 15, 2020 = Sunday → Monday March 16, 2020.
    // Note: with month=3, computeDate sets calendarYear = taxYear + 1.
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

  it("NONPROFIT_990 FILING has a 6-month extension", () => {
    const filing = findFiling(computeDeadlines("NONPROFIT_990", 2024))!;
    expect(filing.originalDueDate.toISOString().slice(0, 10)).toBe("2024-05-15");
    expect(filing.extensionDueDate!.toISOString().slice(0, 10)).toBe("2024-11-15");
  });
});

describe("computeDeadlines — unknown entity types", () => {
  it("returns an empty array rather than throwing", () => {
    expect(computeDeadlines("NOT_A_REAL_TYPE" as EntityType, 2024)).toEqual([]);
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
