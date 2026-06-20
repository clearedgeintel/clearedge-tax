import { z } from "zod";
import type { DocumentCategory } from "@/generated/prisma/enums";

/**
 * Per-document-category extraction definitions.
 *
 * Each entry pairs a Zod schema (runtime validation of what the model
 * returns) with the JSON Schema that we hand to Claude as a tool
 * `input_schema`. The two MUST stay in sync — adding a Zod field without
 * the JSON Schema means the model won't be asked for it; the opposite
 * means runtime validation will reject the model output.
 *
 * Numeric fields are nullable so the model can return `null` for unreadable
 * boxes instead of hallucinating a value.
 */

// ─── W-2 ────────────────────────────────────────────────────────────────────

export const W2Schema = z.object({
  taxYear: z.number().int().nullable(),
  employee: z.object({
    name: z.string().nullable(),
    ssn: z.string().nullable(),
    address: z.string().nullable(),
  }),
  employer: z.object({
    name: z.string().nullable(),
    ein: z.string().nullable(),
    address: z.string().nullable(),
  }),
  boxes: z.object({
    box1_wages: z.number().nullable(),
    box2_federalTaxWithheld: z.number().nullable(),
    box3_socialSecurityWages: z.number().nullable(),
    box4_socialSecurityTaxWithheld: z.number().nullable(),
    box5_medicareWages: z.number().nullable(),
    box6_medicareTaxWithheld: z.number().nullable(),
    box7_socialSecurityTips: z.number().nullable(),
    box10_dependentCareBenefits: z.number().nullable(),
    box12: z
      .array(
        z.object({
          code: z.string(),
          amount: z.number(),
        })
      )
      .nullable(),
    box15_state: z.string().nullable(),
    box16_stateWages: z.number().nullable(),
    box17_stateIncomeTax: z.number().nullable(),
  }),
});
export type W2Fields = z.infer<typeof W2Schema>;

const W2_JSON_SCHEMA = {
  type: "object",
  required: ["taxYear", "employee", "employer", "boxes"],
  additionalProperties: false,
  properties: {
    taxYear: { type: ["integer", "null"] },
    employee: {
      type: "object",
      required: ["name", "ssn", "address"],
      additionalProperties: false,
      properties: {
        name: { type: ["string", "null"] },
        ssn: { type: ["string", "null"] },
        address: { type: ["string", "null"] },
      },
    },
    employer: {
      type: "object",
      required: ["name", "ein", "address"],
      additionalProperties: false,
      properties: {
        name: { type: ["string", "null"] },
        ein: { type: ["string", "null"] },
        address: { type: ["string", "null"] },
      },
    },
    boxes: {
      type: "object",
      required: [
        "box1_wages",
        "box2_federalTaxWithheld",
        "box3_socialSecurityWages",
        "box4_socialSecurityTaxWithheld",
        "box5_medicareWages",
        "box6_medicareTaxWithheld",
        "box7_socialSecurityTips",
        "box10_dependentCareBenefits",
        "box12",
        "box15_state",
        "box16_stateWages",
        "box17_stateIncomeTax",
      ],
      additionalProperties: false,
      properties: {
        box1_wages: { type: ["number", "null"] },
        box2_federalTaxWithheld: { type: ["number", "null"] },
        box3_socialSecurityWages: { type: ["number", "null"] },
        box4_socialSecurityTaxWithheld: { type: ["number", "null"] },
        box5_medicareWages: { type: ["number", "null"] },
        box6_medicareTaxWithheld: { type: ["number", "null"] },
        box7_socialSecurityTips: { type: ["number", "null"] },
        box10_dependentCareBenefits: { type: ["number", "null"] },
        box12: {
          type: ["array", "null"],
          items: {
            type: "object",
            required: ["code", "amount"],
            additionalProperties: false,
            properties: {
              code: { type: "string" },
              amount: { type: "number" },
            },
          },
        },
        box15_state: { type: ["string", "null"] },
        box16_stateWages: { type: ["number", "null"] },
        box17_stateIncomeTax: { type: ["number", "null"] },
      },
    },
  },
} as const;

// ─── 1099-INT ───────────────────────────────────────────────────────────────

export const Form1099INTSchema = z.object({
  taxYear: z.number().int().nullable(),
  payer: z.object({
    name: z.string().nullable(),
    tin: z.string().nullable(),
  }),
  recipient: z.object({
    name: z.string().nullable(),
    tin: z.string().nullable(),
  }),
  box1_interestIncome: z.number().nullable(),
  box2_earlyWithdrawalPenalty: z.number().nullable(),
  box3_treasuryInterest: z.number().nullable(),
  box4_federalTaxWithheld: z.number().nullable(),
  box8_taxExemptInterest: z.number().nullable(),
});
export type Form1099INTFields = z.infer<typeof Form1099INTSchema>;

