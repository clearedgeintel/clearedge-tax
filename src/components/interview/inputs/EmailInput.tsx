"use client";

import { useController, type Control } from "react-hook-form";

interface Props {
  name: string;
  control: Control<Record<string, unknown>>;
}

export default function EmailInput({ name, control }: Props) {
  const { field } = useController({ name, control, defaultValue: "" });

  return (
    <input
      type="email"
      value={(field.value as string) ?? ""}
      onChange={(e) => field.onChange(e.target.value)}
      onBlur={field.onBlur}
      placeholder="email@example.com"
      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  );
}
