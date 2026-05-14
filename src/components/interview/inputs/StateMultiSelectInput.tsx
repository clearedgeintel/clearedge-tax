"use client";

import { useController, type Control } from "react-hook-form";
import { US_STATES } from "./StateSelectInput";

interface Props {
  name: string;
  control: Control<Record<string, unknown>>;
}

export default function StateMultiSelectInput({ name, control }: Props) {
  const { field } = useController({ name, control, defaultValue: [] });
  const selected = Array.isArray(field.value) ? (field.value as string[]) : [];

  function toggle(value: string) {
    if (selected.includes(value)) {
      field.onChange(selected.filter((v) => v !== value));
    } else {
      field.onChange([...selected, value]);
    }
  }

  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selected.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
            >
              {s}
              <button
                type="button"
                onClick={() => toggle(s)}
                className="text-blue-600 hover:text-blue-800"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-4 gap-1 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2">
        {US_STATES.map((s) => (
          <label
            key={s.value}
            className="flex items-center gap-1.5 px-1 py-0.5 text-xs cursor-pointer hover:bg-gray-50 rounded"
          >
            <input
              type="checkbox"
              checked={selected.includes(s.value)}
              onChange={() => toggle(s.value)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            {s.value}
          </label>
        ))}
      </div>
    </div>
  );
}
