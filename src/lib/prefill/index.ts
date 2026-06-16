import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit/logger";
import { loadInterview } from "@/lib/interview/loader";
import type { Question } from "@/lib/interview/types";
import { encrypt, isEncrypted } from "@/lib/security/pii";
import {
  aggregate,
  allMappings,
  readFieldPath,
  type PrefillMapping,
} from "./mappings";

/**
 * One proposed pre-fill: which question to fill, the value, and the source
 * documents the value came from. Includes the current saved answer (if any)
 * so the UI can flag overwrites.
 */
export interface PrefillProposal {
  questionId: string;
  sectionId: string;
  inputType: string;
  questionText: string;
  proposedValue: unknown;
  currentValue: unknown;
  sources: { documentId: string; label: string }[];
}

interface ExtractionRow {
  documentId: string;
  documentLabel: string;
  category: string;
  fields: unknown;
}

const SENSITIVE_INPUT_TYPES = new Set(["ssn", "ein"]);

function findSectionForQuestion(
  questionIndex: Map<string, Question>,
  sections: { sectionId: string; questions: Question[]; includedSections?: { sectionId: string; questions: Question[] }[] }[],
  questionId: string
): string | null {
  // Question must exist in the index; sections lookup happens after.
  if (!questionIndex.has(questionId)) return null;

  function search(secs: typeof sections): string | null {
    for (const s of secs) {
      if (s.questions.some((q) => q.questionId === questionId)) return s.sectionId;
      if (s.includedSections) {
        const found = search(
          s.includedSections as typeof sections
        );
        if (found) return found;
      }
    }
    return null;
  }
  return search(sections);
}

/**
 * Build the list of prefill proposals for a return. Reads all
 * DocumentExtraction rows in SUCCESS or REVIEWED status for the documents
 * attached to the return (either directly via Document.returnId or via the
 * campaign linkage we already do at return creation), groups them by
 * category, applies each mapping, and returns one proposal per filled
 * question.
 *
 * Proposals where the current saved answer already matches the proposed
 * value are omitted — there's nothing to do for them.
 */
export async function proposeReturnPrefills(
  returnId: string
): Promise<PrefillProposal[]> {
  const taxReturn = await prisma.taxReturn.findUnique({
    where: { id: returnId },
    select: {
      taxYear: true,
      entity: { select: { entityType: true } },
    },
  });
  if (!taxReturn) return [];

  const docs = await prisma.document.findMany({
    where: {
      returnId,
      extraction: { status: { in: ["SUCCESS", "REVIEWED"] } },
    },
    select: {
      id: true,
      label: true,
      category: true,
      extraction: { select: { fields: true } },
    },
  });
  if (docs.length === 0) return [];

  const extractions: ExtractionRow[] = docs
    .filter((d) => d.extraction?.fields)
    .map((d) => ({
      documentId: d.id,
      documentLabel: d.label,
      category: d.category,
      fields: d.extraction!.fields,
    }));

  const interview = loadInterview(
    taxReturn.entity.entityType,
    taxReturn.taxYear
  );

  const existingResponses = await prisma.interviewResponse.findMany({
    where: { returnId },
    select: {
      questionId: true,
      instanceIndex: true,
      value: true,
    },
  });
  const responseByKey = new Map<string, unknown>();
  for (const r of existingResponses) {
    // Only instance 0 for v1; multi-instance pre-fill is a follow-up.
    if (r.instanceIndex === 0) responseByKey.set(r.questionId, r.value);
  }

  const proposals: PrefillProposal[] = [];

  // Group extractions by category once so we don't re-iterate per mapping.
  const byCategory = new Map<string, ExtractionRow[]>();
  for (const e of extractions) {
    const arr = byCategory.get(e.category) || [];
    arr.push(e);
    byCategory.set(e.category, arr);
  }

  for (const m of allMappings()) {
    const rows = byCategory.get(m.documentCategory);
    if (!rows || rows.length === 0) continue;

    const question = interview.questionIndex.get(m.questionId);
    if (!question) continue; // mapping references an unknown question — skip

    const values = rows.map((r) => readFieldPath(r.fields, m.fieldPath));
    const proposed = aggregate(values, m.aggregation);
    if (proposed === undefined) continue;

    const current = responseByKey.get(m.questionId);

    // For currency questions, compare numerically; otherwise strict equality.
    const same =
      question.inputType === "currency"
        ? Number(current) === Number(proposed)
        : current === proposed;
    if (same) continue;

    const sectionId =
      findSectionForQuestion(
        interview.questionIndex,
        interview.sections,
        m.questionId
      ) || "";

    proposals.push({
      questionId: m.questionId,
      sectionId,
      inputType: question.inputType,
      questionText: question.text,
      proposedValue: proposed,
      currentValue: current,
      sources: rows
        .filter((r) => readFieldPath(r.fields, m.fieldPath) !== undefined)
        .map((r) => ({ documentId: r.documentId, label: r.documentLabel })),
    });
  }

  return proposals;
}

export interface ApplyPrefillsResult {
  applied: number;
  skipped: number;
  proposalCount: number;
}

/**
 * Persist a list of proposals as InterviewResponse upserts. Respects the
 * SSN/EIN encryption pattern the interview save endpoint already uses —
 * sensitive-typed values are encrypted before storage.
 *
 * Returns counts so the caller can show "12 filled, 3 already matched."
 */
export async function applyReturnPrefills(
  returnId: string,
  actorId: string,
  opts: { overwrite?: boolean } = {}
): Promise<ApplyPrefillsResult> {
  const proposals = await proposeReturnPrefills(returnId);
  if (proposals.length === 0) {
    return { applied: 0, skipped: 0, proposalCount: 0 };
  }

  let applied = 0;
  let skipped = 0;

  for (const p of proposals) {
    if (!opts.overwrite && p.currentValue !== null && p.currentValue !== undefined && p.currentValue !== "") {
      skipped += 1;
      continue;
    }

    let valueToStore = p.proposedValue;
    if (
      SENSITIVE_INPUT_TYPES.has(p.inputType) &&
      typeof valueToStore === "string"
    ) {
      if (!isEncrypted(valueToStore)) {
        valueToStore = encrypt(valueToStore);
      }
    }

    await prisma.interviewResponse.upsert({
      where: {
        returnId_questionId_instanceIndex: {
          returnId,
          questionId: p.questionId,
          instanceIndex: 0,
        },
      },
      create: {
        returnId,
        questionId: p.questionId,
        sectionId: p.sectionId,
        instanceIndex: 0,
        value: valueToStore as never,
        answeredBy: actorId,
      },
      update: {
        value: valueToStore as never,
        sectionId: p.sectionId,
        answeredBy: actorId,
        updatedAt: new Date(),
      },
    });
    applied += 1;
  }

  if (applied > 0) {
    await logAuditEvent({
      returnId,
      userId: actorId,
      eventType: "INTERVIEW_PREFILLED",
      eventCategory: "INTERVIEW",
      description: `Pre-filled ${applied} answer${applied === 1 ? "" : "s"} from extracted documents`,
      metadata: { applied, skipped, overwrite: !!opts.overwrite },
      critical: true,
    });
  }

  return { applied, skipped, proposalCount: proposals.length };
}
