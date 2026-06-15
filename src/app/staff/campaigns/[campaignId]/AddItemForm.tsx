"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Plus } from "lucide-react";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "W2", label: "W-2 (wages)" },
  { value: "W2_G", label: "W-2G (gambling)" },
  { value: "F1099_INT", label: "1099-INT (interest)" },
  { value: "F1099_DIV", label: "1099-DIV (dividends)" },
  { value: "F1099_NEC", label: "1099-NEC (contractor)" },
  { value: "F1099_MISC", label: "1099-MISC (misc)" },
  { value: "F1099_B", label: "1099-B (brokerage)" },
  { value: "F1099_R", label: "1099-R (retirement)" },
  { value: "F1099_SSA", label: "1099-SSA (Social Security)" },
  { value: "F1099_G", label: "1099-G (government)" },
  { value: "F1095_A", label: "1095-A (marketplace insurance)" },
  { value: "K1_1065", label: "K-1 (partnership)" },
  { value: "K1_1120S", label: "K-1 (S-corp)" },
  { value: "K1_1041", label: "K-1 (trust/estate)" },
  { value: "BANK_STATEMENT", label: "Bank statement" },
  { value: "MORTGAGE_STATEMENT", label: "Mortgage statement (1098)" },
  { value: "PROPERTY_TAX", label: "Property tax statement" },
  { value: "CHARITABLE_RECEIPT", label: "Charitable receipt" },
  { value: "PRIOR_RETURN", label: "Prior year return" },
  { value: "DEPRECIATION_SCHEDULE", label: "Depreciation schedule" },
  { value: "FINANCIAL_STATEMENT", label: "Financial statements" },
  { value: "OTHER", label: "Other" },
];

interface Props {
  campaignId: string;
}

export default function AddItemForm({ campaignId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    category: "W2",
    label: "",
    requestNote: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setForm({ category: "W2", label: "", requestNote: "" });
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: form.category,
        label: form.label.trim(),
        requestNote: form.requestNote.trim() || undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error || `Failed (${res.status})`);
      setBusy(false);
      return;
    }
    reset();
    setBusy(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className="border-t border-border-subtle px-5 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          leadingIcon={<Plus className="h-3.5 w-3.5" />}
        >
          Add another item
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="border-t border-border-subtle bg-surface-muted/50 px-5 py-4 space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr] gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-ink mb-1">
            Category
          </span>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink bg-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-ink mb-1">
            Label
            <span className="text-danger ml-0.5">*</span>
          </span>
          <input
            type="text"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="e.g. W-2 from Acme Corp"
            required
            className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink bg-white"
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-xs font-medium text-ink mb-1">
          Note for the client (optional)
        </span>
        <input
          type="text"
          value={form.requestNote}
          onChange={(e) => setForm({ ...form, requestNote: e.target.value })}
          placeholder="Shown on the client portal next to this item."
          className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink bg-white"
        />
      </label>

      {error && (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={busy || !form.label.trim()}
        >
          {busy ? "Adding..." : "Add item"}
        </Button>
      </div>
    </form>
  );
}
