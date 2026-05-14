import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  parseBody,
  json,
  jsonError,
  getReturnScoped,
  getSearchParams,
} from "@/lib/api/helpers";
import { isStaff } from "@/lib/utils/permissions";
import { logInterviewSave } from "@/lib/audit/logger";
import { loadInterview } from "@/lib/interview/loader";
import { evaluateFormTriggers, getQuestionsWithTriggers } from "@/lib/interview/form-trigger-evaluator";
import type { AnswerMap } from "@/lib/interview/types";
import { generateDocumentRequests } from "@/lib/documents/request-triggers";

const BulkSaveSchema = z.object({
  responses: z.array(
    z.object({
      questionId: z.string().min(1),
      sectionId: z.string().min(1),
      instanceIndex: z.number().int().min(0).default(0),
      value: z.unknown(),
    })
  ).min(1).max(500),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { returnId } = await params;

  const taxReturn = await getReturnScoped(returnId, user.firmId);
  if (!taxReturn) return jsonError("Not found", 404);

  const searchParams = getSearchParams(req);
  const sectionId = searchParams.get("sectionId");

  const responses = await prisma.interviewResponse.findMany({
    where: {
      returnId,
      ...(sectionId ? { sectionId } : {}),
    },
    orderBy: [{ sectionId: "asc" }, { questionId: "asc" }, { instanceIndex: "asc" }],
  });

  return json({ responses });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { returnId } = await params;

  const taxReturn = await getReturnScoped(returnId, user.firmId);
  if (!taxReturn) return jsonError("Not found", 404);

  // Clients can only save during INTAKE
  if (!isStaff(user.role) && taxReturn.status !== "INTAKE") {
    return jsonError("Interview responses can only be modified during intake", 403);
  }

  const { data, error: parseError } = await parseBody(req, BulkSaveSchema);
  if (parseError) return parseError;

  const results = await prisma.$transaction(
    data.responses.map((r) =>
      prisma.interviewResponse.upsert({
        where: {
          returnId_questionId_instanceIndex: {
            returnId,
            questionId: r.questionId,
            instanceIndex: r.instanceIndex,
          },
        },
        create: {
          returnId,
          questionId: r.questionId,
          sectionId: r.sectionId,
          instanceIndex: r.instanceIndex,
          value: r.value as never,
          answeredBy: user.id,
        },
        update: {
          value: r.value as never,
          sectionId: r.sectionId,
          answeredBy: user.id,
          updatedAt: new Date(),
        },
      })
    )
  );

  // Log audit events (batched, non-critical)
  for (const r of data.responses) {
    await logInterviewSave(returnId, user.id, r.questionId, r.sectionId);
  }

  // Evaluate form triggers after save
  try {
    const entity = await prisma.entity.findUnique({
      where: { id: taxReturn.entityId },
      select: { entityType: true },
    });

    if (entity) {
      const interview = loadInterview(entity.entityType);
      const allResponses = await prisma.interviewResponse.findMany({
        where: { returnId },
      });

      const answerMap: AnswerMap = new Map();
      for (const r of allResponses) {
        const key = r.instanceIndex === 0
          ? r.questionId
          : `${r.questionId}:${r.instanceIndex}`;
        answerMap.set(key, r.value);
      }

      const triggeredQuestions = getQuestionsWithTriggers(interview.questionIndex);
      const triggerRecords = evaluateFormTriggers(triggeredQuestions, answerMap);

      for (const record of triggerRecords) {
        await prisma.triggeredForm.upsert({
          where: {
            returnId_formId_triggeredByQuestionId: {
              returnId,
              formId: record.formId,
              triggeredByQuestionId: record.triggeredByQuestionId,
            },
          },
          create: {
            returnId,
            formId: record.formId,
            formName: record.formName,
            action: record.action,
            triggeredByQuestionId: record.triggeredByQuestionId,
            isActive: record.isActive,
          },
          update: {
            isActive: record.isActive,
            updatedAt: new Date(),
          },
        });
      }

      // After form triggers are updated, auto-generate document requests
      await generateDocumentRequests(returnId);
    }
  } catch {
    // Form trigger evaluation is non-critical — don't fail the save
    console.error("Form trigger evaluation failed");
  }

  return json({ saved: results.length });
}
