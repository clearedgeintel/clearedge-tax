"use client";

import { useController, type Control } from "react-hook-form";

interface Props {
  name: string;
  control: Control<Record<string, unknown>>;
}

export default function YesNoInput({ name, control }: Props) {
  const { field } = useController({ name, control });

  return (
    <div className="flex gap-3">
      {[
        { value: true, label: "Yes" },
        { value: false, label: "No" },
      ].map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => field.onChange(opt.value)}
          className={`px-5 py-2 rounded-md border text-sm font-medium transition-colors ${
            field.value === opt.value
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
