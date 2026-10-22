import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function MarketingFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-[34ch] text-[13px] leading-relaxed text-ink-soft">
            A small, encrypted vault for the logins you use every day. Built with Web Crypto and
            Postgres row-level security.
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">Product</p>
          <ul className="mt-4 space-y-2.5 text-[13px] text-ink-soft">
            <li>
              <a href="#how" className="hover:text-ink">
                How it works
              </a>
            </li>
            <li>
              <a href="#extension" className="hover:text-ink">
                Browser extension
              </a>
            </li>
            <li>
              <a href="#security" className="hover:text-ink">
                Security model
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">Account</p>
          <ul className="mt-4 space-y-2.5 text-[13px] text-ink-soft">
            <li>
              <Link href="/login" className="hover:text-ink">
                Sign in
              </Link>
            </li>
            <li>
              <Link href="/signup" className="hover:text-ink">
                Create your vault
              </Link>
            </li>
            <li>
              <Link href="/#security" className="hover:text-ink">
                Security notes
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-2 px-5 py-5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>Keyhold MVP</span>
          <span>Client-side encryption · No plaintext passwords stored</span>
        </div>
      </div>
    </footer>
  );
}
