"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Pulse,
  GearSix,
  LockKey,
  Plus,
  ShieldCheck,
  SignOut,
  Vault,
} from "@phosphor-icons/react";
import type { User } from "@supabase/supabase-js";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { useVault } from "@/components/vault/vault-provider";
import { initialsFor } from "@/lib/vault/format";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/app", label: "Vault", icon: Vault, exact: true },
  { href: "/app/activity", label: "Activity", icon: Pulse, exact: false },
  { href: "/app/security", label: "Security", icon: ShieldCheck, exact: false },
];

function isActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href || pathname.startsWith("/app/credentials");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, lock, signOut, autoLockMinutes } = useVault();
  const [signingOut, setSigningOut] = React.useState(false);
  const isSetup = pathname === "/app/setup";
  const displayName =
    (user.user_metadata?.display_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "Vault owner";
  const initials = initialsFor(displayName);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut("local");
    } finally {
      setSigningOut(false);
    }
  }

  if (isSetup) {
    return (
      <div className="min-h-[100dvh]">
        <header className="border-b border-line">
          <div className="mx-auto flex h-16 max-w-[1000px] items-center justify-between px-5 sm:px-8">
            <Link href="/app" aria-label="Keyhold vault">
              <Logo />
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </header>
        <main id="main">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[252px_1fr]">
      <aside className="sticky top-0 hidden h-[100dvh] flex-col border-r border-line bg-surface/55 px-4 py-5 lg:flex">
        <div className="px-2">
          <Link href="/app" aria-label="Keyhold vault">
            <Logo />
          </Link>
        </div>

        <Link
          href="/app/credentials/new"
          className={buttonClass({ variant: "dark", size: "md", className: "mt-7 w-full justify-between" })}
        >
          Add credential
          <Plus size={15} weight="bold" />
        </Link>

        <nav className="mt-7 space-y-1" aria-label="Vault">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] transition-colors",
                  active
                    ? "bg-ink/[0.06] font-medium text-ink"
                    : "text-ink-soft hover:bg-ink/[0.035] hover:text-ink",
                )}
              >
                <item.icon size={17} weight={active ? "fill" : "regular"} className="text-ink-faint" />
                {item.label}
                {active && <span className="ml-auto size-1 rounded-full bg-forest" />}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-2xl border border-line bg-paper/60 p-3.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-faint">
                Vault status
              </span>
              <Badge tone={status === "unlocked" ? "accent" : "neutral"} className="py-0.5 text-[8px]">
                {status === "unlocked" ? "Unlocked" : "Locked"}
              </Badge>
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-soft">
              {status === "unlocked"
                ? `Locks after ${autoLockMinutes} min of inactivity.`
                : "Enter your master password to decrypt this device."}
            </p>
            <button
              type="button"
              onClick={lock}
              disabled={status !== "unlocked"}
              className="mt-2.5 inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-forest transition-opacity hover:opacity-70 disabled:opacity-40"
            >
              <LockKey size={11} weight="fill" />
              Lock now
            </button>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl px-1 py-1">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-sage/60 font-mono text-[10px] font-medium text-forest">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-ink">{displayName}</p>
              <p className="truncate font-mono text-[9px] text-ink-faint">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="grid size-8 place-items-center rounded-full text-ink-faint transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-50"
              aria-label="Sign out"
              title="Sign out"
            >
              <SignOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper/90 px-4 backdrop-blur-md lg:hidden">
          <Link href="/app" aria-label="Keyhold vault">
            <Logo compact />
          </Link>
          <div className="flex items-center gap-1.5">
            <Badge tone={status === "unlocked" ? "accent" : "neutral"} className="py-0.5 text-[8px]">
              {status === "unlocked" ? "Unlocked" : "Locked"}
            </Badge>
            <Link
              href="/app/credentials/new"
              className="grid size-8 place-items-center rounded-full bg-forest text-paper"
              aria-label="Add credential"
            >
              <Plus size={15} weight="bold" />
            </Link>
            <button
              type="button"
              onClick={() => router.push("/app/security")}
              className="grid size-8 place-items-center rounded-full text-ink-soft"
              aria-label="Security settings"
            >
              <GearSix size={17} />
            </button>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-[1120px] px-4 pb-28 pt-6 sm:px-7 lg:px-9 lg:pb-16 lg:pt-10">
          {children}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-md lg:hidden"
        aria-label="Vault navigation"
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {navItems.slice(0, 2).map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg py-1.5 text-[9.5px]",
                  active ? "text-ink" : "text-ink-faint",
                )}
              >
                <item.icon size={18} weight={active ? "fill" : "regular"} />
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/app/credentials/new"
            className="flex flex-col items-center gap-1 rounded-lg py-1.5 text-[9.5px] text-ink-faint"
          >
            <span className="grid size-7 place-items-center rounded-full bg-forest text-paper">
              <Plus size={14} weight="bold" />
            </span>
            Add
          </Link>
          <Link
            href="/app/security"
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg py-1.5 text-[9.5px]",
              pathname === "/app/security" ? "text-ink" : "text-ink-faint",
            )}
          >
            <ShieldCheck size={18} weight={pathname === "/app/security" ? "fill" : "regular"} />
            Security
          </Link>
        </div>
      </nav>
    </div>
  );
}
