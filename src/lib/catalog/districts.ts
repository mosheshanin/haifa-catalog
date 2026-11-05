// Районы карточки для показа (3 ноября 2026): если выбраны все районы Хайфы (kind = "haifa"), вместо длинного
// списка пишем «Вся Хайфа», пригороды — отдельно. В данных карточки хранятся настоящие районы, поэтому такая
// карточка находится в любом районе Хайфы и попадает на все страницы «категория + район».
// Список районов Хайфы передаётся в той же карте названий под служебным ключом, чтобы не менять подписи компонентов.

export const ALL_HAIFA = "Вся Хайфа";
const HAIFA_KEY = "__haifa__";

type District = { slug: string; name: string; kind?: string };

export function districtNameMap(list: District[]): Record<string, string> {
  const map: Record<string, string> = Object.fromEntries(list.map((d) => [d.slug, d.name]));
  map[HAIFA_KEY] = list.filter((d) => d.kind === "haifa").map((d) => d.slug).join(",");
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

// Район для заголовка, описания и картинки предпросмотра (5 ноября 2026): только если у карточки ровно один район.
// Если районов несколько или выбрана «Вся Хайфа», пишем просто «Хайфа» — иначе в превью попадал первый район из списка
// (например, «Адар» у специалиста, который работает по всему городу).
export function singleDistrictName(slugs: string[], list: District[]): string | undefined {
  if (slugs.length !== 1) return undefined;
  return list.find((d) => d.slug === slugs[0])?.name;
}
