import { cn } from "@/lib/utils";

export function KeyholdMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-forest text-paper",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5">
        <circle cx="12" cy="9.25" r="4.25" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M10.55 13.1 9.2 20.2h5.6l-1.35-7.1"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="9.25" r="1.1" fill="var(--color-accent)" />
      </svg>
    </span>
  );
}

export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <KeyholdMark />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[17px] font-semibold tracking-[-0.03em] text-ink">Keyhold</span>
          <span className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.22em] text-ink-faint">
            Private vault
          </span>
        </span>
      )}
    </span>
  );
}
