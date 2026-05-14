import type { Question, AnswerMap, TriggeredFormRecord } from "./types";
import { evaluateCondition } from "./condition-evaluator";

/**
 * Evaluate all form triggers across a set of questions, given current answers.
 * Returns a list of triggered form records to upsert in the database.
 */
export function evaluateFormTriggers(
  questions: Question[],
  answers: AnswerMap
): TriggeredFormRecord[] {
  const records: TriggeredFormRecord[] = [];

  for (const question of questions) {
    if (!question.formTriggers || question.formTriggers.length === 0) {
      continue;
    }

    const answer = answers.get(question.questionId);

    for (const trigger of question.formTriggers) {
      const condition = {
        questionId: question.questionId,
        operator: trigger.triggerWhen.operator,
        value: trigger.triggerWhen.value,
      };

      const isTriggered = evaluateCondition(condition, answers);

      records.push({
        formId: trigger.formId,
        formName: trigger.formName || trigger.formId,
        action: trigger.action || "include",
        triggeredByQuestionId: question.questionId,
        isActive: isTriggered,
      });
    }
  }

  return records;
}

/**
 * Collect all questions that have form triggers from a flat question list.
 */
export function getQuestionsWithTriggers(
  questionIndex: Map<string, Question>
): Question[] {
  const result: Question[] = [];
  for (const question of questionIndex.values()) {
    if (question.formTriggers && question.formTriggers.length > 0) {
      result.push(question);
    }
  }
  return result;
}
