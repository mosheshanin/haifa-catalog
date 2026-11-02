import Link from "next/link";
import { ListingListItem } from "@/components/listing/listing-list-item";
import { CatalogMap, type MapItem } from "@/components/catalog/catalog-map";
import { getCategories, getDistricts } from "@/lib/data/dictionaries";
import { PAGE_SIZE, getListingPoints, searchListings, type ListingSummary } from "@/lib/data/listings";
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
  if (f.atHome && l.formats.includes("at_home")) r.push(l.section === "biznes" ? "🚗 Выезд или доставка" : "🚗 Выезд к клиенту");
  if (f.onSite && l.formats.includes("on_site")) r.push("🏠 Приём у себя");
  if (f.online && l.formats.includes("online")) r.push("💻 Онлайн");
  if (l.has_offer && (f.hasOffer || f.q || district)) r.push("🎁 Есть акция");
  return r;
}

// На карте показываем до 100 найденных карточек сразу, без страниц.
const MAP_LIMIT = 100;

function ViewSwitch({ view, basePath, rawParams }: { view: "list" | "map"; basePath: string; rawParams: RawParams }) {
  const tab = (active: boolean) =>
    `inline-flex h-11 items-center gap-1.5 rounded-xl px-4 font-bold ${active ? "bg-primary text-white" : "text-ink hover:bg-primary-soft"}`;
  return (
    <nav aria-label="Вид" className="inline-flex w-fit gap-1 rounded-2xl border border-line bg-white p-1">
      <Link href={withParams(basePath, rawParams, { view: undefined })} aria-current={view === "list" ? "page" : undefined} className={tab(view === "list")} scroll={false}>
        📋 Список
      </Link>
      <Link href={withParams(basePath, rawParams, { view: "map", page: undefined })} aria-current={view === "map" ? "page" : undefined} className={tab(view === "map")} scroll={false}>
        🗺️ Карта
      </Link>
    </nav>
  );
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
  const isMap = filters.view === "map";
  const [items, categories, districts] = await Promise.all([
    searchListings(isMap ? { ...toSearch(filters, section, MAP_LIMIT), offset: 0 } : toSearch(filters, section, PAGE_SIZE)),
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

  const subtitleOf = (l: ListingSummary) => {
    const cat = l.category_id ? categoryById.get(l.category_id) : undefined;
    return l.section === "specialisty" && l.summary ? l.summary : (cat?.name ?? l.summary ?? "");
  };
  const districtLabelOf = (l: ListingSummary) => l.district_ids.map(districtName).filter(Boolean).slice(0, 2).join(", ");

  if (!items.length) {
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-white p-8 text-center">
        <p className="text-4xl" aria-hidden>🔍</p>
        <p className="mt-2 text-lg font-bold">Ничего не нашлось</p>
        <p className="mt-1 text-muted">Попробуйте убрать часть фильтров, выбрать соседний район или написать запрос по-другому.</p>
        {emptyAction ?? (
          <Link href="/kabinet/novaya" className="mt-4 inline-flex h-11 items-center whitespace-nowrap rounded-2xl bg-accent px-5 font-bold text-white hover:bg-accent-hover">
            ➕ {t.nav.addListingShort}
          </Link>
        )}
      </div>
    );
  }

  const pages = Math.ceil(total / PAGE_SIZE);

  let mapItems: MapItem[] = [];
  if (isMap) {
    const points = new Map((await getListingPoints(items.map((l) => l.id))).map((p) => [p.id, p]));
    mapItems = items.flatMap((l) => {
      const p = points.get(l.id);
      return p ? [{ ...l, lat: p.lat, lng: p.lng, subtitle: subtitleOf(l), districtLabel: districtLabelOf(l) }] : [];
    });
  }

  return (
    <div className="grid gap-4">
      <ViewSwitch view={filters.view} basePath={basePath} rawParams={rawParams} />
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
      {isMap ? (
        <CatalogMap items={mapItems} missing={items.length - mapItems.length} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((l) => (
            <ListingListItem
              key={l.id}
              listing={l}
              subtitle={subtitleOf(l)}
              districtLabel={districtLabelOf(l)}
              reasons={showReasons ? reasonsFor(l, filters, districtName, districtSlugToId) : []}
            />
          ))}
        </div>
      )}
      {!isMap && pages > 1 ? (
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
