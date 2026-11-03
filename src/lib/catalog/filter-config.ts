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
};

const NONE: FilterConfig = { open: false, home: null, site: null, online: null, kupa: false };

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
  "biznes/uslugi-dlya-biznesa": { open: true, home: CLIENT, online: ONLINE }, // 3 ноября 2026
  "specialisty/vrachi-i-psihologi": { kupa: true, home: "🏠 Визит на дом", online: ONLINE },
  "specialisty/krasota": { home: HOME, site: "🏠 Приём у себя" },
  "specialisty/repetitory": { home: "🚗 Приезжает к ученику", online: ONLINE },
  "specialisty/yuristy-i-buhgaltery": { online: ONLINE },
  // Мастера, переезды, няни, фото и видео выезжают все — фильтр «выезд» там ничего не отбирает.
  "specialisty/mastera": {},
  "specialisty/pereezdy": {},
  "specialisty/nyani-i-sidelki": {},
  "specialisty/foto-video-vedushchie": {},
  "specialisty/it-i-dizayn": { home: "🚗 Выезд", online: ONLINE },
  "specialisty/dokumenty-i-repatriaciya": { online: ONLINE },
};

// Исключения для подкатегорий: «раздел/slug подкатегории».
const BY_SUBCATEGORY: Record<string, Partial<FilterConfig>> = {
  "biznes/veterinariya": { kupa: false },
  "specialisty/logopedy": { kupa: true },
};

// Раздел целиком или поиск без категории: всё, кроме больничной кассы, с общими названиями.
const GENERIC: Record<Section, FilterConfig> = {
  biznes: { open: true, home: "🚗 Выезд или доставка", site: null, online: ONLINE, kupa: false },
  specialisty: { open: false, home: CLIENT, site: "🏠 Приём у себя", online: ONLINE, kupa: false },
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
  }));
}

export const KUPOT_LIST = ["Клалит", "Маккаби", "Меухедет", "Леумит"] as const;
