import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "./Card";

interface Props {
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
  /** Optional accent strip on the left edge. Maps to a brand-tinted color. */
  tone?: "neutral" | "brand" | "accent" | "warning" | "danger" | "success";
  href?: string;
}

const TONE_BAR: Record<NonNullable<Props["tone"]>, string> = {
  neutral: "bg-neutral-300",
  brand: "bg-brand-500",
  accent: "bg-accent-500",
  warning: "bg-warning",
  danger: "bg-danger",
  success: "bg-success",
};

export function Stat({ label, value, description, tone = "neutral", href }: Props) {
  const inner = (
    <Card flush className="overflow-hidden">
      <div className="flex">
        <div className={`w-1 ${TONE_BAR[tone]}`} aria-hidden />
        <div className="flex-1 p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-ink">
            {value}
          </div>
          {description && (
            <div className="mt-1 text-xs text-ink-muted">{description}</div>
          )}
        </div>
      </div>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block hover:-translate-y-0.5 transition-transform">
        {inner}
      </Link>
    );
  }
  return inner;
}
