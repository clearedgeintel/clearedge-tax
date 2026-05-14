"use client";

import { useController, type Control } from "react-hook-form";
import type { QuestionOption } from "@/lib/interview/types";

interface Props {
  name: string;
  control: Control<Record<string, unknown>>;
  options: QuestionOption[];
}

export default function MultiSelectInput({ name, control, options }: Props) {
  const { field } = useController({ name, control, defaultValue: [] });
  const selected = Array.isArray(field.value) ? (field.value as string[]) : [];

  function toggle(value: string) {
    if (selected.includes(value)) {
      field.onChange(selected.filter((v) => v !== value));
    } else {
      field.onChange([...selected, value]);
    }
  }

  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
            selected.includes(opt.value)
              ? "bg-blue-50 border-blue-300"
              : "bg-white border-gray-200 hover:bg-gray-50"
          }`}
        >
          <input
            type="checkbox"
            checked={selected.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-800">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}
