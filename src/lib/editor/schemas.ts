import type { Limits, ListingBlock } from "@/lib/blocks/types";

// Описание полей редактора для каждого блока карточки (раздел 4 ТЗ). Редактор строит формы по этим схемам,
// поэтому новый блок = тип в types.ts + схема здесь + отображение в listing-view.tsx + проверка в sanitize.ts.

export type Option = { value: string; label: string };
export type Field =
  | { k: string; label: string; type: "text" | "url" | "email" | "tel"; placeholder?: string; max?: number; help?: string; required?: boolean }
  | { k: string; label: string; type: "textarea"; rows?: number; max?: number; placeholder?: string; help?: string; required?: boolean }
  | { k: string; label: string; type: "number"; min?: number; max?: number; step?: number; suffix?: string }
  | { k: string; label: string; type: "date" | "datetime" | "time"; help?: string; required?: boolean }
  | { k: string; label: string; type: "checkbox"; help?: string }
  | { k: string; label: string; type: "select"; options: Option[] | "districts" | "days"; required?: boolean }
  | { k: string; label: string; type: "multiselect"; options: Option[] | "districts" | "amenities" | "languages" }
  | { k: string; label: string; type: "photo"; help?: string }
  | { k: string; label: string; type: "photos"; max: number | keyof Limits }
  | { k: string; label: string; type: "file"; help?: string }
  | { k: string; label: string; type: "video" }
  | { k: string; label: string; type: "list"; item: Field[]; max: number | keyof Limits; addLabel: string; titleKey?: string; defaults?: Record<string, unknown> }
  | { k: string; label: string; type: "hours" }
  | { k: string; label: string; type: "geocode" };

export const DAYS: Option[] = [
  { value: "sun", label: "Воскресенье" },
  { value: "mon", label: "Понедельник" },
  { value: "tue", label: "Вторник" },
  { value: "wed", label: "Среда" },
  { value: "thu", label: "Четверг" },
  { value: "fri", label: "Пятница" },
  { value: "sat", label: "Суббота" },
];

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });

