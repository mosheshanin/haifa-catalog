// Дополнительные услуги, которые предлагаются владельцу на последнем шаге добавления карточки
// (решение заказчика 3 ноября 2026). Заказ — это заявка администратору (таблица service_orders),
// оплата обсуждается отдельно, онлайн-оплаты нет. Цены в шекелях, без приписки о НДС (решение заказчика).
// Цена сохраняется в заказе на момент заказа: если поменять её здесь, старые заказы не изменятся.

export type ExtraService = {
  code: string;
  title: string;
  text: string;
  price: number;
  icon: string; // 3D-иконка из public/icons/3d
  group?: string; // услуги одной группы взаимоисключающие (два вида интервью)
};

export const EXTRA_SERVICES: ExtraService[] = [
  {
    code: "description",
    title: "Улучшить описание карточки",
    text: "Редактор HBC перепишет описание: понятно, живо и так, чтобы карточку находили в поиске.",
    price: 500,
    icon: "pencil",
  },
  {
    code: "photoshoot",
    title: "Фотосессия",
    text: "Фотограф снимет вас, ваше место и работы. Лучшие кадры поставим в карточку.",
    price: 1500,
    icon: "camera",
  },
  {
    code: "interview",
    title: "Интервью",
    text: "Интервью о вас и вашем деле с публикацией в карточке и на главной странице HBC.",
    price: 1500,
    icon: "mic",
    group: "interview",
  },
  {
    code: "interview_media",
    title: "Интервью + пакет СМИ",
    text: "То же интервью в карточке и на главной, а также публикация в пакете СМИ.",
    price: 5000,
    icon: "megaphone",
    group: "interview",
  },
  {
    code: "consult",
    title: "Консультация Натальи Пигулевской",
    text: "Консультация по развитию бизнеса.",
    price: 1500,
    icon: "chat-bubble",
  },
  {
    code: "subdomain_site",
    title: "Отдельный сайт на поддомене HBC",
    text: "Свой небольшой сайт с адресом на домене проекта, на основе вашей карточки.",
    price: 2000,
    icon: "computer",
  },
];

export const extraByCode = (code: string) => EXTRA_SERVICES.find((s) => s.code === code);

export const formatShekels = (n: number) => `${n.toLocaleString("ru-RU")} ₪`;
