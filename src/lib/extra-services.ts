// Дополнительные услуги, которые предлагаются владельцу при добавлении карточки (решение заказчика 3 ноября 2026).
// С 5 ноября 2026 список хранится в базе (таблица extra_services) и правится в админке → «Услуги и заказы»:
// название, описание, стоимость или «по запросу», иконка, шаги мастера, порядок, показывать/скрыть.
// Загрузка — getExtraServices (src/lib/data/extra-services.ts). Заказ — это заявка администратору (service_orders),
// оплата обсуждается отдельно, онлайн-оплаты нет. Цены в шекелях, без приписки о НДС (решение заказчика).
// Цена сохраняется в заказе на момент заказа: если поменять её в админке, старые заказы не изменятся.

export type ExtraService = {
  code: string;
  title: string;
  text: string;
  price: number | null; // null — «по запросу»
  icon: string; // 3D-иконка из public/icons/3d
  group?: string; // услуги одной группы взаимоисключающие (два вида интервью)
  steps: OfferStep[]; // на каких шагах мастера предлагать (на последнем шаге видны все)
  stepText?: string; // короткий текст предложения на шаге; пусто — описание
};

// Шаги мастера, на которых можно предложить услугу (последний шаг показывает все услуги всегда).
export const OFFER_STEPS = [
  ["contacts", "Контакты"],
  ["about", "Описание"],
  ["place", "Адрес / зона выезда"],
  ["hours", "Часы работы"],
  ["services", "Услуги и цены"],
  ["photos", "Фото"],
  ["languages", "Языки"],
  ["features", "Особенности"],
] as const;
export type OfferStep = (typeof OFFER_STEPS)[number][0];
export const isOfferStep = (s: string): s is OfferStep => OFFER_STEPS.some(([k]) => k === s);

export const PRICE_ON_REQUEST = "по запросу";

export const formatShekels = (n: number) => `${n.toLocaleString("ru-RU")} ₪`;
export const formatPrice = (n: number | null | undefined) => (typeof n === "number" ? formatShekels(n) : PRICE_ON_REQUEST);

// Итог заказа: сумма известных цен и есть ли услуги «по запросу».
// «1 500 ₪», «1 500 ₪ + по запросу», «по запросу».
export function formatTotal(items: Array<{ price: number | null | undefined }>) {
  const known = items.filter((i) => typeof i.price === "number");
  const sum = known.reduce((s, i) => s + (i.price as number), 0);
  const onRequest = known.length < items.length;
  if (!known.length) return PRICE_ON_REQUEST;
  return onRequest ? `${formatShekels(sum)} + ${PRICE_ON_REQUEST}` : formatShekels(sum);
}
