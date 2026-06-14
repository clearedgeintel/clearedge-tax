"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

export default function AcceptRejectButtons({
  documentId,
}: {
  documentId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function flip(status: "ACCEPTED" | "REJECTED") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
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
    <div className="inline-flex flex-col items-end gap-1">
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={() => flip("ACCEPTED")}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md bg-success-soft border border-success/30 px-2 py-1 text-xs font-medium text-success hover:bg-success/10 disabled:opacity-50"
        >
          <Check className="h-3 w-3" /> Accept
        </button>
        <button
          type="button"
          onClick={() => flip("REJECTED")}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md bg-danger-soft border border-danger/30 px-2 py-1 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
        >
          <X className="h-3 w-3" /> Reject
        </button>
      </div>
      {error && <span className="text-[10px] text-danger">{error}</span>}
    </div>
  );
}
