import type { Condition, ConditionGroup, Question, Section, AnswerMap } from "./types";

/**
 * Evaluate a single condition against the answer map.
 */
export function evaluateCondition(
  condition: Condition,
  answers: AnswerMap
): boolean {
  const answer = answers.get(condition.questionId);

  switch (condition.operator) {
    case "eq":
      return answer === condition.value;

    case "neq":
      return answer !== condition.value;

    case "gt":
      return typeof answer === "number" && answer > (condition.value as number);

    case "gte":
      return typeof answer === "number" && answer >= (condition.value as number);

    case "lt":
      return typeof answer === "number" && answer < (condition.value as number);

    case "lte":
      return typeof answer === "number" && answer <= (condition.value as number);

    case "in":
      if (Array.isArray(condition.value)) {
        return condition.value.includes(answer);
      }
      return false;

    case "not_in":
      if (Array.isArray(condition.value)) {
        return !condition.value.includes(answer);
      }
      return true;

    case "contains":
      if (typeof answer === "string") {
        return answer.includes(condition.value as string);
      }
      if (Array.isArray(answer)) {
        return answer.includes(condition.value);
      }
      return false;

    case "exists":
      return answer !== undefined && answer !== null && answer !== "";

    case "not_exists":
      return answer === undefined || answer === null || answer === "";

    default:
      return true;
  }
}

/**
 * Evaluate an array of conditions with AND logic.
 * Empty array → true (no conditions = always visible).
 */
export function evaluateConditions(
  conditions: Condition[],
  answers: AnswerMap
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((c) => evaluateCondition(c, answers));
}

/**
 * Evaluate condition groups with OR logic between groups.
 * Each group's conditions are ANDed together.
 * Empty array → true.
 */
export function evaluateConditionGroups(
  groups: ConditionGroup[],
  answers: AnswerMap
): boolean {
  if (!groups || groups.length === 0) return true;
  return groups.some((group) => {
    if (group.operator === "OR") {
      return group.conditions.some((c) => evaluateCondition(c, answers));
    }
    // Default AND
    return group.conditions.every((c) => evaluateCondition(c, answers));
  });
}

/**
 * Determine whether a question should be visible given current answers.
 */
export function isQuestionVisible(
  question: Question,
  answers: AnswerMap
): boolean {
  // Check simple conditions (AND)
  if (question.conditions && question.conditions.length > 0) {
    if (!evaluateConditions(question.conditions, answers)) {
      return false;
    }
  }

  // Check condition groups (OR of groups)
  if (question.conditionGroups && question.conditionGroups.length > 0) {
    if (!evaluateConditionGroups(question.conditionGroups, answers)) {
      return false;
    }
  }

  return true;
}

/**
 * Determine whether a section should be visible.
 * Checks entity type, filing status, and conditions.
 */
export function isSectionVisible(
  section: Section,
  answers: AnswerMap,
  entityType: string,
  filingStatus?: string
): boolean {
  // Check entity type filter
  if (section.appliesToEntityTypes && section.appliesToEntityTypes.length > 0) {
    if (!section.appliesToEntityTypes.includes(entityType)) {
      return false;
    }
  }

  // Check filing status filter
  if (section.appliesToFilingStatuses && section.appliesToFilingStatuses.length > 0) {
    if (!filingStatus || !section.appliesToFilingStatuses.includes(filingStatus)) {
      return false;
    }
  }

  // Check conditions
  if (section.conditions && section.conditions.length > 0) {
    if (!evaluateConditions(section.conditions, answers)) {
      return false;
    }
  }

  return true;
}

/**
 * Get the answer key for a question within a repeatable instance.
 * Instance 0 uses just questionId, instance N uses questionId:N.
 */
export function getAnswerKey(questionId: string, instanceIndex: number): string {
  return instanceIndex === 0 ? questionId : `${questionId}:${instanceIndex}`;
}

/**
 * Build a scoped answer map for a repeatable section instance.
 * Looks up questionId:instanceIndex first, then falls back to questionId.
 */
export function getScopedAnswer(
  answers: AnswerMap,
  questionId: string,
  instanceIndex: number
): unknown {
  const scopedKey = getAnswerKey(questionId, instanceIndex);
  if (answers.has(scopedKey)) {
    return answers.get(scopedKey);
  }
  // Fall back to instance 0 for cross-section references
  return answers.get(questionId);
}
