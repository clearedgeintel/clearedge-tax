"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ui";
import { Sparkles, RefreshCcw, X } from "lucide-react";

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
          label={documentLabel}
          extraction={extraction}
          onClose={() => setShowModal(false)}
          onRetry={rerun}
        />
      )}
    </div>
  );
}

function ExtractionModal({
  label,
  extraction,
  onClose,
  onRetry,
}: {
  label: string;
  extraction: Extraction;
  onClose: () => void;
  onRetry: () => void;
}) {
  const json = JSON.stringify(extraction.fields, null, 2);

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
          <pre className="rounded-md bg-surface-muted border border-border-subtle p-3 text-xs text-ink font-mono whitespace-pre-wrap break-all">
            {json}
          </pre>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border-subtle px-5 py-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={onRetry}
            leadingIcon={<RefreshCcw className="h-3.5 w-3.5" />}
          >
            Re-run
          </Button>
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
