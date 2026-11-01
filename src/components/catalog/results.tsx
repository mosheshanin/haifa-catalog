import Link from "next/link";
import { ListingListItem } from "@/components/listing/listing-list-item";
import { getCategories, getDistricts } from "@/lib/data/dictionaries";
import { PAGE_SIZE, searchListings, type ListingSummary } from "@/lib/data/listings";
import { toSearch, withParams, type CatalogFilters, type RawParams } from "@/lib/catalog/params";
import { pluralRu } from "@/lib/format";
import { t } from "@/i18n/ru";
import type { Section } from "@/lib/blocks/types";

// Метки совпадений: коротко объясняют, почему карточка в результатах (идея из анализа Deloclub).
function reasonsFor(l: ListingSummary, f: CatalogFilters, districtName: (id: number) => string, districtSlugToId: Map<string, number>) {
  const r: string[] = [];
  const district = f.district ?? l.detected_district ?? undefined;
  if (district) {
    const id = districtSlugToId.get(district);
    if (id && l.district_ids.includes(id)) {
      r.push(l.formats.includes("at_home") ? `🚗 Выезжает: ${districtName(id)}` : `📍 ${districtName(id)}`);
    }
  }
  if (f.language && l.languages.includes(f.language)) r.push(`🗣️ ${f.language}`);
  else if ((f.q || district) && l.languages.includes("Русский")) r.push("🗣️ Говорят по-русски");
  if (f.atHome && l.formats.includes("at_home")) r.push("🚗 Выезд на дом");
  if (f.online && l.formats.includes("online")) r.push("💻 Онлайн");
  if (l.has_offer && (f.hasOffer || f.q || district)) r.push("🎁 Есть акция");
  return r;
}

export async function Results({
  filters,
  section,
  basePath,
  rawParams,
  showReasons = true,
  emptyAction,
}: {
  filters: CatalogFilters;
  section?: Section;
  basePath: string;
  rawParams: RawParams;
  showReasons?: boolean;
  emptyAction?: React.ReactNode;
}) {
  const [items, categories, districts] = await Promise.all([
    searchListings(toSearch(filters, section, PAGE_SIZE)),
    getCategories(),
    getDistricts(),
  ]);
  const total = items[0]?.total_count ?? 0;
  const districtById = new Map(districts.map((d) => [d.id, d.name]));
  const districtSlugToId = new Map(districts.map((d) => [d.slug, d.id]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const districtName = (id: number) => districtById.get(id) ?? "";
  const detectedDistrict = items[0]?.detected_district;
  const detectedCategory = items[0]?.detected_category;

  if (!items.length) {
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-white p-8 text-center">
        <p className="text-4xl" aria-hidden>🔍</p>
        <p className="mt-2 text-lg font-bold">Ничего не нашлось</p>
        <p className="mt-1 text-muted">Попробуйте убрать часть фильтров, выбрать соседний район или написать запрос по-другому.</p>
        {emptyAction ?? (
          <Link href="/kabinet" className="mt-4 inline-flex h-11 items-center rounded-2xl bg-accent px-5 font-bold text-white hover:bg-accent-hover">
            {t.nav.addListing}
          </Link>
        )}
      </div>
    );
  }

  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted">
        Найдено: <b className="text-ink">{total}</b> {pluralRu(total, "карточка", "карточки", "карточек")}
        {detectedCategory || detectedDistrict ? (
          <>
            {" · поняли запрос как "}
            {detectedCategory ? (
              <b className="text-ink">{categories.find((c) => c.slug === detectedCategory && c.section === (section ?? items[0].section))?.name}</b>
            ) : null}
            {detectedCategory && detectedDistrict ? " + " : null}
            {detectedDistrict ? <b className="text-ink">📍 {districts.find((d) => d.slug === detectedDistrict)?.name}</b> : null}
          </>
        ) : null}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((l) => {
          const cat = l.category_id ? categoryById.get(l.category_id) : undefined;
          return (
            <ListingListItem
              key={l.id}
              listing={l}
              subtitle={l.section === "specialisty" && l.summary ? l.summary : (cat?.name ?? l.summary ?? "")}
              districtLabel={l.district_ids.map(districtName).filter(Boolean).slice(0, 2).join(", ")}
              reasons={showReasons ? reasonsFor(l, filters, districtName, districtSlugToId) : []}
            />
          );
        })}
      </div>
      {pages > 1 ? (
        <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Страницы">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={withParams(basePath, rawParams, { page: p === 1 ? undefined : String(p) })}
              aria-current={p === filters.page ? "page" : undefined}
              className={`grid size-11 place-items-center rounded-xl border font-bold ${
                p === filters.page ? "border-primary bg-primary text-white" : "border-line bg-white hover:border-primary"
              }`}
            >
              {p}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

export function ResultsSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2" aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex gap-4 rounded-[var(--radius-card)] border border-line bg-white p-4">
          <div className="size-24 animate-pulse rounded-2xl bg-primary-soft" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-2/3 animate-pulse rounded bg-primary-soft" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-primary-soft" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-primary-soft" />
          </div>
        </div>
      ))}
    </div>
  );
}
