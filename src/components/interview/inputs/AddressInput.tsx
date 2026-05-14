"use client";

import { useController, type Control } from "react-hook-form";
import { US_STATES } from "./StateSelectInput";

interface AddressValue {
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface Props {
  name: string;
  control: Control<Record<string, unknown>>;
}

export default function AddressInput({ name, control }: Props) {
  const { field } = useController({ name, control, defaultValue: {} });
  const value = (field.value as AddressValue) || {};

  function update(key: keyof AddressValue, val: string) {
    field.onChange({ ...value, [key]: val });
  }

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Street address"
        value={value.street1 ?? ""}
        onChange={(e) => update("street1", e.target.value)}
        className={inputClass}
      />
      <input
        type="text"
        placeholder="Apt, suite, unit (optional)"
        value={value.street2 ?? ""}
        onChange={(e) => update("street2", e.target.value)}
        className={inputClass}
      />
      <div className="grid grid-cols-6 gap-3">
        <input
          type="text"
          placeholder="City"
          value={value.city ?? ""}
          onChange={(e) => update("city", e.target.value)}
          className={`col-span-3 ${inputClass}`}
        />
        <select
          value={value.state ?? ""}
          onChange={(e) => update("state", e.target.value)}
          className={`col-span-1 ${inputClass}`}
        >
          <option value="">State</option>
          {US_STATES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.value}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="ZIP"
          value={value.zip ?? ""}
          onChange={(e) => update("zip", e.target.value.replace(/[^0-9-]/g, "").slice(0, 10))}
          className={`col-span-2 ${inputClass}`}
        />
      </div>
    </div>
  );
}
