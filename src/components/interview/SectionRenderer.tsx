"use client";

import { useForm } from "react-hook-form";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ResolvedSection, AnswerMap } from "@/lib/interview/types";
import { getAnswerKey } from "@/lib/interview/condition-evaluator";
import QuestionRenderer from "./QuestionRenderer";
import SectionInclude from "./SectionInclude";

interface Props {
  section: ResolvedSection;
  answers: AnswerMap;
  onSave: (sectionId: string, values: Record<string, unknown>) => Promise<void>;
  onNext: () => void;
  isLast: boolean;
  saving: boolean;
  instanceIndex?: number;
}

export default function SectionRenderer({
  section,
  answers,
  onSave,
  onNext,
  isLast,
  saving,
  instanceIndex = 0,
}: Props) {
  // Build default values from answer map
  const defaultValues = useMemo(() => {
    const values: Record<string, unknown> = {};
    for (const q of section.questions) {
      const key = getAnswerKey(q.questionId, instanceIndex);
      if (answers.has(key)) {
        values[q.questionId] = answers.get(key);
      } else if (q.defaultValue !== undefined) {
        values[q.questionId] = q.defaultValue;
      }
    }
    return values;
  }, [section, answers, instanceIndex]);

  const { control, handleSubmit, reset, getValues } = useForm<Record<string, unknown>>({
    defaultValues,
  });

  // Reset form when section changes
  const prevSectionId = useRef(section.sectionId);
  useEffect(() => {
    if (prevSectionId.current !== section.sectionId) {
      reset(defaultValues);
      prevSectionId.current = section.sectionId;
    }
  }, [section.sectionId, defaultValues, reset]);

  // Merge form values into the global answer map for condition evaluation
  const liveAnswers = useMemo(() => {
    const merged = new Map(answers);
    const currentValues = getValues();
    for (const [key, value] of Object.entries(currentValues)) {
      const answerKey = getAnswerKey(key, instanceIndex);
      merged.set(answerKey, value);
    }
    return merged;
  }, [answers, getValues, instanceIndex]);

  const onSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      await onSave(section.sectionId, values);
    },
    [onSave, section.sectionId]
  );

  const sortedQuestions = useMemo(
    () => [...section.questions].sort((a, b) => a.sortOrder - b.sortOrder),
    [section.questions]
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
        {section.description && (
          <p className="mt-1 text-sm text-gray-500">{section.description}</p>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-1">
          {sortedQuestions.map((question) => {
            if (question.inputType === "section_include" && question.includeSection) {
              const included = section.includedSections?.find(
                (s) => s.sectionId === question.includeSection!.sectionId
              );
              if (!included) return null;
              return (
                <SectionInclude
                  key={question.questionId}
                  section={included}
                  answers={liveAnswers}
                  control={control}
                />
              );
            }

            return (
              <QuestionRenderer
                key={question.questionId}
                question={question}
                answers={liveAnswers}
                control={control}
              />
            );
          })}
        </div>

        <div className="mt-8 flex gap-3 border-t border-gray-200 pt-6">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-300 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              await handleSubmit(onSubmit)();
              onNext();
            }}
            className="px-5 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isLast ? "Complete" : "Save & Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}
