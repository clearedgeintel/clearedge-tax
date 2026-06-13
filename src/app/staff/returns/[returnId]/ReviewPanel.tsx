"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, Button } from "@/components/ui";
import { CheckCircle2, RefreshCcw, Send, XCircle } from "lucide-react";

interface Props {
  returnId: string;
  currentStatus: string;
}

export default function ReviewPanel({ returnId, currentStatus }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitAction(action: string) {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/returns/${returnId}/review-actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: notes || undefined }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Action failed");
        return;
      }

      setNotes("");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card flush className="border-brand-200 bg-brand-50/40">
      <CardHeader
        title="Manager review"
        description="Approve, request revisions, or mark the return as exported."
      />
      <div className="p-5">
        <label className="block">
          <span className="block text-xs font-medium text-ink mb-1">
            Review notes
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional — add context for the preparer or for the audit trail."
            rows={3}
            className="w-full rounded-md border border-border-strong bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>

        {error && (
          <p className="mt-2 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {currentStatus === "REVIEW" && (
            <>
              <Button
                onClick={() => submitAction("APPROVED")}
                disabled={submitting}
                variant="primary"
                leadingIcon={<CheckCircle2 className="h-4 w-4" />}
              >
                Approve
              </Button>
              <Button
                onClick={() => submitAction("REJECTED")}
                disabled={submitting}
                variant="danger"
                leadingIcon={<XCircle className="h-4 w-4" />}
              >
                Request revision
              </Button>
            </>
          )}
          {currentStatus === "REVISION" && (
            <Button
              onClick={() => submitAction("REVISION_COMPLETE")}
              disabled={submitting}
              leadingIcon={<RefreshCcw className="h-4 w-4" />}
            >
              Resubmit for review
            </Button>
          )}
          {currentStatus === "APPROVED" && (
            <Button
              onClick={() => submitAction("EXPORTED")}
              disabled={submitting}
              variant="secondary"
              leadingIcon={<Send className="h-4 w-4" />}
            >
              Mark as exported
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
