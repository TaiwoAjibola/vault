import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "dark" | "outline" | "ghost" | "danger" | "soft";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-ink border border-accent-strong/40 hover:bg-accent-strong active:translate-y-px",
  dark: "bg-forest text-paper border border-forest hover:bg-forest-soft active:translate-y-px",
  outline:
    "bg-transparent text-ink border border-line-strong hover:bg-surface hover:border-ink/30 active:translate-y-px",
  ghost: "bg-transparent text-ink-soft border border-transparent hover:bg-ink/[0.05] hover:text-ink",
  danger:
    "bg-danger text-white border border-danger hover:bg-[#922a22] active:translate-y-px",
  soft: "bg-sage/70 text-forest border border-forest/10 hover:bg-sage active:translate-y-px",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5 rounded-full",
  md: "h-11 px-5 text-sm gap-2 rounded-full",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-full",
  icon: "size-10 rounded-full",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-[background-color,border-color,color,transform,box-shadow] duration-200 disabled:pointer-events-none disabled:opacity-45",
    variants[variant],
    sizes[size],
    className,
  );
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClass({ variant, size, className })}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