const FORM_1099_INT_JSON_SCHEMA = {
  type: "object",
  required: [
    "taxYear",
    "payer",
    "recipient",
    "box1_interestIncome",
    "box2_earlyWithdrawalPenalty",
    "box3_treasuryInterest",
    "box4_federalTaxWithheld",
    "box8_taxExemptInterest",
  ],
  additionalProperties: false,
  properties: {
    taxYear: { type: ["integer", "null"] },
    payer: {
      type: "object",
      required: ["name", "tin"],
      additionalProperties: false,
      properties: {
        name: { type: ["string", "null"] },
        tin: { type: ["string", "null"] },
      },
    },
    recipient: {
      type: "object",
      required: ["name", "tin"],
      additionalProperties: false,
      properties: {
        name: { type: ["string", "null"] },
        tin: { type: ["string", "null"] },
      },
    },
    box1_interestIncome: { type: ["number", "null"] },
    box2_earlyWithdrawalPenalty: { type: ["number", "null"] },
    box3_treasuryInterest: { type: ["number", "null"] },
    box4_federalTaxWithheld: { type: ["number", "null"] },
    box8_taxExemptInterest: { type: ["number", "null"] },
  },
} as const;

// ─── 1099-DIV ───────────────────────────────────────────────────────────────

export const Form1099DIVSchema = z.object({
  taxYear: z.number().int().nullable(),
  payer: z.object({
    name: z.string().nullable(),
    tin: z.string().nullable(),
  }),
  recipient: z.object({
    name: z.string().nullable(),
    tin: z.string().nullable(),
  }),
  box1a_totalOrdinaryDividends: z.number().nullable(),
  box1b_qualifiedDividends: z.number().nullable(),
  box2a_totalCapitalGain: z.number().nullable(),
  box3_nondividendDistributions: z.number().nullable(),
  box4_federalTaxWithheld: z.number().nullable(),
  box7_foreignTaxPaid: z.number().nullable(),
});
export type Form1099DIVFields = z.infer<typeof Form1099DIVSchema>;

const FORM_1099_DIV_JSON_SCHEMA = {
  type: "object",
  required: [
    "taxYear",
    "payer",
    "recipient",
    "box1a_totalOrdinaryDividends",
    "box1b_qualifiedDividends",
    "box2a_totalCapitalGain",
    "box3_nondividendDistributions",
    "box4_federalTaxWithheld",
    "box7_foreignTaxPaid",
  ],
  additionalProperties: false,
  properties: {
    taxYear: { type: ["integer", "null"] },
    payer: {
      type: "object",
      required: ["name", "tin"],
      additionalProperties: false,
      properties: {
        name: { type: ["string", "null"] },
        tin: { type: ["string", "null"] },
      },
    },
    recipient: {
      type: "object",
      required: ["name", "tin"],
      additionalProperties: false,
      properties: {
        name: { type: ["string", "null"] },
        tin: { type: ["string", "null"] },
      },
    },
    box1a_totalOrdinaryDividends: { type: ["number", "null"] },
    box1b_qualifiedDividends: { type: ["number", "null"] },
    box2a_totalCapitalGain: { type: ["number", "null"] },
    box3_nondividendDistributions: { type: ["number", "null"] },
    box4_federalTaxWithheld: { type: ["number", "null"] },
    box7_foreignTaxPaid: { type: ["number", "null"] },
  },
} as const;

// ─── 1099-NEC ───────────────────────────────────────────────────────────────

export const Form1099NECSchema = z.object({
  taxYear: z.number().int().nullable(),
  payer: z.object({
    name: z.string().nullable(),
    tin: z.string().nullable(),
  }),
  recipient: z.object({
    name: z.string().nullable(),
    tin: z.string().nullable(),
  }),
  box1_nonemployeeCompensation: z.number().nullable(),
  box4_federalTaxWithheld: z.number().nullable(),
});
export type Form1099NECFields = z.infer<typeof Form1099NECSchema>;

