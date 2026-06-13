"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/generated/prisma/enums";

interface Props {
  userId: string;
  role: UserRole;
  isActive: boolean;
  isCurrentUser: boolean;
}

const ROLE_OPTIONS: UserRole[] = ["CLIENT", "PREPARER", "MANAGER", "ADMIN"];

export default function UserRowActions({
  userId,
  role,
  isActive,
  isCurrentUser,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [currentRole, setCurrentRole] = useState<UserRole>(role);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || `Failed (${res.status})`);
      return false;
    }
    return true;
  }

  async function onRoleChange(next: UserRole) {
    if (next === currentRole) return;
    const previous = currentRole;
    setCurrentRole(next);
    const ok = await patch({ role: next });
    if (!ok) {
      setCurrentRole(previous);
      return;
    }
    router.refresh();
  }

  async function onToggleActive() {
    const ok = await patch({ isActive: !isActive });
    if (ok) router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <select
          value={currentRole}
          disabled={busy || isCurrentUser}
          onChange={(e) => onRoleChange(e.target.value as UserRole)}
          className="rounded-md border border-border-strong bg-white px-2 py-1 text-xs text-ink disabled:opacity-50"
          aria-label="Change role"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r.charAt(0) + r.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onToggleActive}
          disabled={busy || isCurrentUser}
          className={
            isActive
              ? "rounded-md border border-border-strong bg-white px-2.5 py-1 text-xs text-ink-muted hover:text-danger hover:border-danger/40 disabled:opacity-50"
              : "rounded-md border border-success/40 bg-success-soft px-2.5 py-1 text-xs text-success hover:bg-success/10 disabled:opacity-50"
          }
        >
          {isActive ? "Deactivate" : "Reactivate"}
        </button>
      </div>
      {error && <span className="text-[10px] text-danger">{error}</span>}
      {isCurrentUser && (
        <span className="text-[10px] text-ink-subtle">(you)</span>
      )}
    </div>
  );
}
