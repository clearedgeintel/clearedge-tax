"use client";

import { useState, useCallback, useMemo } from "react";
import type { ResolvedSection, AnswerMap, SectionProgress } from "@/lib/interview/types";
import { getAnswerKey } from "@/lib/interview/condition-evaluator";
import {
  getVisibleSections,
  computeSectionProgress,
} from "@/lib/interview/section-utils";
import SectionNav from "./SectionNav";
import SectionRenderer from "./SectionRenderer";
import RepeatableSection from "./RepeatableSection";

interface InterviewResponse {
  questionId: string;
  sectionId: string;
  instanceIndex: number;
  value: unknown;
}

interface Props {
  sections: ResolvedSection[];
  savedResponses: InterviewResponse[];
  entityType: string;
  filingStatus?: string;
  isStaff: boolean;
  returnId: string;
}

export default function InterviewShell({
  sections,
  savedResponses,
  entityType,
  filingStatus,
  isStaff,
  returnId,
}: Props) {
  // Build initial answer map from saved responses
  const [answers, setAnswers] = useState<AnswerMap>(() => {
    const map = new Map<string, unknown>();
    for (const r of savedResponses) {
      const key = getAnswerKey(r.questionId, r.instanceIndex);
      map.set(key, r.value);
    }
    return map;
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Get visible sections based on current answers
  const visibleSections = useMemo(
    () => getVisibleSections(sections, answers, entityType, filingStatus, isStaff),
    [sections, answers, entityType, filingStatus, isStaff]
  );

  // Compute progress for all visible sections
  const progress: SectionProgress[] = useMemo(
    () => visibleSections.map((s) => computeSectionProgress(s, answers)),
    [visibleSections, answers]
  );

  const currentSection = visibleSections[currentIndex];

  // Save section responses to the API
  const handleSave = useCallback(
    async (sectionId: string, values: Record<string, unknown>) => {
      setSaving(true);
      setSaveStatus("saving");

      // Update local answer map
      const newAnswers = new Map(answers);
      const responses: { questionId: string; sectionId: string; instanceIndex: number; value: unknown }[] = [];

      for (const [questionId, value] of Object.entries(values)) {
        if (value === undefined) continue;
        // Parse instanceIndex from key if present
        const parts = questionId.split(":");
        const qId = parts[0];
        const instanceIdx = parts.length > 1 ? parseInt(parts[1], 10) : 0;

        const key = getAnswerKey(qId, instanceIdx);
        newAnswers.set(key, value);
        responses.push({ questionId: qId, sectionId, instanceIndex: instanceIdx, value });
      }

      setAnswers(newAnswers);

      if (responses.length > 0) {
        try {
          const res = await fetch(`/api/returns/${returnId}/interview`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ responses }),
          });

          if (!res.ok) {
            console.error("Save failed:", await res.text());
          }
        } catch (err) {
          console.error("Save error:", err);
        }
      }

      setSaving(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
    [answers, returnId]
  );

  const handleNext = useCallback(() => {
    if (currentIndex < visibleSections.length - 1) {
      setCurrentIndex(currentIndex + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentIndex, visibleSections.length]);

  const handleNavigate = useCallback(
    (index: number) => {
      if (index >= 0 && index < visibleSections.length) {
        setCurrentIndex(index);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [visibleSections.length]
  );

  if (!currentSection) {
    return (
      <div className="p-8 text-center text-gray-500">
        No interview sections available for this return type.
      </div>
    );
  }

  const overallProgress = progress.reduce(
    (acc, p) => ({ answered: acc.answered + p.answered, total: acc.total + p.total }),
    { answered: 0, total: 0 }
  );

  return (
    <div className="flex min-h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 bg-white p-4 overflow-y-auto">
        <div className="mb-4 px-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Overall Progress</span>
            <span>
              {overallProgress.total > 0
                ? Math.round((overallProgress.answered / overallProgress.total) * 100)
                : 0}
              %
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all"
              style={{
                width: `${
                  overallProgress.total > 0
                    ? (overallProgress.answered / overallProgress.total) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        <SectionNav
          sections={visibleSections}
          progress={progress}
          currentIndex={currentIndex}
          onNavigate={handleNavigate}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 p-8 max-w-3xl">
        {saveStatus === "saved" && (
          <div className="mb-4 text-xs text-green-600 font-medium">Saved</div>
        )}

        {currentSection.repeatable ? (
          <RepeatableSection
            section={currentSection}
            answers={answers}
            onSave={handleSave}
            onNext={handleNext}
            isLast={currentIndex === visibleSections.length - 1}
            saving={saving}
          />
        ) : (
          <SectionRenderer
            section={currentSection}
            answers={answers}
            onSave={handleSave}
            onNext={handleNext}
            isLast={currentIndex === visibleSections.length - 1}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}