export const BLOCK_SCHEMAS: Record<ListingBlock["type"], Field[]> = {
  description: [{ k: "text", label: "Текст", type: "textarea", rows: 7, max: 5000, required: true, help: "Кто вы, чем занимаетесь, чем отличаетесь. Без ссылок и рекламы конкурентов." }],
  address: [
    { k: "address", label: "Адрес", type: "text", max: 200, placeholder: "ул. Герцль, 10, Хайфа", required: true },
    { k: "geo", label: "Метка на карте", type: "geocode" },
    { k: "howToGet", label: "Как добраться", type: "text", max: 300, placeholder: "5 минут от остановки «Герцль»" },
    { k: "parking", label: "Парковка", type: "text", max: 200, placeholder: "Бесплатная во дворе" },
  ],
  service_area: [
    { k: "formats", label: "Как работаете", type: "multiselect", options: [
      { value: "at_home", label: "🚗 Выезд на дом" },
      { value: "on_site", label: "🏠 Приём у себя" },
      { value: "online", label: "💻 Онлайн" },
    ] },
    { k: "districtSlugs", label: "Районы выезда", type: "multiselect", options: "districts" },
  ],
  hours: [
    { k: "week", label: "Расписание", type: "hours" },
    { k: "note", label: "Примечание", type: "text", max: 200, placeholder: "В субботу закрыто" },
  ],
  services: [
    {
      k: "groups",
      label: "Группы услуг",
      type: "list",
      max: 20,
      addLabel: "Добавить группу",
      titleKey: "title",
      defaults: { title: "Услуги", items: [] },
      item: [
        { k: "title", label: "Название группы", type: "text", max: 100 },
        {
          k: "items",
          label: "Услуги",
          type: "list",
          max: "listItems",
          addLabel: "Добавить услугу",
          titleKey: "name",
          item: [
            { k: "name", label: "Услуга", type: "text", max: 150, required: true },
            { k: "description", label: "Описание", type: "text", max: 300 },
            { k: "price", label: "Цена", type: "number", min: 0, suffix: "₪" },
            { k: "priceFrom", label: "Цена «от»", type: "checkbox" },
            { k: "durationMin", label: "Длительность", type: "number", min: 1, max: 1440, suffix: "мин" },
          ],
        },
      ],
    },
  ],
  offers: [
    {
      k: "items",
      label: "Спецпредложения",
      type: "list",
      max: 20,
      addLabel: "Добавить предложение",
      titleKey: "title",
      item: [
        { k: "title", label: "Заголовок", type: "text", max: 150, required: true },
        { k: "description", label: "Описание", type: "text", max: 400 },
        { k: "price", label: "Цена", type: "number", min: 0, suffix: "₪" },
        { k: "discountPercent", label: "Скидка", type: "number", min: 1, max: 100, suffix: "%" },
        { k: "promoCode", label: "Промокод", type: "text", max: 30 },
        { k: "validUntil", label: "Действует до", type: "date", help: "После этой даты предложение скроется само" },
      ],
    },
  ],
  gallery: [
    { k: "photos", label: "Фото", type: "list", max: "gallery", addLabel: "Добавить фото", titleKey: "caption", item: [
      { k: "url", label: "Фото", type: "photo" },
      { k: "caption", label: "Подпись", type: "text", max: 150 },
    ] },
  ],
  before_after: [
    { k: "pairs", label: "Пары фото", type: "list", max: "before_after", addLabel: "Добавить пару", titleKey: "caption", item: [
      { k: "beforeUrl", label: "До", type: "photo" },
      { k: "afterUrl", label: "После", type: "photo" },
      { k: "caption", label: "Подпись", type: "text", max: 150 },
    ] },
  ],
  faq: [
    { k: "items", label: "Вопросы", type: "list", max: 50, addLabel: "Добавить вопрос", titleKey: "q", item: [
      { k: "q", label: "Вопрос", type: "text", max: 300, required: true },
      { k: "a", label: "Ответ", type: "textarea", rows: 3, max: 2000, required: true },
    ] },
  ],
  features: [{ k: "items", label: "Особенности", type: "multiselect", options: "amenities" }],
  languages: [{ k: "items", label: "Языки общения", type: "multiselect", options: "languages" }],
  request: [
    { k: "enabled", label: "Принимать заявки с карточки", type: "checkbox" },
    { k: "withTime", label: "Спрашивать желаемые день и время (простая запись)", type: "checkbox" },
  ],
  video: [
    { k: "items", label: "Видео", type: "list", max: 10, addLabel: "Добавить видео", titleKey: "title", item: [
      { k: "video", label: "Ссылка на YouTube или Vimeo", type: "video" },
      { k: "title", label: "Название", type: "text", max: 150 },
    ] },
  ],
  team: [
    { k: "members", label: "Сотрудники", type: "list", max: "team", addLabel: "Добавить сотрудника", titleKey: "name", item: [
      { k: "name", label: "Имя", type: "text", max: 80, required: true },
      { k: "role", label: "Должность", type: "text", max: 100 },
      { k: "photoUrl", label: "Фото", type: "photo" },
      { k: "bio", label: "Коротко о себе", type: "textarea", rows: 2, max: 300 },
      { k: "bookable", label: "Можно записаться к этому мастеру", type: "checkbox" },
    ] },
  ],
  portfolio: [
    { k: "items", label: "Работы", type: "list", max: "portfolio", addLabel: "Добавить работу", titleKey: "title", item: [
      { k: "title", label: "Название", type: "text", max: 150, required: true },
      { k: "photos", label: "Фото", type: "photos", max: "portfolioPhotos" },
      { k: "description", label: "Описание", type: "textarea", rows: 3, max: 1000 },
      { k: "price", label: "Цена", type: "number", min: 0, suffix: "₪" },
      { k: "priceFrom", label: "Цена «от»", type: "checkbox" },
      { k: "duration", label: "Срок", type: "text", max: 50, placeholder: "2 часа" },
    ] },
  ],
  menu: [
    {
      k: "sections",
      label: "Разделы меню",
      type: "list",
      max: 30,
      addLabel: "Добавить раздел",
      titleKey: "title",
      defaults: { title: "Раздел", items: [] },
      item: [
        { k: "title", label: "Раздел", type: "text", max: 100 },
        { k: "items", label: "Блюда", type: "list", max: "listItems", addLabel: "Добавить блюдо", titleKey: "name", item: [
          { k: "name", label: "Название", type: "text", max: 150, required: true },
          { k: "description", label: "Описание", type: "text", max: 300 },
          { k: "price", label: "Цена", type: "number", min: 0, suffix: "₪" },
          { k: "photoUrl", label: "Фото", type: "photo" },
          { k: "tags", label: "Отметки", type: "multiselect", options: [
            { value: "veg", label: "🌱 Вегетарианское" },
            { value: "spicy", label: "🌶️ Острое" },
          ] },
        ] },
      ],
    },
    { k: "files", label: "Файлы меню (фото страниц или PDF)", type: "list", max: "menuFiles", addLabel: "Добавить файл", titleKey: "title", item: [
      { k: "title", label: "Название", type: "text", max: 100 },
      { k: "url", label: "Файл", type: "file", help: "PDF до 10 МБ или фото" },
    ] },
  ],
  schedule: [
    { k: "classes", label: "Занятия", type: "list", max: "listItems", addLabel: "Добавить занятие", titleKey: "title", defaults: { day: "sun", start: "16:00", end: "17:00" }, item: [
      { k: "title", label: "Занятие", type: "text", max: 150, required: true },
      { k: "day", label: "День", type: "select", options: "days", required: true },
      { k: "start", label: "Начало", type: "time", required: true },
      { k: "end", label: "Конец", type: "time", required: true },
      { k: "age", label: "Возраст", type: "text", max: 40, placeholder: "5–7 лет" },
      { k: "teacher", label: "Преподаватель", type: "text", max: 80 },
      { k: "price", label: "Цена", type: "number", min: 0, suffix: "₪" },
      { k: "priceNote", label: "За что цена", type: "text", max: 40, placeholder: "в месяц" },
    ] },
    { k: "note", label: "Примечание", type: "text", max: 300 },
  ],
  events: [
    { k: "items", label: "Мероприятия", type: "list", max: 30, addLabel: "Добавить мероприятие", titleKey: "title", item: [
      { k: "title", label: "Название", type: "text", max: 150, required: true },
      { k: "start", label: "Начало", type: "datetime", required: true, help: "После даты мероприятие скроется само" },
      { k: "end", label: "Окончание", type: "datetime" },
      { k: "place", label: "Место", type: "text", max: 200 },
      { k: "description", label: "Описание", type: "textarea", rows: 3, max: 1000 },
      { k: "photoUrl", label: "Фото", type: "photo" },
      { k: "registerUrl", label: "Ссылка на запись", type: "url", max: 500, placeholder: "https://…" },
      { k: "price", label: "Цена (0 — бесплатно)", type: "number", min: 0, suffix: "₪" },
    ] },
  ],
  vacancies: [
    { k: "items", label: "Вакансии", type: "list", max: 20, addLabel: "Добавить вакансию", titleKey: "title", defaults: { postedAt: "__today__" }, item: [
      { k: "title", label: "Должность", type: "text", max: 150, required: true },
      { k: "terms", label: "Условия", type: "text", max: 400, placeholder: "График, оплата" },
      { k: "requirements", label: "Требования", type: "textarea", rows: 3, max: 600, help: "Без требований к полу, возрасту и другим личным признакам — это запрещено законом." },
      { k: "contact", label: "Контакт", type: "text", max: 150 },
      { k: "postedAt", label: "Дата публикации", type: "date" },
      { k: "validUntil", label: "Актуально до", type: "date", help: "Если не указать — 30 дней с публикации" },
    ] },
  ],
  news: [
    { k: "posts", label: "Новости", type: "list", max: 100, addLabel: "Добавить новость", titleKey: "text", defaults: { date: "__today__" }, item: [
      { k: "date", label: "Дата", type: "date" },
      { k: "text", label: "Текст", type: "textarea", rows: 3, max: 2000, required: true },
      { k: "photoUrl", label: "Фото", type: "photo" },
    ] },
  ],
  certificates: [
    { k: "items", label: "Документы", type: "list", max: "certificates", addLabel: "Добавить документ", titleKey: "title", item: [
      { k: "title", label: "Название", type: "text", max: 150, required: true },
      { k: "issuer", label: "Кем выдан", type: "text", max: 150 },
      { k: "year", label: "Год", type: "number", min: 1950, max: 2100 },
      { k: "imageUrl", label: "Скан или фото", type: "photo", help: "Закройте номер удостоверения личности и другие личные данные" },
    ] },
  ],
  google: [
    { k: "url", label: "Ссылка на место в Google Картах", type: "url", max: 1000, placeholder: "https://maps.app.goo.gl/…", help: "Откройте место в Google Картах → «Поделиться» → «Копировать ссылку» и вставьте сюда." },
  ],
};