const FORM_1099_NEC_JSON_SCHEMA = {
  type: "object",
  required: [
    "taxYear",
    "payer",
    "recipient",
    "box1_nonemployeeCompensation",
    "box4_federalTaxWithheld",
  ],
  additionalProperties: false,
  properties: {
    taxYear: { type: ["integer", "null"] },
    payer: {
      type: "object",
      required: ["name", "tin"],
      additionalProperties: false,
      properties: {
        name: { type: ["string", "null"] },
        tin: { type: ["string", "null"] },
      },
    },
    recipient: {
      type: "object",
      required: ["name", "tin"],
      additionalProperties: false,
      properties: {
        name: { type: ["string", "null"] },
        tin: { type: ["string", "null"] },
      },
    },
    box1_nonemployeeCompensation: { type: ["number", "null"] },
    box4_federalTaxWithheld: { type: ["number", "null"] },
  },
} as const;

// ─── 1099-MISC ──────────────────────────────────────────────────────────────

export const Form1099MISCSchema = z.object({
  taxYear: z.number().int().nullable(),
  payer: z.object({
    name: z.string().nullable(),
    tin: z.string().nullable(),
  }),
  recipient: z.object({
    name: z.string().nullable(),
    tin: z.string().nullable(),
  }),
  box1_rents: z.number().nullable(),
  box2_royalties: z.number().nullable(),
  box3_otherIncome: z.number().nullable(),
  box4_federalTaxWithheld: z.number().nullable(),
  box6_medicalPayments: z.number().nullable(),
  box7_payerMadeDirectSales: z.boolean().nullable(),
  box8_substitutePayments: z.number().nullable(),
  box10_grossProceedsToAttorney: z.number().nullable(),
});
export type Form1099MISCFields = z.infer<typeof Form1099MISCSchema>;

const FORM_1099_MISC_JSON_SCHEMA = {
  type: "object",
  required: [
    "taxYear",
    "payer",
    "recipient",
    "box1_rents",
    "box2_royalties",
    "box3_otherIncome",
    "box4_federalTaxWithheld",
    "box6_medicalPayments",
    "box7_payerMadeDirectSales",
    "box8_substitutePayments",
    "box10_grossProceedsToAttorney",
  ],
  additionalProperties: false,
  properties: {
    taxYear: { type: ["integer", "null"] },
    payer: {
      type: "object",
      required: ["name", "tin"],
      additionalProperties: false,
      properties: {
        name: { type: ["string", "null"] },
        tin: { type: ["string", "null"] },
      },
    },
    recipient: {
      type: "object",
      required: ["name", "tin"],
      additionalProperties: false,
      properties: {
        name: { type: ["string", "null"] },
        tin: { type: ["string", "null"] },
      },
    },
    box1_rents: { type: ["number", "null"] },
    box2_royalties: { type: ["number", "null"] },
    box3_otherIncome: { type: ["number", "null"] },
    box4_federalTaxWithheld: { type: ["number", "null"] },
    box6_medicalPayments: { type: ["number", "null"] },
    box7_payerMadeDirectSales: { type: ["boolean", "null"] },
    box8_substitutePayments: { type: ["number", "null"] },
    box10_grossProceedsToAttorney: { type: ["number", "null"] },
  },
} as const;

// ─── 1098 (mortgage interest) ───────────────────────────────────────────────

export const Form1098Schema = z.object({
  taxYear: z.number().int().nullable(),
  lender: z.object({
    name: z.string().nullable(),
    tin: z.string().nullable(),
  }),
  borrower: z.object({
    name: z.string().nullable(),
    tin: z.string().nullable(),
  }),
  box1_mortgageInterestReceived: z.number().nullable(),
  box2_outstandingPrincipal: z.number().nullable(),
  box3_mortgageOriginationDate: z.string().nullable(),
  box4_refundOfOverpaidInterest: z.number().nullable(),
  box5_mortgageInsurancePremiums: z.number().nullable(),
  box6_pointsPaidOnPurchase: z.number().nullable(),
  box10_realEstateTaxes: z.number().nullable(),
});
export type Form1098Fields = z.infer<typeof Form1098Schema>;

