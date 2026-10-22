"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowSquareOut,
  Check,
  ClockCounterClockwise,
  Copy,
  Eye,
  EyeSlash,
  Key,
  LockKey,
  PencilSimple,
  ShieldCheck,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useVault } from "@/components/vault/vault-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import type { VaultEvent } from "@/lib/vault/types";
import { displayHost, normalizeWebsite } from "@/lib/vault/origin";
import { formatDate, formatRelative, initialsFor, maskPassword } from "@/lib/vault/format";
import { monogramTint } from "@/lib/vault/monogram";
import { copyText, scheduleClipboardClear } from "@/lib/vault/clipboard";
import { cn } from "@/lib/utils";

const EVENT_COPY: Record<VaultEvent["event_type"], string> = {
  created: "Credential created",
  updated: "Fields updated",
  retrieved: "Password retrieved",
  deleted: "Credential deleted",
};

export function CredentialDetail({ credentialId }: { credentialId: string }) {
  const router = useRouter();
  const { credentials, retrieveSecret, deleteCredential, busy, status } = useVault();
  const credential = credentials.find((item) => item.id === credentialId);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [revealedAt, setRevealedAt] = React.useState<number | null>(null);
  const [copied, setCopied] = React.useState<"password" | "username" | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [events, setEvents] = React.useState<VaultEvent[]>([]);
  const [eventsLoading, setEventsLoading] = React.useState(true);
  const [eventsVersion, setEventsVersion] = React.useState(0);
  const hideTimer = React.useRef<number | null>(null);

  const supabase = React.useMemo(() => createClient(), []);

  React.useEffect(() => {
    if (status !== "unlocked") return;
    let active = true;
    setEventsLoading(true);
    supabase
      .from("vault_events")
      .select("id, credential_id, event_type, created_at")
      .eq("credential_id", credentialId)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data, error }) => {
        if (!active) return;
        if (!error && data) setEvents(data as VaultEvent[]);
        setEventsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [credentialId, eventsVersion, status, supabase]);

  React.useEffect(() => {
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  if (!credential) {
    return (
      <div className="mx-auto max-w-[560px] rounded-2xl border border-line bg-surface p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-sage/60 text-forest">
          <Key size={22} />
        </span>
        <h1 className="mt-4 text-[22px] font-semibold tracking-[-0.03em] text-ink">
          Credential not found
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
          It may have been deleted on another device. Refresh the vault or return to the dashboard.
        </p>
        <Link href="/app" className={buttonClass({ variant: "dark", size: "md", className: "mt-5" })}>
          Back to vault
        </Link>
      </div>
    );
  }

  const tint = monogramTint(credential.applicationName);
  const site = normalizeWebsite(credential.websiteUrl);

  async function reveal() {
    if (!credential) return;
    if (secret) {
      setSecret(null);
      setRevealedAt(null);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      return;
    }
    try {
      const value = await retrieveSecret(credential.id);
      setSecret(value);
      setRevealedAt(Date.now());
      setEventsVersion((value) => value + 1);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => {
        setSecret(null);
        setRevealedAt(null);
      }, 30_000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reveal the password.");
    }
  }

  async function copyPassword() {
    if (!credential) return;
    try {
      const value = await retrieveSecret(credential.id);
      await copyText(value);
      scheduleClipboardClear();
      setCopied("password");
      setEventsVersion((version) => version + 1);
      window.setTimeout(() => setCopied(null), 1800);
      toast.success("Password copied. Clipboard clears in 45 seconds.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not copy the password.");
    }
  }

  async function copyUsername() {
    if (!credential) return;
    try {
      await copyText(credential.username);
      setCopied("username");
      window.setTimeout(() => setCopied(null), 1800);
      toast.success("Username copied.");
    } catch {
      toast.error("Could not copy the username.");
    }
  }

  async function handleDelete() {
    if (!credential) return;
    try {
      await deleteCredential(credential.id);
      toast.success(`${credential.applicationName} deleted.`);
      setConfirmOpen(false);
      router.push("/app");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the credential.");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-ink"
        >
          <ArrowLeft size={12} />
          Back to vault
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/app/credentials/${credential.id}/edit`}
            className={buttonClass({ variant: "outline", size: "sm" })}
          >
            <PencilSimple size={13} />
            Edit
          </Link>
          <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
            <Trash size={14} />
            Delete
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
        <div>
          <div className="flex items-start gap-4">
            <span
              className="grid size-12 shrink-0 place-items-center rounded-[14px] text-[16px] font-semibold"
              style={{ backgroundColor: tint.bg, color: tint.fg }}
              aria-hidden="true"
            >
              {initialsFor(credential.applicationName)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[30px] font-semibold leading-tight tracking-[-0.045em] text-ink sm:text-[36px]">
                  {credential.applicationName}
                </h1>
                <Badge tone="accent" className="translate-y-0.5">
                  Sealed
                </Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
                <span className="font-mono text-[10.5px] text-ink-faint">
                  {displayHost(credential.websiteUrl)}
                </span>
                {site && (
                  <a
                    href={site.origin}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-[11px] text-forest underline decoration-forest/30 underline-offset-4 hover:decoration-forest"
                  >
                    Open website
                    <ArrowSquareOut size={11} />
                  </a>
                )}
              </div>
            </div>
          </div>

          <section className="mt-7 overflow-hidden rounded-panel border border-line-strong bg-surface shadow-card">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-faint">
                Sign-in details
              </p>
              <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-forest">
                <LockKey size={11} weight="fill" />
                Encrypted at rest
              </span>
            </div>

            <dl className="divide-y divide-line">
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <dt className="text-[12px] text-ink-faint">Username or email</dt>
                <dd className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-mono text-[12px] text-ink">{credential.username}</span>
                  <button
                    type="button"
                    onClick={copyUsername}
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full transition-colors hover:bg-ink/5",
                      copied === "username" ? "text-forest" : "text-ink-faint hover:text-ink",
                    )}
                    aria-label="Copy username"
                    title="Copy username"
                  >
                    {copied === "username" ? <Check size={13} weight="bold" /> : <Copy size={13} />}
                  </button>
                </dd>
              </div>

              <div className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[12px] text-ink-faint">Password</dt>
                  <dd className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={reveal}
                      className={buttonClass({ variant: "outline", size: "sm" })}
                    >
                      {secret ? <EyeSlash size={13} /> : <Eye size={13} />}
                      {secret ? "Hide" : "Reveal"}
                    </button>
                    <button
                      type="button"
                      onClick={copyPassword}
                      className={buttonClass({ variant: "soft", size: "sm" })}
                    >
                      {copied === "password" ? <Check size={13} weight="bold" /> : <Copy size={13} />}
                      Copy
                    </button>
                  </dd>
                </div>
                <div className="mt-3 rounded-xl border border-line bg-paper/55 px-3.5 py-3">
                  <p
                    className={cn(
                      "break-all font-mono text-[14px] leading-relaxed",
                      secret ? "text-ink" : "tracking-[0.18em] text-ink-faint",
                    )}
                  >
                    {secret ?? maskPassword(14)}
                  </p>
                </div>
                <p className="mt-2 text-[10.5px] text-ink-faint">
                  {secret
                    ? "Visible in this tab. Hides automatically after 30 seconds."
                    : "Passwords stay masked until you explicitly reveal or copy them."}
                  {revealedAt ? ` Revealed ${formatRelative(new Date(revealedAt).toISOString())}.` : ""}
                </p>
              </div>

              <div className="px-5 py-4">
                <dt className="text-[12px] text-ink-faint">Notes</dt>
                <dd className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-soft">
                  {credential.notes || (
                    <span className="text-ink-faint">No notes saved for this credential.</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-surface/60 px-3.5 py-3 text-[11px] leading-relaxed text-ink-faint">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-forest" />
            Revealing or copying records a retrieval event and updates the last-retrieved timestamp.
            The event contains no secret values.
          </div>
        </div>

        <aside className="space-y-4 lg:pt-4">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-faint">
              Record timeline
            </p>
            <dl className="mt-4 space-y-3 text-[11.5px]">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">Created</dt>
                <dd className="text-right text-ink-soft">{formatDate(credential.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">Updated</dt>
                <dd className="text-right text-ink-soft">{formatDate(credential.updatedAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">Last retrieved</dt>
                <dd className="text-right text-ink-soft">
                  {credential.lastRetrievedAt ? formatDate(credential.lastRetrievedAt) : "Never"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-faint">
                Audit trail
              </p>
              <ClockCounterClockwise size={14} className="text-ink-faint" />
            </div>
            {eventsLoading ? (
              <div className="mt-4 space-y-2">
                <div className="h-7 animate-pulse rounded bg-line/50" />
                <div className="h-7 animate-pulse rounded bg-line/40" />
              </div>
            ) : events.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {events.map((event) => (
                  <li key={event.id} className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "mt-1 size-1.5 shrink-0 rounded-full",
                        event.event_type === "retrieved"
                          ? "bg-forest"
                          : event.event_type === "updated"
                            ? "bg-warning"
                            : "bg-ink-faint",
                      )}
                    />
                    <div>
                      <p className="text-[11.5px] text-ink-soft">{EVENT_COPY[event.event_type]}</p>
                      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
                        {formatDate(event.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[11.5px] text-ink-faint">No events recorded yet.</p>
            )}
          </div>

          <div className="rounded-2xl border border-forest/10 bg-sage/35 p-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-forest/70">
              Encryption
            </p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-soft">
              AES-256-GCM · record bound with authenticated data · encryption version 1.
            </p>
          </div>
        </aside>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Delete ${credential.applicationName}?`}
        description="The encrypted record and its audit history reference will be removed. This cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={busy}>
              <Trash size={14} />
              Delete credential
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-2.5 rounded-xl border border-danger/20 bg-danger-soft p-3.5">
          <WarningCircle size={16} className="mt-0.5 shrink-0 text-danger" />
          <p className="text-[12px] leading-relaxed text-danger">
            Make sure you have another copy of this password if you still need access to{" "}
            <span className="font-medium">{displayHost(credential.websiteUrl)}</span>.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
