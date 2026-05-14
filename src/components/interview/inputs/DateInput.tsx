"use client";

import { useController, type Control } from "react-hook-form";

interface Props {
  name: string;
  control: Control<Record<string, unknown>>;
  minDate?: string;
  maxDate?: string;
}

export default function DateInput({ name, control, minDate, maxDate }: Props) {
  const { field } = useController({ name, control, defaultValue: "" });

  return (
    <input
      type="date"
      value={(field.value as string) ?? ""}
      onChange={(e) => field.onChange(e.target.value)}
      onBlur={field.onBlur}
      min={minDate}
      max={maxDate}
      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  );
}
