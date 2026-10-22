import {
  ArrowSquareOut,
  Check,
  Key,
  Lightning,
  LockKey,
  MagnifyingGlass,
} from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/brand/logo";

export function ExtensionPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[430px]">
      <div className="absolute -left-4 top-8 hidden rotate-[-4deg] rounded-xl border border-line bg-surface px-3 py-2 shadow-card sm:block">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-sage text-forest">
            <LockKey size={12} weight="fill" />
          </span>
          <div>
            <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-ink-faint">
              Vault status
            </p>
            <p className="text-[10.5px] font-medium text-ink">Unlocked for 10 min</p>
          </div>
        </div>
      </div>

      <div className="rounded-[18px] border border-line-strong/80 bg-surface p-2 shadow-float">
        <div className="rounded-[13px] border border-line bg-paper/50">
          <div className="flex items-center justify-between border-b border-line px-3.5 py-3">
            <Logo compact />
            <div className="flex items-center gap-2">
              <Badge tone="accent" className="py-0.5 text-[8px]">
                <span className="size-1.5 rounded-full bg-forest" />
                Unlocked
              </Badge>
              <ArrowSquareOut size={13} className="text-ink-faint" />
            </div>
          </div>

          <div className="space-y-3 p-3.5">
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-raised px-2.5 py-2">
              <span className="grid size-5 place-items-center rounded bg-ink text-[8px] font-semibold text-paper">
                L
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-medium leading-tight text-ink">linear.app</p>
                <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-faint">
                  This website
                </p>
              </div>
              <Check size={12} className="ml-auto text-forest" />
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2">
              <MagnifyingGlass size={12} className="text-ink-faint" />
              <span className="text-[10px] text-ink-faint">Search this site</span>
            </div>

            <div>
              <p className="mb-1.5 font-mono text-[8px] uppercase tracking-[0.15em] text-ink-faint">
                1 saved login
              </p>
              <div className="rounded-lg border border-line bg-surface-raised p-2.5">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-md bg-[#e7e9f5] text-[10px] font-semibold text-[#3d478c]">
                    L
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-ink">Linear</p>
                    <p className="truncate font-mono text-[8.5px] text-ink-faint">
                      taiwo@studio.co
                    </p>
                  </div>
                  <span className="rounded-full bg-forest px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-paper">
                    Fill
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-dashed border-line-strong p-2.5">
              <div className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-md bg-accent/40 text-forest">
                  <Key size={11} weight="fill" />
                </span>
                <div>
                  <p className="text-[10px] font-medium text-ink">Save a login here</p>
                  <p className="text-[8.5px] text-ink-faint">Manual save, encrypted locally</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-line pt-2.5">
              <span className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.12em] text-ink-faint">
                <Lightning size={9} weight="fill" className="text-forest" />
                Open Keyhold
              </span>
              <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-faint">
                v0.1
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BrowserMock() {
  return (
    <div className="overflow-hidden rounded-[20px] border border-line-strong/80 bg-surface shadow-float">
      <div className="flex items-center gap-2 border-b border-line bg-paper/60 px-4 py-2.5">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2 rounded-full bg-line-strong" />
          <span className="size-2 rounded-full bg-line-strong" />
          <span className="size-2 rounded-full bg-line-strong" />
        </div>
        <div className="ml-2 flex flex-1 items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5">
          <LockKey size={10} className="text-forest" />
          <span className="font-mono text-[9px] text-ink-faint">linear.app/login</span>
        </div>
        <span className="grid size-6 place-items-center rounded-md bg-sage text-forest">
          <Key size={11} weight="fill" />
        </span>
      </div>
      <div className="relative p-8 sm:p-12">
        <div className="mx-auto max-w-[280px]">
          <div className="mx-auto mb-5 grid size-10 place-items-center rounded-xl bg-[#e7e9f5] text-[14px] font-bold text-[#3d478c]">
            L
          </div>
          <p className="text-center text-[15px] font-semibold text-ink">Sign in to Linear</p>
          <p className="mt-1 text-center text-[11px] text-ink-faint">Continue to your workspace</p>
          <div className="mt-6 space-y-2.5">
            <div className="rounded-lg border border-line bg-surface-raised px-3 py-2.5 text-[11px] text-ink-soft">
              taiwo@studio.co
            </div>
            <div className="rounded-lg border border-line bg-surface-raised px-3 py-2.5 font-mono text-[10px] tracking-[0.15em] text-ink-faint">
              ••••••••••••
            </div>
            <div className="rounded-lg bg-forest py-2.5 text-center text-[11px] font-medium text-paper">
              Continue
            </div>
          </div>
        </div>

        <div className="absolute bottom-5 left-5 right-5 rounded-xl border border-line-strong/70 bg-surface p-3 shadow-card sm:left-auto sm:right-6 sm:w-[260px]">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-faint">
              Keyhold autofill
            </p>
            <span className="size-1.5 rounded-full bg-forest animate-pulse-dot" />
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-surface-raised px-2.5 py-2">
            <span className="grid size-6 place-items-center rounded-md bg-[#e7e9f5] text-[9px] font-semibold text-[#3d478c]">
              L
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-medium text-ink">Linear</p>
              <p className="truncate font-mono text-[8.5px] text-ink-faint">taiwo@studio.co</p>
            </div>
            <Check size={13} className="text-forest" />
          </div>
          <p className="mt-2 text-[8.5px] leading-relaxed text-ink-faint">
            Matched to linear.app only. Click a saved login to fill.
          </p>
        </div>
      </div>
    </div>
  );
}
