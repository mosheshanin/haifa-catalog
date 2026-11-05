// Заполненность карточки (решение заказчика 5 ноября 2026, холст https://claude.ai/artifact/DfxhoErXVfxkLDnjzeHfBu).
// 100% = 10% сразу (название, категория, район) + основа 4 × 10% + 10 блоков × 5%.
// Основа — то же правило, что isListingComplete (src/lib/seo/indexable.ts): без неё карточку не индексируют,
// поэтому уровень «Видна в поиске» даётся только за всю основу, а не за процент. Блок засчитывается, когда в нём
// есть содержимое (пороги — NEED), скрытые не считаются, прошедшие акции, мероприятия и вакансии — тоже.
// Используется в мастере, редакторе, кабинете (браузер и сервер) и в еженедельном напоминании бота — без серверных
// зависимостей. Тексты подсказок — здесь же.

import { MIN_DESCRIPTION } from "@/lib/seo/indexable";
import { israelToday, vacancyUntil } from "@/lib/blocks/expire";
import { pluralRu as plural } from "@/lib/format";
import { BLOCK_TITLES, type ListingBlock, type ListingData, type Section } from "@/lib/blocks/types";

type BlockType = ListingBlock["type"];
type BlockOf<T extends BlockType> = Extract<ListingBlock, { type: T }>;

export const START_POINTS = 10;
export const BASE_POINTS = 10;
export const BLOCK_POINTS = 5;
export const BLOCKS_FOR_FULL = 10;
export const STRONG_AT = 75;

export type BaseKey = "cover" | "description" | "contact" | "place";
export type ScoreTarget = BaseKey | BlockType;

export type ScoreItem = {
  key: ScoreTarget;
  kind: "base" | "block";
  title: string;
  done: boolean;
  have?: number; // сколько уже есть (фото, услуги, вопросы, знаки описания)
  need?: number;
  points: number; // сколько процентов даст пункт
  why: string; // зачем — мягкое объяснение
  action: string; // что сделать — заголовок совета
  blockType?: BlockType; // блок, который открыть или добавить в редакторе
};

export type Level = { key: "start" | "search" | "strong" | "full"; title: string };

export type ListingScore = {
  percent: number;
  level: Level;
  baseDone: number;
  baseMissing: ScoreItem[];
  blocksDone: number; // засчитанных блоков (могут быть больше 10)
  items: ScoreItem[]; // основа + подходящие категории блоки + любые уже заполненные
  next: ScoreItem[]; // что сделать, по порядку пользы
  message: string; // строка под шкалой
};

// Сколько нужно, чтобы блок засчитался.
const NEED: Partial<Record<BlockType, number>> = { services: 3, gallery: 5, faq: 3 };

const BLOCK_TEXT: Partial<Record<BlockType, { action: string; why: string }>> = {
  services: { action: "Добавьте 3 услуги с ценами", why: "Цена — первый вопрос клиента. Услуги и цены попадают в разметку, которую читают поисковики и нейросети." },
  hours: { action: "Укажите часы работы", why: "Клиенты увидят «Открыто сейчас», а карточка попадёт в фильтр по часам работы." },
  gallery: { action: "Добавьте 5 фото", why: "Фото работ или места показывают вас лучше любых слов." },
  faq: { action: "Добавьте 3 вопроса и ответа", why: "Люди задают такие вопросы Google и нейросетям. Готовый ответ в карточке — хороший шанс, что покажут именно вас." },
  before_after: { action: "Добавьте фото «до и после»", why: "Результат работы виден сразу — без лишних слов." },
  portfolio: { action: "Покажите свои работы", why: "Клиент видит, что вы уже делали похожее, и сколько это стоило." },
  team: { action: "Расскажите о команде", why: "Клиент заранее знает, к кому идёт." },
  video: { action: "Добавьте видео", why: "Короткий ролик с YouTube или Vimeo о вас или о работе вызывает доверие." },
  menu: { action: "Добавьте меню", why: "Меню с ценами — то, что посетители смотрят первым." },
  schedule: { action: "Добавьте расписание занятий", why: "Расписание сразу отвечает на вопрос «когда можно прийти»." },
  offers: { action: "Добавьте спецпредложение", why: "Акции попадают в фильтр «Есть акция» и приходят в Telegram тем, кто добавил вас в избранное." },
  events: { action: "Добавьте мероприятие", why: "Мероприятия размечаются для поисковиков отдельно, с датой и местом." },
  news: { action: "Напишите новость", why: "Свежие новости показывают, что вы работаете и на связи." },
  vacancies: { action: "Добавьте вакансию", why: "Ищете сотрудника — объявление прямо в вашей карточке." },
  certificates: { action: "Добавьте сертификаты", why: "Дипломы и лицензии подтверждают опыт и обучение." },
  features: { action: "Отметьте особенности", why: "По этим отметкам вас находят фильтры каталога." },
  languages: { action: "Укажите языки общения", why: "Клиент сразу видит, что вы его поймёте, — есть фильтр по языку." },
  google: { action: "Подключите рейтинг Google", why: "Ваши звёзды и отзывы из Google рядом с карточкой — доверие с первого взгляда." },
  request: { action: "Включите заявки", why: "Клиент оставит заявку прямо с карточки, а вам придёт сообщение в Telegram." },
  address: { action: "Укажите адрес", why: "Адрес появится на карте, и клиенты смогут прийти к вам." },
  service_area: { action: "Укажите районы выезда", why: "Вас найдут в поиске по району." },
};

