"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReturnStatus } from "@/generated/prisma/enums";
import { Card, CardHeader, Button } from "@/components/ui";
import { ArrowRight, ListChecks } from "lucide-react";

interface Props {
  returnId: string;
  currentStatus: ReturnStatus;
}

export default function AdvancePanel({ returnId, currentStatus }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markIntakeComplete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/returns/${returnId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nextStatus: "PREPARATION",
          note: "Intake complete; advancing to preparation",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitForReview() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/returns/${returnId}/review-actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMITTED_FOR_REVIEW" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (currentStatus === "INTAKE") {
    return (
      <Card flush>
        <CardHeader
          title="Advance return"
          description="When the intake interview and document collection are complete, advance to preparation."
        />
        <div className="p-5">
          {error && (
            <p className="mb-3 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}
          <Button
            onClick={markIntakeComplete}
            disabled={busy}
            leadingIcon={<ListChecks className="h-4 w-4" />}
          >
            {busy ? "Advancing..." : "Mark intake complete"}
          </Button>
          <p className="mt-2 text-xs text-ink-subtle">
            If any K-1s from upstream returns are still pending, the return
            will be marked <em>Intake — blocked</em> instead, and will
            unblock automatically once those K-1s resolve.
          </p>
        </div>
      </Card>
    );
  }

  if (currentStatus === "PREPARATION") {
    return (
      <Card flush>
        <CardHeader
          title="Advance return"
          description="When you've finished preparing the return, submit it for manager review."
        />
        <div className="p-5">
          {error && (
            <p className="mb-3 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}
          <Button
            onClick={submitForReview}
            disabled={busy}
            leadingIcon={<ArrowRight className="h-4 w-4" />}
          >
            {busy ? "Submitting..." : "Submit for review"}
          </Button>
        </div>
      </Card>
    );
  }

  return null;
}
