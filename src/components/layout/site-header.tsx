import Link from "next/link";
import { Icon3d } from "@/components/ui/icon-3d";
import { UserMenu } from "@/components/auth/user-menu";
import { SearchForm } from "@/components/search/search-form";
import { t } from "@/i18n/ru";

// Логотип заказчика (public/brand/hbc-logo.svg); в шапке — горизонтальная плашка из того же рисунка.
export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={`${t.site.name} — ${t.nav.home}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- векторный логотип, оптимизация не нужна */}
      <img src="/brand/hbc-lockup.svg" alt="" width={85} height={36} className="h-9 w-auto rounded-xl" />
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Logo />
        <nav className="ml-2 hidden shrink-0 items-center gap-1 md:flex" aria-label="Разделы">
          <Link href="/biznes" className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold hover:bg-primary-soft">
            {t.nav.biznes}
          </Link>
          <Link href="/specialisty" className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold hover:bg-primary-soft">
            {t.nav.specialisty}
          </Link>
        </nav>
        {/* Поиск сжимается первым, чтобы пункты справа не ломались на две строки */}
        <div className="ml-auto hidden min-w-40 max-w-sm flex-1 lg:block">
          <SearchForm compact />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1 lg:ml-0">
          {/* Поиск — значком в верхней строке: три пункта в нижней строке на телефоне не помещались в одну линию */}
          <Link href="/poisk" className="grid size-10 place-items-center rounded-full text-xl hover:bg-primary-soft lg:hidden" aria-label="Поиск" title="Поиск">
            🔎
          </Link>
          <Link href="/izbrannoe" className="grid size-10 place-items-center rounded-full text-xl hover:bg-primary-soft" aria-label={t.nav.favorites} title={t.nav.favorites}>
            ❤️
          </Link>
          <UserMenu />
        </div>
      </div>
      <nav className="flex flex-wrap gap-1.5 px-4 pb-2 md:hidden" aria-label="Разделы">
        <Link href="/biznes" className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-soft py-1 pl-1.5 pr-3 text-sm font-semibold text-primary">
          <Icon3d name="chart" size={22} priority /> {t.nav.biznes}
        </Link>
        <Link href="/specialisty" className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-soft py-1 pl-1.5 pr-3 text-sm font-semibold text-primary">
          <Icon3d name="boy" size={22} priority /> {t.nav.specialisty}
        </Link>
      </nav>
    </header>
  );
}
