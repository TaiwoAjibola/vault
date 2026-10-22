import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-[12.5px] font-medium tracking-[-0.01em] text-ink", className)}
      {...props}
    >
      {children}
    </label>
  );
}

export function Hint({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs leading-relaxed text-ink-faint", className)} {...props} />;
}

export function ErrorText({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs leading-relaxed text-danger", className)} role="alert" {...props} />
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-input border bg-surface-raised px-3.5 text-[14px] text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.6)] transition-colors placeholder:text-ink-faint/70 focus:border-forest/50 focus:outline-none focus:ring-4 focus:ring-forest/5 disabled:opacity-60",
        invalid ? "border-danger/60 focus:border-danger" : "border-line",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

export function Textarea({
  className,
  invalid,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full resize-y rounded-input border bg-surface-raised px-3.5 py-3 text-[14px] leading-relaxed text-ink transition-colors placeholder:text-ink-faint/70 focus:border-forest/50 focus:outline-none focus:ring-4 focus:ring-forest/5 disabled:opacity-60",
        invalid ? "border-danger/60 focus:border-danger" : "border-line",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={htmlFor}>{label}</Label>
        {optional && (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            Optional
          </span>
        )}
      </div>
      {children}
      {error ? <ErrorText>{error}</ErrorText> : hint ? <Hint>{hint}</Hint> : null}
    </div>
  );
}
