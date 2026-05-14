import type { Section, Question, AnswerMap, SectionProgress, ResolvedSection } from "./types";
import { isSectionVisible, isQuestionVisible } from "./condition-evaluator";

/**
 * Filter sections and questions by role.
 * Clients don't see staffOnly sections/questions.
 */
export function filterForRole(
  sections: ResolvedSection[],
  isStaff: boolean
): ResolvedSection[] {
  if (isStaff) return sections;

  return sections
    .filter((s) => !(s as Section & { staffOnly?: boolean }).staffOnly)
    .map((s) => ({
      ...s,
      questions: s.questions.filter((q) => !q.staffOnly),
      includedSections: s.includedSections
        ? filterForRole(s.includedSections, isStaff)
        : undefined,
    }));
}

/**
 * Get only the visible sections given current answers and context.
 */
export function getVisibleSections(
  sections: ResolvedSection[],
  answers: AnswerMap,
  entityType: string,
  filingStatus: string | undefined,
  isStaff: boolean
): ResolvedSection[] {
  const roleFiltered = filterForRole(sections, isStaff);
  return roleFiltered.filter((s) =>
    isSectionVisible(s, answers, entityType, filingStatus)
  );
}

/**
 * Compute progress for a single section based on visible required questions.
 */
export function computeSectionProgress(
  section: Section,
  answers: AnswerMap
): SectionProgress {
  let total = 0;
  let answered = 0;

  for (const question of section.questions) {
    // Skip hidden questions
    if (!isQuestionVisible(question, answers)) continue;

    // Only count required questions
    const isRequired = question.validation?.required !== false;
    if (!isRequired) continue;

    total++;

    const answer = answers.get(question.questionId);
    if (answer !== undefined && answer !== null && answer !== "") {
      answered++;
    }
  }

  return {
    sectionId: section.sectionId,
    total,
    answered,
    complete: total > 0 && answered >= total,
  };
}

/**
 * Compute progress for all sections.
 */
export function computeAllProgress(
  sections: Section[],
  answers: AnswerMap
): SectionProgress[] {
  return sections.map((s) => computeSectionProgress(s, answers));
}
