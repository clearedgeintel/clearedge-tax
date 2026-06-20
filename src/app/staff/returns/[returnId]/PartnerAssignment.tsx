"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Check } from "lucide-react";

interface Candidate {
  id: string;
  name: string;
  role: string;
}

interface Props {
  returnId: string;
  currentPartnerId: string | null;
  currentPartnerName: string | null;
  candidates: Candidate[];
}

export default function PartnerAssignment({
  returnId,
  currentPartnerId,
  currentPartnerName,
  candidates,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | "">(
    currentPartnerId || ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/returns/${returnId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partnerId: selectedId === "" ? null : selectedId,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error || `Failed (${res.status})`);
      setBusy(false);
      return;
    }
    setBusy(false);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2 group">
        <span className="text-sm text-ink text-right">
          {currentPartnerName || (
            <span className="text-ink-subtle">No partner review</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-ink-subtle hover:text-brand-700 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Edit partner assignment"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="rounded-md border border-border-strong bg-white px-2 py-1 text-xs text-ink"
        >
          <option value="">No partner</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-md bg-brand-700 px-2 py-1 text-xs text-white hover:bg-brand-800 disabled:opacity-50"
          aria-label="Save"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setSelectedId(currentPartnerId || "");
            setError(null);
          }}
          className="rounded-md border border-border-strong px-2 py-1 text-xs text-ink-muted hover:text-ink"
          aria-label="Cancel"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {error && <span className="text-[10px] text-danger">{error}</span>}
    </div>
  );
}
