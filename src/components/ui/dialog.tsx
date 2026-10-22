"use client";

import * as React from "react";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  footer,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  dismissible?: boolean;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      if (dismissible) onClose();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [dismissible, onClose]);

  return (
    <dialog
      ref={ref}
      className={cn(
        "m-auto w-[min(92vw,560px)] rounded-panel border border-line bg-surface p-0 text-ink shadow-float backdrop:bg-forest/35 backdrop:backdrop-blur-[3px]",
        className,
      )}
      onClick={(event) => {
        if (dismissible && event.target === ref.current) onClose();
      }}
    >
      <div className="flex items-start justify-between gap-6 border-b border-line px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em]">{title}</h2>
          {description && (
            <p className="mt-1 max-w-[42ch] text-[13px] leading-relaxed text-ink-soft">
              {description}
            </p>
          )}
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-ink/5 hover:text-ink"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <div className="px-6 py-5">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
    </dialog>
  );
}
