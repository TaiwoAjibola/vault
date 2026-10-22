"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowsClockwise,
  ClockCounterClockwise,
  Eye,
  PencilSimple,
  PlusCircle,
  Trash,
} from "@phosphor-icons/react";
import { useVault } from "@/components/vault/vault-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { VaultEvent } from "@/lib/vault/types";
import { cn } from "@/lib/utils";

type Filter = "all" | VaultEvent["event_type"];

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All events" },
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "retrieved", label: "Retrieved" },
  { value: "deleted", label: "Deleted" },
];

const EVENT_META: Record<
  VaultEvent["event_type"],
  { label: string; icon: typeof PlusCircle; className: string }
> = {
  created: { label: "Credential created", icon: PlusCircle, className: "bg-sage text-forest" },
  updated: { label: "Fields updated", icon: PencilSimple, className: "bg-warning-soft text-warning" },
  retrieved: { label: "Password retrieved", icon: Eye, className: "bg-accent/40 text-forest" },
  deleted: { label: "Credential deleted", icon: Trash, className: "bg-danger-soft text-danger" },
};

function dayKey(iso: string): string {
  const date = new Date(iso);
  return date.toDateString();
}

function dayLabel(key: string): string {
  const date = new Date(key);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(
    date,
  );
}

export function ActivityFeed() {
  const { credentials, status, user } = useVault();
  const supabase = React.useMemo(() => createClient(), []);
  const [events, setEvents] = React.useState<VaultEvent[]>([]);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    if (status !== "unlocked") return;
    let active = true;
    setLoading(true);
    setError(null);
    supabase
      .from("vault_events")
      .select("id, credential_id, event_type, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(150)
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) {
          setError("Could not load the audit trail.");
        } else {
          setEvents((data ?? []) as VaultEvent[]);
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status, supabase, user.id, version]);

  const names = React.useMemo(() => {
    const map = new Map<string, { name: string; host: string }>();
    for (const credential of credentials) {
      map.set(credential.id, {
        name: credential.applicationName,
        host: credential.websiteUrl,
      });
    }
    return map;
  }, [credentials]);

  const filtered = React.useMemo(
    () => (filter === "all" ? events : events.filter((event) => event.event_type === filter)),
    [events, filter],
  );

  const grouped = React.useMemo(() => {
    const groups = new Map<string, VaultEvent[]>();
    for (const event of filtered) {
      const key = dayKey(event.created_at);
      const list = groups.get(key) ?? [];
      list.push(event);
      groups.set(key, list);
    }
    return [...groups.entries()];
  }, [filtered]);

  const retrievals = events.filter((event) => event.event_type === "retrieved").length;
  const changes = events.filter(
    (event) => event.event_type === "created" || event.event_type === "updated",
  ).length;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
            Vault activity
          </p>
          <h1 className="mt-2 text-[32px] font-semibold leading-[1.02] tracking-[-0.05em] text-ink sm:text-[38px]">
            A record of access.
          </h1>
          <p className="mt-2 max-w-[54ch] text-[13px] leading-relaxed text-ink-soft">
            Server-recorded events for this vault. Events contain timestamps and record identifiers —
            never application names, usernames, passwords, or notes.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setVersion((value) => value + 1)}
          disabled={loading}
        >
          <ArrowsClockwise size={13} className={cn(loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface px-4 py-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">Events</p>
          <p className="mt-2 font-feature-numeric text-[28px] font-semibold leading-none tracking-[-0.04em] text-ink">
            {events.length}
          </p>
          <p className="mt-1 text-[10.5px] text-ink-faint">most recent 150</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface px-4 py-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">Retrievals</p>
          <p className="mt-2 font-feature-numeric text-[28px] font-semibold leading-none tracking-[-0.04em] text-ink">
            {retrievals}
          </p>
          <p className="mt-1 text-[10.5px] text-ink-faint">reveal, copy, or fill</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface px-4 py-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">Changes</p>
          <p className="mt-2 font-feature-numeric text-[28px] font-semibold leading-none tracking-[-0.04em] text-ink">
            {changes}
          </p>
          <p className="mt-1 text-[10.5px] text-ink-faint">created or updated</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {FILTERS.map((item) => {
          const active = filter === item.value;
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(item.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11.5px] transition-colors",
                active
                  ? "border-forest/20 bg-forest text-paper"
                  : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-xl bg-line/30" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-danger/20 bg-danger-soft p-5 text-[12.5px] text-danger">
            {error}
          </div>
        ) : grouped.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center">
            <ClockCounterClockwise size={26} className="mx-auto text-ink-faint" />
            <h2 className="mt-3 text-[18px] font-semibold tracking-[-0.02em] text-ink">
              No activity yet
            </h2>
            <p className="mt-1.5 text-[12.5px] text-ink-soft">
              Create a credential or retrieve a password to start the audit trail.
            </p>
          </div>
        ) : (
          <div className="space-y-7">
            {grouped.map(([day, dayEvents]) => (
              <section key={day}>
                <div className="flex items-center gap-3">
                  <h2 className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-faint">
                    {dayLabel(day)}
                  </h2>
                  <div className="h-px flex-1 bg-line" />
                  <span className="font-mono text-[9px] text-ink-faint">{dayEvents.length}</span>
                </div>
                <ul className="mt-3 divide-y divide-line border-y border-line">
                  {dayEvents.map((event) => {
                    const meta = EVENT_META[event.event_type];
                    const known = event.credential_id ? names.get(event.credential_id) : undefined;
                    return (
                      <li
                        key={event.id}
                        className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-1 py-3 sm:gap-4 sm:px-2"
                      >
                        <span
                          className={cn(
                            "grid size-8 place-items-center rounded-full",
                            meta.className,
                          )}
                          aria-hidden="true"
                        >
                          <meta.icon size={14} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[12.5px] font-medium text-ink">{meta.label}</p>
                            {event.event_type === "retrieved" && (
                              <Badge tone="neutral" className="py-0 text-[8px]">
                                Retrieval
                              </Badge>
                            )}
                          </div>
                          <p className="truncate font-mono text-[9.5px] text-ink-faint">
                            {known ? (
                              <>
                                {known.name}
                                <span className="mx-1.5 text-line-strong">/</span>
                                {known.host}
                              </>
                            ) : (
                              "Record removed or unavailable"
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-faint">
                            {new Intl.DateTimeFormat("en", {
                              hour: "numeric",
                              minute: "2-digit",
                            }).format(new Date(event.created_at))}
                          </p>
                          {known && (
                            <Link
                              href={`/app/credentials/${event.credential_id}`}
                              className="text-[10px] text-forest underline decoration-forest/30 underline-offset-2"
                            >
                              Open
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-line bg-surface/60 px-3.5 py-3 text-[11px] leading-relaxed text-ink-faint">
        <Eye size={14} className="mt-0.5 shrink-0 text-forest" />
        <p>
          A retrieval event is written only when a password is explicitly revealed, copied, or filled.
          Timestamps are recorded by Postgres, not the browser.
        </p>
      </div>
    </div>
  );
}
