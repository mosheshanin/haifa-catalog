import Link from "next/link";
import type { ListingBlock, ListingData, MenuTag, WeekdayKey } from "@/lib/blocks/types";
import { Icon3d } from "@/components/ui/icon-3d";
import {
  ChatIcon,
  CheckBadgeIcon,
  ClockIcon,
  GlobeIcon,
  MapPinIcon,
  PhoneIcon,
  SendIcon,
  ShareIcon,
  StarIcon,
  TagIcon,
} from "@/components/icons";
import { OpenNowBadge } from "@/components/listing/open-now";
import {
  formatDateRu,
  formatDayMonth,
  formatEventWhen,
  formatPhone,
  formatPrice,
  googleMapsHref,
  pluralRu,
  telegramHref,
  telHref,
  wazeHref,
  whatsappHref,
} from "@/lib/format";
import { t } from "@/i18n/ru";
import { Photo } from "@/components/ui/photo";
import { FavoriteButton } from "@/components/listing/favorite-button";
import { PlaceMap } from "@/components/catalog/place-map";
import { VideoList } from "@/components/listing/blocks/video-player";
import { BeforeAfterSlider } from "@/components/listing/blocks/before-after";
import { ZoomImage } from "@/components/listing/blocks/zoom-image";
import { TeamBookButton } from "@/components/listing/blocks/team-book-button";
import { SharePanel } from "@/components/listing/share-panel";
import { vacancyUntil } from "@/lib/blocks/expire";
import { safeHref } from "@/lib/blocks/links";
import { GoogleRating } from "@/components/listing/blocks/google-rating";
import { ListingTracker } from "@/components/listing/listing-tracker";
import { ClaimButton, ComplaintButton, ReportListingButton, RequestForm, ReviewForm } from "@/components/listing/public-forms";
import { filterConfig, type FilterConfig } from "@/lib/catalog/filter-config";
import { TelegramRequestButton } from "@/components/telegram/mini-app-chrome";
import type { PublicReview } from "@/lib/data/reviews";
import { districtLabels } from "@/lib/catalog/districts";

export type ShareInfo = { url: string; shortUrl?: string; miniAppUrl: string; qrSvg?: string; temporaryAddress: boolean };

// Что нужно блокам кроме их собственных данных.
type BlockContext = {
  listingId: string;
  isDemo: boolean;
  preview: boolean; // предпросмотр в редакторе: формы не отправляются
  services: string[];
  districtNames: Record<string, string>;
  vimeoThumbs: Record<string, string>;
  requestEnabled: boolean;
  whatsapp?: string;
  title: string;
  bookableNames: string[];
  filter: FilterConfig; // подписи «Доставка», «Выезд к клиенту»… по категории карточки
};

const DAY_FULL: Record<WeekdayKey, string> = {
  sun: "Воскресенье",
  mon: "Понедельник",
  tue: "Вторник",
  wed: "Среда",
  thu: "Четверг",
  fri: "Пятница",
  sat: "Суббота",
};
const DAY_ORDER: WeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const MENU_TAGS: Record<MenuTag, { icon: string; label: string }> = {
  veg: { icon: "🌱", label: "Вегетарианское" },
  spicy: { icon: "🌶️", label: "Острое" },
};

const NEWS_VISIBLE = 3;

const DAY_NAMES: Array<[keyof NonNullable<Extract<ListingBlock, { type: "hours" }>["data"]["week"]>, string]> = [
  ["sun", "Вс"],
  ["mon", "Пн"],
  ["tue", "Вт"],
  ["wed", "Ср"],
  ["thu", "Чт"],
  ["fri", "Пт"],
  ["sat", "Сб"],
];

const FORMAT_LABELS = { at_home: "🚗 Выезд на дом", on_site: "🏠 Приём у себя", online: "💻 Онлайн" } as const;

const FEATURE_ICONS: Record<string, string> = {
  "Оплата картой": "💳",
  "Оплата через Bit": "📱",
  "Wi-Fi": "📶",
  "Доступно для колясок": "♿",
  "Детская зона": "🧸",
  "Кошерно": "✡️",
  "Парковка": "🅿️",
};

// Категория карточки из ссылки «/<раздел>/<категория>» → подписи фильтров (без лишнего запроса в базу).
function filterFromHref(section: "biznes" | "specialisty", href: string): FilterConfig {
  const [, , top, sub] = href.split("/");
  if (!top) return filterConfig(section, null);
  return filterConfig(section, sub ? { slug: sub, parentSlug: top } : { slug: top });
}

// 3D-иконки заголовков блоков (3dicons Gradient, 3 ноября 2026); в коде блоки по-прежнему помечены эмодзи.
const BLOCK_ICONS_3D: Record<string, string> = {
  "📝": "file-text", "🎁": "gift", "💰": "money", "🕒": "clock", "📍": "location", "🚗": "explorer",
  "📷": "camera", "✨": "magic-trick", "❓": "chat-bubble", "⭐": "star", "🗣️": "chat", "✍️": "pencil",
  "🌟": "trophy", "🎬": "video-camera", "👥": "boy", "🗂️": "folder", "🍽️": "tea-cup", "🗓️": "calender",
  "🎉": "megaphone", "💼": "target", "📰": "bell", "📜": "medal", "💬": "chat-text", "📲": "mobile",
};