// Короткая польза блока — для плиток шага мастера «Что ещё можно показать?».
export const BLOCK_SHORT: Partial<Record<BlockType, string>> = {
  faq: "Готовые ответы для Google и нейросетей",
  before_after: "Результат работы виден сразу",
  portfolio: "Работы с описанием и ценой",
  team: "Клиент заранее знает, к кому идёт",
  video: "Короткий ролик о вас или о работе",
  menu: "Блюда и цены или PDF-меню",
  schedule: "Когда проходят занятия",
  offers: "Уходят в Telegram тем, кто добавил вас в избранное",
  events: "Дата, место и запись",
  news: "Показывают, что вы на связи",
  vacancies: "Объявление о работе прямо в карточке",
  certificates: "Подтверждают опыт и обучение",
  google: "Ваши звёзды и отзывы рядом с карточкой",
  request: "Заявка с карточки придёт вам в Telegram",
};

// Блоки, полезные почти всем, в порядке пользы.
const CORE: BlockType[] = ["services", "hours", "gallery", "faq"];
const LATER: BlockType[] = ["google", "offers", "features", "languages", "request", "video", "certificates", "news"];

// Блоки, которые есть смысл предлагать в категории (по slug категории верхнего уровня). Остальные можно добавить
// в редакторе, засчитываются они так же, но в советах не появляются: электрику не нужно меню.
const BY_CATEGORY: Record<string, BlockType[]> = {
  "biznes/eda": ["menu", "events", "team", "vacancies"],
  "biznes/krasota": ["before_after", "team", "portfolio", "vacancies"],
  "biznes/zdorovye": ["team", "vacancies"],
  "biznes/dom-i-remont": ["before_after", "portfolio", "team"],
  "biznes/avto": ["before_after", "team"],
  "biznes/obrazovanie": ["schedule", "team", "events"],
  "biznes/magaziny": ["events", "vacancies"],
  "biznes/yuridicheskie-uslugi": ["team", "portfolio"],
  "biznes/nedvizhimost": ["portfolio", "team"],
  "biznes/dosug": ["schedule", "events", "menu", "team"],
  "biznes/turistam": ["events", "menu", "team"],
  "biznes/uslugi-dlya-biznesa": ["portfolio", "team"],
  "specialisty/vrachi-i-psihologi": [],
  "specialisty/krasota": ["before_after", "portfolio"],
  "specialisty/repetitory": ["schedule"],
  "specialisty/yuristy-i-buhgaltery": ["portfolio"],
  "specialisty/mastera": ["before_after", "portfolio"],
  "specialisty/pereezdy": ["portfolio"],
  "specialisty/nyani-i-sidelki": [],
  "specialisty/foto-video-vedushchie": ["portfolio"],
  "specialisty/it-i-dizayn": ["portfolio"],
  "specialisty/dokumenty-i-repatriaciya": [],
  "specialisty/uslugi-dlya-biznesa": ["portfolio"],
};
const DEFAULT_PICKS: Record<Section, BlockType[]> = { biznes: ["before_after", "portfolio", "team"], specialisty: ["portfolio"] };

// Блоки, которые стоит предлагать этой карточке, в порядке пользы.
export function suggestedBlocks(section: Section, topSlug: string | null | undefined): BlockType[] {
  const picks = (topSlug ? BY_CATEGORY[`${section}/${topSlug}`] : undefined) ?? DEFAULT_PICKS[section];
  return [...CORE, ...picks, ...LATER];
}

