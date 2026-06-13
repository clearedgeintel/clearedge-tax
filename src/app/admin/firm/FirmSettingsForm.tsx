"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

interface Address {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface FirmData {
  name: string;
  ein: string | null;
  phone: string | null;
  address: Address | null;
}

interface Props {
  initial: FirmData;
}

export default function FirmSettingsForm({ initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: initial.name,
    ein: initial.ein || "",
    phone: initial.phone || "",
    street: initial.address?.street || "",
    city: initial.address?.city || "",
    state: initial.address?.state || "",
    zip: initial.address?.zip || "",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);

    const body = {
      name: form.name,
      ein: form.ein || undefined,
      phone: form.phone || undefined,
      address: {
        street: form.street || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        zip: form.zip || undefined,
      },
    };

    const res = await fetch("/api/firm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage({
        kind: "error",
        text: data?.error || `Failed to save (${res.status})`,
      });
      setBusy(false);
      return;
    }

    setMessage({ kind: "success", text: "Saved." });
    setBusy(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {message && (
        <div
          className={
            message.kind === "success"
              ? "rounded-md bg-success-soft px-3 py-2 text-sm text-success"
              : "rounded-md bg-danger-soft px-3 py-2 text-sm text-danger"
          }
        >
          {message.text}
        </div>
      )}

      <Field label="Firm name" required>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="EIN">
          <input
            type="text"
            value={form.ein}
            onChange={(e) => setForm({ ...form, ein: e.target.value })}
            placeholder="12-3456789"
            className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink font-mono"
          />
        </Field>
        <Field label="Phone">
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="(555) 555-5555"
            className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink"
          />
        </Field>
      </div>

      <div className="border-t border-border-subtle pt-4">
        <h3 className="text-sm font-semibold text-ink mb-3">Address</h3>
        <div className="space-y-4">
          <Field label="Street">
            <input
              type="text"
              value={form.street}
              onChange={(e) => setForm({ ...form, street: e.target.value })}
              className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="City">
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink"
              />
            </Field>
            <Field label="State">
              <input
                type="text"
                value={form.state}
                onChange={(e) =>
                  setForm({ ...form, state: e.target.value.toUpperCase() })
                }
                maxLength={2}
                placeholder="TX"
                className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink uppercase"
              />
            </Field>
            <Field label="ZIP">
              <input
                type="text"
                value={form.zip}
                onChange={(e) => setForm({ ...form, zip: e.target.value })}
                className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink"
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-border-subtle">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
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
