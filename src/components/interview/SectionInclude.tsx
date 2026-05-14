"use client";

import { useMemo } from "react";
import type { Control } from "react-hook-form";
import type { ResolvedSection, AnswerMap } from "@/lib/interview/types";
import QuestionRenderer from "./QuestionRenderer";

interface Props {
  section: ResolvedSection;
  answers: AnswerMap;
  control: Control<Record<string, unknown>>;
}

export default function SectionInclude({ section, answers, control }: Props) {
  const sortedQuestions = useMemo(
    () => [...section.questions].sort((a, b) => a.sortOrder - b.sortOrder),
    [section.questions]
  );

  return (
    <div className="mt-6 mb-4 pl-4 border-l-2 border-blue-200">
      <h3 className="text-lg font-medium text-gray-800 mb-1">{section.title}</h3>
      {section.description && (
        <p className="text-sm text-gray-500 mb-3">{section.description}</p>
      )}
      <div className="space-y-1">
        {sortedQuestions.map((question) => (
          <QuestionRenderer
            key={question.questionId}
            question={question}
            answers={answers}
            control={control}
          />
        ))}
      </div>
    </div>
  );
}
