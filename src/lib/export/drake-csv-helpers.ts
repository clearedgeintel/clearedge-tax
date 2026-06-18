/**
 * Pure helpers for the Drake CSV adapter. Split out so the test suite can
 * exercise them without pulling in the Prisma client (which requires
 * DATABASE_URL at module load).
 */

const CRLF = "\r\n";

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : (Math.round(n * 100) / 100).toString();
}

export function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "number" ? formatNumber(value) : String(value);
  if (
    s.includes(",") ||
    s.includes('"') ||
    s.includes("\n") ||
    s.includes("\r")
  ) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export class CsvBuilder {
  private rows: string[] = [];

  header(...columns: string[]) {
    this.rows.push(columns.map(escapeCSV).join(","));
  }

  row(section: string, field: string, value: unknown, notes = "") {
    this.rows.push(
      [section, field, value, notes].map(escapeCSV).join(",")
    );
  }

  blank() {
    this.rows.push("");
  }

  toString(): string {
    if (this.rows.length === 0) return "";
    return this.rows.join(CRLF) + CRLF;
  }
}

export function readPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    if (cur === null || cur === undefined || typeof cur !== "object")
      return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur ?? undefined;
}

export interface DrakeExtractionRow {
  documentId: string;
  label: string;
  category: string;
  fields: Record<string, unknown>;
}

export function sumNumeric(
  rows: DrakeExtractionRow[],
  path: string
): number {
  let total = 0;
  for (const r of rows) {
    const v = readPath(r.fields, path);
    if (typeof v === "number" && Number.isFinite(v)) total += v;
  }
  return total;
}

export function appendW2Section(
  csv: CsvBuilder,
  w2s: DrakeExtractionRow[]
): void {
  if (w2s.length === 0) return;

  csv.blank();
  csv.row("W-2 Total", "Box 1 — Wages", sumNumeric(w2s, "boxes.box1_wages"), "Sum across all W-2s");
  csv.row("W-2 Total", "Box 2 — Federal income tax withheld", sumNumeric(w2s, "boxes.box2_federalTaxWithheld"), "Sum across all W-2s");
  csv.row("W-2 Total", "Box 3 — Social Security wages", sumNumeric(w2s, "boxes.box3_socialSecurityWages"), "Sum across all W-2s");
  csv.row("W-2 Total", "Box 4 — Social Security tax withheld", sumNumeric(w2s, "boxes.box4_socialSecurityTaxWithheld"), "Sum across all W-2s");
  csv.row("W-2 Total", "Box 5 — Medicare wages", sumNumeric(w2s, "boxes.box5_medicareWages"), "Sum across all W-2s");
  csv.row("W-2 Total", "Box 6 — Medicare tax withheld", sumNumeric(w2s, "boxes.box6_medicareTaxWithheld"), "Sum across all W-2s");
  csv.row("W-2 Total", "Box 16 — State wages", sumNumeric(w2s, "boxes.box16_stateWages"), "Sum across all W-2s");
  csv.row("W-2 Total", "Box 17 — State income tax", sumNumeric(w2s, "boxes.box17_stateIncomeTax"), "Sum across all W-2s");

  w2s.forEach((w2, i) => {
    const section = `W-2 #${i + 1}`;
    csv.blank();
    csv.row(section, "Document label", w2.label);
    csv.row(section, "Employer name", readPath(w2.fields, "employer.name") || "");
    csv.row(section, "Employer EIN", readPath(w2.fields, "employer.ein") || "");
    csv.row(section, "Employee name", readPath(w2.fields, "employee.name") || "");
    csv.row(section, "Employee SSN", readPath(w2.fields, "employee.ssn") || "");
    csv.row(section, "Tax year on form", readPath(w2.fields, "taxYear") ?? "");
    csv.row(section, "Box 1 — Wages", readPath(w2.fields, "boxes.box1_wages") ?? "", "Box 1");
    csv.row(section, "Box 2 — Federal income tax withheld", readPath(w2.fields, "boxes.box2_federalTaxWithheld") ?? "", "Box 2");
    csv.row(section, "Box 3 — Social Security wages", readPath(w2.fields, "boxes.box3_socialSecurityWages") ?? "", "Box 3");
    csv.row(section, "Box 4 — Social Security tax withheld", readPath(w2.fields, "boxes.box4_socialSecurityTaxWithheld") ?? "", "Box 4");
    csv.row(section, "Box 5 — Medicare wages", readPath(w2.fields, "boxes.box5_medicareWages") ?? "", "Box 5");
    csv.row(section, "Box 6 — Medicare tax withheld", readPath(w2.fields, "boxes.box6_medicareTaxWithheld") ?? "", "Box 6");
    const box12 = readPath(w2.fields, "boxes.box12");
    if (Array.isArray(box12)) {
      for (const entry of box12) {
        if (entry && typeof entry === "object") {
          const code = (entry as { code?: unknown }).code;
          const amount = (entry as { amount?: unknown }).amount;
          if (code) {
            csv.row(section, `Box 12 — Code ${String(code)}`, amount ?? "", "Box 12");
          }
        }
      }
    }
    csv.row(section, "Box 15 — State", readPath(w2.fields, "boxes.box15_state") || "", "Box 15");
    csv.row(section, "Box 16 — State wages", readPath(w2.fields, "boxes.box16_stateWages") ?? "", "Box 16");
    csv.row(section, "Box 17 — State income tax", readPath(w2.fields, "boxes.box17_stateIncomeTax") ?? "", "Box 17");
  });
}

