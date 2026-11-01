// Примерные карточки для макетов этапа 1. Все названия, телефоны и люди вымышлены.
// На этапе 2 их заменят настоящие карточки из базы.
import type { ListingData } from "@/lib/blocks/types";

export type MockListing = {
  slug: string;
  categorySlug: string;
  categoryName: string;
  rating: number;
  reviewsCount: number;
  hasOffer: boolean;
  data: ListingData;
};

const workWeek = {
  sun: [{ open: "09:00", close: "19:00" }],
  mon: [{ open: "09:00", close: "19:00" }],
  tue: [{ open: "09:00", close: "19:00" }],
  wed: [{ open: "09:00", close: "19:00" }],
  thu: [{ open: "09:00", close: "20:00" }],
  fri: [{ open: "08:30", close: "13:30" }],
};

export const MOCK_LISTINGS: MockListing[] = [
  {
    slug: "primer-salon-lavanda",
    categorySlug: "krasota",
    categoryName: "Красота и уход",
    rating: 4.9,
    reviewsCount: 38,
    hasOffer: true,
    data: {
      section: "biznes",
      header: {
        title: "Салон «Лаванда» (пример)",
        slogan: "Маникюр, брови и уход за кожей в центре Хадара",
        districtSlugs: ["hadar"],
        badges: ["verified", "russian_speaking"],
      },
      contacts: { phone: "+972500000001", whatsapp: "+972500000001", telegram: "example_lavanda", instagram: "example.lavanda" },
      confirmedAt: "2026-10-28",
      blocks: [
        {
          id: "d1",
          type: "description",
          data: {
            text: "Небольшой салон с тремя мастерами. Работаем с 2015 года, говорим по-русски, на иврите и английском. Используем стерильные инструменты и одноразовые пилки.",
          },
        },
        {
          id: "o1",
          type: "offers",
          data: {
            items: [
              { title: "Маникюр с покрытием по будням до 12:00", discountPercent: 15, validUntil: "2026-11-30", promoCode: "UTRO" },
            ],
          },
        },
        {
          id: "s1",
          type: "services",
          data: {
            groups: [
              {
                title: "Ногти",
                items: [
                  { name: "Маникюр с покрытием гель-лак", price: 150, durationMin: 90 },
                  { name: "Педикюр", price: 180, priceFrom: true, durationMin: 75 },
                  { name: "Снятие покрытия", price: 40, durationMin: 20 },
                ],
              },
              {
                title: "Брови и ресницы",
                items: [
                  { name: "Коррекция и окрашивание бровей", price: 120, durationMin: 45 },
                  { name: "Ламинирование ресниц", price: 200, durationMin: 60 },
                ],
              },
            ],
          },
        },
        { id: "h1", type: "hours", data: { week: workWeek, note: "В субботу закрыто" } },
        {
          id: "a1",
          type: "address",
          data: { address: "ул. Герцль, 10, Хайфа (пример)", howToGet: "5 минут пешком от остановки «Герцль»", parking: "Платная парковка во дворе", lat: 32.8156, lng: 34.9984 },
        },
        { id: "g1", type: "gallery", data: { photos: [{ caption: "Зал" }, { caption: "Рабочее место мастера" }, { caption: "Ресепшн" }] } },
        { id: "b1", type: "before_after", data: { pairs: [{ caption: "Укрепление ногтей гелем" }] } },
        {
          id: "f1",
          type: "faq",
          data: {
            items: [
              { q: "Нужно ли записываться заранее?", a: "Лучше за 1–2 дня. Свободные окна бывают и в день обращения — напишите в WhatsApp." },
              { q: "Есть ли парковка?", a: "Да, платная парковка во дворе здания." },
            ],
          },
        },
        { id: "fe1", type: "features", data: { items: ["Оплата картой", "Оплата через Bit", "Wi-Fi", "Доступно для колясок"] } },
        { id: "l1", type: "languages", data: { items: ["Русский", "Иврит", "Английский"] } },
        { id: "r1", type: "request", data: { enabled: true, withTime: true } },
      ],
    },
  },
  {
    slug: "primer-kafe-samovar",
    categorySlug: "eda",
    categoryName: "Еда и напитки",
    rating: 4.6,
    reviewsCount: 112,
    hasOffer: false,
    data: {
      section: "biznes",
      header: {
        title: "Кафе «Самовар» (пример)",
        slogan: "Домашняя кухня, пельмени и выпечка",
        districtSlugs: ["merkaz-hacarmel"],
        badges: ["russian_speaking"],
      },
      contacts: { phone: "+972500000002", whatsapp: "+972500000002", website: "https://example.com" },
      blocks: [
        { id: "d2", type: "description", data: { text: "Уютное кафе с русской и европейской кухней. Бизнес-ланч по будням, торты на заказ." } },
        { id: "h2", type: "hours", data: { week: { ...workWeek, sat: [{ open: "19:00", close: "23:00" }] } } },
        { id: "a2", type: "address", data: { address: "Шдерот ха-Наси, 120, Хайфа (пример)", lat: 32.8034, lng: 34.9886 } },
        { id: "fe2", type: "features", data: { items: ["Оплата картой", "Детская зона", "Wi-Fi"] } },
        { id: "l2", type: "languages", data: { items: ["Русский", "Иврит"] } },
      ],
    },
  },
  {
    slug: "primer-anna-manikyur",
    categorySlug: "krasota",
    categoryName: "Красота (мастера на дому)",
    rating: 5,
    reviewsCount: 21,
    hasOffer: true,
    data: {
      section: "specialisty",
      header: {
        title: "Анна К. (пример)",
        profession: "Мастер маникюра на дому",
        districtSlugs: ["kiryat-bialik", "kiryat-motzkin", "kiryat-yam"],
        badges: ["russian_speaking"],
      },
      contacts: { phone: "+972500000003", whatsapp: "+972500000003", telegram: "example_anna" },
      blocks: [
        { id: "d3", type: "description", data: { text: "Опыт 8 лет. Приезжаю со своим оборудованием и стерилизатором. Работаю по записи." } },
        { id: "sa3", type: "service_area", data: { districtSlugs: ["kiryat-bialik", "kiryat-motzkin", "kiryat-yam"], formats: ["at_home", "on_site"] } },
        {
          id: "s3",
          type: "services",
          data: { groups: [{ title: "Услуги", items: [{ name: "Маникюр с покрытием", price: 130, durationMin: 90 }, { name: "Наращивание", price: 220, priceFrom: true }] }] },
        },
        { id: "o3", type: "offers", data: { items: [{ title: "Первый визит", discountPercent: 10 }] } },
        { id: "l3", type: "languages", data: { items: ["Русский", "Иврит"] } },
        { id: "r3", type: "request", data: { enabled: true, withTime: true } },
      ],
    },
  },
  {
    slug: "primer-elektrik-boris",
    categorySlug: "mastera",
    categoryName: "Мастера на все руки",
    rating: 4.8,
    reviewsCount: 54,
    hasOffer: false,
    data: {
      section: "specialisty",
      header: {
        title: "Борис М. (пример)",
        profession: "Электрик с лицензией",
        districtSlugs: ["hadar", "ahuza", "neve-shaanan", "carmelia"],
        badges: ["verified", "russian_speaking", "documents_checked"],
      },
      contacts: { phone: "+972500000004", whatsapp: "+972500000004" },
      blocks: [
        { id: "d4", type: "description", data: { text: "Проводка, щитки, розетки, подключение бытовой техники. Лицензия электрика, гарантия на работу." } },
        { id: "sa4", type: "service_area", data: { districtSlugs: ["hadar", "ahuza", "neve-shaanan", "carmelia"], formats: ["at_home"] } },
        { id: "s4", type: "services", data: { groups: [{ title: "Работы", items: [{ name: "Вызов и диагностика", price: 250 }, { name: "Замена розетки", price: 120, priceFrom: true }] }] } },
        { id: "l4", type: "languages", data: { items: ["Русский", "Иврит", "Английский"] } },
      ],
    },
  },
];

export function mockListingBySlug(section: string, slug: string) {
  return MOCK_LISTINGS.find((l) => l.data.section === section && l.slug === slug);
}

export function mockListingsFor(section: string, categorySlug?: string) {
  return MOCK_LISTINGS.filter((l) => l.data.section === section && (!categorySlug || l.categorySlug === categorySlug));
}
