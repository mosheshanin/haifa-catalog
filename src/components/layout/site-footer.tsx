import Link from "next/link";
import { t } from "@/i18n/ru";
import { AddToHomeScreenButton } from "@/components/telegram/mini-app-chrome";
import { TelegramPromo } from "@/components/layout/telegram-promo";
import { LEGAL_PAGES } from "@/lib/legal";
import { CookieSettingsLink } from "@/components/legal/consent";

export function SiteFooter() {
  return (
    // Отступ сверху большой: телефон из промо-блока выступает над подвалом (в Mini App блок скрыт, см. globals.css)
    <footer className="site-footer mt-36 border-t border-line bg-white md:mt-40">
      <TelegramPromo />
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 text-sm sm:grid-cols-2 sm:px-6">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- векторный логотип */}
          <img src="/brand/hbc-lockup.svg" alt={t.site.name} width={85} height={36} className="h-9 w-auto rounded-xl" />
          <p className="mt-2 text-muted">{t.site.tagline}</p>
          <div className="mt-3 empty:hidden">
            <AddToHomeScreenButton />
          </div>
        </div>
        <nav className="flex flex-col gap-2 sm:items-end" aria-label="Каталог">
          <Link href="/biznes" className="hover:text-primary">{t.nav.biznes}</Link>
          <Link href="/specialisty" className="hover:text-primary">{t.nav.specialisty}</Link>
          <Link href="/kabinet/novaya" className="hover:text-primary">{t.nav.addListing}</Link>
        </nav>
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