export function append1099IntSection(
  csv: CsvBuilder,
  rows: DrakeExtractionRow[]
): void {
  if (rows.length === 0) return;

  csv.blank();
  csv.row("1099-INT Total", "Box 1 — Interest income", sumNumeric(rows, "box1_interestIncome"), "Sum across all 1099-INTs");
  csv.row("1099-INT Total", "Box 2 — Early withdrawal penalty", sumNumeric(rows, "box2_earlyWithdrawalPenalty"), "Sum across all 1099-INTs");
  csv.row("1099-INT Total", "Box 3 — Treasury interest", sumNumeric(rows, "box3_treasuryInterest"), "Sum across all 1099-INTs");
  csv.row("1099-INT Total", "Box 4 — Federal income tax withheld", sumNumeric(rows, "box4_federalTaxWithheld"), "Sum across all 1099-INTs");
  csv.row("1099-INT Total", "Box 8 — Tax-exempt interest", sumNumeric(rows, "box8_taxExemptInterest"), "Sum across all 1099-INTs");

  rows.forEach((d, i) => {
    const section = `1099-INT #${i + 1}`;
    csv.blank();
    csv.row(section, "Document label", d.label);
    csv.row(section, "Payer name", readPath(d.fields, "payer.name") || "");
    csv.row(section, "Payer TIN", readPath(d.fields, "payer.tin") || "");
    csv.row(section, "Recipient name", readPath(d.fields, "recipient.name") || "");
    csv.row(section, "Recipient TIN", readPath(d.fields, "recipient.tin") || "");
    csv.row(section, "Box 1 — Interest income", readPath(d.fields, "box1_interestIncome") ?? "", "Box 1");
    csv.row(section, "Box 4 — Federal income tax withheld", readPath(d.fields, "box4_federalTaxWithheld") ?? "", "Box 4");
    csv.row(section, "Box 8 — Tax-exempt interest", readPath(d.fields, "box8_taxExemptInterest") ?? "", "Box 8");
  });
}

export function append1099DivSection(
  csv: CsvBuilder,
  rows: DrakeExtractionRow[]
): void {
  if (rows.length === 0) return;

  csv.blank();
  csv.row("1099-DIV Total", "Box 1a — Total ordinary dividends", sumNumeric(rows, "box1a_totalOrdinaryDividends"), "Sum across all 1099-DIVs");
  csv.row("1099-DIV Total", "Box 1b — Qualified dividends", sumNumeric(rows, "box1b_qualifiedDividends"), "Sum across all 1099-DIVs");
  csv.row("1099-DIV Total", "Box 2a — Total capital gain", sumNumeric(rows, "box2a_totalCapitalGain"), "Sum across all 1099-DIVs");
  csv.row("1099-DIV Total", "Box 3 — Nondividend distributions", sumNumeric(rows, "box3_nondividendDistributions"), "Sum across all 1099-DIVs");
  csv.row("1099-DIV Total", "Box 4 — Federal income tax withheld", sumNumeric(rows, "box4_federalTaxWithheld"), "Sum across all 1099-DIVs");
  csv.row("1099-DIV Total", "Box 7 — Foreign tax paid", sumNumeric(rows, "box7_foreignTaxPaid"), "Sum across all 1099-DIVs");

  rows.forEach((d, i) => {
    const section = `1099-DIV #${i + 1}`;
    csv.blank();
    csv.row(section, "Document label", d.label);
    csv.row(section, "Payer name", readPath(d.fields, "payer.name") || "");
    csv.row(section, "Payer TIN", readPath(d.fields, "payer.tin") || "");
    csv.row(section, "Recipient name", readPath(d.fields, "recipient.name") || "");
    csv.row(section, "Recipient TIN", readPath(d.fields, "recipient.tin") || "");
    csv.row(section, "Box 1a — Total ordinary dividends", readPath(d.fields, "box1a_totalOrdinaryDividends") ?? "", "Box 1a");
    csv.row(section, "Box 1b — Qualified dividends", readPath(d.fields, "box1b_qualifiedDividends") ?? "", "Box 1b");
    csv.row(section, "Box 2a — Total capital gain", readPath(d.fields, "box2a_totalCapitalGain") ?? "", "Box 2a");
    csv.row(section, "Box 4 — Federal income tax withheld", readPath(d.fields, "box4_federalTaxWithheld") ?? "", "Box 4");
    csv.row(section, "Box 7 — Foreign tax paid", readPath(d.fields, "box7_foreignTaxPaid") ?? "", "Box 7");
  });
}

export function flattenInterviewValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
