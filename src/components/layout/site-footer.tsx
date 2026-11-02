import Link from "next/link";
import { t } from "@/i18n/ru";
import { AddToHomeScreenButton } from "@/components/telegram/mini-app-chrome";
import { TelegramPromo } from "@/components/layout/telegram-promo";
import { LEGAL_PAGES } from "@/lib/legal";
import { CookieSettingsLink } from "@/components/legal/consent";

export function SiteFooter() {
  return (
    // Отступ сверху большой: телефон из промо-блока выступает над подвалом (в Mini App блок скрыт, см. globals.css)
    <footer className="site-footer mt-28 border-t border-line bg-white md:mt-32">
      <TelegramPromo />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- векторный логотип */}
          <img src="/brand/hbc-lockup.svg" alt={t.site.name} width={85} height={36} className="h-9 w-auto rounded-xl" />
          <p className="mt-2 font-bold text-muted">#HaifaBusinessClub</p>
          <div className="mt-3 empty:hidden">
            <AddToHomeScreenButton />
          </div>
        </div>
        <Link
          href="/kabinet/novaya"
          className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-accent px-5 font-bold text-white hover:bg-accent-hover max-[359px]:gap-1.5 max-[359px]:px-3 max-[359px]:text-[0.8125rem] sm:w-auto"
        >
          ➕ {t.nav.addListing}
        </Link>
      </div>
      {/* Документы — отдельной строкой внизу подвала (решение 2 ноября 2026, этап 5) */}
      <div className="border-t border-line">
        <nav aria-label="Документы" className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-4 text-xs text-muted sm:px-6">
          {LEGAL_PAGES.map((p) => (
            <Link key={p.href} href={p.href} className="hover:text-primary hover:underline">
              {p.title}
            </Link>
          ))}
          <CookieSettingsLink label="Настройки cookie" className="text-left hover:text-primary hover:underline" />
          <span className="sm:ml-auto">© 2026 {t.site.brand}</span>
        </nav>
      </div>
    </footer>
  );
}
