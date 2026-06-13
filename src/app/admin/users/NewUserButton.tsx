"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export default function NewUserButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "PREPARER",
  });

  function reset() {
    setForm({ name: "", email: "", password: "", role: "PREPARER" });
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error || `Failed to create user (${res.status})`);
      setSubmitting(false);
      return;
    }

    reset();
    setOpen(false);
    setSubmitting(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        Invite user
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-neutral-900/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border-subtle bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
          <h2 className="text-sm font-semibold text-ink">Invite user</h2>
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

          <Field label="Full name" required>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink"
              placeholder="e.g. Pat Preparer"
            />
          </Field>

          <Field label="Email" required>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink"
              placeholder="user@firm.com"
            />
          </Field>

          <Field label="Temporary password" required>
            <input
              type="text"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink font-mono"
              placeholder="At least 8 characters"
            />
            <p className="mt-1 text-[11px] text-ink-subtle">
              Share with the user out-of-band. They&apos;ll change it on first sign-in.
            </p>
          </Field>

          <Field label="Role" required>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink"
            >
              <option value="PREPARER">Preparer</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
              <option value="CLIENT">Client</option>
            </select>
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create user"}
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