// Данные нового блока по умолчанию.
export function defaultBlockData(type: ListingBlock["type"]): Record<string, unknown> {
  switch (type) {
    case "description":
      return { text: "" };
    case "address":
      return { address: "" };
    case "service_area":
      return { districtSlugs: [], formats: ["at_home"] };
    case "hours":
      return { week: { sun: [{ open: "09:00", close: "18:00" }], mon: [{ open: "09:00", close: "18:00" }], tue: [{ open: "09:00", close: "18:00" }], wed: [{ open: "09:00", close: "18:00" }], thu: [{ open: "09:00", close: "18:00" }] } };
    case "services":
      return { groups: [{ title: "Услуги", items: [] }] };
    case "menu":
      return { sections: [{ title: "Основное меню", items: [] }], files: [] };
    case "request":
      return { enabled: true, withTime: true };
    case "google":
      return { url: "" };
    case "schedule":
      return { classes: [] };
    default: {
      const list = BLOCK_SCHEMAS[type].find((f) => f.type === "list" || f.type === "multiselect");
      return list ? { [list.k]: [] } : {};
    }
  }
}

export function fillDefaults(d: Record<string, unknown> | undefined): Record<string, unknown> {
  return Object.fromEntries(Object.entries(d ?? {}).map(([k, v]) => [k, v === "__today__" ? today() : v]));
}

// Какие блоки подходят разделу: у специалистов вместо адреса обычно зона выезда, меню — у заведений.
export const ADDABLE_ORDER: ListingBlock["type"][] = [
  "description",
  "services",
  "hours",
  "address",
  "service_area",
  "gallery",
  "before_after",
  "portfolio",
  "team",
  "video",
  "menu",
  "schedule",
  "offers",
  "events",
  "news",
  "vacancies",
  "faq",
  "certificates",
  "features",
  "languages",
  "google",
  "request",
];
