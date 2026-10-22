import Link from "next/link";
import {
  ArrowRight,
  Browser,
  CheckCircle,
  Fingerprint,
  Key,
  LockKey,
  ShieldCheck,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { VaultPreview } from "@/components/marketing/vault-preview";
import { BrowserMock, ExtensionPreview } from "@/components/marketing/extension-preview";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";

const mechanics = [
  {
    number: "01",
    title: "Unlock once",
    body: "Your master password derives a key in your browser. The vault key never leaves this device in the clear.",
    icon: Fingerprint,
  },
  {
    number: "02",
    title: "Seal every field",
    body: "Application name, URL, username, password, and notes are encrypted with AES-256-GCM before upload.",
    icon: LockKey,
  },
  {
    number: "03",
    title: "Retrieve anywhere",
    body: "Sign in on another computer, unlock the vault, and your credentials decrypt locally. The server only sees ciphertext.",
    icon: Key,
  },
];

const serverSees = ["Ciphertext and nonces", "Ownership IDs", "Created / updated timestamps", "Audit event types"];
const serverCannotSee = ["Application names", "Website URLs", "Usernames or emails", "Passwords and notes"];

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh]">
      <MarketingNav />
      <main id="main">
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 keyhole-dots opacity-40" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-[1180px] items-center gap-14 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10 lg:pb-28 lg:pt-20">
            <div className="animate-rise">
              <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5">
                <span className="size-1.5 rounded-full bg-forest animate-pulse-dot" />
                <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-soft">
                  Encrypted in your browser
                </span>
              </div>
              <h1 className="mt-7 max-w-[15ch] text-[46px] font-semibold leading-[0.98] tracking-[-0.055em] text-ink sm:text-[62px] lg:text-[68px]">
                Every login, <span className="text-forest/55">under one lock.</span>
              </h1>
              <p className="mt-6 max-w-[46ch] text-[15.5px] leading-relaxed text-ink-soft">
                Save, search, and autofill passwords without handing over the keys. Your vault is
                encrypted before it leaves the browser.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/signup" className={buttonClass({ size: "lg" })}>
                  Create your vault
                  <ArrowRight size={16} weight="bold" />
                </Link>
                <a href="#how" className={buttonClass({ variant: "outline", size: "lg" })}>
                  How the vault works
                </a>
              </div>
              <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-faint">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-forest" />
                  AES-256-GCM
                </span>
                <span className="flex items-center gap-1.5">
                  <Fingerprint size={13} className="text-forest" />
                  PBKDF2 · 600k rounds
                </span>
                <span className="flex items-center gap-1.5">
                  <Browser size={13} className="text-forest" />
                  Chrome + Edge
                </span>
              </div>
            </div>

            <div className="animate-rise lg:pl-4" style={{ animationDelay: "120ms" }}>
              <VaultPreview />
              <div className="mt-4 flex items-center justify-between gap-4 px-1">
                <p className="max-w-[30ch] text-[11.5px] leading-relaxed text-ink-faint">
                  A real preview of the Keyhold ledger. Sample data, never your credentials.
                </p>
                <Badge tone="neutral">Light by design</Badge>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="border-y border-line bg-surface/55">
          <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 lg:py-20">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                  How it works
                </p>
                <h2 className="mt-4 max-w-[14ch] text-[34px] font-semibold leading-[1.02] tracking-[-0.045em] text-ink sm:text-[42px]">
                  Three moves. One sealed vault.
                </h2>
                <p className="mt-5 max-w-[38ch] text-[14px] leading-relaxed text-ink-soft">
                  No custom cryptography. No plaintext fallback. The browser does the encryption;
                  the database stores the result.
                </p>
              </div>

              <div className="divide-y divide-line border-y border-line">
                {mechanics.map((item) => (
                  <div
                    key={item.number}
                    className="grid grid-cols-[auto_1fr] gap-4 py-6 sm:grid-cols-[54px_1fr_auto] sm:gap-6"
                  >
                    <span className="font-mono text-[11px] tracking-[0.1em] text-ink-faint">
                      {item.number}
                    </span>
                    <div>
                      <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-ink">
                        {item.title}
                      </h3>
                      <p className="mt-1.5 max-w-[46ch] text-[13px] leading-relaxed text-ink-soft">
                        {item.body}
                      </p>
                    </div>
                    <span className="hidden size-10 place-items-center rounded-full border border-line bg-surface text-forest sm:grid">
                      <item.icon size={18} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="extension" className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 lg:py-28">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                Browser extension
              </p>
              <h2 className="mt-4 max-w-[16ch] text-[34px] font-semibold leading-[1.02] tracking-[-0.045em] text-ink sm:text-[44px]">
                Fills the form. Not the wrong site.
              </h2>
              <p className="mt-5 max-w-[48ch] text-[14px] leading-relaxed text-ink-soft">
                The extension asks before it saves, matches credentials to the exact origin, and
                keeps per-site access opt-in. You can revoke a site at any time.
              </p>
              <ul className="mt-7 space-y-3.5">
                {[
                  "Save prompts appear only after a likely successful login.",
                  "Changed passwords offer an update — never a silent overwrite.",
                  "Autofill is exact-origin, with an explicit click to fill.",
                  "Only the selected password is released to the active tab.",
                ].map((item) => (
                  <li key={item} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-soft">
                    <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-forest" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-2">
                <Badge tone="accent">Manifest V3</Badge>
                <Badge>Chrome</Badge>
                <Badge>Edge</Badge>
                <Badge>Optional site access</Badge>
              </div>
            </div>
            <div className="grid gap-6">
              <BrowserMock />
              <div className="hidden lg:block">
                <ExtensionPreview />
              </div>
            </div>
          </div>
        </section>

        <section id="security" className="border-y border-line bg-sage/35">
          <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest/70">
                  Security model
                </p>
                <h2 className="mt-4 max-w-[15ch] text-[34px] font-semibold leading-[1.02] tracking-[-0.045em] text-ink sm:text-[42px]">
                  The server stores what it cannot read.
                </h2>
                <p className="mt-5 max-w-[44ch] text-[14px] leading-relaxed text-ink-soft">
                  Payload encryption happens in the browser with the Web Crypto API. The wrapped
                  vault key is stored separately from your credential ciphertext.
                </p>
                <div className="mt-7 flex items-start gap-2.5 rounded-xl border border-warning/20 bg-warning-soft/80 p-3.5">
                  <Warning size={16} className="mt-0.5 shrink-0 text-warning" />
                  <p className="text-[12px] leading-relaxed text-warning">
                    Keep your recovery key somewhere safe. If you lose both the master password and
                    the recovery key, the encrypted vault cannot be recovered.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-line bg-surface p-5">
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-faint">
                    Stored by the server
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {serverSees.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-[12.5px] text-ink-soft">
                        <span className="size-1 rounded-full bg-ink-faint" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-forest/10 bg-forest p-5 text-paper">
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-paper/55">
                    Never stored in plaintext
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {serverCannotSee.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-[12.5px] text-paper/85">
                        <LockKey size={12} className="text-accent" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="sm:col-span-2 text-[11px] leading-relaxed text-ink-faint">
                  This MVP does not claim zero-knowledge. The server still delivers the application
                  and could be compromised; encryption protects stored credential payloads, not a
                  compromised browser or device.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 lg:py-24">
          <div className="relative overflow-hidden rounded-[26px] border border-line-strong bg-surface p-8 sm:p-12 lg:p-14">
            <div className="pointer-events-none absolute -right-20 -top-24 size-[340px] rounded-full border border-line/80" aria-hidden="true" />
            <div className="pointer-events-none absolute -right-10 -top-12 size-[260px] rounded-full border border-line/60" aria-hidden="true" />
            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <Badge tone="accent">Private by default</Badge>
                <h2 className="mt-5 max-w-[18ch] text-[34px] font-semibold leading-[1.02] tracking-[-0.045em] text-ink sm:text-[44px]">
                  Put your logins under lock.
                </h2>
                <p className="mt-4 max-w-[44ch] text-[14px] leading-relaxed text-ink-soft">
                  Create a vault, add your first credential, then load the extension in Chrome or
                  Edge. Setup takes about two minutes.
                </p>
              </div>
              <Link href="/signup" className={buttonClass({ size: "lg" })}>
                Create your vault
                <ArrowRight size={16} weight="bold" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
