// Районы карточки для показа (3 ноября 2026): если выбраны все районы Хайфы (kind = "haifa"), вместо длинного
// списка пишем «Вся Хайфа», пригороды — отдельно. В данных карточки хранятся настоящие районы, поэтому такая
// карточка находится в любом районе Хайфы и попадает на все страницы «категория + район».
// Список районов Хайфы передаётся в той же карте названий под служебным ключом, чтобы не менять подписи компонентов.

export const ALL_HAIFA = "Вся Хайфа";
const HAIFA_KEY = "__haifa__";
const SUBURBS_KEY = "__suburbs__"; // пригороды (kind = "suburb"), 7 ноября 2026
const ORDER_KEY = "__order__"; // порядок справочника: районы в карточке идут так же, как в списках

type District = { slug: string; name: string; kind?: string };

export function districtNameMap(list: District[]): Record<string, string> {
  const map: Record<string, string> = Object.fromEntries(list.map((d) => [d.slug, d.name]));
  map[HAIFA_KEY] = list.filter((d) => d.kind === "haifa").map((d) => d.slug).join(",");
  map[SUBURBS_KEY] = list.filter((d) => d.kind === "suburb").map((d) => d.slug).join(",");
  map[ORDER_KEY] = list.map((d) => d.slug).join(",");
  return map;
}

export function haifaSlugs(names: Record<string, string>): string[] {
  return (names[HAIFA_KEY] ?? "").split(",").filter(Boolean);
}

export function isAllHaifa(slugs: string[], haifa: string[]): boolean {
  return haifa.length > 0 && haifa.every((h) => slugs.includes(h));
}

export function districtLabels(slugs: string[], names: Record<string, string>): string[] {
  const haifa = haifaSlugs(names);
  if (isAllHaifa(slugs, haifa)) return [ALL_HAIFA, ...slugs.filter((s) => !haifa.includes(s)).map((s) => names[s] ?? s)];
  return slugs.map((s) => names[s] ?? s);
}

// Короткая подпись района в списках (карточки каталога, избранное, «Рядом», «Похожие», Telegram) — 6 ноября 2026.
// Раньше списки брали два первых района из `listings.district_ids` в порядке, в каком их сложила база, поэтому у
// всех, кто работает по всему городу, стояло «Ахуза, Неве-Шаанан». Теперь: районы идут в порядке справочника, все
// районы Хайфы сворачиваются в «Вся Хайфа», Хайфа вместе со всеми пригородами — в «Вся Хайфа и пригороды»,
// больше двух названий — «Адар, Ахуза и ещё 3». `list` — справочник районов (getDistricts), с `kind` и `sort`.
export const ALL_HAIFA_AND_SUBURBS = "Вся Хайфа и пригороды";

type DistrictRow = { id: number; name: string; kind?: string; sort?: number };

export function districtListParts(ids: Array<number | string> | null | undefined, list: DistrictRow[]): string[] {
  const own = new Set((ids ?? []).map(Number));
  const ordered = [...list].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const picked = ordered.filter((d) => own.has(d.id));
  if (!picked.length) return [];
  const haifa = ordered.filter((d) => d.kind === "haifa");
  if (!haifa.length || !haifa.every((d) => own.has(d.id))) return picked.map((d) => d.name);
  const suburbs = ordered.filter((d) => d.kind === "suburb");
  const pickedSuburbs = picked.filter((d) => d.kind !== "haifa");
  if (suburbs.length && suburbs.every((d) => own.has(d.id))) return [ALL_HAIFA_AND_SUBURBS];
  return [ALL_HAIFA, ...pickedSuburbs.map((d) => d.name)];
}

export function districtListLabel(ids: Array<number | string> | null | undefined, list: DistrictRow[], max = 2): string {
  const parts = districtListParts(ids, list);
  if (parts.length <= max) return parts.join(", ");
  return `${parts.slice(0, max).join(", ")} и ещё ${parts.length - max}`;
}

// Район для заголовка, описания и картинки предпросмотра (5 ноября 2026): только если у карточки ровно один район.
// Если районов несколько или выбрана «Вся Хайфа», пишем просто «Хайфа» — иначе в превью попадал первый район из списка
// (например, «Адар» у специалиста, который работает по всему городу).
export function singleDistrictName(slugs: string[], list: District[]): string | undefined {
  if (slugs.length !== 1) return undefined;
  return list.find((d) => d.slug === slugs[0])?.name;
}

// Районы на странице карточки (шапка, «Зона выезда», резюме внизу) — 7 ноября 2026. Сворачиваются так же, как в списках
// (districtListParts), но без «и ещё N»: «Вся Хайфа и пригороды», «Вся Хайфа, Нешер», «Адар, Ахуза, Хайфа», «Нешер, Тират-Кармель».
// Раньше шапка писала все районы и всегда добавляла «, Хайфа»: «Вся Хайфа, Кирьят-Бялик, … Кирьят-Тивон, Хайфа».
// «Хайфа» в конце — только когда все районы в самой Хайфе (а справочник это знает).
export function districtPlaceLabel(slugs: string[], names: Record<string, string>): string {
  const split = (k: string) => (names[k] ?? "").split(",").filter(Boolean);
  const haifa = split(HAIFA_KEY);
  const suburbs = split(SUBURBS_KEY);
  const order = split(ORDER_KEY);
  const pos = (s: string) => (order.indexOf(s) + 1 || order.length + 1);
  const picked = [...new Set(slugs)].sort((a, b) => pos(a) - pos(b));
  const name = (s: string) => names[s] ?? s;
  if (!picked.length) return "Хайфа";
  if (!haifa.length) return `${picked.map(name).join(", ")}, Хайфа`; // справочник без видов районов — как раньше
  if (isAllHaifa(picked, haifa)) {
    if (suburbs.length && suburbs.every((s) => picked.includes(s))) return ALL_HAIFA_AND_SUBURBS;
    return [ALL_HAIFA, ...picked.filter((s) => !haifa.includes(s)).map(name)].join(", ");
  }
  const list = picked.map(name).join(", ");
  return picked.every((s) => haifa.includes(s)) ? `${list}, Хайфа` : list;
}
