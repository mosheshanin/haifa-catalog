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
