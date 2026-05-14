"use client";

import { useState } from "react";
import { useController, type Control } from "react-hook-form";

interface Props {
  name: string;
  control: Control<Record<string, unknown>>;
  min?: number;
  max?: number;
}

export default function CurrencyInput({ name, control, min, max }: Props) {
  const { field } = useController({ name, control });
  const [display, setDisplay] = useState(() =>
    field.value !== undefined && field.value !== null
      ? Number(field.value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : ""
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9.-]/g, "");
    setDisplay(raw);
    const num = parseFloat(raw);
    field.onChange(isNaN(num) ? undefined : num);
  }

  function handleBlur() {
    field.onBlur();
    if (field.value !== undefined && field.value !== null) {
      setDisplay(
        Number(field.value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      );
    }
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
      <input
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={() => {
          if (field.value !== undefined && field.value !== null) {
            setDisplay(String(field.value));
          }
        }}
        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}
