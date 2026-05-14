"use client";

import { useState } from "react";
import { useController, type Control } from "react-hook-form";

interface Props {
  name: string;
  control: Control<Record<string, unknown>>;
}

export default function SsnInput({ name, control }: Props) {
  const { field } = useController({ name, control, defaultValue: "" });
  const [showFull, setShowFull] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let val = e.target.value.replace(/[^0-9]/g, "");
    if (val.length > 9) val = val.slice(0, 9);
    if (val.length > 5) {
      val = val.slice(0, 3) + "-" + val.slice(3, 5) + "-" + val.slice(5);
    } else if (val.length > 3) {
      val = val.slice(0, 3) + "-" + val.slice(3);
    }
    field.onChange(val);
  }

  function maskedValue(val: string): string {
    if (!val || val.length < 7) return val;
    return "***-**-" + val.slice(-4);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={
          showFull
            ? (field.value as string) ?? ""
            : maskedValue((field.value as string) ?? "")
        }
        onChange={handleChange}
        onFocus={() => setShowFull(true)}
        onBlur={() => {
          setShowFull(false);
          field.onBlur();
        }}
        placeholder="XXX-XX-XXXX"
        maxLength={11}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}
