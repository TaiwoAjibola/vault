"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { WarningCircle } from "@phosphor-icons/react";
import { useVault } from "@/components/vault/vault-provider";
import { UnlockScreen } from "@/components/vault/unlock-screen";

function LoadingShell() {
  return (
    <div className="mx-auto max-w-[820px] space-y-6 py-10">
      <div className="h-5 w-28 animate-pulse rounded bg-line/60" />
      <div className="h-14 w-2/3 animate-pulse rounded-xl bg-line/50" />
      <div className="h-24 animate-pulse rounded-2xl bg-line/40" />
      <div className="h-64 animate-pulse rounded-2xl bg-line/30" />
    </div>
  );
}

export function VaultGuard({ children }: { children: React.ReactNode }) {
  const { status, error, clearError } = useVault();
  const router = useRouter();

  React.useEffect(() => {
    if (status === "no-vault") router.replace("/app/setup");
  }, [router, status]);

  if (status === "loading") return <LoadingShell />;
  if (status === "signed-out") return <LoadingShell />;
  if (status === "no-vault") return <LoadingShell />;

  if (status === "locked") {
    return (
      <>
        {error && (
          <div className="mx-auto mb-4 flex max-w-[520px] items-start gap-2 rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-3 text-[12px] text-danger">
            <WarningCircle size={15} className="mt-0.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button type="button" onClick={clearError} className="underline underline-offset-2">
              Dismiss
            </button>
          </div>
        )}
        <UnlockScreen />
      </>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-warning/20 bg-warning-soft px-3.5 py-3 text-[12px] text-warning">
          <WarningCircle size={15} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={clearError} className="underline underline-offset-2">
            Dismiss
          </button>
        </div>
      )}
      {children}
    </>
  );
}