const FORM_1098_JSON_SCHEMA = {
  type: "object",
  required: [
    "taxYear",
    "lender",
    "borrower",
    "box1_mortgageInterestReceived",
    "box2_outstandingPrincipal",
    "box3_mortgageOriginationDate",
    "box4_refundOfOverpaidInterest",
    "box5_mortgageInsurancePremiums",
    "box6_pointsPaidOnPurchase",
    "box10_realEstateTaxes",
  ],
  additionalProperties: false,
  properties: {
    taxYear: { type: ["integer", "null"] },
    lender: {
      type: "object",
      required: ["name", "tin"],
      additionalProperties: false,
      properties: {
        name: { type: ["string", "null"] },
        tin: { type: ["string", "null"] },
      },
    },
    borrower: {
      type: "object",
      required: ["name", "tin"],
      additionalProperties: false,
      properties: {
        name: { type: ["string", "null"] },
        tin: { type: ["string", "null"] },
      },
    },
    box1_mortgageInterestReceived: { type: ["number", "null"] },
    box2_outstandingPrincipal: { type: ["number", "null"] },
    box3_mortgageOriginationDate: { type: ["string", "null"] },
    box4_refundOfOverpaidInterest: { type: ["number", "null"] },
    box5_mortgageInsurancePremiums: { type: ["number", "null"] },
    box6_pointsPaidOnPurchase: { type: ["number", "null"] },
    box10_realEstateTaxes: { type: ["number", "null"] },
  },
} as const;

// ─── Extractor registry ─────────────────────────────────────────────────────

export interface ExtractorDef {
  /** Zod schema for runtime validation of the model output. */
  schema: z.ZodTypeAny;
  /** Name of the Claude tool used to capture the structured output. */
  toolName: string;
  /** Tool description shown to the model. */
  toolDescription: string;
  /** Extraction instructions appended to the user message. */
  instructions: string;
  /** JSON Schema sent as the tool's `input_schema`. */
  inputSchema: object;
}

/**
 * Map from DocumentCategory to its extractor definition. Categories absent
 * from this map are treated as UNSUPPORTED — the worker records a row with
 * status=UNSUPPORTED and no extracted fields.
 */
export const EXTRACTORS: Partial<Record<DocumentCategory, ExtractorDef>> = {
  W2: {
    schema: W2Schema,
    toolName: "store_w2",
    toolDescription:
      "Record the fields extracted from a US IRS Form W-2 wage statement.",
    instructions:
      "Read every numeric box and named field on the W-2. Use null for any field you cannot confidently read. For dollar amounts, return the number only — never include currency symbols, commas, or surrounding text.",
    inputSchema: W2_JSON_SCHEMA,
  },
  F1099_INT: {
    schema: Form1099INTSchema,
    toolName: "store_1099_int",
    toolDescription:
      "Record the fields extracted from a US IRS Form 1099-INT interest income statement.",
    instructions:
      "Extract every box that has a value. Use null for blank or unreadable boxes. Return raw numbers (no commas, no currency symbols).",
    inputSchema: FORM_1099_INT_JSON_SCHEMA,
  },
  F1099_DIV: {
    schema: Form1099DIVSchema,
    toolName: "store_1099_div",
    toolDescription:
      "Record the fields extracted from a US IRS Form 1099-DIV dividends and distributions statement.",
    instructions:
      "Extract every box that has a value. Use null for blank or unreadable boxes. Return raw numbers (no commas, no currency symbols).",
    inputSchema: FORM_1099_DIV_JSON_SCHEMA,
  },
  F1099_NEC: {
    schema: Form1099NECSchema,
    toolName: "store_1099_nec",
    toolDescription:
      "Record the fields extracted from a US IRS Form 1099-NEC nonemployee compensation statement.",
    instructions:
      "Extract every box that has a value. Use null for blank or unreadable boxes. Return raw numbers (no commas, no currency symbols).",
    inputSchema: FORM_1099_NEC_JSON_SCHEMA,
  },
  F1099_MISC: {
    schema: Form1099MISCSchema,
    toolName: "store_1099_misc",
    toolDescription:
      "Record the fields extracted from a US IRS Form 1099-MISC miscellaneous information statement.",
    instructions:
      "Extract every box that has a value. Use null for blank or unreadable boxes. Box 7 is a yes/no checkbox — return true if the box is checked, false if unchecked, null if you cannot tell. Other boxes return raw numbers.",
    inputSchema: FORM_1099_MISC_JSON_SCHEMA,
  },
  // 1098 mortgage interest is filed under the MORTGAGE_STATEMENT category.
  MORTGAGE_STATEMENT: {
    schema: Form1098Schema,
    toolName: "store_form_1098",
    toolDescription:
      "Record the fields extracted from a US IRS Form 1098 mortgage interest statement.",
    instructions:
      "Extract every box that has a value. Use null for blank or unreadable boxes. Box 3 is the origination date — return it in ISO 8601 (YYYY-MM-DD) if you can read it; otherwise null. Other boxes return raw numbers.",
    inputSchema: FORM_1098_JSON_SCHEMA,
  },
};
