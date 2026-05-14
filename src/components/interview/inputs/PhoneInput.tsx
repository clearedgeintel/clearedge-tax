"use client";

import { useController, type Control } from "react-hook-form";

interface Props {
  name: string;
  control: Control<Record<string, unknown>>;
}

export default function PhoneInput({ name, control }: Props) {
  const { field } = useController({ name, control, defaultValue: "" });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let val = e.target.value.replace(/[^0-9]/g, "");
    if (val.length > 10) val = val.slice(0, 10);
    if (val.length > 6) {
      val = `(${val.slice(0, 3)}) ${val.slice(3, 6)}-${val.slice(6)}`;
    } else if (val.length > 3) {
      val = `(${val.slice(0, 3)}) ${val.slice(3)}`;
    }
    field.onChange(val);
  }

  return (
    <input
      type="tel"
      value={(field.value as string) ?? ""}
      onChange={handleChange}
      onBlur={field.onBlur}
      placeholder="(555) 555-5555"
      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  );
}
