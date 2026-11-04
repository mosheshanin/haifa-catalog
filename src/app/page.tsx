import Link from "next/link";
import { SearchForm } from "@/components/search/search-form";
import { ShowMore } from "@/components/catalog/show-more";
import { ArrowRightIcon } from "@/components/icons";
import { Icon3d } from "@/components/ui/icon-3d";
import { OwnerReel } from "@/components/home/owner-reel";
import { HeroCutout } from "@/components/home/hero-cutout";
import { categoryIcon3d } from "@/lib/icons-3d";
import { getSectionCategories } from "@/lib/data/dictionaries";
import { nonEmptyCategories } from "@/lib/data/listings";
import { t } from "@/i18n/ru";
import { jsonLdScript, siteJsonLd } from "@/lib/seo/jsonld";
import { miniAppLink, siteUrl } from "@/lib/env";
import type { Section } from "@/lib/blocks/types";

// Заголовок блока на главной: заголовок, подзаголовок с воздухом между ними, ссылка «Все» справа.
function SectionHeading({ id, title, icon, lead, href }: { id: string; title: string; icon?: string; lead?: string; href?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 sm:mb-6">
      <div className="min-w-0">
        <h2 id={id} className="flex items-center gap-3 text-2xl font-extrabold leading-tight sm:text-[1.75rem]">
          {icon ? <Icon3d name={icon} size={44} className="-my-1.5" /> : null}
          {title}
        </h2>
        {/* Подзаголовок начинается вровень с текстом заголовка: иконка 44 px + промежуток 12 px */}
        {lead ? <p className={`mt-2 leading-relaxed text-muted ${icon ? "pl-14" : ""}`}>{lead}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 font-bold text-primary hover:bg-primary-soft">
          Все <ArrowRightIcon className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}

const MOBILE_TILES = 6;

async function CategoryGrid({ section }: { section: Section }) {
  // Только категории с карточками (правило 4 ноября 2026)
  const categories = await nonEmptyCategories(await getSectionCategories(section));
  if (!categories.length) return <p className="text-muted">{t.home.emptySection}</p>;
  return (
    // Три колонки на компьютере, две на планшете, одна на телефоне: названия помещаются, плитки не теснятся (2 ноября 2026).
    // На телефоне — первые 6 плиток и «Показать ещё».
    <ShowMore hiddenCount={Math.max(0, categories.length - MOBILE_TILES)}>
    <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      {categories.map((c, i) => (
        <li key={c.id} className={`min-w-0 ${i >= MOBILE_TILES ? "max-sm:group-data-[open=false]:hidden" : ""}`}>
          <Link
            href={`/${section}/${c.slug}`}
            className="group flex h-full min-h-[4.5rem] items-center gap-4 rounded-2xl border border-line bg-white px-4 py-3 font-bold leading-snug transition hover:border-primary hover:bg-primary-soft"
          >
            {/* 3D-иконка без подложки, чуть крупнее места под неё: объём читается лучше (3 ноября 2026) */}
            <span className="grid size-12 shrink-0 place-items-center" aria-hidden>
              <Icon3d name={categoryIcon3d(c)} size={54} fallback={c.icon ?? "📌"} className="drop-shadow-[0_6px_6px_rgba(20,20,20,0.2)] transition group-hover:-translate-y-0.5 motion-reduce:transition-none" />
            </span>
            <span className="min-w-0 flex-1 text-balance break-words">{c.name}</span>
            <ArrowRightIcon className="size-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        </li>
      ))}
    </ul>
    </ShowMore>
  );
}

export default async function HomePage() {
  const url = siteUrl();
  return (
    <div className="grid grid-cols-1 gap-12 sm:gap-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          siteJsonLd({
            url,
            name: t.site.brand,
            alternateName: t.site.name,
            description: t.site.description,
            logo: `${url}/brand/hbc-logo-512.png`,
            sameAs: [miniAppLink().replace(/\?startapp$/, "")],
          }),
        )}
      />
      {/* Первый экран. Вырез в углу (HeroCutout) рисуется поверх фона блока и не обрезается его скруглённым углом,
          поэтому у блока нет overflow-hidden, а жёлтое свечение лежит в своей обрезающей обёртке.
          Блок — @container: размер выреза и колонка текста зависят от его ширины (от 65rem — компьютерный вид,
          текст уже 37,5rem, форма крупная справа; меньше — форма над надписью, для неё оставлена полоса). */}
      <div className="@container relative isolate">
        <section className="relative rounded-[2rem] bg-primary px-6 py-10 text-white sm:px-12 sm:py-16">
          {/* Жёлтый отсвет на графите (палитра 3 ноября 2026) */}
          <div className="absolute inset-0 overflow-hidden rounded-[2rem]" aria-hidden>
            <div className="absolute -right-16 -top-16 size-64 rounded-full bg-[#facc15]/20 blur-2xl" />
          </div>
          <div className="relative z-10 max-w-2xl">
            <div aria-hidden className="h-[calc(min(45.5cqw,12.9rem)_-_2.5rem)] sm:h-[calc(min(45.5cqw,12.9rem)_-_4rem)] @[65rem]:hidden" />
            <div className="@[65rem]:max-w-[37.5rem]">
              <p className="font-bold text-highlight">{t.site.brand}</p>
              <h1 className="mt-3 text-3xl font-extrabold leading-tight text-balance sm:text-5xl sm:leading-[1.1]">{t.home.title}</h1>
              <p className="mt-4 text-lg leading-relaxed text-white/90">{t.home.lead}</p>
              <div className="mt-8">
                <SearchForm />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {/* В 3dicons нет зуба и весов: временно сердце и щит (решение 3 ноября 2026) */}
              {[["paint-brush", "Маникюр"], ["heart", "Стоматолог"], ["bulb", "Электрик"], ["notebook", "Репетитор"], ["sheild", "Юрист"]].map(([icon, q]) => (
                <Link key={q} href={`/poisk?q=${encodeURIComponent(q)}`} className="inline-flex items-center gap-2 rounded-full bg-white/15 py-1.5 pl-2 pr-3.5 text-sm font-semibold hover:bg-white/25">
                  <Icon3d name={icon} size={26} priority className="drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]" /> {q}
                </Link>
              ))}
            </div>
          </div>
        </section>
        <HeroCutout />
      </div>

      {(["biznes", "specialisty"] as const).map((section) => (
        <section key={section} aria-labelledby={`h-${section}`}>
          <SectionHeading id={`h-${section}`} title={t.sections[section].title} icon={section === "biznes" ? "chart" : "boy"} lead={t.sections[section].lead} href={`/${section}`} />
          <CategoryGrid section={section} />
        </section>
      ))}

      {/* Блок для владельцев (4 ноября 2026): сверху «монтаж» из пяти кадров, снизу неподвижные описание и кнопка.
          Всё, что движется, обрезано краями карточки (overflow-hidden); заголовок для скринридера — sr-only. */}
      <section aria-labelledby="h-owner" className="isolate overflow-hidden rounded-[2rem] border border-line bg-white">
        <OwnerReel frames={t.home.ownerReel} summary={t.home.ownerReelStatic} />
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10 sm:px-10 sm:py-8">
          <div className="min-w-0">
            <h2 id="h-owner" className="sr-only">{t.home.ownerCta}</h2>
            <p className="max-w-2xl leading-relaxed text-muted">{t.home.ownerCtaLead}</p>
          </div>
          <Link href="/kabinet/novaya" className="inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-accent px-5 font-bold text-on-accent hover:bg-accent-hover sm:w-auto sm:px-6">
            {t.home.ownerCtaButton} <ArrowRightIcon className="size-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
