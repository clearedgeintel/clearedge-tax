import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  /** When true, drops internal padding so the consumer can lay out a header strip + body */
  flush?: boolean;
}

export function Card({ children, className = "", flush = false }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-border-subtle bg-surface shadow-[0_1px_2px_0_rgb(0_0_0/0.04)] ${
        flush ? "" : "p-5"
      } ${className}`}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function CardHeader({
  title,
  description,
  actions,
  className = "",
}: CardHeaderProps) {
  return (
    <div
      className={`flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4 ${className}`}
    >
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}
