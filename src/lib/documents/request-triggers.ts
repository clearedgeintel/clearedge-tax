import { prisma } from "@/lib/db";
import type { DocumentCategory } from "@/generated/prisma/enums";
import { notifyDocumentsRequested } from "@/lib/comms/notify";

/**
 * Document request rules: maps form triggers to the documents
 * that should be requested when those forms are active.
 */
const FORM_DOCUMENT_REQUIREMENTS: Record<string, { category: DocumentCategory; label: string }[]> = {
  "schedule-a": [
    { category: "CHARITABLE_RECEIPT", label: "Charitable donation receipts" },
    { category: "PROPERTY_TAX", label: "Property tax statements" },
    { category: "MORTGAGE_STATEMENT", label: "Mortgage interest statement (Form 1098)" },
  ],
  "schedule-c": [
    { category: "BANK_STATEMENT", label: "Business bank statements" },
    { category: "FINANCIAL_STATEMENT", label: "Business income & expense records" },
  ],
  "schedule-e": [
    { category: "FINANCIAL_STATEMENT", label: "Rental income & expense records" },
    { category: "DEPRECIATION_SCHEDULE", label: "Rental property depreciation schedule" },
  ],
  "form-8829": [
    { category: "OTHER", label: "Home office measurements and expenses" },
  ],
  "form-4562": [
    { category: "DEPRECIATION_SCHEDULE", label: "Asset depreciation schedule" },
  ],
  "form-4797": [
    { category: "OTHER", label: "Business asset sale documentation" },
  ],
};

/**
 * Standard documents requested based on entity type,
 * regardless of form triggers.
 */
const ENTITY_TYPE_DOCUMENTS: Record<string, { category: DocumentCategory; label: string }[]> = {
  INDIVIDUAL_1040: [
    { category: "W2", label: "W-2 wage statements" },
    { category: "F1099_INT", label: "1099-INT interest income" },
    { category: "F1099_DIV", label: "1099-DIV dividend income" },
    { category: "PRIOR_RETURN", label: "Prior year tax return" },
  ],
  S_CORP_1120S: [
    { category: "FINANCIAL_STATEMENT", label: "Year-end financial statements" },
    { category: "BANK_STATEMENT", label: "Business bank statements" },
    { category: "PRIOR_RETURN", label: "Prior year 1120-S return" },
  ],
  PARTNERSHIP_1065: [
    { category: "FINANCIAL_STATEMENT", label: "Partnership financial statements" },
    { category: "BANK_STATEMENT", label: "Partnership bank statements" },
    { category: "PRIOR_RETURN", label: "Prior year 1065 return" },
  ],
  SOLE_PROP_SCHEDULE_C: [
    { category: "BANK_STATEMENT", label: "Business bank statements" },
    { category: "FINANCIAL_STATEMENT", label: "Business income & expense summary" },
  ],
  NONPROFIT_990: [
    { category: "FINANCIAL_STATEMENT", label: "Financial statements" },
    { category: "PRIOR_RETURN", label: "Prior year 990 return" },
  ],
  NONPROFIT_990EZ: [
    { category: "FINANCIAL_STATEMENT", label: "Financial statements" },
  ],
  NONPROFIT_990PF: [
    { category: "FINANCIAL_STATEMENT", label: "Foundation financial statements" },
    { category: "PRIOR_RETURN", label: "Prior year 990-PF return" },
  ],
};

/**
 * Generate document requests for a return based on its entity type
 * and triggered forms. Skips documents that already exist.
 */
export async function generateDocumentRequests(returnId: string): Promise<number> {
  const taxReturn = await prisma.taxReturn.findUnique({
    where: { id: returnId },
    include: {
      entity: { select: { entityType: true, clientId: true } },
      triggeredForms: { where: { isActive: true } },
      documents: { select: { category: true, label: true } },
    },
  });

  if (!taxReturn) return 0;

  const existingDocs = new Set(
    taxReturn.documents.map((d) => `${d.category}:${d.label}`)
  );

  const toCreate: { category: DocumentCategory; label: string }[] = [];

  // 1. Entity-type standard documents
  const entityDocs = ENTITY_TYPE_DOCUMENTS[taxReturn.entity.entityType] || [];
  for (const doc of entityDocs) {
    if (!existingDocs.has(`${doc.category}:${doc.label}`)) {
      toCreate.push(doc);
    }
  }

  // 2. Form-triggered documents
  for (const form of taxReturn.triggeredForms) {
    const formDocs = FORM_DOCUMENT_REQUIREMENTS[form.formId] || [];
    for (const doc of formDocs) {
      if (!existingDocs.has(`${doc.category}:${doc.label}`)) {
        toCreate.push(doc);
      }
    }
  }

  if (toCreate.length === 0) return 0;

  await prisma.document.createMany({
    data: toCreate.map((doc) => ({
      returnId,
      clientId: taxReturn.entity.clientId,
      category: doc.category,
      label: doc.label,
      status: "REQUESTED" as const,
    })),
  });

  // Fire-and-forget client notification. Best-effort: failures don't roll
  // back the document creation.
  await notifyDocumentsRequested({
    returnId,
    documentLabels: toCreate.map((d) => d.label),
  });

  return toCreate.length;
}
