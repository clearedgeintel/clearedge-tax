"use client";

import { useEffect, useState } from "react";
import InterviewShell from "@/components/interview/InterviewShell";
import type { ResolvedSection } from "@/lib/interview/types";

interface InterviewResponse {
  questionId: string;
  sectionId: string;
  instanceIndex: number;
  value: unknown;
}

interface Props {
  returnId: string;
  entityType: string;
  filingStatus?: string;
  isStaff: boolean;
}

export default function InterviewClient({
  returnId,
  entityType,
  filingStatus,
  isStaff,
}: Props) {
  const [sections, setSections] = useState<ResolvedSection[] | null>(null);
  const [responses, setResponses] = useState<InterviewResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [questionsRes, responsesRes] = await Promise.all([
          fetch(`/api/returns/${returnId}/interview/questions`),
          fetch(`/api/returns/${returnId}/interview`),
        ]);

        if (!questionsRes.ok) throw new Error("Failed to load questions");
        if (!responsesRes.ok) throw new Error("Failed to load responses");

        const questionsData = await questionsRes.json();
        const responsesData = await responsesRes.json();

        setSections(questionsData.sections);
        setResponses(responsesData.responses);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load interview");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [returnId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500 text-sm">Loading interview...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-red-500 text-sm">{error}</div>
      </div>
    );
  }

  if (!sections) return null;

  return (
    <InterviewShell
      sections={sections}
      savedResponses={responses}
      entityType={entityType}
      filingStatus={filingStatus}
      isStaff={isStaff}
      returnId={returnId}
    />
  );
}
