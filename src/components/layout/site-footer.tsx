import Link from "next/link";
import { t } from "@/i18n/ru";
import { AddToHomeScreenButton } from "@/components/telegram/mini-app-chrome";
import { TelegramPromo } from "@/components/layout/telegram-promo";
import { LEGAL_PAGES } from "@/lib/legal";
import { CookieSettingsLink } from "@/components/legal/consent";

const HBC_PROJECTS = [
  {
    href: "https://t.me/bismarketbot",
    logo: "/brand/projects/bmarket.webp",
    alt: "BMarket",
    caption: "Бизнес Маркет",
    w: 340,
    h: 96,
    plate: "",
    imgClass: "h-12 w-auto",
  },
  {
    href: "https://www.facebook.com/groups/575429493787196",
    logo: "/brand/projects/haifabusinessclub-white.webp",
    alt: "#HaifaBusinessClub",
    caption: "Бизнес-встречи оффлайн",
    w: 518,
    h: 48,
    plate: "bg-primary px-4",
    imgClass: "h-5 w-auto",
  },
];

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
          className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-accent px-5 font-bold text-on-accent hover:bg-accent-hover max-[359px]:gap-1.5 max-[359px]:px-3 max-[359px]:text-[0.8125rem] sm:w-auto"
        >
          ➕ {t.nav.addListing}
        </Link>
      </div>
      {/* Проекты HBC (3 ноября 2026): логотипы вырезаны из картинок заказчика, файлы — public/brand/projects */}
      <section aria-labelledby="hbc-projects" className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <h2 id="hbc-projects" className="text-base font-bold">
            Проекты HBC
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-3xl">
            {HBC_PROJECTS.map((p) => (
              <li key={p.href} className="min-w-0">
                <a
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex h-full flex-col items-start gap-3 rounded-2xl border border-line p-4 hover:border-primary/40 hover:bg-surface-alt"
                >
                  <span className={`flex h-12 items-center overflow-hidden rounded-xl ${p.plate}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- маленький логотип, оптимизация не нужна */}
                    <img src={p.logo} alt={p.alt} width={p.w} height={p.h} loading="lazy" className={p.imgClass} />
                  </span>
                  <span className="text-sm text-muted group-hover:text-ink">
                    {p.caption} <span aria-hidden="true">↗</span>
                    <span className="sr-only"> (откроется в новой вкладке)</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
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