// Slug категории верхнего уровня по id категории (подкатегория → родитель).
export function topCategorySlug(categoryId: number | null | undefined, categories: Array<{ id: number; slug: string; parentId?: number | null; parent_id?: number | null }>): string | null {
  const c = categories.find((x) => x.id === categoryId);
  if (!c) return null;
  const parentId = c.parentId ?? c.parent_id;
  if (!parentId) return c.slug;
  return categories.find((x) => x.id === parentId)?.slug ?? c.slug;
}

function count(block: ListingBlock | undefined, today: string): number {
  if (!block) return 0;
  switch (block.type) {
    case "services":
      return block.data.groups.reduce((n, g) => n + g.items.filter((i) => i.name?.trim()).length, 0);
    case "hours":
      return block.data.mode || Object.values(block.data.week ?? {}).some((d) => d?.length) ? 1 : 0;
    case "gallery":
      return block.data.photos.filter((p) => p.url).length;
    case "faq":
      return block.data.items.filter((i) => i.q?.trim() && i.a?.trim()).length;
    case "before_after":
      return block.data.pairs.filter((p) => p.beforeUrl && p.afterUrl).length;
    case "portfolio":
      return block.data.items.filter((i) => i.title?.trim()).length;
    case "team":
      return block.data.members.filter((m) => m.name?.trim()).length;
    case "video":
      return block.data.items.length;
    case "menu":
      return block.data.sections.reduce((n, s) => n + s.items.length, 0) + (block.data.files?.length ?? 0);
    case "schedule":
      return block.data.classes.length;
    case "offers":
      return block.data.items.filter((o) => o.title?.trim() && (!o.validUntil || o.validUntil >= today)).length;
    case "events":
      return block.data.items.filter((e) => e.title?.trim() && (e.end ?? e.start).slice(0, 10) >= today).length;
    case "news":
      return block.data.posts.filter((p) => p.text?.trim()).length;
    case "vacancies":
      return block.data.items.filter((v) => v.title?.trim() && vacancyUntil(v) >= today).length;
    case "certificates":
      return block.data.items.filter((c) => c.title?.trim()).length;
    case "features":
      return block.data.items.length + (block.data.kupot?.length ?? 0) + (block.data.formats?.length ?? 0);
    case "languages":
      return block.data.items.length;
    case "google":
      return block.data.url?.trim() ? 1 : 0;
    case "request":
      return block.data.enabled ? 1 : 0;
    case "address":
      return block.data.address?.trim() ? 1 : 0;
    case "service_area":
      return block.data.districtSlugs.length ? 1 : 0;
    case "description":
      return block.data.text.trim().length;
  }
}

