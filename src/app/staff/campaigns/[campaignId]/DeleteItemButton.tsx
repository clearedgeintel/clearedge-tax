"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeleteItemButton({
  documentId,
}: {
  documentId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!confirm("Remove this item from the campaign?")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/documents/${documentId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error || `Failed (${res.status})`);
      setBusy(false);
      return;
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-danger disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {busy ? "…" : "Remove"}
      </button>
      {error && <span className="text-[10px] text-danger">{error}</span>}
    </div>
  );
}
