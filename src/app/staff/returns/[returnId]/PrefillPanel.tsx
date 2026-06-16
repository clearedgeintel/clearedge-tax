"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, Button, Badge } from "@/components/ui";
import { Sparkles, AlertTriangle } from "lucide-react";

interface Proposal {
  questionId: string;
  sectionId: string;
  inputType: string;
  questionText: string;
  proposedValue: unknown;
  currentValue: unknown;
  sources: { documentId: string; label: string }[];
}

interface Props {
  returnId: string;
}

function formatValue(v: unknown, inputType: string): string {
  if (v === null || v === undefined || v === "") return "—";
  if (inputType === "currency" && typeof v === "number") {
    return v.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }
  if (typeof v === "number") return v.toLocaleString("en-US");
  return String(v);
}

export default function PrefillPanel({ returnId }: Props) {
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [result, setResult] = useState<{
    applied: number;
    skipped: number;
  } | null>(null);

  async function preview() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/returns/${returnId}/prefill`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Failed (${res.status})`);
      }
      const data = (await res.json()) as { proposals: Proposal[] };
      setProposals(data.proposals);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/returns/${returnId}/prefill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overwrite }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Failed (${res.status})`);
      }
      const data = (await res.json()) as { applied: number; skipped: number };
      setResult(data);
      setProposals(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card flush className="border-accent-200 bg-accent-50/40">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent-600" />
            Pre-fill from extracted documents
          </span>
        }
        description="Reads the AI-extracted fields from any accepted W-2s, 1099-INTs, and 1099-DIVs on this return and proposes interview answers."
      />
      <div className="p-5 space-y-3">
        {error && (
          <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        {result && (
          <div className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">
            Filled {result.applied} answer
            {result.applied === 1 ? "" : "s"}.
            {result.skipped > 0 && (
              <>
                {" "}
                Skipped {result.skipped} because they already had an answer
                (toggle Overwrite to replace).
              </>
            )}
          </div>
        )}

        {proposals === null ? (
          <Button onClick={preview} disabled={busy} variant="primary" size="sm">
            {busy ? "Loading..." : "Preview proposals"}
          </Button>
        ) : proposals.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No new pre-fills available. Either nothing has been extracted yet,
            or every mapped question already matches the extracted value.
          </p>
        ) : (
          <>
            <p className="text-xs text-ink-muted">
              {proposals.length} proposed change
              {proposals.length === 1 ? "" : "s"} — review then apply.
            </p>
            <div className="rounded-md border border-border-subtle bg-white max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted border-b border-border-subtle text-[10px] uppercase tracking-wide text-ink-subtle">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Question</th>
                    <th className="text-left px-3 py-2 font-medium">Current</th>
                    <th className="text-left px-3 py-2 font-medium">Proposed</th>
                    <th className="text-left px-3 py-2 font-medium">From</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {proposals.map((p) => {
                    const hasCurrent =
                      p.currentValue !== null &&
                      p.currentValue !== undefined &&
                      p.currentValue !== "";
                    return (
                      <tr key={p.questionId}>
                        <td className="px-3 py-2 text-xs text-ink">
                          <div className="font-medium">{p.questionText}</div>
                          <div className="font-mono text-[10px] text-ink-subtle">
                            {p.questionId}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {hasCurrent ? (
                            <span className="inline-flex items-center gap-1 text-warning">
                              <AlertTriangle className="h-3 w-3" />
                              {formatValue(p.currentValue, p.inputType)}
                            </span>
                          ) : (
                            <span className="text-ink-subtle">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs font-medium text-ink">
                          {formatValue(p.proposedValue, p.inputType)}
                        </td>
                        <td className="px-3 py-2 text-xs text-ink-muted">
                          <div className="flex flex-wrap gap-1">
                            {p.sources.map((s) => (
                              <Badge key={s.documentId} tone="neutral">
                                {s.label}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
                className="rounded border-border-strong"
              />
              Overwrite existing answers
            </label>

            <div className="flex gap-2">
              <Button onClick={apply} disabled={busy} size="sm">
                {busy ? "Applying..." : `Apply ${proposals.length} change${proposals.length === 1 ? "" : "s"}`}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setProposals(null)}
              >
                Discard
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
