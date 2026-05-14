"use client";

import { useController, type Control } from "react-hook-form";

interface Props {
  name: string;
  control: Control<Record<string, unknown>>;
  min?: number;
  max?: number;
  placeholder?: string;
}

export default function NumberInput({ name, control, min, max, placeholder }: Props) {
  const { field } = useController({ name, control });

  return (
    <input
      type="number"
      value={field.value !== undefined && field.value !== null ? String(field.value) : ""}
      onChange={(e) => {
        const val = e.target.value;
        field.onChange(val === "" ? undefined : Number(val));
      }}
      onBlur={field.onBlur}
      min={min}
      max={max}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  );
}
