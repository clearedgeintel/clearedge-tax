import type { ReactNode } from "react";

type Tone =
  | "neutral"
  | "brand"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-surface-muted text-ink-muted border border-border-subtle",
  brand: "bg-brand-50 text-brand-700 border border-brand-100",
  accent: "bg-accent-50 text-accent-700 border border-accent-100",
  success:
    "bg-success-soft text-success border border-[color:var(--success)]/15",
  warning:
    "bg-warning-soft text-warning border border-[color:var(--warning)]/15",
  danger:
    "bg-danger-soft text-danger border border-[color:var(--danger)]/15",
  info: "bg-info-soft text-info border border-[color:var(--info)]/15",
};

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = "neutral", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
