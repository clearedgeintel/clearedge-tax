"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Send } from "lucide-react";

interface Props {
  campaignId: string;
  disabled?: boolean;
  size?: "sm" | "md";
}

export default function SendCampaignButton({
  campaignId,
  disabled,
  size = "sm",
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/send`, {
      method: "POST",
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
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={send}
        disabled={disabled || busy}
        size={size}
        leadingIcon={<Send className="h-3.5 w-3.5" />}
      >
        {busy ? "Sending…" : "Send to client"}
      </Button>
      {error && <span className="text-[10px] text-danger">{error}</span>}
    </div>
  );
}
