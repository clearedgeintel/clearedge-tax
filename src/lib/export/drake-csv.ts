import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/security/pii";
import { ENTITY_TYPE_LABELS } from "@/types/entities";
import type { DocumentCategory } from "@/generated/prisma/enums";
import {
  CsvBuilder,
  append1099DivSection,
  append1099IntSection,
  appendW2Section,
  flattenInterviewValue,
  type DrakeExtractionRow,
} from "./drake-csv-helpers";

/**
 * Drake-compatible CSV adapter for a reviewer-approved return.
 *
 * Output is a "tall" CSV with four columns — Section, Field, Value, Notes.
 * This shape:
 *   1. Reads cleanly by a preparer scanning the file in Excel.
 *   2. Is trivial for a Drake-side script to consume — every row is
 *      addressable by (Section, Field).
 *   3. Survives CSV's lack of nesting without resorting to ZIPs or
 *      proprietary line markers.
 *
 * Coverage v1: structured rollups of any extracted W-2, 1099-INT, and
 * 1099-DIV documents on the return, plus a Header section with entity /
 * status metadata and the decrypted TIN, plus every recorded interview
 * answer as Interview: <sectionId> rows. The caller is responsible for
 * gating access (status, role) and for logging the PII access event.
 */

interface BuildOpts {
  returnId: string;
}

function safeDecrypt(value: string): string {
  try {
    return decrypt(value);
  } catch {
    return "";
  }
}

export async function generateDrakeCsv(opts: BuildOpts): Promise<string> {
  const taxReturn = await prisma.taxReturn.findUnique({
    where: { id: opts.returnId },
    include: {
      entity: {
        include: {
          client: { select: { displayName: true } },
        },
      },
      preparer: { select: { name: true } },
      reviewer: { select: { name: true } },
      partner: { select: { name: true } },
      documents: {
        include: { extraction: { select: { fields: true, status: true } } },
      },
      interviewResponses: {
        orderBy: [{ sectionId: "asc" }, { questionId: "asc" }],
      },
    },
  });
  if (!taxReturn) throw new Error("Return not found");

  const extractionRows: DrakeExtractionRow[] = taxReturn.documents
    .filter(
      (d) =>
        d.extraction &&
        (d.extraction.status === "SUCCESS" || d.extraction.status === "REVIEWED")
    )
    .map((d) => ({
      documentId: d.id,
      label: d.label,
      category: d.category as DocumentCategory,
      fields: (d.extraction!.fields as Record<string, unknown>) || {},
    }));

  const w2s = extractionRows.filter((r) => r.category === "W2");
  const intRows = extractionRows.filter((r) => r.category === "F1099_INT");
  const divRows = extractionRows.filter((r) => r.category === "F1099_DIV");

  const csv = new CsvBuilder();
  csv.header("Section", "Field", "Value", "Notes");

  const tinPlain = taxReturn.entity.tin
    ? safeDecrypt(taxReturn.entity.tin)
    : "";

  csv.row("Header", "Tax year", taxReturn.taxYear);
  csv.row(
    "Header",
    "Entity type",
    ENTITY_TYPE_LABELS[taxReturn.entity.entityType]
  );
  csv.row("Header", "Entity legal name", taxReturn.entity.legalName);
  csv.row("Header", "TIN", tinPlain);
  csv.row("Header", "TIN type", taxReturn.entity.tinType || "");
  csv.row("Header", "Filing status", taxReturn.entity.filingStatus || "");
  csv.row(
    "Header",
    "Date of birth",
    taxReturn.entity.dateOfBirth?.toISOString().slice(0, 10) || ""
  );
  csv.row("Header", "Client (household)", taxReturn.entity.client.displayName);
  csv.row("Header", "Preparer", taxReturn.preparer?.name || "");
  csv.row("Header", "Reviewer", taxReturn.reviewer?.name || "");
  csv.row("Header", "Partner", taxReturn.partner?.name || "");
  csv.row("Header", "Status at export", taxReturn.status);
  csv.row(
    "Header",
    "Approved at",
    taxReturn.approvedAt?.toISOString() || ""
  );
  csv.row(
    "Header",
    "Exported at",
    taxReturn.exportedAt?.toISOString() || ""
  );
  csv.row(
    "Header",
    "Filing jurisdictions",
    taxReturn.filingJurisdictions.join("; ")
  );

  appendW2Section(csv, w2s);
  append1099IntSection(csv, intRows);
  append1099DivSection(csv, divRows);

  if (taxReturn.interviewResponses.length > 0) {
    csv.blank();
    for (const r of taxReturn.interviewResponses) {
      let val: unknown = r.value;
      if (typeof val === "string" && val.startsWith("enc:v1:")) {
        val = safeDecrypt(val);
      }
      const instance = r.instanceIndex > 0 ? ` (instance ${r.instanceIndex})` : "";
      csv.row(
        `Interview: ${r.sectionId}`,
        `${r.questionId}${instance}`,
        flattenInterviewValue(val)
      );
    }
  }

  return csv.toString();
}
