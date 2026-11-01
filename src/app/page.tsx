import Link from "next/link";
import { SearchForm } from "@/components/search/search-form";
import { ListingListItem } from "@/components/listing/listing-list-item";
import { ArrowRightIcon, MapPinIcon } from "@/components/icons";
import { getCategories, getDistricts, getSectionCategories } from "@/lib/data/dictionaries";
import { searchListings, type ListingSummary } from "@/lib/data/listings";
import { t } from "@/i18n/ru";
import type { Section } from "@/lib/blocks/types";

async function CategoryGrid({ section }: { section: Section }) {
  const categories = await getSectionCategories(section);
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {categories.map((c) => (
        <li key={c.id}>
          <Link
            href={`/${section}/${c.slug}`}
            className="flex h-full min-h-16 items-center gap-3 rounded-2xl border border-line bg-white px-3 py-3 text-sm font-bold leading-snug hover:border-primary hover:bg-primary-soft"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-xl" aria-hidden>
              {c.icon ?? "📌"}
            </span>
            <span>{c.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ListingGrid({ items, districtName, categoryName }: { items: ListingSummary[]; districtName: (id: number) => string; categoryName: (id: number | null) => string }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
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
    <div className="grid gap-10">
      <section className="relative overflow-hidden rounded-[2rem] bg-primary px-5 py-10 text-white sm:px-10 sm:py-14">
        <div className="absolute -right-16 -top-16 size-64 rounded-full bg-highlight/25 blur-2xl" aria-hidden />
        <div className="relative max-w-2xl">
          <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl">{t.home.title}</h1>
          <p className="mt-3 text-lg text-white/90">{t.home.lead}</p>
          <div className="mt-6">
            <SearchForm />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[["💅", "Маникюр"], ["🦷", "Стоматолог"], ["💡", "Электрик"], ["📚", "Репетитор"], ["⚖️", "Юрист"]].map(([icon, q]) => (
              <Link key={q} href={`/poisk?q=${encodeURIComponent(q)}`} className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25">
                {icon} {q}
              </Link>
            ))}
            <Link href="/ryadom" className="inline-flex items-center gap-1 rounded-full bg-highlight px-3 py-1.5 text-sm font-bold text-ink">
              <MapPinIcon className="size-4" /> {t.search.nearMe}
            </Link>
          </div>
        </div>
      </section>

      {(["biznes", "specialisty"] as const).map((section) => (
        <section key={section} aria-labelledby={`h-${section}`}>
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 id={`h-${section}`} className="text-2xl font-extrabold">{section === "biznes" ? "🏢" : "👷"} {t.sections[section].title}</h2>
              <p className="text-muted">{t.sections[section].lead}</p>
            </div>
            <Link href={`/${section}`} className="hidden shrink-0 items-center gap-1 font-bold text-primary sm:inline-flex">
              Все <ArrowRightIcon className="size-4" />
            </Link>
          </div>
          <CategoryGrid section={section} />
        </section>
      ))}

      {withOffers.length ? (
        <section aria-labelledby="h-offers">
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2 id="h-offers" className="text-2xl font-extrabold">🎁 {t.home.offers}</h2>
            <Link href="/poisk?offer=1" className="inline-flex shrink-0 items-center gap-1 font-bold text-primary">
              Все <ArrowRightIcon className="size-4" />
            </Link>
          </div>
          <ListingGrid items={withOffers} districtName={districtName} categoryName={categoryName} />
        </section>
      ) : null}

      {newest.length ? (
        <section aria-labelledby="h-new">
          <h2 id="h-new" className="mb-3 text-2xl font-extrabold">✨ {t.home.newListings}</h2>
          <ListingGrid items={newest} districtName={districtName} categoryName={categoryName} />
        </section>
      ) : null}

      <section className="rounded-[2rem] border-2 border-dashed border-primary/30 bg-white p-6 sm:p-10">
        <h2 className="text-2xl font-extrabold">🙋 {t.home.ownerCta}</h2>
        <p className="mt-2 max-w-2xl text-muted">{t.home.ownerCtaLead}</p>
        <Link href="/kabinet" className="mt-5 inline-flex h-12 items-center gap-2 rounded-2xl bg-accent px-6 font-bold text-white hover:bg-accent-hover">
          {t.nav.addListing} <ArrowRightIcon className="size-5" />
        </Link>
      </section>
    </div>
  );
}
