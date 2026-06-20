import type { DocumentCategory } from "@/generated/prisma/enums";

/**
 * Pre-fill mappings: each entry says "when the platform has a document of
 * category X with a SUCCESS extraction, look at field path Y in the
 * extracted JSON and use it to populate interview question Z."
 *
 * Aggregation:
 *   - "first": take the first non-null value across documents of that category
 *   - "sum": sum all non-null numeric values
 *
 * If a mapping references a questionId that doesn't exist in the loaded
 * interview matrix (e.g., it was removed or hasn't been added yet), the
 * service silently skips it — no harm done. That makes this list safe to
 * extend ahead of the question matrix.
 */

export type AggregationMode = "first" | "sum";

export interface PrefillMapping {
  documentCategory: DocumentCategory;
  fieldPath: string;
  questionId: string;
  aggregation: AggregationMode;
}

const MAPPINGS: PrefillMapping[] = [
  // ─── W-2 → INDIVIDUAL_1040 Wages section ─────────────────────────────
  {
    documentCategory: "W2",
    fieldPath: "boxes.box1_wages",
    questionId: "1040-WS-005",
    aggregation: "sum",
  },
  {
    documentCategory: "W2",
    fieldPath: "boxes.box2_federalTaxWithheld",
    questionId: "1040-WS-006",
    aggregation: "sum",
  },
  {
    documentCategory: "W2",
    fieldPath: "boxes.box3_socialSecurityWages",
    questionId: "1040-WS-007",
    aggregation: "sum",
  },
  {
    documentCategory: "W2",
    fieldPath: "boxes.box4_socialSecurityTaxWithheld",
    questionId: "1040-WS-008",
    aggregation: "sum",
  },
  {
    documentCategory: "W2",
    fieldPath: "boxes.box5_medicareWages",
    questionId: "1040-WS-009",
    aggregation: "sum",
  },
  {
    documentCategory: "W2",
    fieldPath: "boxes.box6_medicareTaxWithheld",
    questionId: "1040-WS-010",
    aggregation: "sum",
  },
  {
    documentCategory: "W2",
    fieldPath: "boxes.box16_stateWages",
    questionId: "1040-WS-011",
    aggregation: "sum",
  },
  {
    documentCategory: "W2",
    fieldPath: "boxes.box17_stateIncomeTax",
    questionId: "1040-WS-012",
    aggregation: "sum",
  },

  // ─── 1099-INT → INDIVIDUAL_1040 Interest / Dividends section ─────────
  {
    documentCategory: "F1099_INT",
    fieldPath: "box1_interestIncome",
    questionId: "1040-ID-003",
    aggregation: "sum",
  },
  {
    documentCategory: "F1099_INT",
    fieldPath: "box4_federalTaxWithheld",
    questionId: "1040-ID-004",
    aggregation: "sum",
  },

  // ─── 1099-DIV ────────────────────────────────────────────────────────
  {
    documentCategory: "F1099_DIV",
    fieldPath: "box1a_totalOrdinaryDividends",
    questionId: "1040-ID-008",
    aggregation: "sum",
  },
  {
    documentCategory: "F1099_DIV",
    fieldPath: "box1b_qualifiedDividends",
    questionId: "1040-ID-009",
    aggregation: "sum",
  },
  {
    documentCategory: "F1099_DIV",
    fieldPath: "box2a_totalCapitalGain",
    questionId: "1040-ID-010",
    aggregation: "sum",
  },

  // ─── 1099-NEC → self-employment / Schedule C ─────────────────────────
  {
    documentCategory: "F1099_NEC",
    fieldPath: "box1_nonemployeeCompensation",
    questionId: "1040-SC-001",
    aggregation: "sum",
  },

  // ─── 1099-MISC → Other income ────────────────────────────────────────
  {
    documentCategory: "F1099_MISC",
    fieldPath: "box1_rents",
    questionId: "1040-RENT-006",
    aggregation: "sum",
  },
  {
    documentCategory: "F1099_MISC",
    fieldPath: "box3_otherIncome",
    questionId: "1040-OI-001",
    aggregation: "sum",
  },

  // ─── 1098 mortgage → Itemized deductions / Schedule A ────────────────
  {
    documentCategory: "MORTGAGE_STATEMENT",
    fieldPath: "box1_mortgageInterestReceived",
    questionId: "1040-SA-001",
    aggregation: "sum",
  },
  {
    documentCategory: "MORTGAGE_STATEMENT",
    fieldPath: "box10_realEstateTaxes",
    questionId: "1040-SA-005",
    aggregation: "sum",
  },
];

export function mappingsForCategory(
  category: DocumentCategory
): PrefillMapping[] {
  return MAPPINGS.filter((m) => m.documentCategory === category);
}

export function allMappings(): PrefillMapping[] {
  return MAPPINGS;
}

/**
 * Walk a dot-path into an arbitrary object. Returns undefined if any segment
 * is missing or the final value is null/undefined.
 */
export function readFieldPath(
  obj: unknown,
  path: string
): unknown {
  if (obj === null || obj === undefined) return undefined;
  let current: unknown = obj;
  for (const seg of path.split(".")) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[seg];
  }
  return current ?? undefined;
}

/**
 * Aggregate a list of values according to a mapping mode. Skips null/
 * undefined; for "sum", coerces to numbers and ignores non-numerics.
 */
export function aggregate(
  values: unknown[],
  mode: AggregationMode
): unknown | undefined {
  const present = values.filter((v) => v !== null && v !== undefined);
  if (present.length === 0) return undefined;
  if (mode === "first") return present[0];
  // sum
  let total = 0;
  let anyNumeric = false;
  for (const v of present) {
    if (typeof v === "number" && Number.isFinite(v)) {
      total += v;
      anyNumeric = true;
    }
  }
  return anyNumeric ? total : undefined;
}
