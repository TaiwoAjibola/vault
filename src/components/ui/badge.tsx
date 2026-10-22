import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "accent" | "forest" | "warning" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "border-line bg-surface-raised text-ink-soft",
  accent: "border-accent-strong/40 bg-accent/30 text-forest",
  forest: "border-forest/15 bg-forest text-paper",
  warning: "border-warning/20 bg-warning-soft text-warning",
  danger: "border-danger/20 bg-danger-soft text-danger",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
