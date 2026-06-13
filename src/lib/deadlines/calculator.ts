import { addMonths, isWeekend, nextMonday } from "date-fns";
import type { EntityType, DeadlineType } from "@/generated/prisma/enums";

interface DeadlineConfig {
  type: DeadlineType;
  month: number; // 1-based
  day: number;
}

// ─── Federal ─────────────────────────────────────────────────────────────

const FEDERAL_ENTITY_DEADLINES: Record<string, DeadlineConfig[]> = {
  INDIVIDUAL_1040: [
    { type: "FILING", month: 4, day: 15 },
    { type: "EXTENSION_FILING", month: 4, day: 15 },
    { type: "ESTIMATED_Q1", month: 4, day: 15 },
    { type: "ESTIMATED_Q2", month: 6, day: 15 },
    { type: "ESTIMATED_Q3", month: 9, day: 15 },
    { type: "ESTIMATED_Q4", month: 1, day: 15 },
  ],
  S_CORP_1120S: [
    { type: "FILING", month: 3, day: 15 },
    { type: "EXTENSION_FILING", month: 3, day: 15 },
  ],
  PARTNERSHIP_1065: [
    { type: "FILING", month: 3, day: 15 },
    { type: "EXTENSION_FILING", month: 3, day: 15 },
  ],
  SOLE_PROP_SCHEDULE_C: [
    { type: "FILING", month: 4, day: 15 },
    { type: "ESTIMATED_Q1", month: 4, day: 15 },
    { type: "ESTIMATED_Q2", month: 6, day: 15 },
    { type: "ESTIMATED_Q3", month: 9, day: 15 },
    { type: "ESTIMATED_Q4", month: 1, day: 15 },
  ],
  NONPROFIT_990N: [
    { type: "FILING", month: 5, day: 15 },
  ],
  NONPROFIT_990EZ: [
    { type: "FILING", month: 5, day: 15 },
    { type: "EXTENSION_FILING", month: 5, day: 15 },
  ],
  NONPROFIT_990: [
    { type: "FILING", month: 5, day: 15 },
    { type: "EXTENSION_FILING", month: 5, day: 15 },
  ],
  NONPROFIT_990PF: [
    { type: "FILING", month: 5, day: 15 },
    { type: "EXTENSION_FILING", month: 5, day: 15 },
    { type: "ESTIMATED_Q1", month: 5, day: 15 },
    { type: "ESTIMATED_Q2", month: 8, day: 15 },
    { type: "ESTIMATED_Q3", month: 11, day: 15 },
    { type: "ESTIMATED_Q4", month: 2, day: 15 },
  ],
  NONPROFIT_990T: [
    { type: "FILING", month: 5, day: 15 },
    { type: "EXTENSION_FILING", month: 5, day: 15 },
    { type: "ESTIMATED_Q1", month: 4, day: 15 },
    { type: "ESTIMATED_Q2", month: 6, day: 15 },
    { type: "ESTIMATED_Q3", month: 9, day: 15 },
    { type: "ESTIMATED_Q4", month: 12, day: 15 },
  ],
};

// ─── States ──────────────────────────────────────────────────────────────
// Initial coverage: MN, CA, NY, WI (income-tax states) and TX (franchise tax).
// Each state config only lists what's filed at that state level — Texas, for
// example, has no individual income tax, so INDIVIDUAL_1040 simply absent.
// Extension durations match federal (6 months) for entity types where the
// state offers an extension; nonprofits inherit the same pattern.