function Section({ id, title, icon, children }: { id?: string; title: string; icon?: string; children: React.ReactNode }) {
  return (
    // Фон блока задаёт подложка .card-blocks (globals.css): соседние блоки разного цвета (решение 2 ноября 2026).
    <section id={id} className="card-block scroll-mt-32 rounded-[var(--radius-card)] border border-line bg-[var(--block-bg,#fff)] p-5 shadow-sm sm:p-7">
      <h2 className="mb-4 flex items-center gap-2.5 text-lg font-extrabold leading-snug sm:mb-5 sm:text-xl">
        {icon && BLOCK_ICONS_3D[icon] ? (
          <Icon3d name={BLOCK_ICONS_3D[icon]} size={40} className="-my-1 drop-shadow-[0_4px_4px_rgba(20,20,20,0.18)]" />
        ) : icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--block-accent,var(--color-primary-soft))] text-lg" aria-hidden>
            {icon}
          </span>
        ) : null}
        {title}
      </h2>
      {children}
    </section>
  );
}

function PhotoPlaceholder({ label, url }: { label?: string; url?: string }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-line">
      {url ? (
        <Photo src={url} alt={label ?? ""} className="aspect-[4/3] w-full" sizes="(max-width: 640px) 50vw, 33vw" />
      ) : (
        <div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-primary-soft to-[#e7e4d6] text-sm font-semibold text-primary">
          📷 Фото
        </div>
      )}
      {label ? <figcaption className="px-3 py-2 text-sm text-muted">{label}</figcaption> : null}
    </figure>
  );
}

