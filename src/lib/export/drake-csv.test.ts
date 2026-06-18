import { describe, expect, it } from "vitest";
import {
  CsvBuilder,
  appendW2Section,
  append1099IntSection,
  append1099DivSection,
  escapeCSV,
  formatNumber,
  flattenInterviewValue,
  type DrakeExtractionRow,
} from "./drake-csv-helpers";

describe("escapeCSV", () => {
  it("returns plain string when no special characters present", () => {
    expect(escapeCSV("hello")).toBe("hello");
    expect(escapeCSV(42)).toBe("42");
  });

  it("returns empty for null / undefined", () => {
    expect(escapeCSV(null)).toBe("");
    expect(escapeCSV(undefined)).toBe("");
  });

  it("wraps in quotes and escapes embedded quotes when a comma is present", () => {
    expect(escapeCSV("Smith, John")).toBe('"Smith, John"');
    expect(escapeCSV('She said "hi"')).toBe('"She said ""hi"""');
  });

  it("wraps fields with embedded newlines", () => {
    expect(escapeCSV("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCSV("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("formats numbers without unnecessary trailing zeros", () => {
    expect(escapeCSV(75000)).toBe("75000");
    expect(escapeCSV(75000.5)).toBe("75000.5");
    expect(escapeCSV(75000.123456)).toBe("75000.12");
  });
});

describe("formatNumber", () => {
  it("integers stay integers", () => {
    expect(formatNumber(1000)).toBe("1000");
  });

  it("rounds to two decimals", () => {
    expect(formatNumber(1234.5678)).toBe("1234.57");
  });

  it("handles negative values", () => {
    expect(formatNumber(-500.5)).toBe("-500.5");
  });

  it("returns empty for non-finite", () => {
    expect(formatNumber(Number.NaN)).toBe("");
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("");
  });
});

describe("CsvBuilder", () => {
  it("emits a header line + row lines joined by CRLF, trailing CRLF", () => {
    const b = new CsvBuilder();
    b.header("Section", "Field", "Value", "Notes");
    b.row("Header", "Tax year", 2025, "");
    const out = b.toString();
    expect(out).toBe("Section,Field,Value,Notes\r\nHeader,Tax year,2025,\r\n");
  });

  it("emits a blank line between sections", () => {
    const b = new CsvBuilder();
    b.row("A", "1", 1, "");
    b.blank();
    b.row("B", "1", 1, "");
    const out = b.toString();
    // Two empty strings when split: the explicit blank() between sections
    // and the trailing CRLF after the last row.
    expect(out.split("\r\n").filter((l) => l === "")).toHaveLength(2);
    expect(out).toContain("A,1,1,\r\n\r\nB,1,1,");
  });
});

function makeW2(
  overrides: Partial<{
    box1: number | null;
    box2: number | null;
    box5: number | null;
    box6: number | null;
    employerName: string;
    box12: { code: string; amount: number }[] | null;
  }> = {}
): DrakeExtractionRow {
  // `in` lets us distinguish "intentionally null" (the model said
  // unreadable) from "not overridden". `??` would treat both the same.
  const pick = <T,>(key: string, fallback: T): T =>
    key in overrides
      ? ((overrides as Record<string, unknown>)[key] as T)
      : fallback;
  return {
    documentId: "doc-x",
    label: "W-2 from Acme Corp",
    category: "W2",
    fields: {
      taxYear: 2025,
      employer: {
        name: pick("employerName", "Acme Corp"),
        ein: "12-3456789",
        address: null,
      },
      employee: { name: "John Smith", ssn: null, address: null },
      boxes: {
        box1_wages: pick("box1", 75000),
        box2_federalTaxWithheld: pick("box2", 12000),
        box3_socialSecurityWages: 75000,
        box4_socialSecurityTaxWithheld: 4650,
        box5_medicareWages: pick("box5", 75000),
        box6_medicareTaxWithheld: pick("box6", 1087.5),
        box7_socialSecurityTips: null,
        box10_dependentCareBenefits: null,
        box12: pick("box12", null),
        box15_state: "TX",
        box16_stateWages: 75000,
        box17_stateIncomeTax: 0,
      },
    },
  };
}

describe("appendW2Section", () => {
  it("emits no rows when there are no W-2s", () => {
    const b = new CsvBuilder();
    appendW2Section(b, []);
    expect(b.toString()).toBe("");
  });

  it("emits total rows + per-W-2 detail rows for one W-2", () => {
    const b = new CsvBuilder();
    appendW2Section(b, [makeW2()]);
    const out = b.toString();
    expect(out).toContain("W-2 Total,Box 1 — Wages,75000");
    expect(out).toContain("W-2 Total,Box 6 — Medicare tax withheld,1087.5");
    expect(out).toContain("W-2 #1,Employer name,Acme Corp");
    expect(out).toContain("W-2 #1,Employer EIN,12-3456789");
    expect(out).toContain("W-2 #1,Box 1 — Wages,75000");
  });

  it("totals sum across multiple W-2s", () => {
    const b = new CsvBuilder();
    appendW2Section(b, [
      makeW2({ box1: 75000, box2: 12000 }),
      makeW2({ box1: 50000, box2: 7500, employerName: "Beta Co" }),
    ]);
    const out = b.toString();
    expect(out).toContain("W-2 Total,Box 1 — Wages,125000");
    expect(out).toContain("W-2 Total,Box 2 — Federal income tax withheld,19500");
    expect(out).toContain("W-2 #2,Employer name,Beta Co");
  });

  it("emits Box 12 code rows when present", () => {
    const b = new CsvBuilder();
    appendW2Section(b, [
      makeW2({
        box12: [
          { code: "D", amount: 5000 },
          { code: "DD", amount: 8200 },
        ],
      }),
    ]);
    const out = b.toString();
    expect(out).toContain("W-2 #1,Box 12 — Code D,5000");
    expect(out).toContain("W-2 #1,Box 12 — Code DD,8200");
  });

  it("escapes commas in employer names", () => {
    const b = new CsvBuilder();
    appendW2Section(b, [makeW2({ employerName: "Smith, Jones & Co" })]);
    expect(b.toString()).toContain(
      'W-2 #1,Employer name,"Smith, Jones & Co"'
    );
  });

  it("treats null boxes as empty (model said unreadable)", () => {
    const b = new CsvBuilder();
    appendW2Section(b, [makeW2({ box5: null, box6: null })]);
    const out = b.toString();
    expect(out).toContain("W-2 Total,Box 5 — Medicare wages,0");
    const detail = out.split("\r\n").find((l) => l.startsWith("W-2 #1,Box 5"));
    expect(detail).toBe("W-2 #1,Box 5 — Medicare wages,,Box 5");
  });
});

describe("append1099IntSection", () => {
  it("emits totals and per-document rows", () => {
    const b = new CsvBuilder();
    append1099IntSection(b, [
      {
        documentId: "d1",
        label: "1099-INT from Big Bank",
        category: "F1099_INT",
        fields: {
          taxYear: 2025,
          payer: { name: "Big Bank", tin: "12-3456789" },
          recipient: { name: "John Smith", tin: null },
          box1_interestIncome: 1250.42,
          box2_earlyWithdrawalPenalty: null,
          box3_treasuryInterest: null,
          box4_federalTaxWithheld: 100,
          box8_taxExemptInterest: null,
        },
      },
      {
        documentId: "d2",
        label: "1099-INT from Credit Union",
        category: "F1099_INT",
        fields: {
          taxYear: 2025,
          payer: { name: "Credit Union", tin: null },
          recipient: { name: "John Smith", tin: null },
          box1_interestIncome: 75,
          box2_earlyWithdrawalPenalty: null,
          box3_treasuryInterest: null,
          box4_federalTaxWithheld: null,
          box8_taxExemptInterest: null,
        },
      },
    ]);
    const out = b.toString();
    expect(out).toContain("1099-INT Total,Box 1 — Interest income,1325.42");
    expect(out).toContain("1099-INT Total,Box 4 — Federal income tax withheld,100");
    expect(out).toContain("1099-INT #1,Payer name,Big Bank");
    expect(out).toContain("1099-INT #2,Payer name,Credit Union");
  });
});

describe("append1099DivSection", () => {
  it("emits totals and per-document rows", () => {
    const b = new CsvBuilder();
    append1099DivSection(b, [
      {
        documentId: "d1",
        label: "1099-DIV from Broker",
        category: "F1099_DIV",
        fields: {
          taxYear: 2025,
          payer: { name: "Big Broker", tin: "12-3456789" },
          recipient: { name: "John Smith", tin: null },
          box1a_totalOrdinaryDividends: 2500,
          box1b_qualifiedDividends: 2100,
          box2a_totalCapitalGain: 800,
          box3_nondividendDistributions: null,
          box4_federalTaxWithheld: null,
          box7_foreignTaxPaid: null,
        },
      },
    ]);
    const out = b.toString();
    expect(out).toContain("1099-DIV Total,Box 1a — Total ordinary dividends,2500");
    expect(out).toContain("1099-DIV Total,Box 1b — Qualified dividends,2100");
    expect(out).toContain("1099-DIV #1,Payer name,Big Broker");
  });
});

describe("flattenInterviewValue", () => {
  it("returns empty for null / undefined", () => {
    expect(flattenInterviewValue(null)).toBe("");
    expect(flattenInterviewValue(undefined)).toBe("");
  });

  it("stringifies objects and arrays as JSON", () => {
    expect(flattenInterviewValue({ a: 1 })).toBe('{"a":1}');
    expect(flattenInterviewValue(["TX", "WI"])).toBe('["TX","WI"]');
  });

  it("passes scalars through as String(x)", () => {
    expect(flattenInterviewValue("hello")).toBe("hello");
    expect(flattenInterviewValue(42)).toBe("42");
    expect(flattenInterviewValue(true)).toBe("true");
  });
});
