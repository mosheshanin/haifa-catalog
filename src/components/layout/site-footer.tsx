import Link from "next/link";
import { t } from "@/i18n/ru";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-3">
        <div>
          <p className="text-lg font-extrabold text-primary">{t.site.name}</p>
          <p className="mt-2 text-muted">{t.site.tagline}</p>
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
