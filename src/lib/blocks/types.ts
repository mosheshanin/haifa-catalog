// Данные карточки: шапка и набор блоков (раздел 4 ТЗ).
// Каждый тип блока — отдельный модуль со своей схемой; в базе хранится как JSON в listing_versions.data.
// На этапе 1 описаны основные блоки, остальные добавляются на этапе 2 без изменения базы.

export type Section = "biznes" | "specialisty";

export type WeekdayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export type HoursInterval = { open: string; close: string }; // "09:00" — "18:00", время Израиля

export type HeaderBlock = {
  title: string;
  slogan?: string;
  logoUrl?: string;
  coverUrl?: string;
  profession?: string; // для специалистов
  categoryId?: number;
  districtSlugs: string[];
  badges: Array<"verified" | "russian_speaking" | "documents_checked">;
};

export type ContactsBlock = {
  phone?: string;
  whatsapp?: string;
  telegram?: string; // имя пользователя без @
  email?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  youtube?: string;
};

export type ServiceItem = { name: string; description?: string; price?: number; priceFrom?: boolean; durationMin?: number };
export type ServiceGroup = { title: string; items: ServiceItem[] };

export type FaqItem = { q: string; a: string };

export type OfferItem = { title: string; description?: string; price?: number; discountPercent?: number; promoCode?: string; validUntil?: string };

export type ListingBlock =
  | { id: string; type: "description"; hidden?: boolean; data: { text: string } }
  | { id: string; type: "address"; hidden?: boolean; data: { address: string; howToGet?: string; parking?: string; lat?: number; lng?: number } }
  | { id: string; type: "service_area"; hidden?: boolean; data: { districtSlugs: string[]; formats: Array<"at_home" | "on_site" | "online"> } }
  | { id: string; type: "hours"; hidden?: boolean; data: { week: Partial<Record<WeekdayKey, HoursInterval[]>>; note?: string } }
  | { id: string; type: "services"; hidden?: boolean; data: { groups: ServiceGroup[] } }
  | { id: string; type: "offers"; hidden?: boolean; data: { items: OfferItem[] } }
  | { id: string; type: "gallery"; hidden?: boolean; data: { photos: Array<{ url?: string; caption?: string }> } }
  | { id: string; type: "before_after"; hidden?: boolean; data: { pairs: Array<{ beforeUrl?: string; afterUrl?: string; caption?: string }> } }
  | { id: string; type: "faq"; hidden?: boolean; data: { items: FaqItem[] } }
  | { id: string; type: "features"; hidden?: boolean; data: { items: string[] } }
  | { id: string; type: "languages"; hidden?: boolean; data: { items: string[] } }
  | { id: string; type: "request"; hidden?: boolean; data: { enabled: boolean; withTime: boolean } };

export type ListingData = {
  section: Section;
  header: HeaderBlock;
  contacts: ContactsBlock;
  blocks: ListingBlock[];
  confirmedAt?: string;
};

export const BLOCK_TITLES: Record<ListingBlock["type"], string> = {
  description: "Описание",
  address: "Адрес и карта",
  service_area: "Зона выезда",
  hours: "Часы работы",
  services: "Услуги и цены",
  offers: "Спецпредложения",
  gallery: "Галерея",
  before_after: "До и после",
  faq: "Вопросы и ответы",
  features: "Особенности",
  languages: "Языки",
  request: "Заявка и запись",
};
