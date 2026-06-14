"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { CAMPAIGN_TEMPLATES } from "@/lib/campaigns/templates";

interface Client {
  id: string;
  displayName: string;
}

export default function NewCampaignButton({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const currentYear = 2025;
  const [form, setForm] = useState({
    clientId: clients[0]?.id || "",
    taxYear: currentYear,
    templateId: CAMPAIGN_TEMPLATES[0]?.id || "",
    message: "",
    deadline: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!form.clientId && clients[0]) {
      setForm((f) => ({ ...f, clientId: clients[0].id }));
    }
  }, [clients, form.clientId]);

  function reset() {
    setForm({
      clientId: clients[0]?.id || "",
      taxYear: currentYear,
      templateId: CAMPAIGN_TEMPLATES[0]?.id || "",
      message: "",
      deadline: "",
    });
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/clients/${form.clientId}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taxYear: form.taxYear,
        templateId: form.templateId,
        message: form.message || undefined,
        deadline: form.deadline || undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error || `Failed (${res.status})`);
      setBusy(false);
      return;
    }
    reset();
    setOpen(false);
    setBusy(false);
    router.refresh();
  }

  if (clients.length === 0) {
    return (
      <Button disabled variant="secondary" size="sm">
        Add a client first
      </Button>
    );
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        New campaign
      </Button>
    );
  }

  const template = CAMPAIGN_TEMPLATES.find((t) => t.id === form.templateId);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-neutral-900/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border-subtle bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
          <h2 className="text-sm font-semibold text-ink">
            New document-collection campaign
          </h2>
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="text-xs text-ink-muted hover:text-ink"
          >
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
              {error}
            </div>
          )}

          <Field label="Client" required>
            <select
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              required
              className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Tax year" required>
              <input
                type="number"
                min={2020}
                max={2099}
                value={form.taxYear}
                onChange={(e) =>
                  setForm({ ...form, taxYear: Number(e.target.value) })
                }
                required
                className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink"
              />
            </Field>
            <Field label="Deadline (optional)">
              <input
                type="date"
                value={form.deadline}
                onChange={(e) =>
                  setForm({ ...form, deadline: e.target.value })
                }
                className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink"
              />
            </Field>
          </div>

          <Field label="Template" required>
            <select
              value={form.templateId}
              onChange={(e) =>
                setForm({ ...form, templateId: e.target.value })
              }
              required
              className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink"
            >
              {CAMPAIGN_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {template && (
              <p className="mt-1 text-[11px] text-ink-subtle">
                {template.description}
              </p>
            )}
          </Field>

          {template && (
            <div className="rounded-md border border-border-subtle bg-surface-muted p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle mb-1">
                Items in this template
              </p>
              <ul className="text-xs text-ink-muted space-y-0.5">
                {template.items.map((it, i) => (
                  <li key={i}>• {it.label}</li>
                ))}
              </ul>
            </div>
          )}

          <Field label="Message to client (optional)">
            <textarea
              rows={3}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="A quick note that goes on the client's portal alongside the document list."
              className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating..." : "Create campaign"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink mb-1">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