const STATE_ENTITY_DEADLINES: Record<string, Record<string, DeadlineConfig[]>> = {
  MN: {
    INDIVIDUAL_1040: [
      { type: "FILING", month: 4, day: 15 },
      { type: "EXTENSION_FILING", month: 4, day: 15 },
    ],
    S_CORP_1120S: [
      { type: "FILING", month: 3, day: 15 },
      { type: "EXTENSION_FILING", month: 3, day: 15 },
    ],
    PARTNERSHIP_1065: [
      { type: "FILING", month: 3, day: 15 },
      { type: "EXTENSION_FILING", month: 3, day: 15 },
    ],
    SOLE_PROP_SCHEDULE_C: [
      { type: "FILING", month: 4, day: 15 },
    ],
    NONPROFIT_990: [
      { type: "FILING", month: 5, day: 15 },
      { type: "EXTENSION_FILING", month: 5, day: 15 },
    ],
    NONPROFIT_990EZ: [
      { type: "FILING", month: 5, day: 15 },
      { type: "EXTENSION_FILING", month: 5, day: 15 },
    ],
  },
  CA: {
    INDIVIDUAL_1040: [
      { type: "FILING", month: 4, day: 15 },
      { type: "EXTENSION_FILING", month: 4, day: 15 },
    ],
    S_CORP_1120S: [
      { type: "FILING", month: 3, day: 15 },
      { type: "EXTENSION_FILING", month: 3, day: 15 },
    ],
    PARTNERSHIP_1065: [
      { type: "FILING", month: 3, day: 15 },
      { type: "EXTENSION_FILING", month: 3, day: 15 },
    ],
    SOLE_PROP_SCHEDULE_C: [
      { type: "FILING", month: 4, day: 15 },
    ],
    NONPROFIT_990: [
      { type: "FILING", month: 5, day: 15 },
      { type: "EXTENSION_FILING", month: 5, day: 15 },
    ],
  },
  NY: {
    INDIVIDUAL_1040: [
      { type: "FILING", month: 4, day: 15 },
      { type: "EXTENSION_FILING", month: 4, day: 15 },
    ],
    S_CORP_1120S: [
      { type: "FILING", month: 3, day: 15 },
      { type: "EXTENSION_FILING", month: 3, day: 15 },
    ],
    PARTNERSHIP_1065: [
      { type: "FILING", month: 3, day: 15 },
      { type: "EXTENSION_FILING", month: 3, day: 15 },
    ],
    SOLE_PROP_SCHEDULE_C: [
      { type: "FILING", month: 4, day: 15 },
    ],
    NONPROFIT_990: [
      { type: "FILING", month: 5, day: 15 },
      { type: "EXTENSION_FILING", month: 5, day: 15 },
    ],
  },
  WI: {
    INDIVIDUAL_1040: [
      { type: "FILING", month: 4, day: 15 },
      { type: "EXTENSION_FILING", month: 4, day: 15 },
    ],
    S_CORP_1120S: [
      { type: "FILING", month: 3, day: 15 },
      { type: "EXTENSION_FILING", month: 3, day: 15 },
    ],
    PARTNERSHIP_1065: [
      { type: "FILING", month: 3, day: 15 },
      { type: "EXTENSION_FILING", month: 3, day: 15 },
    ],
    SOLE_PROP_SCHEDULE_C: [
      { type: "FILING", month: 4, day: 15 },
    ],
  },
  TX: {
    // No personal income tax. Franchise tax applies to S-corps,
    // partnerships, and LLCs. Filed annually on May 15.
    S_CORP_1120S: [
      { type: "FILING", month: 5, day: 15 },
      { type: "EXTENSION_FILING", month: 5, day: 15 },
    ],
    PARTNERSHIP_1065: [
      { type: "FILING", month: 5, day: 15 },
      { type: "EXTENSION_FILING", month: 5, day: 15 },
    ],
  },
};

const EXTENSION_DURATIONS: Record<string, number> = {
  INDIVIDUAL_1040: 6,
  S_CORP_1120S: 6,
  PARTNERSHIP_1065: 6,
  SOLE_PROP_SCHEDULE_C: 6,
  NONPROFIT_990EZ: 6,
  NONPROFIT_990: 6,
  NONPROFIT_990PF: 6,
  NONPROFIT_990T: 6,
};

/** Returns the list of state codes we have deadline rules for. */
export const SUPPORTED_STATES: string[] = Object.keys(STATE_ENTITY_DEADLINES).sort();

function adjustForWeekend(date: Date): Date {
  if (isWeekend(date)) return nextMonday(date);
  return date;
}

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

function buildDeadline(
  config: DeadlineConfig,
  taxYear: number,
  entityType: EntityType,
  jurisdiction: string
): ComputedDeadline {
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
    jurisdiction,
    dueDate: adjustedDate,
    originalDueDate: originalDate,
    extensionDueDate,
  };
}

/**
 * Compute every deadline that applies to a return of `entityType` for income
 * year `taxYear`, across the jurisdictions in `filingJurisdictions`. Defaults
 * to FEDERAL only when called without the third arg, preserving the original
 * signature.
 *
 * State codes that aren't in our coverage table emit no deadlines (the
 * jurisdiction is silently skipped rather than throwing — adding a state is
 * a data change, not a structural one).
 */
export function computeDeadlines(
  entityType: EntityType,
  taxYear: number,
  filingJurisdictions: string[] = ["FEDERAL"]
): ComputedDeadline[] {
  const results: ComputedDeadline[] = [];

  for (const jurisdiction of filingJurisdictions) {
    if (jurisdiction === "FEDERAL") {
      const configs = FEDERAL_ENTITY_DEADLINES[entityType];
      if (!configs) continue;
      for (const c of configs) {
        results.push(buildDeadline(c, taxYear, entityType, "FEDERAL"));
      }
      continue;
    }
    const stateConfigs = STATE_ENTITY_DEADLINES[jurisdiction]?.[entityType];
    if (!stateConfigs) continue;
    for (const c of stateConfigs) {
      results.push(buildDeadline(c, taxYear, entityType, jurisdiction));
    }
  }

  return results;
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
