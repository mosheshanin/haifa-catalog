import type { SearchParams } from "@/lib/data/listings";
import type { Section } from "@/lib/blocks/types";
import { KUPOT_LIST } from "@/lib/catalog/filter-config";

// Фильтры живут в адресе страницы (раздел 5 ТЗ): ?q=…&district=…&lang=…&open=1&home=1&site=1&online=1&offer=1&kupa=…&sort=…&page=2&view=map
export type RawParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export const LANGUAGES = ["Русский", "Иврит", "Английский", "Арабский"] as const;
export const KUPOT = KUPOT_LIST;
export const SORTS = [
  { value: "relevance", label: "По релевантности" },
  { value: "rating", label: "По рейтингу" },
  { value: "new", label: "Сначала новые" },
] as const;

export type CatalogFilters = {
  q?: string;
  category?: string;
  district?: string;
  language?: string;
  openNow: boolean;
  atHome: boolean;
  onSite: boolean;
  online: boolean;
  hasOffer: boolean;
  kupa?: string;
  sort: "relevance" | "rating" | "new";
  page: number;
  view: "list" | "map";
};

export function parseFilters(sp: RawParams, fixed: { category?: string; district?: string } = {}): CatalogFilters {
  const sort = one(sp.sort);
  const page = Number(one(sp.page) ?? 1);
  const language = one(sp.lang);
  const kupa = one(sp.kupa);
  return {
    q: one(sp.q)?.slice(0, 120),
    category: fixed.category ?? one(sp.category),
    district: fixed.district ?? one(sp.district),
    language: LANGUAGES.includes(language as (typeof LANGUAGES)[number]) ? language : undefined,
    openNow: one(sp.open) === "1",
    atHome: one(sp.home) === "1",
    onSite: one(sp.site) === "1",
    online: one(sp.online) === "1",
    hasOffer: one(sp.offer) === "1",
    kupa: KUPOT.includes(kupa as (typeof KUPOT)[number]) ? kupa : undefined,
    sort: sort === "rating" || sort === "new" ? sort : "relevance",
    page: Number.isInteger(page) && page > 0 && page < 100 ? page : 1,
    view: one(sp.view) === "map" ? "map" : "list",
  };
}

export function toSearch(f: CatalogFilters, section: Section | undefined, pageSize: number): SearchParams {
  const formats = [f.atHome ? "at_home" : null, f.onSite ? "on_site" : null, f.online ? "online" : null].filter(Boolean) as string[];
  return {
    q: f.q,
    section,
    category: f.category,
    district: f.district,
    language: f.language,
    formats,
    hasOffer: f.hasOffer,
    kupa: f.kupa,
    openNow: f.openNow,
    sort: f.sort,
    limit: pageSize,
    offset: (f.page - 1) * pageSize,
  };
}

export function hasActiveFilters(f: CatalogFilters, fixed: { category?: string; district?: string } = {}) {
  return Boolean(
    f.q ||
      (f.category && f.category !== fixed.category) ||
      (f.district && f.district !== fixed.district) ||
      f.language ||
      f.openNow ||
      f.atHome ||
      f.onSite ||
      f.online ||
      f.hasOffer ||
      f.kupa ||
      f.sort !== "relevance",
  );
}

// Адрес следующей страницы с теми же фильтрами.
export function withParams(base: string, sp: RawParams, patch: Record<string, string | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = one(v);
    if (val) u.set(k, val);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v) u.set(k, v);
    else u.delete(k);
  }
  const s = u.toString();
  return s ? `${base}?${s}` : base;
}
