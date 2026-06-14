"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Ban } from "lucide-react";

export default function CancelCampaignButton({
  campaignId,
}: {
  campaignId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
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

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="sm"
        leadingIcon={<Ban className="h-3.5 w-3.5" />}
        onClick={() => setConfirming(true)}
      >
        Cancel campaign
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-ink-muted">Are you sure?</span>
      <Button
        variant="danger"
        size="sm"
        onClick={cancel}
        disabled={busy}
      >
        {busy ? "…" : "Yes, cancel"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(false)}
      >
        Keep it
      </Button>
      {error && <span className="text-[10px] text-danger">{error}</span>}
    </div>
  );
}
