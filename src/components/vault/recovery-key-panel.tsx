"use client";

import * as React from "react";
import { Check, Copy, DownloadSimple, Key, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RecoveryKeyPanel({
  recoveryKey,
  onDone,
  doneLabel = "Continue",
  title = "Save your recovery key",
  description = "This is the only way back into the vault if you forget the master password. It will not be shown again.",
}: {
  recoveryKey: string;
  onDone: () => void;
  doneLabel?: string;
  title?: string;
  description?: string;
}) {
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy. Select the key and copy it manually.");
    }
  }

  function download() {
    const body = [
      "KEYHOLD RECOVERY KEY",
      "====================",
      "",
      recoveryKey,
      "",
      "Keep this file offline and private. Anyone with this key can unlock your vault.",
      "Keyhold staff will never ask for it.",
      "",
      `Generated: ${new Date().toISOString()}`,
      "",
    ].join("\n");
    const blob = new Blob([body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "keyhold-recovery-key.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/45 text-forest">
          <Key size={19} weight="fill" />
        </span>
        <div>
          <h2 className="text-[19px] font-semibold tracking-[-0.025em] text-ink">{title}</h2>
          <p className="mt-1 max-w-[52ch] text-[12.5px] leading-relaxed text-ink-soft">{description}</p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-line-strong bg-paper/60 p-4">
        <p className="break-all font-mono text-[15px] leading-relaxed tracking-[0.08em] text-ink sm:text-[17px]">
          {recoveryKey}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] font-medium text-ink-soft transition-colors hover:text-ink"
          >
            {copied ? <Check size={13} weight="bold" /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy key"}
          </button>
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] font-medium text-ink-soft transition-colors hover:text-ink"
          >
            <DownloadSimple size={13} />
            Download .txt
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-warning/20 bg-warning-soft p-3.5">
        <Warning size={15} className="mt-0.5 shrink-0 text-warning" />
        <p className="text-[11.5px] leading-relaxed text-warning">
          Treat this like a spare key. Store it offline. If you lose both the master password and
          this key, nobody — including Keyhold — can decrypt the vault.
        </p>
      </div>

      <label
        className={cn(
          "mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border p-3.5 transition-colors",
          acknowledged ? "border-forest/30 bg-sage/40" : "border-line bg-surface",
        )}
      >
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          className="mt-0.5 size-4 accent-[#0e2a1f]"
        />
        <span className="text-[12px] leading-relaxed text-ink-soft">
          I have stored this recovery key somewhere safe and understand it will not be shown again.
        </span>
      </label>

      <Button onClick={onDone} disabled={!acknowledged} className="mt-5 w-full" size="lg">
        {doneLabel}
      </Button>
    </div>
  );
}
