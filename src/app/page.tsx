import Link from "next/link";
import { SearchForm } from "@/components/search/search-form";
import { ListingListItem } from "@/components/listing/listing-list-item";
import { ArrowRightIcon, MapPinIcon } from "@/components/icons";
import { getCategories, getDistricts, getSectionCategories } from "@/lib/data/dictionaries";
import { searchListings, type ListingSummary } from "@/lib/data/listings";
import { t } from "@/i18n/ru";
import type { Section } from "@/lib/blocks/types";

// Заголовок блока на главной: заголовок, подзаголовок с воздухом между ними, ссылка «Все» справа.
function SectionHeading({ id, title, lead, href }: { id: string; title: string; lead?: string; href?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 sm:mb-6">
      <div className="min-w-0">
        <h2 id={id} className="text-2xl font-extrabold leading-tight sm:text-[1.75rem]">{title}</h2>
        {lead ? <p className="mt-2 leading-relaxed text-muted">{lead}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 font-bold text-primary hover:bg-primary-soft">
          Все <ArrowRightIcon className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}

async function CategoryGrid({ section }: { section: Section }) {
  const categories = await getSectionCategories(section);
  return (
    // Три колонки на компьютере, две на планшете, одна на телефоне: названия помещаются, плитки не теснятся (2 ноября 2026)
    <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      {categories.map((c) => (
        <li key={c.id} className="min-w-0">
          <Link
            href={`/${section}/${c.slug}`}
            className="group flex h-full min-h-[4.5rem] items-center gap-4 rounded-2xl border border-line bg-white px-4 py-3 font-bold leading-snug transition hover:border-primary hover:bg-primary-soft"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-2xl group-hover:bg-white" aria-hidden>
              {c.icon ?? "📌"}
            </span>
            <span className="min-w-0 flex-1 text-balance break-words">{c.name}</span>
            <ArrowRightIcon className="size-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ListingGrid({ items, districtName, categoryName }: { items: ListingSummary[]; districtName: (id: number) => string; categoryName: (id: number | null) => string }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((l) => (
        <ListingListItem
          key={l.id}
          listing={l}
          subtitle={l.section === "specialisty" && l.summary ? l.summary : categoryName(l.category_id)}
          districtLabel={l.district_ids.map(districtName).filter(Boolean).slice(0, 2).join(", ")}
        />
      ))}
    </div>
  );
}

export default async function HomePage() {
  const [districts, categories, withOffers, newest] = await Promise.all([
    getDistricts(),
    getCategories(),
    searchListings({ hasOffer: true, limit: 4 }),
    searchListings({ sort: "new", limit: 6 }),
  ]);
  const districtName = (id: number) => districts.find((d) => d.id === id)?.name ?? "";
  const categoryName = (id: number | null) => categories.find((c) => c.id === id)?.name ?? "";

  return (
    <div className="grid grid-cols-1 gap-12 sm:gap-16">
      <section className="relative overflow-hidden rounded-[2rem] bg-primary px-6 py-10 text-white sm:px-12 sm:py-16">
        {/* Светлый отсвет того же синего: жёлтый на тёмно-синем давал грязное коричневое пятно */}
        <div className="absolute -right-16 -top-16 size-64 rounded-full bg-[#6366f1]/35 blur-2xl" aria-hidden />
        <div className="relative max-w-2xl">
          <h1 className="text-3xl font-extrabold leading-tight text-balance sm:text-5xl sm:leading-[1.1]">{t.home.title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-white/90">{t.home.lead}</p>
          <div className="mt-8">
            <SearchForm />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {[["💅", "Маникюр"], ["🦷", "Стоматолог"], ["💡", "Электрик"], ["📚", "Репетитор"], ["⚖️", "Юрист"]].map(([icon, q]) => (
              <Link key={q} href={`/poisk?q=${encodeURIComponent(q)}`} className="rounded-full bg-white/15 px-3.5 py-2 text-sm font-semibold hover:bg-white/25">
                {icon} {q}
              </Link>
            ))}
            <Link href="/ryadom" className="inline-flex items-center gap-1 rounded-full bg-highlight px-3.5 py-2 text-sm font-bold text-ink">
              <MapPinIcon className="size-4" /> {t.search.nearMe}
            </Link>
          </div>
        </div>
      </section>

      {(["biznes", "specialisty"] as const).map((section) => (
        <section key={section} aria-labelledby={`h-${section}`}>
          <SectionHeading id={`h-${section}`} title={`${section === "biznes" ? "🏢" : "👷"} ${t.sections[section].title}`} lead={t.sections[section].lead} href={`/${section}`} />
          <CategoryGrid section={section} />
        </section>
      ))}

      {withOffers.length ? (
        <section aria-labelledby="h-offers">
          <SectionHeading id="h-offers" title={`🎁 ${t.home.offers}`} href="/poisk?offer=1" />
          <ListingGrid items={withOffers} districtName={districtName} categoryName={categoryName} />
        </section>
      ) : null}

      {newest.length ? (
        <section aria-labelledby="h-new">
          <SectionHeading id="h-new" title={`✨ ${t.home.newListings}`} />
          <ListingGrid items={newest} districtName={districtName} categoryName={categoryName} />
        </section>
      ) : null}

      <section className="rounded-[2rem] border-2 border-dashed border-primary/30 bg-white p-6 sm:p-12">
        <h2 className="text-xl font-extrabold leading-snug text-balance sm:text-2xl">🙋 {t.home.ownerCta}</h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted">{t.home.ownerCtaLead}</p>
        <Link href="/kabinet/novaya" className="mt-6 inline-flex h-12 items-center gap-2 whitespace-nowrap rounded-2xl bg-accent px-6 font-bold text-white hover:bg-accent-hover">
          {t.home.ownerCtaButton} <ArrowRightIcon className="size-5" />
        </Link>
      </section>
    </div>
  );
}
