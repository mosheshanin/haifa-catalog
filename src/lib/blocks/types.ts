// Данные карточки: шапка и набор блоков (раздел 4 ТЗ).
// Каждый тип блока — отдельный модуль со своей схемой; в базе хранится как JSON в listing_versions.data.
// Новый тип блока добавляется здесь и в listing-view.tsx; база при этом не меняется.

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

// Исключения в часах работы: праздник, короткий день, санитарный день. Дата — по Израилю.
export type HoursException = { date: string; closed?: boolean; intervals?: HoursInterval[]; note?: string };

export type VideoItem = { provider: "youtube" | "vimeo"; videoId: string; title?: string };

export type TeamMember = { name: string; role?: string; photoUrl?: string; bio?: string; bookable?: boolean };

export type PortfolioItem = { title: string; description?: string; photos: string[]; price?: number; priceFrom?: boolean; duration?: string };

export type MenuTag = "veg" | "spicy";
export type MenuItem = { name: string; description?: string; price?: number; photoUrl?: string; tags?: MenuTag[] };
export type MenuSection = { title: string; items: MenuItem[] };
export type MenuFile = { title: string; url: string; kind: "pdf" | "image" };

export type ScheduleClass = {
  title: string;
  day: WeekdayKey;
  start: string; // "16:00"
  end: string;
  age?: string; // «5–7 лет»
  teacher?: string;
  price?: number;
  priceNote?: string; // «в месяц», «за занятие»
};

export type EventItem = {
  title: string;
  start: string; // местное время Израиля: "2026-11-20T18:00"
  end?: string;
  place?: string;
  description?: string;
  photoUrl?: string;
  registerUrl?: string;
  price?: number;
};

export type VacancyItem = {
  title: string;
  terms?: string; // график, оплата
  requirements?: string;
  contact?: string;
  postedAt: string; // "2026-10-25"
  validUntil?: string; // по умолчанию postedAt + 30 дней
};

export type NewsPost = { date: string; text: string; photoUrl?: string };

export type CertificateItem = { title: string; issuer?: string; year?: number; imageUrl?: string };

export type ListingBlock =
  | { id: string; type: "description"; hidden?: boolean; data: { text: string } }
  | { id: string; type: "address"; hidden?: boolean; data: { address: string; howToGet?: string; parking?: string; lat?: number; lng?: number } }
  | { id: string; type: "service_area"; hidden?: boolean; data: { districtSlugs: string[]; formats: Array<"at_home" | "on_site" | "online"> } }
  | {
      id: string;
      type: "hours";
      hidden?: boolean;
      data: { week: Partial<Record<WeekdayKey, HoursInterval[]>>; exceptions?: HoursException[]; note?: string };
    }
  | { id: string; type: "services"; hidden?: boolean; data: { groups: ServiceGroup[] } }
  | { id: string; type: "offers"; hidden?: boolean; data: { items: OfferItem[] } }
  | { id: string; type: "gallery"; hidden?: boolean; data: { photos: Array<{ url?: string; caption?: string }> } }
  | { id: string; type: "before_after"; hidden?: boolean; data: { pairs: Array<{ beforeUrl?: string; afterUrl?: string; caption?: string }> } }
  | { id: string; type: "faq"; hidden?: boolean; data: { items: FaqItem[] } }
  | { id: string; type: "features"; hidden?: boolean; data: { items: string[] } }
  | { id: string; type: "languages"; hidden?: boolean; data: { items: string[] } }
  | { id: string; type: "request"; hidden?: boolean; data: { enabled: boolean; withTime: boolean } }
  | { id: string; type: "video"; hidden?: boolean; data: { items: VideoItem[] } }
  | { id: string; type: "team"; hidden?: boolean; data: { members: TeamMember[] } }
  | { id: string; type: "portfolio"; hidden?: boolean; data: { items: PortfolioItem[] } }
  | { id: string; type: "menu"; hidden?: boolean; data: { sections: MenuSection[]; files?: MenuFile[] } }
  | { id: string; type: "schedule"; hidden?: boolean; data: { classes: ScheduleClass[]; note?: string } }
  | { id: string; type: "events"; hidden?: boolean; data: { items: EventItem[] } }
  | { id: string; type: "vacancies"; hidden?: boolean; data: { items: VacancyItem[] } }
  | { id: string; type: "news"; hidden?: boolean; data: { posts: NewsPost[] } }
  | { id: string; type: "certificates"; hidden?: boolean; data: { items: CertificateItem[] } };

export type BlockOf<T extends ListingBlock["type"]> = Extract<ListingBlock, { type: T }>;

// Вакансия без «актуально до» показывается 30 дней с публикации (раздел 4 ТЗ).
export const VACANCY_DEFAULT_DAYS = 30;

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
  video: "Видео",
  team: "Команда",
  portfolio: "Портфолио и кейсы",
  menu: "Меню",
  schedule: "Расписание занятий",
  events: "Мероприятия",
  vacancies: "Вакансии",
  news: "Новости",
  certificates: "Сертификаты и лицензии",
};
