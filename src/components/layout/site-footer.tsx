import Link from "next/link";
import { t } from "@/i18n/ru";
import { AddToHomeScreenButton } from "@/components/telegram/mini-app-chrome";
import { TelegramPromo } from "@/components/layout/telegram-promo";
import { LEGAL_PAGES } from "@/lib/legal";
import { CookieSettingsLink } from "@/components/legal/consent";

// «Проекты HBC» (3 ноября 2026): справа от логотипа, без подложек; логотипы серые, цветные при наведении
// (у клуба логотип одноцветный — при наведении он просто становится чётче). Файлы вырезаны из картинок заказчика.
const HBC_PROJECTS = [
  {
    href: "https://t.me/bismarketbot",
    logo: "/brand/projects/bmarket.webp",
    alt: "BMarket",
    caption: "Бизнес Маркет",
    w: 340,
    h: 96,
    imgClass: "h-8 w-auto rounded-lg",
  },
  {
    href: "https://www.facebook.com/groups/575429493787196",
    logo: "/brand/projects/haifabusinessclub.webp",
    alt: "#HaifaBusinessClub",
    caption: "Бизнес-встречи оффлайн",
    w: 518,
    h: 48,
    imgClass: "h-5 w-auto",
  },
];

export function SiteFooter() {
  return (
    // Отступ сверху большой: телефон из промо-блока выступает над подвалом (в Mini App блок скрыт, см. globals.css)
    <footer className="site-footer mt-28 border-t border-line bg-white md:mt-32">
      <TelegramPromo />
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 text-sm sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-12">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element -- векторный логотип */}
            <img src="/brand/hbc-lockup.svg" alt={t.site.name} width={85} height={36} className="h-9 w-auto rounded-xl" />
            <p className="mt-2 font-bold text-muted">#HaifaBusinessClub</p>
            <div className="mt-3 empty:hidden">
              <AddToHomeScreenButton />
            </div>
          </div>
          <nav aria-labelledby="hbc-projects">
            <p id="hbc-projects" className="text-xs font-bold text-muted">
              Проекты HBC
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-10 gap-y-5">
              {HBC_PROJECTS.map((p) => (
                <li key={p.href}>
                  <a href={p.href} target="_blank" rel="noopener noreferrer" className="group flex flex-col gap-2">
                    <span className="flex h-8 items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element -- маленький логотип */}
                      <img
                        src={p.logo}
                        alt={p.alt}
                        width={p.w}
                        height={p.h}
                        loading="lazy"
                        className={`${p.imgClass} opacity-70 grayscale transition duration-200 group-hover:opacity-100 group-hover:grayscale-0 group-focus-visible:opacity-100 group-focus-visible:grayscale-0`}
                      />
                    </span>
                    <span className="text-xs text-muted group-hover:text-ink">
                      {p.caption} <span aria-hidden="true">↗</span>
                      <span className="sr-only"> (откроется в новой вкладке)</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <Link
          href="/kabinet/novaya"
          className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap sm:self-start rounded-2xl bg-accent px-5 font-bold text-on-accent hover:bg-accent-hover max-[359px]:gap-1.5 max-[359px]:px-3 max-[359px]:text-[0.8125rem] lg:self-auto"
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