export function listingScore(
  data: ListingData,
  opts: { topSlug?: string | null; placeTitle?: string; today?: string } = {},
): ListingScore {
  const today = opts.today ?? israelToday();
  const sec = data.section;
  const visible = data.blocks.filter((b) => !b.hidden);
  const first = <T extends BlockType>(t: T) => visible.find((b) => b.type === t) as BlockOf<T> | undefined;
  const placeType: BlockType = sec === "biznes" ? "address" : "service_area";

  const descLen = count(first("description"), today);
  const hasContact = Boolean(data.contacts.phone || data.contacts.whatsapp || data.contacts.telegram);
  const placeDone = count(first("address"), today) > 0 || count(first("service_area"), today) > 0;
  const base: ScoreItem[] = [
    { key: "cover", kind: "base", title: "Обложка", done: Boolean(data.header.coverUrl), points: BASE_POINTS, action: "Добавьте обложку", why: "Первое, что видят в поиске и в превью ссылки в WhatsApp и Telegram." },
    {
      key: "description",
      kind: "base",
      title: `Описание от ${MIN_DESCRIPTION} знаков`,
      done: descLen >= MIN_DESCRIPTION,
      have: Math.min(descLen, MIN_DESCRIPTION),
      need: MIN_DESCRIPTION,
      points: BASE_POINTS,
      blockType: "description",
      action: "Расскажите о себе",
      why: "Пишите так, как объясняете клиенту по телефону: что делаете, для кого и чем отличаетесь. Этот текст читают поисковики и нейросети.",
    },
    { key: "contact", kind: "base", title: "Телефон или мессенджер", done: hasContact, points: BASE_POINTS, action: "Добавьте телефон или мессенджер", why: "Клиенты увидят кнопки «Позвонить», «WhatsApp», «Telegram»." },
    {
      key: "place",
      kind: "base",
      title: sec === "biznes" ? "Адрес" : (opts.placeTitle ?? "Районы работы"),
      done: placeDone,
      points: BASE_POINTS,
      blockType: placeType,
      action: sec === "biznes" ? "Укажите адрес" : "Укажите, где вы работаете",
      why: sec === "biznes" ? "Адрес появится на карте и в поиске по району." : "По районам вас найдут фильтры каталога.",
    },
  ];
  const baseDone = base.filter((b) => b.done).length;

  // Блоки сверх основы: подходящие категории + любые уже заполненные (их тоже засчитываем).
  const suggested = suggestedBlocks(sec, opts.topSlug);
  const blockTypes: BlockType[] = [...suggested];
  for (const b of visible) {
    if (b.type === "description" || b.type === placeType) continue;
    if (!blockTypes.includes(b.type)) blockTypes.push(b.type);
  }
  const blocks: ScoreItem[] = blockTypes.map((t) => {
    const have = count(first(t), today);
    const need = NEED[t] ?? 1;
    const text = BLOCK_TEXT[t] ?? { action: `Добавьте блок «${BLOCK_TITLES[t]}»`, why: "" };
    return {
      key: t,
      kind: "block",
      title: t === "service_area" ? (opts.placeTitle ?? BLOCK_TITLES[t]) : BLOCK_TITLES[t],
      done: have >= need,
      have: need > 1 ? Math.min(have, need) : undefined,
      need: need > 1 ? need : undefined,
      points: BLOCK_POINTS,
      blockType: t,
      action: text.action,
      why: text.why,
    };
  });
  const blocksDone = blocks.filter((b) => b.done).length;
  const percent = Math.min(100, START_POINTS + baseDone * BASE_POINTS + Math.min(blocksDone, BLOCKS_FOR_FULL) * BLOCK_POINTS);

  const level: Level =
    baseDone < base.length
      ? { key: "start", title: "Начало" }
      : percent >= 100
        ? { key: "full", title: "Полная" }
        : percent >= STRONG_AT
          ? { key: "strong", title: "Сильная" }
          : { key: "search", title: "Видна в поиске" };

  const baseMissing = base.filter((b) => !b.done);
  const leftBlocks = Math.max(0, BLOCKS_FOR_FULL - blocksDone);
  const toStrong = Math.max(0, Math.ceil((STRONG_AT - percent) / BLOCK_POINTS));
  let message: string;
  if (baseMissing.length) {
    const n = baseMissing.length;
    message = `Ещё ${n} ${plural(n, "пункт", "пункта", "пунктов")} — и карточку смогут показывать Google и нейросети.`;
  } else if (level.key === "search") {
    message = `Карточка видна в поиске. Ещё ${toStrong} ${plural(toStrong, "блок", "блока", "блоков")} до «Сильной».`;
  } else if (level.key === "strong") {
    message = `Сильная карточка! Ещё ${leftBlocks} ${plural(leftBlocks, "блок", "блока", "блоков")} — и она будет полной.`;
  } else {
    message = "Карточка заполнена полностью. Обновляйте акции и новости, чтобы она оставалась свежей.";
  }

  // Порядок советов: основа, затем подходящие блоки (уже частично начатые — раньше), остальные заполненные не советуем.
  const nextBlocks = blocks.filter((b) => !b.done && suggested.includes(b.key as BlockType));
  nextBlocks.sort((a, b) => Number(Boolean(b.have)) - Number(Boolean(a.have)));
  const next = [...baseMissing, ...(blocksDone < BLOCKS_FOR_FULL ? nextBlocks : [])];

  return { percent, level, baseDone, baseMissing, blocksDone, items: [...base, ...blocks], next, message };
}

// Где карточку найдут (вариант В холста — в окне «Как считается заполненность»): одни и те же пункты по каналам.
export type Channel = { key: string; title: string; sub: string; items: ScoreItem[] };

export function scoreChannels(score: ListingScore): Channel[] {
  const by = (keys: ScoreTarget[]) => keys.map((k) => score.items.find((i) => i.key === k)).filter((x): x is ScoreItem => Boolean(x));
  const trust: ScoreTarget[] = ["gallery", "before_after", "portfolio", "team", "menu", "schedule", "certificates", "google", "offers", "languages"];
  return [
    { key: "search", title: "Поисковики", sub: "Google, Bing", items: by(["cover", "description", "contact", "place", "services", "hours", "faq"]) },
    { key: "ai", title: "Нейросети", sub: "ChatGPT, Gemini, Claude", items: by(["description", "services", "hours", "faq", "features"]) },
    // Здесь только подходящие категории блоки и уже заполненные.
    { key: "clients", title: "Клиенты в каталоге", sub: "Доверие и выбор", items: by(trust) },
  ];
}
