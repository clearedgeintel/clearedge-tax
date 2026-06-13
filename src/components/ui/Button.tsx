import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  className?: string;
  children: ReactNode;
}

interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size" | "children">,
    CommonProps {
  href?: never;
}

interface LinkProps extends CommonProps {
  href: string;
  type?: never;
  disabled?: boolean;
  target?: string;
  rel?: string;
}

const BASE =
  "inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-700 text-white hover:bg-brand-800 focus-visible:ring-brand-500",
  secondary:
    "bg-white text-ink border border-border-strong hover:bg-surface-muted focus-visible:ring-brand-500",
  ghost:
    "bg-transparent text-ink-muted hover:bg-surface-muted hover:text-ink focus-visible:ring-brand-500",
  danger:
    "bg-danger text-white hover:opacity-90 focus-visible:ring-danger",
};

const SIZES: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3.5 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm",
};

function classNames(...parts: (string | undefined | false)[]): string {
  return parts.filter(Boolean).join(" ");
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps | LinkProps>(
  function Button(props, ref) {
    const {
      variant = "primary",
      size = "md",
      leadingIcon,
      trailingIcon,
      className,
      children,
      ...rest
    } = props;
    const classes = classNames(BASE, VARIANTS[variant], SIZES[size], className);
    const content = (
      <>
        {leadingIcon}
        <span>{children}</span>
        {trailingIcon}
      </>
    );

    if ("href" in rest && typeof rest.href === "string") {
      const { href, disabled, target, rel } = rest as LinkProps;
      if (disabled) {
        return (
          <span aria-disabled className={classes} role="button">
            {content}
          </span>
        );
      }
      return (
        <Link href={href} className={classes} target={target} rel={rel}>
          {content}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        type={(rest as ButtonProps).type || "button"}
        className={classes}
        {...(rest as ButtonProps)}
      >
        {content}
      </button>
    );
  }
);
