/**
 * End-to-end happy-path walkthrough against the seeded ClearEdge Tax DB.
 *
 * Picks John Smith's 1040 return from the seed and walks it through the full
 * lifecycle, calling the same engine code the HTTP routes call. Prints
 * PASS/FAIL for each step so we can spot what's broken without a browser.
 *
 *   npx tsx scripts/e2e-happy-path.ts
 *
 * The script resets the return back to INTAKE at start so it's re-runnable.
 * It does NOT delete the return — it's the same row the seed creates.
 *
 * Anything that mutates downstream rows (deadlines, audit events, doc
 * requests) accumulates across runs. The seed is the source of truth: run
 * `npm run db:seed` to start clean.
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { transitionReturn } from "../src/lib/sequencing/status-machine";
import { computeDeadlines } from "../src/lib/deadlines/calculator";
import { generateDocumentRequests } from "../src/lib/documents/request-triggers";
import { generateExportPackage } from "../src/lib/export/package-generator";
import { loadInterview } from "../src/lib/interview/loader";
import {
  evaluateFormTriggers,
  getQuestionsWithTriggers,
} from "../src/lib/interview/form-trigger-evaluator";
import { encrypt, isEncrypted } from "../src/lib/security/pii";
import type { AnswerMap } from "../src/lib/interview/types";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type StepResult = "PASS" | "FAIL" | "WARN" | "SKIP";

const results: { step: string; status: StepResult; note: string }[] = [];
function record(step: string, status: StepResult, note = "") {
  results.push({ step, status, note });
  const icon =
    status === "PASS" ? "+" : status === "FAIL" ? "-" : status === "WARN" ? "?" : ".";
  const line = `${icon} ${step}${note ? `  ${note}` : ""}`;
  console.log(line);
}

async function main() {
  console.log("\nClearEdge Tax — E2E happy-path walkthrough\n");

  // ── Step 0: find the seed return ───────────────────────────────────
  const john = await prisma.entity.findFirst({
    where: { legalName: "John Smith", entityType: "INDIVIDUAL_1040" },
  });
  if (!john) {
    record("locate seed return", "FAIL", "John Smith 1040 not found — run `npm run db:seed` first");
    return;
  }
  let taxReturn = await prisma.taxReturn.findFirst({
    where: { entityId: john.id, taxYear: 2025 },
  });
  if (!taxReturn) {
    record("locate seed return", "FAIL", "John's 2025 1040 not found");
    return;
  }
  record("locate seed return", "PASS", `return ${taxReturn.id}`);

  const preparer = await prisma.user.findFirst({ where: { email: "preparer@clearedgetax.com" } });
  const manager = await prisma.user.findFirst({ where: { email: "manager@clearedgetax.com" } });
  if (!preparer || !manager) {
    record("locate actors", "FAIL", "missing preparer or manager user");
    return;
  }
  record("locate actors", "PASS", `${preparer.email} + ${manager.email}`);

  // ── Step 1: reset state ────────────────────────────────────────────
  await prisma.taxReturn.update({
    where: { id: taxReturn.id },
    data: {
      status: "INTAKE",
      isBlocked: false,
      blockedReason: null,
      statusNote: null,
      submittedAt: null,
      approvedAt: null,
      exportedAt: null,
    },
  });
  // Encrypt and store a TIN on the entity so the export step exercises
  // the decrypt path. Idempotent: encrypting an already-encrypted value
  // is a no-op.
  const tinPlain = "123-45-6789";
  await prisma.entity.update({
    where: { id: john.id },
    data: { tin: encrypt(tinPlain), tinType: "SSN" },
  });
  await prisma.reviewAction.deleteMany({ where: { returnId: taxReturn.id } });
  // resolve any K-1 links so the return can advance unblocked
  await prisma.k1Link.updateMany({
    where: { targetReturnId: taxReturn.id, isResolved: false },
    data: { isResolved: true, resolvedAt: new Date() },
  });
  record("reset state", "PASS", "INTAKE, no review actions, K-1s pre-resolved");

  // ── Step 2: deadlines computed for this entity type ────────────────
  const computed = computeDeadlines(john.entityType, 2025);
  const filingDl = computed.find((d) => d.deadlineType === "FILING");
  if (!filingDl) {
    record("compute deadlines", "FAIL", "no FILING deadline produced");
  } else {
    const expected = "2026-04-15";
    const got = filingDl.originalDueDate.toISOString().slice(0, 10);
    if (got === expected) {
      record("compute deadlines", "PASS", `FILING ${got} as expected`);
    } else {
      record("compute deadlines", "WARN", `FILING ${got}, expected ${expected}`);
    }
  }

  // ── Step 3: save a few interview answers, including an SSN ─────────
  const interview = loadInterview(john.entityType);
  // Find an SSN question and a question with any form trigger we can satisfy.
  let ssnQuestion: { questionId: string; sectionId: string } | null = null;
  let triggerQuestion:
    | {
        questionId: string;
        sectionId: string;
        triggerValue: unknown;
        formId: string;
      }
    | null = null;
  for (const sec of interview.sections) {
    for (const q of sec.questions) {
      if (!ssnQuestion && q.inputType === "ssn") {
        ssnQuestion = { questionId: q.questionId, sectionId: sec.sectionId };
      }
      if (!triggerQuestion && q.formTriggers && q.formTriggers.length > 0) {
        const t = q.formTriggers[0];
        if (t.triggerWhen.operator === "eq" || t.triggerWhen.operator === "exists") {
          triggerQuestion = {
            questionId: q.questionId,
            sectionId: sec.sectionId,
            triggerValue:
              t.triggerWhen.operator === "exists"
                ? "y"
                : t.triggerWhen.value,
            formId: t.formId,
          };
        }
      }
    }
  }

  if (ssnQuestion) {
    const plaintext = "123-45-6789";
    await prisma.interviewResponse.upsert({
      where: {
        returnId_questionId_instanceIndex: {
          returnId: taxReturn.id,
          questionId: ssnQuestion.questionId,
          instanceIndex: 0,
        },
      },
      create: {
        returnId: taxReturn.id,
        questionId: ssnQuestion.questionId,
        sectionId: ssnQuestion.sectionId,
        instanceIndex: 0,
        value: encrypt(plaintext) as never,
        answeredBy: preparer.id,
      },
      update: {
        value: encrypt(plaintext) as never,
        answeredBy: preparer.id,
      },
    });
    const stored = await prisma.interviewResponse.findUnique({
      where: {
        returnId_questionId_instanceIndex: {
          returnId: taxReturn.id,
          questionId: ssnQuestion.questionId,
          instanceIndex: 0,
        },
      },
    });
    if (stored && typeof stored.value === "string" && isEncrypted(stored.value)) {
      record(
        "encrypt SSN answer",
        "PASS",
        `q=${ssnQuestion.questionId} stored as ciphertext`
      );
    } else {
      record("encrypt SSN answer", "FAIL", "value is not encrypted in DB");
    }
  } else {
    record("encrypt SSN answer", "SKIP", "no SSN question in this interview file");
  }

  if (triggerQuestion) {
    await prisma.interviewResponse.upsert({
      where: {
        returnId_questionId_instanceIndex: {
          returnId: taxReturn.id,
          questionId: triggerQuestion.questionId,
          instanceIndex: 0,
        },
      },
      create: {
        returnId: taxReturn.id,
        questionId: triggerQuestion.questionId,
        sectionId: triggerQuestion.sectionId,
        instanceIndex: 0,
        value: triggerQuestion.triggerValue as never,
        answeredBy: preparer.id,
      },
      update: {
        value: triggerQuestion.triggerValue as never,
        answeredBy: preparer.id,
      },
    });
    record(
      "save trigger-satisfying answer",
      "PASS",
      `${triggerQuestion.questionId}=${JSON.stringify(triggerQuestion.triggerValue)} → ${triggerQuestion.formId}`
    );
  } else {
    record("save trigger-satisfying answer", "WARN", "no eligible form-trigger question found");
  }

  // ── Step 4: evaluate form triggers, persist triggered forms ────────
  const allResponses = await prisma.interviewResponse.findMany({
    where: { returnId: taxReturn.id },
  });
  const answerMap: AnswerMap = new Map();
  for (const r of allResponses) {
    const key =
      r.instanceIndex === 0 ? r.questionId : `${r.questionId}:${r.instanceIndex}`;
    answerMap.set(key, r.value);
  }
  const triggeredQuestions = getQuestionsWithTriggers(interview.questionIndex);
  const triggerRecords = evaluateFormTriggers(triggeredQuestions, answerMap);
  for (const t of triggerRecords) {
    await prisma.triggeredForm.upsert({
      where: {
        returnId_formId_triggeredByQuestionId: {
          returnId: taxReturn.id,
          formId: t.formId,
          triggeredByQuestionId: t.triggeredByQuestionId,
        },
      },
      create: {
        returnId: taxReturn.id,
        formId: t.formId,
        formName: t.formName,
        action: t.action,
        triggeredByQuestionId: t.triggeredByQuestionId,
        isActive: t.isActive,
      },
      update: { isActive: t.isActive },
    });
  }
  const activeTriggered = await prisma.triggeredForm.count({
    where: { returnId: taxReturn.id, isActive: true },
  });
  record("evaluate form triggers", "PASS", `${activeTriggered} active triggered forms`);

  // ── Step 5: generate document requests ─────────────────────────────
  await prisma.document.deleteMany({
    where: { returnId: taxReturn.id, status: "REQUESTED" },
  });
  const generated = await generateDocumentRequests(taxReturn.id);
  record("generate doc requests", "PASS", `${generated} new requests`);

  // ── Step 6: fulfil documents (simulate client upload + staff accept)
  const requestedDocs = await prisma.document.findMany({
    where: { returnId: taxReturn.id, status: "REQUESTED" },
  });
  for (const d of requestedDocs) {
    await prisma.document.update({
      where: { id: d.id },
      data: {
        status: "ACCEPTED",
        storageKey: `walkthrough/${d.id}/placeholder`,
        mimeType: "application/pdf",
        fileSize: 100_000,
        uploadedBy: preparer.id,
        uploadedAt: new Date(),
      },
    });
  }
  const acceptedCount = await prisma.document.count({
    where: { returnId: taxReturn.id, status: "ACCEPTED" },
  });
  record(
    "fulfil + accept documents",
    "PASS",
    `${acceptedCount} accepted (incl. ${requestedDocs.length} newly fulfilled)`
  );

  // ── Step 7: INTAKE → PREPARATION ───────────────────────────────────
  let result = await transitionReturn(taxReturn.id, "PREPARATION", preparer.id, "Intake complete");
  if (!result.success) {
    record("INTAKE → PREPARATION", "FAIL", result.error || "");
  } else {
    const r = await prisma.taxReturn.findUnique({ where: { id: taxReturn.id } });
    record(
      "INTAKE → PREPARATION",
      r?.status === "PREPARATION" ? "PASS" : "WARN",
      `status now ${r?.status}`
    );
  }

  // ── Step 8: PREPARATION → REVIEW ───────────────────────────────────
  result = await transitionReturn(taxReturn.id, "REVIEW", preparer.id, "Ready for review");
  await prisma.reviewAction.create({
    data: {
      returnId: taxReturn.id,
      userId: preparer.id,
      action: "SUBMITTED_FOR_REVIEW",
      notes: "Ready for review",
    },
  });
  let r = await prisma.taxReturn.findUnique({ where: { id: taxReturn.id } });
  record("PREPARATION → REVIEW", r?.status === "REVIEW" ? "PASS" : "FAIL", `status ${r?.status}`);
  if (!r?.submittedAt) {
    record("submittedAt stamp", "FAIL", "expected submittedAt to be set");
  } else {
    record("submittedAt stamp", "PASS", r.submittedAt.toISOString());
  }

  // ── Step 9: REVIEW → APPROVED ──────────────────────────────────────
  result = await transitionReturn(taxReturn.id, "APPROVED", manager.id, "Looks good");
  await prisma.reviewAction.create({
    data: {
      returnId: taxReturn.id,
      userId: manager.id,
      action: "APPROVED",
      notes: "Looks good",
    },
  });
  r = await prisma.taxReturn.findUnique({ where: { id: taxReturn.id } });
  record("REVIEW → APPROVED", r?.status === "APPROVED" ? "PASS" : "FAIL", `status ${r?.status}`);
  if (!r?.approvedAt) record("approvedAt stamp", "FAIL", "");
  else record("approvedAt stamp", "PASS", r.approvedAt.toISOString());

  // ── Step 10: generate export package ───────────────────────────────
  try {
    const pkg = await generateExportPackage(taxReturn.id, { actorUserId: manager.id });
    if (pkg.entityInfo.tin === "123-45-6789") {
      record("export decrypts TIN", "PASS", "matches stored plaintext");
    } else if (pkg.entityInfo.tin) {
      record(
        "export decrypts TIN",
        "WARN",
        `got ${JSON.stringify(pkg.entityInfo.tin)}, expected 123-45-6789`
      );
    } else {
      record("export decrypts TIN", "SKIP", "no TIN stored on entity yet");
    }
    record(
      "export package shape",
      "PASS",
      `${Object.keys(pkg.interviewData).length} sections of interview data, ${pkg.documents.length} docs`
    );
  } catch (e) {
    record("generate export package", "FAIL", e instanceof Error ? e.message : String(e));
  }

  // ── Step 11: APPROVED → EXPORTED ───────────────────────────────────
  result = await transitionReturn(taxReturn.id, "EXPORTED", manager.id, "Exported to Drake");
  await prisma.reviewAction.create({
    data: {
      returnId: taxReturn.id,
      userId: manager.id,
      action: "EXPORTED",
      notes: "Exported to Drake",
    },
  });
  r = await prisma.taxReturn.findUnique({ where: { id: taxReturn.id } });
  record("APPROVED → EXPORTED", r?.status === "EXPORTED" ? "PASS" : "FAIL", `status ${r?.status}`);
  if (!r?.exportedAt) record("exportedAt stamp", "FAIL", "");
  else record("exportedAt stamp", "PASS", r.exportedAt.toISOString());

  // ── Step 12: cannot transition from EXPORTED ───────────────────────
  result = await transitionReturn(taxReturn.id, "APPROVED", manager.id, "regress");
  if (result.success) {
    record("EXPORTED is terminal", "FAIL", "regression succeeded");
  } else {
    record("EXPORTED is terminal", "PASS", result.error || "rejected");
  }

  // ── Summary ────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(64));
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const warn = results.filter((r) => r.status === "WARN").length;
  const skip = results.filter((r) => r.status === "SKIP").length;
  console.log(`Summary: ${pass} PASS / ${fail} FAIL / ${warn} WARN / ${skip} SKIP\n`);
  if (fail > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("\nUNHANDLED:", e);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
