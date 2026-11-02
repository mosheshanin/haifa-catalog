import Link from "next/link";
import { t } from "@/i18n/ru";
import { AddToHomeScreenButton } from "@/components/telegram/mini-app-chrome";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-3">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- векторный логотип */}
          <img src="/brand/hbc-lockup.svg" alt={t.site.name} width={85} height={36} className="h-9 w-auto rounded-xl" />
          <p className="mt-2 text-muted">{t.site.tagline}</p>
          <div className="mt-3 empty:hidden">
            <AddToHomeScreenButton />
          </div>
        </div>
        <nav className="flex flex-col gap-2" aria-label="Каталог">
          <Link href="/biznes" className="hover:text-primary">{t.nav.biznes}</Link>
          <Link href="/specialisty" className="hover:text-primary">{t.nav.specialisty}</Link>
          <Link href="/kabinet/novaya" className="hover:text-primary">{t.nav.addListing}</Link>
        </nav>
        <nav className="flex flex-col gap-2" aria-label="Документы">
          <span className="text-muted">Политика конфиденциальности — этап 5</span>
          <span className="text-muted">Условия использования — этап 5</span>
        </nav>
      </div>
    </footer>
  );
}
