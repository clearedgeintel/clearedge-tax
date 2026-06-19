"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ui";
import { Sparkles, RefreshCcw, X, Check, Pencil } from "lucide-react";

interface Extraction {
  status: "PENDING" | "SUCCESS" | "FAILED" | "UNSUPPORTED" | "REVIEWED";
  fields: unknown;
  model: string | null;
  errorMessage: string | null;
  updatedAt: string;
}

interface Props {
  documentId: string;
  documentLabel: string;
  documentStatus: "REQUESTED" | "UPLOADED" | "ACCEPTED" | "REJECTED";
  extraction: Extraction | null;
}

export default function ExtractionCell({
  documentId,
  documentLabel,
  documentStatus,
  extraction,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // While extraction is PENDING, refresh every 5s up to ~1m so the status
  // chip flips without the user having to reload.
  useEffect(() => {
    if (extraction?.status !== "PENDING") return;
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      router.refresh();
      if (tries >= 12) clearInterval(id);
    }, 5_000);
    return () => clearInterval(id);
  }, [extraction?.status, router]);

  if (documentStatus === "REQUESTED") {
    return <span className="text-xs text-ink-subtle">—</span>;
  }

  async function rerun() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/extract`, {
        method: "POST",
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

  const status = extraction?.status;

  const chip =
    status === "SUCCESS" || status === "REVIEWED" ? (
      <Badge tone="success">
        <Sparkles className="h-3 w-3" /> Extracted
      </Badge>
    ) : status === "PENDING" ? (
      <Badge tone="info">Extracting…</Badge>
    ) : status === "UNSUPPORTED" ? (
      <Badge tone="neutral">Not supported</Badge>
    ) : status === "FAILED" ? (
      <Badge tone="danger">Failed</Badge>
    ) : (
      <Badge tone="neutral">Not run</Badge>
    );

  const canView = status === "SUCCESS" || status === "REVIEWED";
  const canRetry =
    status === "FAILED" || status === "UNSUPPORTED" || !status;

  return (
    <div className="flex items-center gap-2">
      {chip}
      {canView && (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="text-xs font-medium text-brand-700 hover:text-brand-800"
        >
          View
        </button>
      )}
      {canRetry && (
        <button
          type="button"
          onClick={rerun}
          disabled={busy}
          className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-brand-700 disabled:opacity-50"
          title="Re-run extraction"
        >
          <RefreshCcw className="h-3 w-3" />
          {busy ? "…" : "Retry"}
        </button>
      )}
      {error && <span className="text-[10px] text-danger">{error}</span>}

      {showModal && extraction && (
        <ExtractionModal
          documentId={documentId}
          label={documentLabel}
          extraction={extraction}
          onClose={() => setShowModal(false)}
          onRetry={rerun}
          onChange={() => router.refresh()}
        />
      )}
    </div>
  );
}

function ExtractionModal({
  documentId,
  label,
  extraction,
  onClose,
  onRetry,
  onChange,
}: {
  documentId: string;
  label: string;
  extraction: Extraction;
  onClose: () => void;
  onRetry: () => void;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() =>
    JSON.stringify(extraction.fields, null, 2)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const json = JSON.stringify(extraction.fields, null, 2);

  async function patchExtraction(
    body: { status?: "REVIEWED"; fields?: unknown }
  ): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/extraction`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Failed (${res.status})`);
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveEdits() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setError("Invalid JSON — fix the syntax before saving.");
      return;
    }
    const ok = await patchExtraction({ fields: parsed });
    if (ok) {
      setEditing(false);
      onChange();
    }
  }

  async function markReviewed() {
    // If currently editing with unsaved changes, save them along with the
    // status flip in one round-trip.
    if (editing) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(draft);
      } catch {
        setError("Invalid JSON — fix the syntax before saving.");
        return;
      }
      const ok = await patchExtraction({ status: "REVIEWED", fields: parsed });
      if (ok) {
        setEditing(false);
        onChange();
        onClose();
      }
      return;
    }
    const ok = await patchExtraction({ status: "REVIEWED" });
    if (ok) {
      onChange();
      onClose();
    }
  }

  const alreadyReviewed = extraction.status === "REVIEWED";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-900/50 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-border-subtle bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink truncate">
              Extracted fields — {label}
            </h2>
            <p className="text-xs text-ink-subtle">
              {extraction.model || "model not recorded"} ·{" "}
              {new Date(extraction.updatedAt).toLocaleString()}
              {alreadyReviewed && " · reviewed"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              className="w-full min-h-[300px] rounded-md border border-border-strong bg-white p-3 text-xs text-ink font-mono"
            />
          ) : (
            <pre className="rounded-md bg-surface-muted border border-border-subtle p-3 text-xs text-ink font-mono whitespace-pre-wrap break-all">
              {json}
            </pre>
          )}
          {error && (
            <p className="mt-2 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border-subtle px-5 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onRetry}
              leadingIcon={<RefreshCcw className="h-3.5 w-3.5" />}
            >
              Re-run
            </Button>
            {!editing ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDraft(JSON.stringify(extraction.fields, null, 2));
                  setEditing(true);
                }}
                leadingIcon={<Pencil className="h-3.5 w-3.5" />}
              >
                Edit
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={saveEdits}
                  leadingIcon={<Check className="h-3.5 w-3.5" />}
                >
                  Save edits
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setDraft(json);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!alreadyReviewed && (
              <Button
                size="sm"
                disabled={busy}
                onClick={markReviewed}
                leadingIcon={<Check className="h-3.5 w-3.5" />}
              >
                {editing ? "Save & mark reviewed" : "Mark reviewed"}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
