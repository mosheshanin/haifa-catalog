// Какие фильтры есть в категории и как они называются (аудит фильтров, вариант Б, решение 2 ноября 2026, раздел 5 ТЗ).
// Район, язык, «Есть акция» и сортировка — везде. Остальное — по таблице ниже; кроме того, фильтр прячется, если
// в категории нет ни одной карточки с такой отметкой (см. getFilterAvailability).
// Используется и в каталоге (сервер), и в редакторе карточки (браузер), поэтому без серверных зависимостей.

import type { Section } from "@/lib/blocks/types";

export type FilterConfig = {
  open: boolean; // «Открыто сейчас» — где есть часы работы
  home: string | null; // формат at_home: «Выезд на дом», «Доставка», «Визит на дом»…
  site: string | null; // формат on_site: «Приём у себя»
  online: string | null; // формат online
  kupa: boolean; // больничная касса
  places: PlaceLabels; // как называть форматы работы в редакторе, мастере и на карточке (всегда все три)
};

// Подписи форматов работы специалиста (блок «Зона выезда») и формата «выезд» у бизнесов. Фильтр каталога может
// называть их короче или не показываться вовсе (поля home/site/online выше), а здесь подписи есть всегда.
export type PlaceLabels = {
  home: string; // формат at_home
  site: string; // формат on_site
  online: string; // формат online
  title: string; // заголовок блока на карточке и в редакторе
  area: string; // поле районов
  reach: string; // начало метки совпадения в списке: «🚗 Выезжает: Адар»
  hint: string; // подсказка шага «Как и где вы работаете?» в мастере
};

export const DEFAULT_PLACES: PlaceLabels = {
  home: "🚗 Выезд на дом",
  site: "🏠 Приём у себя",
  online: "💻 Онлайн",
  title: "Зона выезда",
  area: "Районы выезда",
  reach: "🚗 Выезжает",
  hint: "Выезжаете к клиентам, принимаете у себя или работаете онлайн.",
};

// Для специалистов, которые работают с бизнесом и документами, «выезд на дом» и «приём у себя» звучат странно:
// это встреча у клиента и встреча в своём офисе (решение заказчика 4 ноября 2026). Формат в базе тот же —
// фильтры и поиск не меняются.
const MEET_CLIENT = "🤝 Встреча у клиента";
const MEET_OFFICE = "🏢 Встреча в своём офисе";
const OFFICE_PLACES: PlaceLabels = {
  home: MEET_CLIENT,
  site: MEET_OFFICE,
  online: "💻 Онлайн",
  title: "Где можно встретиться",
  area: "Где можете встретиться",
  reach: "🤝 Встречи",
  hint: "Встречаетесь у клиента, в своём офисе или работаете онлайн.",
};

const NONE: FilterConfig = { open: false, home: null, site: null, online: null, kupa: false, places: DEFAULT_PLACES };

const HOME = "🚗 Выезд на дом";
const CLIENT = "🚗 Выезд к клиенту";
const DELIVERY = "🛵 Доставка";
const ONLINE = "💻 Онлайн";

// Ключ — «раздел/slug категории верхнего уровня».
const BY_CATEGORY: Record<string, Partial<FilterConfig>> = {
  "biznes/eda": { open: true, home: DELIVERY },
  "biznes/krasota": { open: true },
  "biznes/zdorovye": { open: true, kupa: true, online: "💻 Онлайн-консультация" },
  "biznes/dom-i-remont": { open: true, home: CLIENT },
  "biznes/avto": { open: true, home: CLIENT },
  "biznes/obrazovanie": { online: ONLINE },
  "biznes/magaziny": { open: true, home: DELIVERY, online: "🛒 Заказ онлайн" },
  "biznes/yuridicheskie-uslugi": { open: true, online: ONLINE },
  "biznes/nedvizhimost": { open: true },
  "biznes/dosug": { open: true },
  "biznes/turistam": { open: true },
  "biznes/uslugi-dlya-biznesa": { open: true, home: MEET_CLIENT, online: ONLINE, places: OFFICE_PLACES }, // 3 ноября 2026
  "specialisty/vrachi-i-psihologi": { kupa: true, home: "🏠 Визит на дом", online: ONLINE },
  "specialisty/krasota": { home: HOME, site: "🏠 Приём у себя" },
  "specialisty/repetitory": { home: "🚗 Приезжает к ученику", online: ONLINE },
  "specialisty/yuristy-i-buhgaltery": { home: MEET_CLIENT, site: MEET_OFFICE, online: ONLINE, places: OFFICE_PLACES },
  "specialisty/uslugi-dlya-biznesa": { home: MEET_CLIENT, site: MEET_OFFICE, online: ONLINE, places: OFFICE_PLACES }, // 3 ноября 2026
  // Мастера, переезды, няни, фото и видео выезжают все — фильтр «выезд» там ничего не отбирает.
  "specialisty/mastera": {},
  "specialisty/pereezdy": {},
  "specialisty/nyani-i-sidelki": {},
  "specialisty/foto-video-vedushchie": {},
  "specialisty/it-i-dizayn": { home: MEET_CLIENT, site: MEET_OFFICE, online: ONLINE, places: OFFICE_PLACES },
  "specialisty/dokumenty-i-repatriaciya": { home: MEET_CLIENT, site: MEET_OFFICE, online: ONLINE, places: OFFICE_PLACES },
};

// Исключения для подкатегорий: «раздел/slug подкатегории».
const BY_SUBCATEGORY: Record<string, Partial<FilterConfig>> = {
  "biznes/veterinariya": { kupa: false },
  "specialisty/logopedy": { kupa: true },
};

// Раздел целиком или поиск без категории: всё, кроме больничной кассы, с общими названиями.
const GENERIC: Record<Section, FilterConfig> = {
  biznes: { open: true, home: "🚗 Выезд или доставка", site: null, online: ONLINE, kupa: false, places: DEFAULT_PLACES },
  specialisty: { open: false, home: CLIENT, site: "🏠 Приём у себя", online: ONLINE, kupa: false, places: DEFAULT_PLACES },
};

export type CategoryRef = { slug: string; parentSlug?: string | null };

export function filterConfig(section: Section, category?: CategoryRef | null): FilterConfig {
  if (!category) return GENERIC[section];
  const top = category.parentSlug ?? category.slug;
  const base = BY_CATEGORY[`${section}/${top}`];
  if (!base) return GENERIC[section];
  const sub = category.parentSlug ? BY_SUBCATEGORY[`${section}/${category.slug}`] : undefined;
  return { ...NONE, ...base, ...sub };
}

// Объединение нескольких категорий (поиск, где один slug есть в обоих разделах).
export function mergeConfigs(list: FilterConfig[]): FilterConfig {
  if (!list.length) return NONE;
  return list.reduce((a, b) => ({
    open: a.open || b.open,
    home: a.home ?? b.home,
    site: a.site ?? b.site,
    online: a.online ?? b.online,
    kupa: a.kupa || b.kupa,
    places: a.places,
  }));
}

export const KUPOT_LIST = ["Клалит", "Маккаби", "Меухедет", "Леумит"] as const;
