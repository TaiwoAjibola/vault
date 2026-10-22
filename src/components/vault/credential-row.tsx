"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Copy,
  Eye,
  EyeSlash,
  Trash,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import type { DecryptedCredential } from "@/lib/vault/types";
import { displayHost } from "@/lib/vault/origin";
import { formatRelative, initialsFor, maskPassword } from "@/lib/vault/format";
import { monogramTint } from "@/lib/vault/monogram";
import { copyText, scheduleClipboardClear } from "@/lib/vault/clipboard";
import { useVault } from "@/components/vault/vault-provider";
import { cn } from "@/lib/utils";

export function CredentialRow({
  credential,
  onDelete,
}: {
  credential: DecryptedCredential;
  onDelete: (credential: DecryptedCredential) => void;
}) {
  const { retrieveSecret } = useVault();
  const [secret, setSecret] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<"password" | "username" | null>(null);
  const hideTimer = React.useRef<number | null>(null);
  const tint = monogramTint(credential.applicationName);

  React.useEffect(() => {
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  async function reveal() {
    if (secret) {
      setSecret(null);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      return;
    }
    try {
      const value = await retrieveSecret(credential.id);
      setSecret(value);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setSecret(null), 25_000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reveal this password.");
    }
  }

  async function copyPassword() {
    try {
      const value = await retrieveSecret(credential.id);
      await copyText(value);
      scheduleClipboardClear();
      setCopied("password");
      window.setTimeout(() => setCopied(null), 1800);
      toast.success("Password copied. Clipboard clears in 45 seconds.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not copy the password.");
    }
  }

  async function copyUsername() {
    try {
      await copyText(credential.username);
      setCopied("username");
      window.setTimeout(() => setCopied(null), 1800);
      toast.success("Username copied.");
    } catch {
      toast.error("Could not copy the username.");
    }
  }

  return (
    <div className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line px-1 py-3.5 transition-colors hover:bg-surface/60 sm:grid-cols-[auto_minmax(0,1.15fr)_minmax(0,1fr)_130px_auto] sm:gap-4 sm:px-3">
      <span
        className="grid size-9 shrink-0 place-items-center rounded-[10px] text-[12px] font-semibold sm:size-10"
        style={{ backgroundColor: tint.bg, color: tint.fg }}
        aria-hidden="true"
      >
        {initialsFor(credential.applicationName)}
      </span>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            href={`/app/credentials/${credential.id}`}
            className="truncate text-[13.5px] font-medium text-ink hover:underline hover:underline-offset-4"
          >
            {credential.applicationName}
          </Link>
          <ArrowUpRight
            size={11}
            className="shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
          />
        </div>
        <p className="truncate font-mono text-[10px] text-ink-faint">
          {displayHost(credential.websiteUrl)}
        </p>
      </div>

      <div className="hidden min-w-0 sm:block">
        <p className="truncate font-mono text-[11px] text-ink-soft">{credential.username}</p>
        <p className="mt-0.5 truncate text-[10.5px] text-ink-faint">
          {secret ? (
            <span className="font-mono text-ink">{secret}</span>
          ) : (
            <span className="font-mono tracking-[0.12em]">{maskPassword(10)}</span>
          )}
        </p>
      </div>

      <div className="hidden text-right sm:block">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-faint">
          {credential.lastRetrievedAt
            ? `Used ${formatRelative(credential.lastRetrievedAt)}`
            : "Never used"}
        </p>
        <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint/70">
          {formatRelative(credential.updatedAt)}
        </p>
      </div>

      <div className="flex items-center justify-end gap-0.5">
        <button
          type="button"
          onClick={reveal}
          className="grid size-8 place-items-center rounded-full text-ink-faint transition-colors hover:bg-ink/5 hover:text-ink"
          aria-label={secret ? "Hide password" : "Reveal password"}
          title={secret ? "Hide password" : "Reveal password"}
        >
          {secret ? <EyeSlash size={15} /> : <Eye size={15} />}
        </button>
        <button
          type="button"
          onClick={copyPassword}
          className={cn(
            "grid size-8 place-items-center rounded-full transition-colors hover:bg-ink/5",
            copied === "password" ? "text-forest" : "text-ink-faint hover:text-ink",
          )}
          aria-label="Copy password"
          title="Copy password"
        >
          {copied === "password" ? <Check size={15} weight="bold" /> : <Copy size={15} />}
        </button>
        <button
          type="button"
          onClick={copyUsername}
          className={cn(
            "hidden size-8 place-items-center rounded-full transition-colors hover:bg-ink/5 sm:grid",
            copied === "username" ? "text-forest" : "text-ink-faint hover:text-ink",
          )}
          aria-label="Copy username"
          title="Copy username"
        >
          {copied === "username" ? <Check size={15} weight="bold" /> : <span className="font-mono text-[10px]">@</span>}
        </button>
        <button
          type="button"
          onClick={() => onDelete(credential)}
          className="grid size-8 place-items-center rounded-full text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
          aria-label={`Delete ${credential.applicationName}`}
          title="Delete credential"
        >
          <Trash size={15} />
        </button>
      </div>

      {secret && (
        <div className="col-span-3 flex items-center gap-2 rounded-lg border border-forest/15 bg-sage/35 px-3 py-2 sm:hidden">
          <span className="font-mono text-[11px] text-ink">{secret}</span>
          <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
            hides in 25s
          </span>
        </div>
      )}
    </div>
  );
}
