"use client";

import { useController, type Control } from "react-hook-form";

interface Props {
  name: string;
  control: Control<Record<string, unknown>>;
  min?: number;
  max?: number;
}

export default function PercentageInput({ name, control, min = 0, max = 100 }: Props) {
  const { field } = useController({ name, control });

  return (
    <div className="relative w-32">
      <input
        type="number"
        step="0.01"
        value={field.value !== undefined && field.value !== null ? String(field.value) : ""}
        onChange={(e) => {
          const val = e.target.value;
          field.onChange(val === "" ? undefined : Number(val));
        }}
        onBlur={field.onBlur}
        min={min}
        max={max}
        className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
    </div>
  );
}
