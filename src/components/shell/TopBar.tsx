"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronRight, LogOut } from "lucide-react";
import { signOutAction } from "@/lib/auth-actions";

interface UserInfo {
  name: string;
  role: string;
  email: string;
}

interface Props {
  user: UserInfo;
  /** Optional override for the rightmost crumb label (e.g. an entity name for /staff/returns/[id]) */
  trailingCrumb?: string;
  rightSlot?: ReactNode;
}

const LABEL_MAP: Record<string, string> = {
  staff: "Staff",
  admin: "Admin",
  portal: "Portal",
  dashboard: "Dashboard",
  queue: "Work queue",
  returns: "Returns",
  clients: "Clients",
  documents: "Documents",
  notifications: "Notifications",
  users: "Users",
  firm: "Firm",
  audit: "Audit log",
  interview: "Interview",
  login: "Sign in",
};

const CUID_RE = /^c[a-z0-9]{20,}$/i;

interface Crumb {
  label: string;
  href: string;
  isLast: boolean;
}

function buildCrumbs(pathname: string, trailing?: string): Crumb[] {
  const segs = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
  let acc = "";
  segs.forEach((raw, i) => {
    acc += "/" + raw;
    if (CUID_RE.test(raw)) {
      // Skip raw ID segments — the parent crumb's label already represents the resource.
      return;
    }
    crumbs.push({
      label: LABEL_MAP[raw] || raw.charAt(0).toUpperCase() + raw.slice(1),
      href: acc,
      isLast: i === segs.length - 1,
    });
  });
  if (crumbs.length === 0) {
    crumbs.push({ label: "Home", href: "/", isLast: true });
  } else {
    // Recompute isLast after possible skips.
    crumbs.forEach((c, i) => (c.isLast = i === crumbs.length - 1));
  }
  if (trailing) {
    crumbs[crumbs.length - 1] = { ...crumbs[crumbs.length - 1], isLast: false };
    crumbs.push({ label: trailing, href: pathname, isLast: true });
  }
  return crumbs;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TopBar({ user, trailingCrumb, rightSlot }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const crumbs = buildCrumbs(pathname, trailingCrumb);
  const role = user.role.charAt(0) + user.role.slice(1).toLowerCase();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border-subtle bg-surface/95 backdrop-blur px-6">
      <nav aria-label="Breadcrumb" className="min-w-0 flex items-center gap-1 text-sm">
        {crumbs.map((c, i) => (
          <Fragment key={c.href + i}>
            {i > 0 && (
              <ChevronRight
                className="h-3.5 w-3.5 text-ink-subtle shrink-0"
                aria-hidden
              />
            )}
            {c.isLast ? (
              <span className="font-medium text-ink truncate">{c.label}</span>
            ) : (
              <Link
                href={c.href}
                className="text-ink-muted hover:text-ink truncate"
              >
                {c.label}
              </Link>
            )}
          </Fragment>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        {rightSlot}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full p-1 pr-3 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">
              {initials(user.name)}
            </span>
            <span className="hidden sm:block text-left">
              <span className="block text-xs font-medium text-ink leading-4">
                {user.name}
              </span>
              <span className="block text-[10px] text-ink-subtle leading-3">
                {role}
              </span>
            </span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 rounded-md border border-border-subtle bg-surface shadow-lg overflow-hidden"
            >
              <div className="px-3 py-2 border-b border-border-subtle">
                <div className="text-sm font-medium text-ink truncate">
                  {user.name}
                </div>
                <div className="text-xs text-ink-subtle truncate">
                  {user.email}
                </div>
              </div>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink-muted hover:bg-surface-muted hover:text-ink text-left"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
