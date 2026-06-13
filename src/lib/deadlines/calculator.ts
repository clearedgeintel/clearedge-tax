import { addMonths, addDays, isWeekend, nextMonday } from "date-fns";
import type { EntityType, DeadlineType } from "@/generated/prisma/enums";

interface DeadlineConfig {
  type: DeadlineType;
  month: number; // 1-based
  day: number;
  jurisdiction: string;
}

// Federal deadline configurations by entity type
const ENTITY_DEADLINES: Record<string, DeadlineConfig[]> = {
  INDIVIDUAL_1040: [
    { type: "FILING", month: 4, day: 15, jurisdiction: "FEDERAL" },
    { type: "EXTENSION_FILING", month: 4, day: 15, jurisdiction: "FEDERAL" },
    { type: "ESTIMATED_Q1", month: 4, day: 15, jurisdiction: "FEDERAL" },
    { type: "ESTIMATED_Q2", month: 6, day: 15, jurisdiction: "FEDERAL" },
    { type: "ESTIMATED_Q3", month: 9, day: 15, jurisdiction: "FEDERAL" },
    { type: "ESTIMATED_Q4", month: 1, day: 15, jurisdiction: "FEDERAL" },
  ],
  S_CORP_1120S: [
    { type: "FILING", month: 3, day: 15, jurisdiction: "FEDERAL" },
    { type: "EXTENSION_FILING", month: 3, day: 15, jurisdiction: "FEDERAL" },
  ],
  PARTNERSHIP_1065: [
    { type: "FILING", month: 3, day: 15, jurisdiction: "FEDERAL" },
    { type: "EXTENSION_FILING", month: 3, day: 15, jurisdiction: "FEDERAL" },
  ],
  SOLE_PROP_SCHEDULE_C: [
    { type: "FILING", month: 4, day: 15, jurisdiction: "FEDERAL" },
    { type: "ESTIMATED_Q1", month: 4, day: 15, jurisdiction: "FEDERAL" },
    { type: "ESTIMATED_Q2", month: 6, day: 15, jurisdiction: "FEDERAL" },
    { type: "ESTIMATED_Q3", month: 9, day: 15, jurisdiction: "FEDERAL" },
    { type: "ESTIMATED_Q4", month: 1, day: 15, jurisdiction: "FEDERAL" },
  ],
  NONPROFIT_990N: [
    { type: "FILING", month: 5, day: 15, jurisdiction: "FEDERAL" },
  ],
  NONPROFIT_990EZ: [
    { type: "FILING", month: 5, day: 15, jurisdiction: "FEDERAL" },
    { type: "EXTENSION_FILING", month: 5, day: 15, jurisdiction: "FEDERAL" },
  ],
  NONPROFIT_990: [
    { type: "FILING", month: 5, day: 15, jurisdiction: "FEDERAL" },
    { type: "EXTENSION_FILING", month: 5, day: 15, jurisdiction: "FEDERAL" },
  ],
  NONPROFIT_990PF: [
    { type: "FILING", month: 5, day: 15, jurisdiction: "FEDERAL" },
    { type: "EXTENSION_FILING", month: 5, day: 15, jurisdiction: "FEDERAL" },
    { type: "ESTIMATED_Q1", month: 5, day: 15, jurisdiction: "FEDERAL" },
    { type: "ESTIMATED_Q2", month: 8, day: 15, jurisdiction: "FEDERAL" },
    { type: "ESTIMATED_Q3", month: 11, day: 15, jurisdiction: "FEDERAL" },
    { type: "ESTIMATED_Q4", month: 2, day: 15, jurisdiction: "FEDERAL" },
  ],
  NONPROFIT_990T: [
    { type: "FILING", month: 5, day: 15, jurisdiction: "FEDERAL" },
    { type: "EXTENSION_FILING", month: 5, day: 15, jurisdiction: "FEDERAL" },
    { type: "ESTIMATED_Q1", month: 4, day: 15, jurisdiction: "FEDERAL" },
    { type: "ESTIMATED_Q2", month: 6, day: 15, jurisdiction: "FEDERAL" },
    { type: "ESTIMATED_Q3", month: 9, day: 15, jurisdiction: "FEDERAL" },
    { type: "ESTIMATED_Q4", month: 12, day: 15, jurisdiction: "FEDERAL" },
  ],
};

// Extension durations by entity type (months from original deadline)
const EXTENSION_DURATIONS: Record<string, number> = {
  INDIVIDUAL_1040: 6,       // April 15 -> October 15
  S_CORP_1120S: 6,          // March 15 -> September 15
  PARTNERSHIP_1065: 6,      // March 15 -> September 15
  SOLE_PROP_SCHEDULE_C: 6,  // April 15 -> October 15
  NONPROFIT_990EZ: 6,       // May 15 -> November 15
  NONPROFIT_990: 6,         // May 15 -> November 15
  NONPROFIT_990PF: 6,       // May 15 -> November 15
  NONPROFIT_990T: 6,        // May 15 -> November 15
};

/**
 * Adjusts a date to the next business day if it falls on a weekend.
 * Does not account for federal holidays — that would require a holiday calendar.
 */
function adjustForWeekend(date: Date): Date {
  if (isWeekend(date)) {
    return nextMonday(date);
  }
  return date;
}

/**
 * `taxYear` here is the income year (IRS convention, matching prisma/seed.ts).
 * - FILING / EXTENSION_FILING for income year T are always due in calendar year T+1.
 * - Estimated payments use the month: Jan/Feb/Mar belongs to T+1 (Q4-style),
 *   anything later belongs to T (in-year quarterly payments).
 */
function computeDate(
  taxYear: number,
  month: number,
  day: number,
  type: DeadlineType
): Date {
  const isFiling = type === "FILING" || type === "EXTENSION_FILING";
  const calendarYear = isFiling || month <= 3 ? taxYear + 1 : taxYear;
  return new Date(calendarYear, month - 1, day);
}

export interface ComputedDeadline {
  deadlineType: DeadlineType;
  jurisdiction: string;
  dueDate: Date;
  originalDueDate: Date;
  extensionDueDate: Date | null;
}

export function computeDeadlines(
  entityType: EntityType,
  taxYear: number
): ComputedDeadline[] {
  const configs = ENTITY_DEADLINES[entityType];
  if (!configs) return [];

  return configs.map((config) => {
    const originalDate = computeDate(taxYear, config.month, config.day, config.type);
    const adjustedDate = adjustForWeekend(originalDate);

    let extensionDueDate: Date | null = null;
    if (
      config.type === "FILING" &&
      EXTENSION_DURATIONS[entityType] !== undefined
    ) {
      const extDate = addMonths(originalDate, EXTENSION_DURATIONS[entityType]);
      extensionDueDate = adjustForWeekend(extDate);
    }

    return {
      deadlineType: config.type,
      jurisdiction: config.jurisdiction,
      dueDate: adjustedDate,
      originalDueDate: originalDate,
      extensionDueDate,
    };
  });
}

/**
 * Returns the number of days until a deadline from today.
 * Negative values mean the deadline has passed.
 */
export function daysUntilDeadline(dueDate: Date): number {
  const now = new Date();
  const diff = dueDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Returns a severity level based on days remaining.
 */
export function deadlineSeverity(
  daysRemaining: number
): "overdue" | "critical" | "warning" | "normal" {
  if (daysRemaining < 0) return "overdue";
  if (daysRemaining <= 7) return "critical";
  if (daysRemaining <= 30) return "warning";
  return "normal";
}
