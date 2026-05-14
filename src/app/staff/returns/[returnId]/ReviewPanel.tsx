"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
        const data = await res.json();
        setError(data.error || "Action failed");
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
    <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-5">
      <h3 className="text-sm font-semibold text-purple-900">Manager Review</h3>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add review notes or feedback..."
        rows={3}
        className="mt-3 w-full px-3 py-2 border border-purple-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
      />

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}

      <div className="mt-3 flex gap-2">
        {currentStatus === "REVIEW" && (
          <>
            <button
              onClick={() => submitAction("APPROVED")}
              disabled={submitting}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => submitAction("REJECTED")}
              disabled={submitting}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              Reject &amp; Request Revision
            </button>
          </>
        )}
        {currentStatus === "REVISION" && (
          <button
            onClick={() => submitAction("REVISION_COMPLETE")}
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Resubmit for Review
          </button>
        )}
        {currentStatus === "APPROVED" && (
          <button
            onClick={() => submitAction("EXPORTED")}
            disabled={submitting}
            className="px-4 py-2 bg-gray-800 text-white text-sm rounded-md hover:bg-gray-900 disabled:opacity-50"
          >
            Mark as Exported
          </button>
        )}
      </div>
    </div>
  );
}