function Block({ block, ctx }: { block: ListingBlock; ctx: BlockContext }) {
  const { districtNames } = ctx;
  if (block.hidden) return null;
  switch (block.type) {
    case "description":
      return (
        <Section title={t.listing.about} icon="📝">
          <p className="leading-relaxed">{block.data.text}</p>
        </Section>
      );
    case "offers":
      return (
        <Section id="offers" title={t.listing.offers} icon="🎁">
          <ul className="grid grid-cols-1 gap-3">
            {block.data.items.map((o, i) => (
              <li key={i} className="rounded-2xl border-2 border-accent/50 bg-[#fdf8e1] p-4">
                <p className="flex items-start gap-2 font-extrabold leading-snug text-accent-ink">
                  <TagIcon className="mt-0.5 size-5 shrink-0" />
                  <span className="min-w-0">
                    {o.discountPercent ? <span className="whitespace-nowrap">−{o.discountPercent}% · </span> : null}
                    {o.title}
                  </span>
                </p>
                {o.promoCode ? (
                  <p className="mt-1 text-sm">
                    Промокод: <span className="rounded bg-white px-1.5 py-0.5 font-mono font-bold">{o.promoCode}</span>
                  </p>
                ) : null}
                {o.validUntil ? <p className="mt-1 text-sm text-muted">До {formatDateRu(o.validUntil)}</p> : null}
              </li>
            ))}
          </ul>
        </Section>
      );
    case "services":
      return (
        <Section id="services" title={t.listing.services} icon="💰">
          <div className="grid grid-cols-1 gap-5">
            {block.data.groups.map((g, gi) => (
              <div key={gi}>
                <h3 className="mb-2 font-bold text-primary">{g.title}</h3>
                <ul className="divide-y divide-line">
                  {g.items.map((s, si) => (
                    <li key={si} className="flex items-baseline gap-3 py-2.5">
                      <span className="flex-1">
                        {s.name}
                        {s.durationMin ? <span className="ml-2 text-sm text-muted">{s.durationMin} мин</span> : null}
                      </span>
                      {s.price !== undefined ? <span className="font-extrabold">{formatPrice(s.price, s.priceFrom)}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      );
    case "hours":
      return (
        <Section title={t.listing.hours} icon="🕒">
          {block.data.mode !== "on_request" ? (
            <div className="mb-3">
              <OpenNowBadge week={block.data.week} exceptions={block.data.exceptions} mode={block.data.mode} />
            </div>
          ) : null}
          {block.data.mode === "always" ? (
            <p className="font-bold">{t.listing.hoursAlways}</p>
          ) : block.data.mode === "on_request" ? (
            <p className="font-bold">{t.listing.hoursOnRequest}</p>
          ) : (
          <dl className="grid grid-cols-[3rem_1fr] gap-y-1.5">
            {DAY_NAMES.map(([key, label]) => (
              <div key={key} className="contents">
                <dt className="font-bold">{label}</dt>
                <dd className={block.data.week[key]?.length ? "" : "text-muted"}>
                  {block.data.week[key]?.length
                    ? block.data.week[key]!.map((i) => `${i.open}–${i.close}`).join(", ")
                    : "Выходной"}
                </dd>
              </div>
            ))}
          </dl>
          )}
          {block.data.exceptions?.length ? (
            <div className="mt-4 rounded-2xl bg-[#fff8e1] p-3">
              <p className="mb-1.5 text-sm font-extrabold">📅 Особые дни</p>
              <ul className="grid gap-1 text-sm">
                {block.data.exceptions.map((x) => (
                  <li key={x.date}>
                    <span className="font-bold">{formatDayMonth(x.date, true)}:</span>{" "}
                    {x.closed || !x.intervals?.length ? "закрыто" : x.intervals.map((i) => `${i.open}–${i.close}`).join(", ")}
                    {x.note ? <span className="text-muted"> · {x.note}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {block.data.note ? <p className="mt-3 text-sm text-muted">{block.data.note}</p> : null}
        </Section>
      );
    case "address":
      return (
        <Section title={t.listing.address} icon="📍">
          <p className="flex items-start gap-2 font-semibold">
            <MapPinIcon className="mt-0.5 size-5 shrink-0 text-primary" />
            {block.data.address}
          </p>
          {block.data.howToGet ? <p className="mt-2 text-sm text-muted">{block.data.howToGet}</p> : null}
          {block.data.parking ? <p className="mt-1 text-sm text-muted">Парковка: {block.data.parking}</p> : null}
          {block.data.lat && block.data.lng ? <PlaceMap lat={block.data.lat} lng={block.data.lng} label={block.data.address} /> : null}
          {block.data.lat && block.data.lng ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={wazeHref(block.data.lat, block.data.lng)} className="rounded-full border border-line px-4 py-2 text-sm font-bold hover:border-primary">
                Маршрут в Waze
              </a>
              <a href={googleMapsHref(block.data.lat, block.data.lng)} className="rounded-full border border-line px-4 py-2 text-sm font-bold hover:border-primary">
                Открыть в Google Maps
              </a>
            </div>
          ) : null}
        </Section>
      );
    case "service_area":
      return (
        <Section title={t.listing.serviceArea} icon="🚗">
          <p className="mb-2 flex flex-wrap gap-2">
            {block.data.formats.map((f) => (
              <span key={f} className="rounded-full bg-primary-soft px-3 py-1 text-sm font-bold text-primary">
                {FORMAT_LABELS[f]}
              </span>
            ))}
          </p>
          <p>{districtLabels(block.data.districtSlugs, districtNames).join(", ")}</p>
        </Section>
      );
    case "gallery":
      return (
        <Section title={t.listing.gallery} icon="📷">
          {/* Фото открываются крупно целиком, с листанием по всей галерее */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(() => {
              const group = block.data.photos
                .filter((p) => p.url)
                .map((p, i) => ({ src: p.url!, alt: p.caption || `${ctx.title} — фото ${i + 1}` }));
              return block.data.photos.map((p, i) => {
                const at = group.findIndex((g) => g.src === p.url);
                return p.url ? (
                  <figure key={i} className="overflow-hidden rounded-2xl border border-line">
                    <ZoomImage src={p.url} alt={group[at].alt} group={group} index={at} />
                    {p.caption ? <figcaption className="px-3 py-2 text-sm text-muted">{p.caption}</figcaption> : null}
                  </figure>
                ) : (
                  <PhotoPlaceholder key={i} label={p.caption} />
                );
              });
            })()}
          </div>
        </Section>
      );
    case "before_after":
      return (
        <Section title={t.listing.beforeAfter} icon="✨">
          <div className={`grid gap-4 ${block.data.pairs.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {block.data.pairs.map((p, i) => (
              <BeforeAfterSlider key={i} beforeUrl={p.beforeUrl} afterUrl={p.afterUrl} caption={p.caption} />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Двигайте ползунок, чтобы сравнить.</p>
        </Section>
      );
    case "faq":
      return (
        <Section title={t.listing.faq} icon="❓">
          <div className="divide-y divide-line">
            {block.data.items.map((f, i) => (
              <details key={i} className="group py-3" open={i === 0}>
                <summary className="cursor-pointer list-none font-bold marker:hidden">
                  <span className="mr-2 text-primary group-open:rotate-90">›</span>
                  {f.q}
                </summary>
                <p className="mt-2 pl-5 text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </Section>
      );
    case "features": {
      const kupot = block.data.kupot ?? [];
      const formats = (block.data.formats ?? []).map((f) => (f === "at_home" ? ctx.filter.home ?? "🚗 Выезд или доставка" : ctx.filter.online ?? "💻 Онлайн"));
      if (!block.data.items.length && !kupot.length && !formats.length) return null;
      return (
        <Section title={t.listing.features} icon="⭐">
          <ul className="flex flex-wrap gap-2">
            {[...formats, ...block.data.items].map((f) => (
              <li key={f} className="rounded-full border border-line bg-surface-alt px-3 py-1.5 text-sm font-semibold">
                {FEATURE_ICONS[f] ? `${FEATURE_ICONS[f]} ` : ""}
                {f}
              </li>
            ))}
          </ul>
          {kupot.length ? <p className="mt-3 text-sm">🏥 Работает с больничными кассами: <b>{kupot.join(", ")}</b></p> : null}
        </Section>
      );
    }
    case "languages":
      return (
        <Section title={t.listing.languages} icon="🗣️">
          <p className="flex items-center gap-2">
            <GlobeIcon className="size-5 text-primary" />
            {block.data.items.join(", ")}
          </p>
        </Section>
      );
    case "request":
      if (!block.data.enabled) return null;
      return (
        <Section id="request" title={t.listing.request} icon="✍️">
          {ctx.preview ? (
            <p className="rounded-xl bg-surface-alt p-4 text-sm text-muted">Здесь посетители увидят форму заявки{block.data.withTime ? " с выбором дня и времени" : ""}.</p>
          ) : (
            <RequestForm
              listingId={ctx.listingId}
              withTime={block.data.withTime}
              services={ctx.services}
              masters={ctx.bookableNames}
              isDemo={ctx.isDemo}
            />
          )}
        </Section>
      );

    case "google":
      return (
        <Section id="google" title={t.listing.google} icon="🌟">
          <GoogleRating url={block.data.url} placeId={block.data.placeId} cid={block.data.cid} />
        </Section>
      );

    case "video":
      if (!block.data.items.length) return null;
      return (
        <Section title={t.listing.video} icon="🎬">
          <VideoList items={block.data.items} vimeoThumbs={ctx.vimeoThumbs} />
        </Section>
      );
    case "team":
      if (!block.data.members.length) return null;
      return (
        <Section id="team" title={t.listing.team} icon="👥">
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {block.data.members.map((m) => (
              <li key={m.name} className="min-w-0 text-center">
                {m.photoUrl ? (
                  <Photo src={m.photoUrl} alt={m.name} className="mx-auto aspect-square w-full max-w-36 rounded-full" sizes="144px" />
                ) : (
                  <div className="mx-auto grid aspect-square w-full max-w-36 place-items-center rounded-full bg-primary-soft text-4xl" aria-hidden>
                    👤
                  </div>
                )}
                <p className="mt-2 font-extrabold leading-tight">{m.name}</p>
                {m.role ? <p className="text-sm text-muted">{m.role}</p> : null}
                {m.bio ? <p className="mt-1 text-sm">{m.bio}</p> : null}
                {m.bookable ? (
                  ctx.requestEnabled ? (
                    <TeamBookButton name={m.name} />
                  ) : ctx.whatsapp ? (
                    <a
                      href={whatsappHref(ctx.whatsapp, `Здравствуйте! Хочу записаться. Мастер: ${m.name}. Нашёл(а) вас в каталоге HBC.`)}
                      aria-label={`Записаться в WhatsApp: ${m.name}`}
                      className="mt-2 inline-flex min-h-11 w-full max-w-36 items-center justify-center whitespace-nowrap rounded-xl bg-[#15803d] px-2 py-2 text-sm font-bold text-white"
                    >
                      <span className="max-[359px]:hidden" aria-hidden>💬&nbsp;</span>
                      Записаться
                    </a>
                  ) : null
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      );
    case "portfolio":
      if (!block.data.items.length) return null;
      return (
        <Section title={t.listing.portfolio} icon="🗂️">
          <ul className="grid grid-cols-1 gap-5">
            {block.data.items.map((w, i) => (
              <li key={i} className="min-w-0 rounded-2xl border border-line p-3">
                {w.photos.length ? (
                  <div className={`grid gap-2 ${w.photos.length > 1 ? "grid-cols-2" : ""}`}>
                    {w.photos.slice(0, 4).map((url, pi) => (
                      <div key={pi} className="overflow-hidden rounded-xl">
                        <ZoomImage src={url} alt={`${w.title} — фото ${pi + 1}`} />
                      </div>
                    ))}
                  </div>
                ) : null}
                <h3 className="mt-3 font-extrabold">{w.title}</h3>
                {w.description ? <p className="mt-1 text-sm leading-relaxed">{w.description}</p> : null}
                {w.price !== undefined || w.duration ? (
                  <p className="mt-2 flex flex-wrap gap-2 text-sm">
                    {w.price !== undefined ? <span className="rounded-full bg-primary-soft px-2.5 py-1 font-bold text-primary">💰 {formatPrice(w.price, w.priceFrom)}</span> : null}
                    {w.duration ? <span className="rounded-full bg-surface-alt px-2.5 py-1 font-semibold">⏱️ {w.duration}</span> : null}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      );
    case "menu":
      if (!block.data.sections.length && !block.data.files?.length) return null;
      return (
        <Section id="menu" title={t.listing.menu} icon="🍽️">
          <div className="grid grid-cols-1 gap-6">
            {block.data.sections.map((sec, si) => (
              <div key={si}>
                <h3 className="mb-2 font-bold text-primary">{sec.title}</h3>
                <ul className="divide-y divide-line">
                  {sec.items.map((it, ii) => (
                    <li key={ii} className="flex items-start gap-3 py-3">
                      {it.photoUrl ? (
                        <div className="w-20 shrink-0 overflow-hidden rounded-xl sm:w-24">
                          <ZoomImage src={it.photoUrl} alt={it.name} className="aspect-square w-full" sizes="96px" />
                        </div>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">
                          {it.name}
                          {it.tags?.map((tag) => (
                            <span key={tag} className="ml-1.5" title={MENU_TAGS[tag].label} aria-label={MENU_TAGS[tag].label}>
                              {MENU_TAGS[tag].icon}
                            </span>
                          ))}
                        </p>
                        {it.description ? <p className="text-sm text-muted">{it.description}</p> : null}
                      </div>
                      {it.price !== undefined ? <span className="shrink-0 font-extrabold">{formatPrice(it.price)}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {block.data.sections.some((sec) => sec.items.some((it) => it.tags?.length)) ? (
            <p className="mt-2 text-xs text-muted">🌱 вегетарианское · 🌶️ острое</p>
          ) : null}
          {block.data.files?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {block.data.files.map((f) => (
                <a key={f.url} href={safeHref(f.url)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-line px-4 py-2 text-sm font-bold hover:border-primary">
                  {f.kind === "pdf" ? "📄" : "🖼️"} {f.title}
                </a>
              ))}
            </div>
          ) : null}
        </Section>
      );
    case "schedule": {
      if (!block.data.classes.length) return null;
      const days = DAY_ORDER.filter((d) => block.data.classes.some((c) => c.day === d));
      return (
        <Section id="schedule" title={t.listing.schedule} icon="🗓️">
          <div className="grid grid-cols-1 gap-4">
            {days.map((d) => (
              <div key={d}>
                <h3 className="mb-1.5 font-bold text-primary">{DAY_FULL[d]}</h3>
                <ul className="grid grid-cols-1 gap-2">
                  {block.data.classes
                    .filter((c) => c.day === d)
                    .sort((a, b) => a.start.localeCompare(b.start))
                    .map((c, i) => (
                      <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-2xl bg-surface-alt px-3 py-2.5">
                        <span className="font-mono text-sm font-bold">
                          {c.start}–{c.end}
                        </span>
                        <span className="min-w-0 flex-1 font-bold">{c.title}</span>
                        {c.age ? <span className="whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-xs font-bold">👶 {c.age}</span> : null}
                        {c.teacher ? <span className="text-sm text-muted">🎓 {c.teacher}</span> : null}
                        {c.price !== undefined ? (
                          <span className="text-sm font-extrabold">
                            {formatPrice(c.price)}
                            {c.priceNote ? <span className="font-normal text-muted"> {c.priceNote}</span> : null}
                          </span>
                        ) : null}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
          {block.data.note ? <p className="mt-3 text-sm text-muted">{block.data.note}</p> : null}
        </Section>
      );
    }
    case "events":
      return (
        <Section id="events" title={t.listing.events} icon="🎉">
          <ul className="grid grid-cols-1 gap-4">
            {block.data.items.map((e, i) => (
              <li key={i} className="grid min-w-0 gap-3 overflow-hidden rounded-2xl border border-line sm:grid-cols-[12rem_1fr]">
                {e.photoUrl ? <Photo src={e.photoUrl} alt={e.title} className="aspect-[16/9] w-full sm:aspect-auto sm:h-full" sizes="(max-width: 640px) 100vw, 192px" /> : null}
                <div className="min-w-0 p-3 sm:pl-0">
                  <p className="text-sm font-extrabold text-accent-ink">📅 {formatEventWhen(e.start, e.end)}</p>
                  <h3 className="mt-1 text-lg font-extrabold leading-tight">{e.title}</h3>
                  {e.place ? <p className="mt-1 text-sm text-muted">📍 {e.place}</p> : null}
                  {e.description ? <p className="mt-2 text-sm leading-relaxed">{e.description}</p> : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {e.price !== undefined ? (
                      <span className="rounded-full bg-primary-soft px-2.5 py-1 text-sm font-bold text-primary">{e.price === 0 ? "Бесплатно" : formatPrice(e.price)}</span>
                    ) : null}
                    {safeHref(e.registerUrl) ? (
                      <a href={safeHref(e.registerUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 py-2 text-sm font-bold text-on-accent hover:bg-accent-hover">
                        ✍️ Записаться
                      </a>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      );
    case "vacancies":
      return (
        <Section id="vacancies" title={t.listing.vacancies} icon="💼">
          <ul className="grid grid-cols-1 gap-3">
            {block.data.items.map((v, i) => (
              <li key={i} className="min-w-0 rounded-2xl border border-line p-4">
                <h3 className="text-lg font-extrabold">{v.title}</h3>
                {v.terms ? <p className="mt-1 text-sm">🕒 {v.terms}</p> : null}
                {v.requirements ? <p className="mt-1 text-sm">📋 {v.requirements}</p> : null}
                {v.contact ? <p className="mt-1 text-sm font-semibold">📞 {v.contact}</p> : null}
                <p className="mt-2 text-xs text-muted">
                  Опубликовано {formatDayMonth(v.postedAt)} · актуально до {formatDayMonth(vacancyUntil(v))}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      );
    case "news": {
      if (!block.data.posts.length) return null;
      const post = (p: (typeof block.data.posts)[number], i: number) => (
        <li key={i} className="grid min-w-0 gap-3 border-b border-line pb-4 last:border-0 last:pb-0 sm:grid-cols-[1fr_9rem]">
          <div className="min-w-0">
            <p className="text-sm font-bold text-muted">🗞️ {formatDayMonth(p.date)}</p>
            <p className="mt-1 leading-relaxed">{p.text}</p>
          </div>
          {p.photoUrl ? (
            <div className="overflow-hidden rounded-xl sm:order-none">
              <ZoomImage src={p.photoUrl} alt={`Новость от ${formatDayMonth(p.date)}`} sizes="(max-width: 640px) 100vw, 144px" />
            </div>
          ) : null}
        </li>
      );
      return (
        <Section id="news" title={t.listing.news} icon="📰">
          <ul className="grid grid-cols-1 gap-4">{block.data.posts.slice(0, NEWS_VISIBLE).map(post)}</ul>
          {block.data.posts.length > NEWS_VISIBLE ? (
            <details className="group mt-4">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-2xl border border-line px-4 font-bold hover:border-primary group-open:hidden">
                Показать все ({block.data.posts.length})
              </summary>
              <ul className="grid gap-4 border-t border-line pt-4">{block.data.posts.slice(NEWS_VISIBLE).map((p, i) => post(p, i + NEWS_VISIBLE))}</ul>
            </details>
          ) : null}
        </Section>
      );
    }
    case "certificates":
      if (!block.data.items.length) return null;
      return (
        <Section id="certificates" title={t.listing.certificates} icon="📜">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {block.data.items.map((c, i) => (
              <li key={i} className="min-w-0 overflow-hidden rounded-2xl border border-line">
                {c.imageUrl ? (
                  <ZoomImage src={c.imageUrl} alt={c.title} />
                ) : (
                  <div className="grid aspect-[4/3] place-items-center bg-primary-soft text-3xl" aria-hidden>
                    📜
                  </div>
                )}
                <div className="p-2.5">
                  <p className="text-sm font-bold leading-snug">{c.title}</p>
                  {c.issuer || c.year ? (
                    <p className="text-xs text-muted">{[c.issuer, c.year].filter(Boolean).join(", ")}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      );
  }
}

export function ListingView({
  listingId,
  data,
  categoryName,
  categoryHref,
  rating,
  reviewsCount = 0,
  isDemo = false,
  districtNames,
  share,
  vimeoThumbs = {},
  reviews = [],
  hasOwner = true,
  preview = false,
  wide = false,
}: {
  listingId: string;
  data: ListingData;
  categoryName: string;
  categoryHref: string;
  rating?: number | null;
  reviewsCount?: number;
  isDemo?: boolean;
  districtNames: Record<string, string>;
  share: ShareInfo;
  vimeoThumbs?: Record<string, string>;
  reviews?: PublicReview[];
  hasOwner?: boolean;
  preview?: boolean;
  // Страница карточки на компьютере: справа закреплённая панель «Связаться» (2 ноября 2026). В редакторе и проверке — нет.
  wide?: boolean;
}) {
  const { header, contacts } = data;
  const hours = data.blocks.find((b) => b.type === "hours");
  const address = data.blocks.find((b) => b.type === "address");
  const districts = districtLabels(header.districtSlugs, districtNames);
  const sectionTitle = t.sections[data.section].title;
  const waText = "Здравствуйте! Нашёл(а) вас в каталоге HBC.";
  const request = data.blocks.find((b) => b.type === "request" && !b.hidden);
  const requestEnabled = request?.type === "request" && request.data.enabled;
  const team = data.blocks.find((b) => b.type === "team" && !b.hidden);
  const servicesBlock = data.blocks.find((b) => b.type === "services" && !b.hidden);
  const ctx: BlockContext = {
    listingId,
    isDemo,
    preview,
    services: servicesBlock?.type === "services" ? servicesBlock.data.groups.flatMap((g) => g.items.map((i) => i.name)).slice(0, 60) : [],
    districtNames,
    vimeoThumbs,
    requestEnabled,
    whatsapp: contacts.whatsapp,
    title: header.title,
    bookableNames: team?.type === "team" ? team.data.members.filter((m) => m.bookable).map((m) => m.name) : [],
    filter: filterFromHref(data.section, categoryHref),
  };

  return (
    <div className="pb-action-bar md:pb-0">
      {requestEnabled && !preview ? <TelegramRequestButton /> : null}
      <nav aria-label="Хлебные крошки" className="mb-4 text-sm text-muted">
        <ol className="flex flex-wrap gap-1">
          <li>
            <Link href="/" className="hover:text-primary">Главная</Link> ›
          </li>
          <li>
            <Link href={`/${data.section}`} className="hover:text-primary">{sectionTitle}</Link> ›
          </li>
          {categoryName ? (
            <li>
              <Link href={categoryHref} className="hover:text-primary">{categoryName}</Link>
            </li>
          ) : null}
        </ol>
      </nav>

      <div className={wide ? "lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8" : undefined}>
      <div className="min-w-0">
      <header className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-sm">
        {header.coverUrl ? (
          <Photo src={header.coverUrl} alt={header.title} className="h-40 w-full sm:h-56" sizes="(max-width: 768px) 100vw, 768px" priority />
        ) : (
          <div className="h-28 bg-gradient-to-r from-primary via-[#3a3a40] to-[#8a7a3a] sm:h-40" aria-hidden />
        )}
        <div className="px-5 pb-6 sm:px-7 sm:pb-7">
          {header.logoUrl ? (
            <div className="relative -mt-10 size-20 overflow-hidden rounded-3xl border-4 border-white bg-white shadow-md">
              <Photo src={header.logoUrl} alt={`Логотип: ${header.title}`} className="size-full" sizes="80px" priority />
            </div>
          ) : (
            // relative — иначе обложка (картинка рисуется позже фона блока) перекрывает заглушку логотипа
            <div className="relative -mt-10 grid size-20 place-items-center rounded-3xl border-4 border-white bg-highlight text-2xl font-extrabold shadow-md">
              {header.title.replace(/[«»"()]/g, "").trim()[0]}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {header.badges.includes("verified") ? (
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-highlight px-2.5 py-1 text-xs font-extrabold">
                <CheckBadgeIcon className="size-3.5" /> {t.listing.verified}
              </span>
            ) : null}
            {header.badges.includes("documents_checked") ? (
              <span className="whitespace-nowrap rounded-full bg-[#e5f4e4] px-2.5 py-1 text-xs font-bold text-success">Документы проверены</span>
            ) : null}
            {hours?.type === "hours" ? <OpenNowBadge week={hours.data.week} mode={hours.data.mode} /> : null}
          </div>
          <h1 className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">{header.title}</h1>
          <p className="mt-2 text-muted">
            {header.profession ?? categoryName} · {districts.join(", ")}, Хайфа
          </p>
          {header.slogan ? <p className="mt-3 text-lg font-semibold leading-snug">{header.slogan}</p> : null}
          {rating && reviewsCount > 0 ? (
            <p className="mt-3 inline-flex items-center gap-1 font-bold">
              <StarIcon className="size-5 fill-highlight text-highlight" /> {Number(rating).toFixed(1)}
              <span className="font-normal text-muted">
                · {reviewsCount} {pluralRu(reviewsCount, "отзыв", "отзыва", "отзывов")}
                {isDemo ? " (примерные)" : ""}
              </span>
            </p>
          ) : null}


          <div className={`mt-6 hidden flex-wrap gap-2 md:flex ${wide ? "lg:hidden" : ""}`}>
            {contacts.phone ? (
              <a href={telHref(contacts.phone)} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-5 font-bold text-white hover:bg-primary-hover">
                <PhoneIcon className="size-5" /> {formatPhone(contacts.phone)}
              </a>
            ) : null}
            {contacts.whatsapp ? (
              <a href={whatsappHref(contacts.whatsapp, waText)} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#15803d] px-5 font-bold text-white hover:brightness-95">
                <ChatIcon className="size-5" /> {t.listing.whatsapp}
              </a>
            ) : null}
            {contacts.telegram ? (
              <a href={telegramHref(contacts.telegram)} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#29A9EB] px-5 font-bold text-white hover:brightness-95">
                <SendIcon className="size-5" /> {t.listing.telegram}
              </a>
            ) : null}
            <FavoriteButton listingId={listingId} withLabel />
            <a href="#share" data-track="share" className="inline-flex h-12 items-center gap-2 rounded-2xl border border-line px-4 font-bold hover:border-primary">
              <ShareIcon className="size-5" /> {t.listing.share}
            </a>
          </div>
        </div>
      </header>

      <div className="card-blocks mt-6 grid grid-cols-1 gap-6">
        {data.blocks.map((b) => (
          <Block key={b.id} block={b} ctx={ctx} />
        ))}

        <Section id="reviews" title={t.listing.reviews} icon="💬">
          {reviews.length ? (
            <ul className="mb-4 grid gap-4">
              {reviews.slice(0, 20).map((r) => (
                <li key={r.id} className="min-w-0 border-b border-line pb-4 last:border-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-bold">{r.author_name}</span>
                    <span className="text-highlight" aria-label={`Оценка ${r.rating} из 5`}>
                      {"★".repeat(r.rating)}
                      <span className="text-line">{"★".repeat(5 - r.rating)}</span>
                    </span>
                    <span className="text-sm text-muted">{formatDateRu(r.created_at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-line leading-relaxed">{r.text}</p>
                  {r.owner_reply ? (
                    <div className="mt-2 rounded-xl bg-surface-alt p-3 text-sm">
                      <p className="font-bold">💬 Ответ владельца</p>
                      <p className="mt-1 whitespace-pre-line">{r.owner_reply}</p>
                    </div>
                  ) : null}
                  {!preview ? (
                    <ComplaintButton
                      listingId={listingId}
                      kind="review"
                      reviewId={r.id}
                      label="Пожаловаться"
                      className="mt-1 min-h-11 text-xs font-semibold text-muted hover:text-danger"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-muted">Отзывов пока нет. Будьте первым!</p>
          )}
          {!preview ? <ReviewForm listingId={listingId} isDemo={isDemo} /> : null}
        </Section>

        <Section id="share" title={t.listing.shareTitle} icon="📲">
          <SharePanel
            title={header.title}
            url={share.url}
            shortUrl={share.shortUrl}
            miniAppUrl={share.miniAppUrl}
            qrSvg={share.qrSvg}
            temporaryAddress={share.temporaryAddress}
          />
        </Section>

        {!preview ? (
          <div className="flex flex-wrap gap-3 text-sm">
            {!hasOwner ? (
              <ClaimButton
                listingId={listingId}
                label={t.listing.claim}
                className="min-h-11 rounded-full border border-line bg-white px-4 py-2 font-bold hover:border-primary"
              />
            ) : null}
            <ReportListingButton listingId={listingId} label={t.listing.report} />
            <ComplaintButton
              listingId={listingId}
              kind="data_request"
              label={t.listing.fixData}
              className="min-h-11 rounded-full border border-line bg-white px-4 py-2 font-semibold text-muted hover:border-primary"
            />
          </div>
        ) : null}
        {/* Короткое фактическое резюме для поисковиков и нейросетей (раздел 8 ТЗ). Внизу: наверху оно повторяло шапку. */}
          <p className="rounded-2xl bg-white/60 p-4 text-sm leading-relaxed text-muted">
            {header.title} — {(header.profession ?? categoryName).toLowerCase()} в районе {districts.join(", ")}, Хайфа.
            {contacts.phone ? ` Телефон: ${formatPhone(contacts.phone)}.` : ""}
            {data.blocks.some((b) => b.type === "languages")
              ? ` Языки: ${(data.blocks.find((b) => b.type === "languages") as Extract<ListingBlock, { type: "languages" }>).data.items.join(", ").toLowerCase()}.`
              : ""}
          </p>
        {!preview ? <ListingTracker listingId={listingId} /> : null}
        {data.confirmedAt ? (
          <p className="flex items-center gap-1 text-sm text-muted">
            <ClockIcon className="size-4" /> {t.listing.updated} {formatDateRu(data.confirmedAt)}
          </p>
        ) : null}
      </div>
      </div>
      {wide ? (
        <ContactAside
          listingId={listingId}
          contacts={contacts}
          waText={waText}
          openNow={hours?.type === "hours" ? <OpenNowBadge week={hours.data.week} mode={hours.data.mode} /> : null}
          address={address?.type === "address" ? address.data : undefined}
          requestEnabled={Boolean(requestEnabled)}
        />
      ) : null}
      </div>

      {/* Закреплённая панель действий на телефоне (раздел 4 и 10 ТЗ). */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-xl gap-2">
          {contacts.phone ? (
            <a href={telHref(contacts.phone)} className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-1 font-bold text-white">
              <PhoneIcon className="size-5 shrink-0 max-[359px]:hidden" /> {t.listing.call}
            </a>
          ) : null}
          {contacts.whatsapp ? (
            <a href={whatsappHref(contacts.whatsapp, waText)} className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#15803d] px-1 font-bold text-white">
              <ChatIcon className="size-5 shrink-0 max-[359px]:hidden" /> WhatsApp
            </a>
          ) : null}
          {address?.type === "address" && address.data.lat && address.data.lng ? (
            <a
              href={wazeHref(address.data.lat, address.data.lng)}
              className="grid size-12 shrink-0 place-items-center rounded-2xl border border-line"
              aria-label={t.listing.route}
            >
              <MapPinIcon className="size-5" />
            </a>
          ) : data.blocks.some((b) => b.type === "request") ? (
            <a href="#request" className="flex h-12 min-w-0 flex-1 items-center justify-center rounded-2xl bg-accent px-1 font-bold text-on-accent">
              Записаться
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Панель «Связаться» справа на компьютере: всегда на виду при прокрутке длинной карточки.
function ContactAside({
  listingId,
  contacts,
  waText,
  openNow,
  address,
  requestEnabled,
}: {
  listingId: string;
  contacts: ListingData["contacts"];
  waText: string;
  openNow: React.ReactNode;
  address?: { address: string; lat?: number; lng?: number };
  requestEnabled: boolean;
}) {
  const btn = "flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 font-bold";
  return (
    <aside className="hidden lg:sticky lg:top-24 lg:block" aria-label="Связаться">
      <div className="grid gap-3 rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-sm">
        <p className="flex items-center justify-between gap-2 text-lg font-extrabold">
          Связаться {openNow}
        </p>
        {contacts.phone ? (
          <a href={telHref(contacts.phone)} className={`${btn} bg-primary text-white hover:bg-primary-hover`}>
            <PhoneIcon className="size-5" /> {formatPhone(contacts.phone)}
          </a>
        ) : null}
        {contacts.whatsapp ? (
          <a href={whatsappHref(contacts.whatsapp, waText)} className={`${btn} bg-[#15803d] text-white hover:brightness-95`}>
            <ChatIcon className="size-5" /> {t.listing.whatsapp}
          </a>
        ) : null}
        {contacts.telegram ? (
          <a href={telegramHref(contacts.telegram)} className={`${btn} bg-[#29A9EB] text-white hover:brightness-95`}>
            <SendIcon className="size-5" /> {t.listing.telegram}
          </a>
        ) : null}
        {requestEnabled ? (
          <a href="#request" className={`${btn} bg-accent text-on-accent hover:bg-accent-hover`}>
            ✍️ {t.listing.request}
          </a>
        ) : null}
        {address?.address ? (
          <div className="mt-1 grid gap-2 border-t border-line pt-4 text-sm">
            <p className="flex gap-2">
              <MapPinIcon className="mt-0.5 size-4 shrink-0 text-primary" /> {address.address}
            </p>
            {address.lat && address.lng ? (
              <a href={wazeHref(address.lat, address.lng)} className="font-bold text-primary hover:underline">
                {t.listing.route} ↗
              </a>
            ) : null}
          </div>
        ) : null}
        <div className="mt-1 flex gap-2 border-t border-line pt-4">
          <FavoriteButton listingId={listingId} withLabel className="flex-1 justify-center" />
          <a href="#share" data-track="share" className="inline-flex h-12 items-center gap-2 rounded-2xl border border-line px-4 font-bold hover:border-primary" aria-label={t.listing.share}>
            <ShareIcon className="size-5" />
          </a>
        </div>
      </div>
    </aside>
  );
}

// Один блок отдельно — для сравнения «было — стало» в админке.
export function BlockPreview({ block, districtNames }: { block: ListingBlock; districtNames: Record<string, string> }) {
  const ctx: BlockContext = {
    listingId: "preview",
    isDemo: true,
    preview: true,
    services: [],
    districtNames,
    vimeoThumbs: {},
    requestEnabled: false,
    title: "",
    bookableNames: [],
    filter: filterConfig("biznes", null),
  };
  return <Block block={{ ...block, hidden: false } as ListingBlock} ctx={ctx} />;
}
