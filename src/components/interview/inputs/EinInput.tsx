"use client";

import { useController, type Control } from "react-hook-form";

interface Props {
  name: string;
  control: Control<Record<string, unknown>>;
}

export default function EinInput({ name, control }: Props) {
  const { field } = useController({ name, control, defaultValue: "" });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let val = e.target.value.replace(/[^0-9]/g, "");
    if (val.length > 9) val = val.slice(0, 9);
    if (val.length > 2) {
      val = val.slice(0, 2) + "-" + val.slice(2);
    }
    field.onChange(val);
  }

  return (
    <input
      type="text"
      value={(field.value as string) ?? ""}
      onChange={handleChange}
      onBlur={field.onBlur}
      placeholder="XX-XXXXXXX"
      maxLength={10}
      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  );
}
