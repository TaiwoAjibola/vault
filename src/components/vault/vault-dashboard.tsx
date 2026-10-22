"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Key,
  LockKey,
  MagnifyingGlass,
  Plus,
  ShieldCheck,
  Trash,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useVault } from "@/components/vault/vault-provider";
import { CredentialRow } from "@/components/vault/credential-row";
import { Button, buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import type { DecryptedCredential } from "@/lib/vault/types";
import { normalizeOrigin } from "@/lib/vault/origin";
import { formatRelative } from "@/lib/vault/format";
import { cn } from "@/lib/utils";

type Filter = "all" | "recent" | "unused";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "recent", label: "Recently updated" },
  { value: "unused", label: "Never retrieved" },
];

export function VaultDashboard() {
  const { user, credentials, status, autoLockMinutes, lock, deleteCredential, busy } = useVault();
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [deleteTarget, setDeleteTarget] = React.useState<DecryptedCredential | null>(null);
  const [greeting, setGreeting] = React.useState("Welcome");
  const searchRef = React.useRef<HTMLInputElement>(null);

  const displayName =
    (user.user_metadata?.display_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "there";

  React.useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
  }, []);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const sites = React.useMemo(() => {
    const set = new Set<string>();
    for (const credential of credentials) {
      const origin = normalizeOrigin(credential.websiteUrl);
      if (origin) set.add(origin);
    }
    return set.size;
  }, [credentials]);

  const unused = React.useMemo(
    () => credentials.filter((credential) => !credential.lastRetrievedAt).length,
    [credentials],
  );

  const lastActivity = React.useMemo(() => {
    const stamps = credentials
      .map((credential) => credential.lastRetrievedAt)
      .filter((value): value is string => Boolean(value))
      .sort();
    return stamps.at(-1) ?? null;
  }, [credentials]);

  const filtered = React.useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return credentials.filter((credential) => {
      if (filter === "recent") {
        const updated = new Date(credential.updatedAt).getTime();
        if (Date.now() - updated > 7 * 24 * 60 * 60 * 1000) return false;
      }
      if (filter === "unused" && credential.lastRetrievedAt) return false;
      if (!needle) return true;
      return (
        credential.applicationName.toLowerCase().includes(needle) ||
        credential.websiteUrl.toLowerCase().includes(needle) ||
        credential.username.toLowerCase().includes(needle)
      );
    });
  }, [credentials, deferredQuery, filter]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteCredential(deleteTarget.id);
      toast.success(`${deleteTarget.applicationName} deleted.`);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the credential.");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
            Personal vault
          </p>
          <h1 className="mt-2 text-[32px] font-semibold leading-[1.02] tracking-[-0.05em] text-ink sm:text-[40px]">
            {greeting}, {displayName}.
          </h1>
          <p className="mt-2 max-w-[52ch] text-[13.5px] leading-relaxed text-ink-soft">
            Everything here is decrypted locally in this tab. Search, reveal, or copy a credential
            when you need it.
          </p>
        </div>
        <Link
          href="/app/credentials/new"
          className={buttonClass({ variant: "dark", size: "md", className: "lg:hidden" })}
        >
          Add credential
          <Plus size={15} weight="bold" />
        </Link>
      </div>

      <section className="relative mt-7 overflow-hidden rounded-panel border border-line-strong bg-surface shadow-card">
        <div
          className="pointer-events-none absolute -right-16 -top-24 size-[290px] rounded-full border border-forest/[0.07]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-4 -top-12 size-[200px] rounded-full border border-forest/[0.06]"
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute right-10 top-9 hidden text-forest/[0.08] sm:block" aria-hidden="true">
          <LockKey size={78} weight="thin" />
        </div>

        <div className="relative grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-5 py-5 sm:px-6">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-faint">
              Credentials
            </p>
            <p className="mt-2 font-feature-numeric text-[34px] font-semibold leading-none tracking-[-0.04em] text-ink">
              {credentials.length}
            </p>
            <p className="mt-1.5 text-[11px] text-ink-faint">sealed records</p>
          </div>
          <div className="px-5 py-5 sm:px-6">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-faint">
              Websites
            </p>
            <p className="mt-2 font-feature-numeric text-[34px] font-semibold leading-none tracking-[-0.04em] text-ink">
              {sites}
            </p>
            <p className="mt-1.5 text-[11px] text-ink-faint">distinct origins</p>
          </div>
          <div className="px-5 py-5 sm:px-6">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-faint">
              Last retrieved
            </p>
            <p className="mt-2 text-[17px] font-medium leading-tight tracking-[-0.02em] text-ink">
              {lastActivity ? formatRelative(lastActivity) : "No retrievals yet"}
            </p>
            <p className="mt-1.5 text-[11px] text-ink-faint">
              {unused === 0 ? "Every record has been used" : `${unused} never retrieved`}
            </p>
          </div>
        </div>

        <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper/45 px-5 py-3.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status === "unlocked" ? "accent" : "neutral"}>
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  status === "unlocked" ? "bg-forest animate-pulse-dot" : "bg-ink-faint",
                )}
              />
              {status === "unlocked" ? "Vault unlocked" : "Vault locked"}
            </Badge>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">
              AES-256-GCM · Auto-lock {autoLockMinutes}m
            </span>
          </div>
          <button
            type="button"
            onClick={lock}
            className="inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-forest transition-opacity hover:opacity-70"
          >
            <LockKey size={11} weight="fill" />
            Lock now
          </button>
        </div>
      </section>

      <div className="mt-7 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-[420px]">
          <MagnifyingGlass
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <Input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search applications, websites, or usernames"
            aria-label="Search credentials"
            className="h-10 pl-9 pr-16 text-[13px]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-faint hover:bg-ink/5 hover:text-ink"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          ) : (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-line px-1.5 py-0.5 font-mono text-[9px] text-ink-faint">
              ⌘K
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((item) => {
            const active = filter === item.value;
            const count =
              item.value === "all"
                ? credentials.length
                : item.value === "recent"
                  ? credentials.filter(
                      (credential) =>
                        Date.now() - new Date(credential.updatedAt).getTime() <=
                        7 * 24 * 60 * 60 * 1000,
                    ).length
                  : unused;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(item.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] transition-colors",
                  active
                    ? "border-forest/20 bg-forest text-paper"
                    : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "font-mono text-[9px]",
                    active ? "text-paper/60" : "text-ink-faint",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-b border-line pb-2">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-faint">
          {filtered.length} {filtered.length === 1 ? "record" : "records"}
        </p>
        <p className="hidden font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-faint sm:block">
          Reveal or copy records a retrieval
        </p>
      </div>

      {filtered.length > 0 ? (
        <div>
          {filtered.map((credential) => (
            <CredentialRow
              key={credential.id}
              credential={credential}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      ) : credentials.length === 0 ? (
        <div className="mt-8 rounded-panel border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full border border-line bg-surface text-forest">
            <Key size={26} weight="thin" />
          </span>
          <h2 className="mt-5 text-[22px] font-semibold tracking-[-0.035em] text-ink">
            Your vault is empty.
          </h2>
          <p className="mx-auto mt-2 max-w-[46ch] text-[13px] leading-relaxed text-ink-soft">
            Add the first login you want under lock. Application name, URL, username, password, and
            notes are encrypted in this browser before anything is stored.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/app/credentials/new" className={buttonClass({ variant: "dark", size: "md" })}>
              Add your first credential
              <Plus size={14} weight="bold" />
            </Link>
            <Link href="/app/security" className={buttonClass({ variant: "outline", size: "md" })}>
              Security settings
            </Link>
          </div>
          <div className="mx-auto mt-8 flex max-w-[460px] items-center justify-center gap-2 border-t border-line pt-5 text-[11px] text-ink-faint">
            <ShieldCheck size={14} className="text-forest" />
            The server receives ciphertext, never these fields in plaintext.
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-line bg-surface px-6 py-12 text-center">
          <MagnifyingGlass size={24} className="mx-auto text-ink-faint" />
          <h2 className="mt-3 text-[17px] font-semibold text-ink">No matching credentials</h2>
          <p className="mt-1.5 text-[12.5px] text-ink-soft">
            Try a different application name, website, or username.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
          >
            Clear filters
            <ArrowRight size={13} />
          </Button>
        </div>
      )}

      <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-line bg-surface/60 px-3.5 py-3 text-[11px] leading-relaxed text-ink-faint">
        <LockKey size={14} className="mt-0.5 shrink-0 text-forest" />
        <p>
          Keyhold never stores your master password or an unwrapped vault key. Closing this tab
          discards the decrypted vault, and inactivity locks it automatically.
        </p>
      </div>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.applicationName ?? "credential"}?`}
        description="This permanently removes the encrypted record from your vault. It cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={busy}>
              <Trash size={14} />
              Delete credential
            </Button>
          </>
        }
      >
        <dl className="space-y-2.5 rounded-xl border border-line bg-paper/50 p-4 text-[12px]">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-faint">Application</dt>
            <dd className="text-right font-medium text-ink">{deleteTarget?.applicationName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-faint">Username</dt>
            <dd className="truncate text-right font-mono text-[11px] text-ink-soft">
              {deleteTarget?.username}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-faint">Last updated</dt>
            <dd className="text-right font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
              {deleteTarget ? formatRelative(deleteTarget.updatedAt) : ""}
            </dd>
          </div>
        </dl>
      </Dialog>
    </div>
  );
}
