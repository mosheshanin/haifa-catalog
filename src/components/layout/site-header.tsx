import Link from "next/link";
import { UserMenu } from "@/components/auth/user-menu";
import { SearchForm } from "@/components/search/search-form";
import { t } from "@/i18n/ru";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-extrabold text-primary" aria-label={`${t.site.name} — ${t.nav.home}`}>
      <span className="grid size-9 place-items-center rounded-2xl bg-primary text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden>
          <path d="M3 21h18M5 21V10l7-6 7 6v11" strokeLinejoin="round" />
          <path d="M10 21v-5h4v5" />
        </svg>
      </span>
      <span className="text-xl tracking-tight">{t.site.name}</span>
      <span className="hidden rounded-full bg-highlight px-2 py-0.5 text-[11px] font-bold text-ink sm:inline">{t.site.city}</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Logo />
        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Разделы">
          <Link href="/biznes" className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-primary-soft">
            {t.nav.biznes}
          </Link>
          <Link href="/specialisty" className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-primary-soft">
            {t.nav.specialisty}
          </Link>
        </nav>
        <div className="ml-auto hidden w-full max-w-sm lg:block">
          <SearchForm compact />
        </div>
        <div className="ml-auto lg:ml-0">
          <UserMenu />
        </div>
      </div>
      <nav className="flex flex-wrap gap-1.5 px-4 pb-2 md:hidden" aria-label="Разделы">
        <Link href="/biznes" className="rounded-full bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary">
          🏢 {t.nav.biznes}
        </Link>
        <Link href="/specialisty" className="rounded-full bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary">
          👷 {t.nav.specialisty}
        </Link>
        <Link href="/poisk" className="rounded-full bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary">
          🔎 Поиск
        </Link>
      </nav>
    </header>
  );
}
