import Link from "next/link";
import { Check, LockKey, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/brand/logo";

const privateThings = [
  "Application names and URLs",
  "Usernames and email addresses",
  "Passwords and private notes",
  "Your master password and vault key",
];

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  eyebrow,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[0.86fr_1.14fr]">
      <aside className="relative hidden overflow-hidden border-r border-line bg-sage/40 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 keyhole-dots opacity-50" aria-hidden="true" />
        <div className="relative p-10 xl:p-14">
          <Link href="/" aria-label="Keyhold home" className="inline-flex rounded-lg">
            <Logo />
          </Link>
        </div>

        <div className="relative px-10 xl:px-14">
          <div className="relative mx-auto mb-12 grid size-48 place-items-center">
            <div className="absolute inset-0 rounded-full border border-forest/10" />
            <div className="absolute inset-5 rounded-full border border-forest/10" />
            <div className="absolute inset-10 rounded-full border border-forest/15 bg-surface/50 backdrop-blur-sm" />
            <LockKey size={54} weight="light" className="relative text-forest" />
            <span className="absolute -bottom-1 rounded-full border border-forest/10 bg-surface px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-forest">
              Sealed locally
            </span>
          </div>
          <h2 className="max-w-[12ch] text-[38px] font-semibold leading-[1.02] tracking-[-0.05em] text-ink xl:text-[46px]">
            The key is yours.
          </h2>
          <p className="mt-4 max-w-[38ch] text-[13.5px] leading-relaxed text-ink-soft">
            Keyhold encrypts credential payloads in your browser. The server stores a sealed box,
            not the contents.
          </p>
          <ul className="mt-8 space-y-3 border-t border-forest/10 pt-6">
            {privateThings.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-[12.5px] text-ink-soft">
                <span className="grid size-5 place-items-center rounded-full bg-forest/8 text-forest">
                  <Check size={11} weight="bold" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative p-10 xl:p-14">
          <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface/70 p-3.5">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-forest" />
            <p className="text-[11px] leading-relaxed text-ink-soft">
              Your account password and vault master password are separate. Losing both the master
              password and recovery key means the vault cannot be decrypted.
            </p>
          </div>
        </div>
      </aside>

      <main id="main" className="flex flex-col">
        <div className="flex items-center justify-between px-5 py-5 sm:px-8 lg:hidden">
          <Link href="/" aria-label="Keyhold home">
            <Logo />
          </Link>
          <Link href="/" className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            Back home
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[420px]">
            {eyebrow && (
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                {eyebrow}
              </p>
            )}
            <h1 className="mt-3 text-[32px] font-semibold leading-[1.05] tracking-[-0.045em] text-ink">
              {title}
            </h1>
            <p className="mt-2.5 max-w-[44ch] text-[13.5px] leading-relaxed text-ink-soft">
              {subtitle}
            </p>
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-7 border-t border-line pt-5">{footer}</div>}
          </div>
        </div>
        <div className="hidden px-8 pb-6 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-faint lg:block">
          Keyhold · Encrypted credential vault
        </div>
      </main>
    </div>
  );
}
