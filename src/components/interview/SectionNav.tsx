"use client";

import { Check, Circle } from "lucide-react";
import type { SectionProgress, ResolvedSection } from "@/lib/interview/types";

interface Props {
  sections: ResolvedSection[];
  progress: SectionProgress[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}

export default function SectionNav({
  sections,
  progress,
  currentIndex,
  onNavigate,
}: Props) {
  return (
    <nav className="space-y-1">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
        Sections
      </h3>
      {sections.map((section, index) => {
        const p = progress.find((pr) => pr.sectionId === section.sectionId);
        const isCurrent = index === currentIndex;

        return (
          <button
            key={section.sectionId}
            onClick={() => onNavigate(index)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left text-sm transition-colors ${
              isCurrent
                ? "bg-blue-50 text-blue-700 font-medium"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <ProgressIcon progress={p} />
            <span className="flex-1 truncate">{section.title}</span>
            {p && p.total > 0 && (
              <span className="text-xs text-gray-400">
                {p.answered}/{p.total}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function ProgressIcon({ progress }: { progress?: SectionProgress }) {
  if (!progress) {
    return <Circle className="h-4 w-4 text-gray-300 flex-shrink-0" />;
  }
  if (progress.complete) {
    return (
      <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
        <Check className="h-3 w-3 text-white" />
      </div>
    );
  }
  if (progress.answered > 0) {
    return (
      <div className="h-4 w-4 rounded-full border-2 border-blue-400 flex-shrink-0">
        <div
          className="h-full rounded-full bg-blue-400"
          style={{ width: `${(progress.answered / progress.total) * 100}%` }}
        />
      </div>
    );
  }
  return <Circle className="h-4 w-4 text-gray-300 flex-shrink-0" />;
}
