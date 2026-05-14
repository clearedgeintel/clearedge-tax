"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ResolvedSection, AnswerMap } from "@/lib/interview/types";
import SectionRenderer from "./SectionRenderer";

interface Props {
  section: ResolvedSection;
  answers: AnswerMap;
  onSave: (sectionId: string, values: Record<string, unknown>) => Promise<void>;
  onNext: () => void;
  isLast: boolean;
  saving: boolean;
}

export default function RepeatableSection({
  section,
  answers,
  onSave,
  onNext,
  isLast,
  saving,
}: Props) {
  const [instances, setInstances] = useState(() => {
    // Count existing instances from the answer map
    let maxIndex = 0;
    for (const key of answers.keys()) {
      for (const q of section.questions) {
        if (key.startsWith(q.questionId + ":")) {
          const idx = parseInt(key.split(":")[1], 10);
          if (idx > maxIndex) maxIndex = idx;
        }
      }
    }
    // Always have at least one instance
    return Array.from({ length: maxIndex + 1 }, (_, i) => i);
  });

  function addInstance() {
    setInstances((prev) => [...prev, prev.length > 0 ? Math.max(...prev) + 1 : 0]);
  }

  function removeInstance(index: number) {
    if (instances.length <= 1) return;
    setInstances((prev) => prev.filter((i) => i !== index));
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
        {section.description && (
          <p className="mt-1 text-sm text-gray-500">{section.description}</p>
        )}
      </div>

      {instances.map((instanceIdx, arrIdx) => (
        <div
          key={instanceIdx}
          className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-600">
              {section.title} #{arrIdx + 1}
            </h3>
            {instances.length > 1 && (
              <button
                type="button"
                onClick={() => removeInstance(instanceIdx)}
                className="text-red-500 hover:text-red-700 p-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <SectionRenderer
            section={section}
            answers={answers}
            onSave={onSave}
            onNext={onNext}
            isLast={isLast}
            saving={saving}
            instanceIndex={instanceIdx}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={addInstance}
        className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add another {section.title.toLowerCase()}
      </button>
    </div>
  );
}
