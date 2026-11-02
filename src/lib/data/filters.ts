import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import { getCategories, type Category } from "@/lib/data/dictionaries";
import { filterConfig, mergeConfigs, type FilterConfig } from "@/lib/catalog/filter-config";
import type { CatalogFilters } from "@/lib/catalog/params";
import type { Section } from "@/lib/blocks/types";
import { getSiteSettings } from "@/lib/data/settings";
import { amenityList } from "@/lib/catalog/amenities";

// Что показать в форме фильтров: подпись фильтра или null, если его в этой категории нет или он ничего не найдёт.
// amenities — отметки «Особенностей», которые что-то найдут (список категории + общий список раздела, этап 5).
export type FilterAvailability = { open: boolean; home: string | null; site: string | null; online: string | null; kupa: boolean; offer: boolean; amenities: string[] };

type Stats = { at_home: number; on_site: number; online: number; kupa: number; with_hours: number; with_offer: number };
const ZERO: Stats = { at_home: 0, on_site: 0, online: 0, kupa: 0, with_hours: 0, with_offer: 0 };

async function stats(section: Section, categoryId: number | null): Promise<Stats> {
  "use cache";
  cacheTag("listings");
  cacheLife("minutes");
  const { data, error } = await createPublicClient().rpc("category_filter_stats", { p_section: section, p_category_id: categoryId });
  if (error) {
    console.warn("category_filter_stats:", error.message);
    return ZERO;
  }
  return ((data as Stats[] | null)?.[0] ?? ZERO) as Stats;
}

async function amenityCounts(section: Section, categoryId: number | null): Promise<Record<string, number>> {
  "use cache";
  cacheTag("listings");
  cacheLife("minutes");
  const { data, error } = await createPublicClient().rpc("category_amenity_counts", { p_section: section, p_category_id: categoryId });
  if (error) {
    console.warn("category_amenity_counts:", error.message);
    return {};
  }
  return Object.fromEntries(((data as Array<{ amenity: string; n: number }> | null) ?? []).map((r) => [r.amenity, r.n]));
}

const add = (a: Stats, b: Stats): Stats => ({
  at_home: a.at_home + b.at_home,
  on_site: a.on_site + b.on_site,
  online: a.online + b.online,
  kupa: a.kupa + b.kupa,
  with_hours: a.with_hours + b.with_hours,
  with_offer: a.with_offer + b.with_offer,
});

// Категория (или несколько — один адрес категории бывает в обоих разделах) → таблица фильтров + проверка, что фильтр что-то найдёт.
// Выбранный фильтр показываем всегда, чтобы его можно было снять.
export async function getFilterAvailability(
  scope: { section?: Section; category?: Category | null; categorySlug?: string },
  active: CatalogFilters,
): Promise<FilterAvailability> {
  const all = await getCategories();
  const slugOf = (id: number | null) => all.find((c) => c.id === id)?.slug ?? null;
  let targets: Array<{ section: Section; category: Category | null }>;
  if (scope.category) targets = [{ section: scope.category.section, category: scope.category }];
  else if (scope.categorySlug) {
    const found = all.filter((c) => c.slug === scope.categorySlug && (!scope.section || c.section === scope.section));
    targets = found.length ? found.map((c) => ({ section: c.section, category: c })) : [];
  } else targets = [];
  if (!targets.length) targets = (scope.section ? [scope.section] : (["biznes", "specialisty"] as Section[])).map((s) => ({ section: s, category: null }));

  const configs: FilterConfig[] = targets.map((t) =>
    filterConfig(t.section, t.category ? { slug: t.category.slug, parentSlug: slugOf(t.category.parent_id) } : null),
  );
  const cfg = mergeConfigs(configs);
  const st = (await Promise.all(targets.map((t) => stats(t.section, t.category?.id ?? null)))).reduce(add, ZERO);

  // «Особенности»: список категории + общий список раздела; показываем отметки, у которых есть карточки, и выбранные.
  const settings = await getSiteSettings();
  const cats = all.map((c) => ({ id: c.id, parentId: c.parent_id, amenities: c.amenities ?? [] }));
  const counts = await Promise.all(targets.map((t) => amenityCounts(t.section, t.category?.id ?? null)));
  const candidates = [
    ...new Set(
      targets.flatMap((t) =>
        amenityList(t.category?.id ?? null, cats, t.section === "specialisty" ? settings.amenitiesSpecialisty : settings.amenities),
      ),
    ),
  ];
  const amenities = [
    ...candidates.filter((a) => counts.some((c) => (c[a] ?? 0) > 0) || active.amenities.includes(a)),
    ...active.amenities.filter((a) => !candidates.includes(a)),
  ];
  return {
    open: (cfg.open && st.with_hours > 0) || active.openNow,
    home: (st.at_home > 0 || active.atHome ? cfg.home : null) ?? (active.atHome ? "🚗 Выезд" : null),
    site: (st.on_site > 0 || active.onSite ? cfg.site : null) ?? (active.onSite ? "🏠 Приём у себя" : null),
    online: (st.online > 0 || active.online ? cfg.online : null) ?? (active.online ? "💻 Онлайн" : null),
    kupa: (cfg.kupa && st.kupa > 0) || Boolean(active.kupa),
    offer: st.with_offer > 0 || active.hasOffer,
    amenities,
  };
}
