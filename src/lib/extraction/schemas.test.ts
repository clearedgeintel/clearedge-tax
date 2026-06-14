import { describe, expect, it } from "vitest";
import {
  EXTRACTORS,
  Form1099DIVSchema,
  Form1099INTSchema,
  W2Schema,
} from "./schemas";

describe("W2Schema", () => {
  it("accepts a fully populated W-2", () => {
    const out = W2Schema.safeParse({
      taxYear: 2024,
      employee: {
        name: "John Smith",
        ssn: "***-**-1234",
        address: "123 Main St, Austin, TX 78701",
      },
      employer: {
        name: "Acme Corp",
        ein: "12-3456789",
        address: "1 Acme Way, Austin, TX",
      },
      boxes: {
        box1_wages: 75000.5,
        box2_federalTaxWithheld: 12000,
        box3_socialSecurityWages: 75000,
        box4_socialSecurityTaxWithheld: 4650,
        box5_medicareWages: 75000,
        box6_medicareTaxWithheld: 1087.5,
        box7_socialSecurityTips: null,
        box10_dependentCareBenefits: null,
        box12: [
          { code: "D", amount: 5000 },
          { code: "DD", amount: 8200 },
        ],
        box15_state: "TX",
        box16_stateWages: 75000,
        box17_stateIncomeTax: 0,
      },
    });
    expect(out.success).toBe(true);
  });

  it("accepts nulls for every nullable box (mostly-blank W-2)", () => {
    const out = W2Schema.safeParse({
      taxYear: null,
      employee: { name: null, ssn: null, address: null },
      employer: { name: null, ein: null, address: null },
      boxes: {
        box1_wages: null,
        box2_federalTaxWithheld: null,
        box3_socialSecurityWages: null,
        box4_socialSecurityTaxWithheld: null,
        box5_medicareWages: null,
        box6_medicareTaxWithheld: null,
        box7_socialSecurityTips: null,
        box10_dependentCareBenefits: null,
        box12: null,
        box15_state: null,
        box16_stateWages: null,
        box17_stateIncomeTax: null,
      },
    });
    expect(out.success).toBe(true);
  });

  it("rejects a missing box entirely (model must include every field as null or value)", () => {
    const out = W2Schema.safeParse({
      taxYear: 2024,
      employee: { name: "X", ssn: null, address: null },
      employer: { name: "Y", ein: null, address: null },
      boxes: {
        // box1_wages omitted
        box2_federalTaxWithheld: 1000,
        box3_socialSecurityWages: null,
        box4_socialSecurityTaxWithheld: null,
        box5_medicareWages: null,
        box6_medicareTaxWithheld: null,
        box7_socialSecurityTips: null,
        box10_dependentCareBenefits: null,
        box12: null,
        box15_state: null,
        box16_stateWages: null,
        box17_stateIncomeTax: null,
      },
    });
    expect(out.success).toBe(false);
  });

  it("rejects a non-numeric wages value (model hallucinated a string)", () => {
    const out = W2Schema.safeParse({
      taxYear: 2024,
      employee: { name: null, ssn: null, address: null },
      employer: { name: null, ein: null, address: null },
      boxes: {
        box1_wages: "$75,000.00",
        box2_federalTaxWithheld: null,
        box3_socialSecurityWages: null,
        box4_socialSecurityTaxWithheld: null,
        box5_medicareWages: null,
        box6_medicareTaxWithheld: null,
        box7_socialSecurityTips: null,
        box10_dependentCareBenefits: null,
        box12: null,
        box15_state: null,
        box16_stateWages: null,
        box17_stateIncomeTax: null,
      },
    });
    expect(out.success).toBe(false);
  });
});

describe("Form1099INTSchema", () => {
  it("accepts a typical interest statement", () => {
    const out = Form1099INTSchema.safeParse({
      taxYear: 2024,
      payer: { name: "Big Bank", tin: "12-3456789" },
      recipient: { name: "John Smith", tin: "***-**-1234" },
      box1_interestIncome: 1250.42,
      box2_earlyWithdrawalPenalty: null,
      box3_treasuryInterest: null,
      box4_federalTaxWithheld: null,
      box8_taxExemptInterest: null,
    });
    expect(out.success).toBe(true);
  });
});

describe("Form1099DIVSchema", () => {
  it("accepts a typical dividend statement", () => {
    const out = Form1099DIVSchema.safeParse({
      taxYear: 2024,
      payer: { name: "Big Broker", tin: "12-3456789" },
      recipient: { name: "John Smith", tin: "***-**-1234" },
      box1a_totalOrdinaryDividends: 2500,
      box1b_qualifiedDividends: 2100,
      box2a_totalCapitalGain: 800,
      box3_nondividendDistributions: null,
      box4_federalTaxWithheld: null,
      box7_foreignTaxPaid: null,
    });
    expect(out.success).toBe(true);
  });
});

describe("EXTRACTORS registry", () => {
  it("registers the three v1 supported categories", () => {
    expect(EXTRACTORS.W2).toBeDefined();
    expect(EXTRACTORS.F1099_INT).toBeDefined();
    expect(EXTRACTORS.F1099_DIV).toBeDefined();
  });

  it("leaves K-1 categories unsupported for now (extension point)", () => {
    expect(EXTRACTORS.K1_1065).toBeUndefined();
    expect(EXTRACTORS.K1_1120S).toBeUndefined();
  });

  it("each registered extractor has matching tool name and instructions", () => {
    for (const def of Object.values(EXTRACTORS)) {
      if (!def) continue;
      expect(def.toolName).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(def.toolDescription.length).toBeGreaterThan(20);
      expect(def.instructions.length).toBeGreaterThan(20);
      expect(def.inputSchema).toBeDefined();
    }
  });
});
