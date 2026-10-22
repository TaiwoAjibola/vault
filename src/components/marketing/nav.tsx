import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonClass } from "@/components/ui/button";

export function MarketingNav() {
  return (
    <header className="relative z-30 border-b border-line/80">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="Keyhold home" className="rounded-lg">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-7 text-[13px] text-ink-soft md:flex" aria-label="Main">
          <a href="#how" className="transition-colors hover:text-ink">
            How it works
          </a>
          <a href="#extension" className="transition-colors hover:text-ink">
            Extension
          </a>
          <a href="#security" className="transition-colors hover:text-ink">
            Security
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className={buttonClass({ variant: "ghost", size: "sm", className: "hidden sm:inline-flex" })}
          >
            Sign in
          </Link>
          <Link href="/signup" className={buttonClass({ variant: "dark", size: "sm" })}>
            Create your vault
          </Link>
        </div>
      </div>
    </header>
  );
}
