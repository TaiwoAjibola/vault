import {
  Copy,
  DotsThree,
  Eye,
  MagnifyingGlass,
  Plus,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const rows = [
  {
    name: "Linear",
    username: "taiwo@studio.co",
    host: "linear.app",
    monogram: "L",
    tone: "bg-[#e7e9f5] text-[#3d478c]",
  },
  {
    name: "Figma",
    username: "taiwo@studio.co",
    host: "figma.com",
    monogram: "F",
    tone: "bg-[#f7e7e2] text-[#a34b32]",
  },
  {
    name: "Betterment",
    username: "t.aiyeku@gmail.com",
    host: "betterment.com",
    monogram: "B",
    tone: "bg-[#e5efe1] text-[#3d6a43]",
  },
];

export function VaultPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[22px] border border-line-strong/80 bg-surface shadow-float",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-line bg-paper/60 px-4 py-3">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="size-2 rounded-full bg-line-strong" />
          <span className="size-2 rounded-full bg-line-strong" />
          <span className="size-2 rounded-full bg-line-strong" />
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1">
          <ShieldCheck size={12} weight="fill" className="text-forest" />
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
            Vault unlocked
          </span>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">Keyhold</span>
      </div>

      <div className="grid gap-5 p-5 sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-faint">
              Personal vault
            </p>
            <h3 className="mt-1.5 text-[22px] font-semibold tracking-[-0.04em] text-ink">
              Good evening, Taiwo
            </h3>
          </div>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-forest text-paper">
            <Plus size={16} weight="bold" />
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-raised px-3 py-2.5">
          <MagnifyingGlass size={15} className="text-ink-faint" />
          <span className="text-[12px] text-ink-faint">Search applications or websites</span>
          <span className="ml-auto rounded border border-line px-1.5 py-0.5 font-mono text-[9px] text-ink-faint">
            ⌘K
          </span>
        </div>

        <div>
          <div className="flex items-center justify-between pb-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
              3 credentials
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
              Updated
            </span>
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {rows.map((row) => (
              <li key={row.name} className="flex items-center gap-3 py-3">
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg text-[12px] font-semibold",
                    row.tone,
                  )}
                >
                  {row.monogram}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-ink">{row.name}</p>
                  <p className="truncate font-mono text-[10px] text-ink-faint">{row.username}</p>
                </div>
                <span className="hidden font-mono text-[11px] tracking-[0.12em] text-ink-faint sm:block">
                  ••••••••
                </span>
                <span className="text-ink-faint">
                  <Eye size={14} />
                </span>
                <span className="text-ink-faint">
                  <Copy size={14} />
                </span>
                <span className="text-ink-faint">
                  <DotsThree size={16} weight="bold" />
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-forest/10 bg-sage/45 px-3.5 py-3">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-forest animate-pulse-dot" />
            <span className="text-[11px] text-forest">Encrypted before upload</span>
          </div>
          <Badge tone="forest" className="bg-forest/90">
            AES-256-GCM
          </Badge>
        </div>
      </div>
    </div>
  );
}
