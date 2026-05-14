"use client";

import { useController, type Control } from "react-hook-form";

interface Props {
  name: string;
  control: Control<Record<string, unknown>>;
  placeholder?: string;
  maxLength?: number;
}

export default function TextInput({ name, control, placeholder, maxLength }: Props) {
  const { field } = useController({ name, control, defaultValue: "" });

  return (
    <input
      {...field}
      value={(field.value as string) ?? ""}
      type="text"
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  );
}
