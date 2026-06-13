"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  /** If set, the item is active when the pathname starts with one of these prefixes. Otherwise exact match. */
  matchPrefixes?: string[];
}

export interface NavSection {
  heading?: string;
  items: NavItem[];
}

interface Props {
  brandHref: string;
  brandLabel: string;
  sections: NavSection[];
  footer?: ReactNode;
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.matchPrefixes && item.matchPrefixes.length > 0) {
    return item.matchPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
  }
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function Sidebar({ brandHref, brandLabel, sections, footer }: Props) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border-subtle bg-surface sticky top-0">
      <Link
        href={brandHref}
        className="flex h-16 items-center gap-2 border-b border-border-subtle px-4"
      >
        <Image
          src="/ClearEdge_Tax_Logo.png"
          alt="ClearEdge Tax"
          width={36}
          height={36}
          unoptimized
          priority
        />
        <span className="text-sm font-semibold tracking-tight text-ink">
          {brandLabel}
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {sections.map((section, idx) => (
          <div key={idx} className={idx > 0 ? "mt-4" : ""}>
            {section.heading && (
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                {section.heading}
              </div>
            )}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={
                        active
                          ? "group flex items-center gap-2.5 rounded-md bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800 ring-1 ring-inset ring-brand-100"
                          : "group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ink-muted hover:bg-surface-muted hover:text-ink"
                      }
                    >
                      <span
                        className={
                          active
                            ? "text-brand-700"
                            : "text-ink-subtle group-hover:text-ink-muted"
                        }
                      >
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {footer && (
        <div className="border-t border-border-subtle p-3">{footer}</div>
      )}
    </aside>
  );
}
