// Список отметок «Особенностей» для карточки или фильтра (этап 5, вариант В аудита фильтров):
// свои отметки категории верхнего уровня (подкатегория берёт список родителя) + общие отметки раздела.
// Без серверных зависимостей: используется и в каталоге, и в редакторе карточки.

export type AmenityCategory = { id: number; parentId: number | null; amenities: string[] };

export function amenityList(categoryId: number | null | undefined, categories: AmenityCategory[], common: string[]): string[] {
  const cat = categories.find((c) => c.id === categoryId);
  const top = cat?.parentId ? categories.find((c) => c.id === cat.parentId) : cat;
  return [...new Set([...(top?.amenities ?? []), ...common])];
}

// Отметки в адресе: ?f=Кошерно&f=Терраса. Не больше 10, каждая до 60 знаков.
export function parseAmenities(v: string | string[] | undefined): string[] {
  const list = (Array.isArray(v) ? v : v ? [v] : []).map((x) => x.trim()).filter((x) => x && x.length <= 60);
  return [...new Set(list)].slice(0, 10);
}
