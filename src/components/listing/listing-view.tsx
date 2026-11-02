import Link from "next/link";
import type { ListingBlock, ListingData, MenuTag, WeekdayKey } from "@/lib/blocks/types";
import {
  ChatIcon,
  CheckBadgeIcon,
  ClockIcon,
  FlagIcon,
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

export type ShareInfo = { url: string; shortUrl?: string; miniAppUrl: string; qrSvg?: string; temporaryAddress: boolean };

// Что нужно блокам кроме их собственных данных.
type BlockContext = {
  districtNames: Record<string, string>;
  vimeoThumbs: Record<string, string>;
  requestEnabled: boolean;
  whatsapp?: string;
  title: string;
  bookableNames: string[];
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
  "Выезд на дом": "🚗",
  "Онлайн": "💻",
  "Парковка": "🅿️",
};

function Section({ id, title, icon, children }: { id?: string; title: string; icon?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-xl font-extrabold">
        {icon ? (
          <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-lg" aria-hidden>
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
        <div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-primary-soft to-[#d3ebee] text-sm font-semibold text-primary">
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
          <ul className="grid gap-3">
            {block.data.items.map((o, i) => (
              <li key={i} className="rounded-2xl border-2 border-accent/30 bg-[#fff4ee] p-4">
                <p className="flex items-center gap-2 font-extrabold text-accent">
                  <TagIcon className="size-5" />
                  {o.discountPercent ? `−${o.discountPercent}% · ` : ""}
                  {o.title}
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
          <div className="grid gap-5">
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
          <div className="mb-3">
            <OpenNowBadge week={block.data.week} exceptions={block.data.exceptions} />
          </div>
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
          <p>{block.data.districtSlugs.map((s) => districtNames[s] ?? s).join(", ")}</p>
        </Section>
      );
    case "gallery":
      return (
        <Section title={t.listing.gallery} icon="📷">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {block.data.photos.map((p, i) => (
              <PhotoPlaceholder key={i} label={p.caption} url={p.url} />
            ))}
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
    case "features":
      return (
        <Section title={t.listing.features} icon="⭐">
          <ul className="flex flex-wrap gap-2">
            {block.data.items.map((f) => (
              <li key={f} className="rounded-full border border-line bg-surface-alt px-3 py-1.5 text-sm font-semibold">
                {FEATURE_ICONS[f] ? `${FEATURE_ICONS[f]} ` : ""}
                {f}
              </li>
            ))}
          </ul>
        </Section>
      );
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
          <form className="grid gap-3" aria-describedby="request-note">
            <input disabled placeholder="Ваше имя" className="h-12 rounded-xl border border-line bg-surface-alt px-4" />
            <input disabled placeholder="Телефон или Telegram" className="h-12 rounded-xl border border-line bg-surface-alt px-4" />
            {ctx.bookableNames.length ? (
              <label className="grid gap-1 text-sm font-bold">
                К кому
                <select id="request-master" disabled defaultValue="" className="h-12 rounded-xl border border-line bg-surface-alt px-4 font-normal">
                  <option value="">Любой мастер</option>
                  {ctx.bookableNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {block.data.withTime ? (
              <input disabled placeholder="Желаемые день и время" className="h-12 rounded-xl border border-line bg-surface-alt px-4" />
            ) : null}
            <textarea disabled placeholder="Комментарий" rows={3} className="rounded-xl border border-line bg-surface-alt px-4 py-3" />
            <button type="button" disabled className="h-12 rounded-2xl bg-accent font-bold text-white opacity-70">
              Отправить заявку
            </button>
            <p id="request-note" className="text-sm text-muted">
              Форма заработает на этапе 4: заявка придёт владельцу в Telegram и сохранится в кабинете.
            </p>
          </form>
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
                      className="mt-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1fa855] px-3 py-2 text-sm font-bold text-white"
                    >
                      💬 Записаться
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
          <ul className="grid gap-5">
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
          <div className="grid gap-6">
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
                <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-line px-4 py-2 text-sm font-bold hover:border-primary">
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
          <div className="grid gap-4">
            {days.map((d) => (
              <div key={d}>
                <h3 className="mb-1.5 font-bold text-primary">{DAY_FULL[d]}</h3>
                <ul className="grid gap-2">
                  {block.data.classes
                    .filter((c) => c.day === d)
                    .sort((a, b) => a.start.localeCompare(b.start))
                    .map((c, i) => (
                      <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-2xl bg-surface-alt px-3 py-2.5">
                        <span className="font-mono text-sm font-bold">
                          {c.start}–{c.end}
                        </span>
                        <span className="min-w-0 flex-1 font-bold">{c.title}</span>
                        {c.age ? <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold">👶 {c.age}</span> : null}
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
          <ul className="grid gap-4">
            {block.data.items.map((e, i) => (
              <li key={i} className="grid min-w-0 gap-3 overflow-hidden rounded-2xl border border-line sm:grid-cols-[12rem_1fr]">
                {e.photoUrl ? <Photo src={e.photoUrl} alt={e.title} className="aspect-[16/9] w-full sm:aspect-auto sm:h-full" sizes="(max-width: 640px) 100vw, 192px" /> : null}
                <div className="min-w-0 p-3 sm:pl-0">
                  <p className="text-sm font-extrabold text-accent">📅 {formatEventWhen(e.start, e.end)}</p>
                  <h3 className="mt-1 text-lg font-extrabold leading-tight">{e.title}</h3>
                  {e.place ? <p className="mt-1 text-sm text-muted">📍 {e.place}</p> : null}
                  {e.description ? <p className="mt-2 text-sm leading-relaxed">{e.description}</p> : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {e.price !== undefined ? (
                      <span className="rounded-full bg-primary-soft px-2.5 py-1 text-sm font-bold text-primary">{e.price === 0 ? "Бесплатно" : formatPrice(e.price)}</span>
                    ) : null}
                    {e.registerUrl ? (
                      <a href={e.registerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover">
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
          <ul className="grid gap-3">
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
          <ul className="grid gap-4">{block.data.posts.slice(0, NEWS_VISIBLE).map(post)}</ul>
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
}) {
  const { header, contacts } = data;
  const hours = data.blocks.find((b) => b.type === "hours");
  const address = data.blocks.find((b) => b.type === "address");
  const districts = header.districtSlugs.map((s) => districtNames[s] ?? s);
  const sectionTitle = t.sections[data.section].title;
  const waText = "Здравствуйте! Нашёл(а) вас в каталоге HBC.";
  const request = data.blocks.find((b) => b.type === "request" && !b.hidden);
  const requestEnabled = request?.type === "request" && request.data.enabled;
  const team = data.blocks.find((b) => b.type === "team" && !b.hidden);
  const ctx: BlockContext = {
    districtNames,
    vimeoThumbs,
    requestEnabled,
    whatsapp: contacts.whatsapp,
    title: header.title,
    bookableNames: team?.type === "team" ? team.data.members.filter((m) => m.bookable).map((m) => m.name) : [],
  };

  return (
    <div className="pb-action-bar md:pb-0">
      <nav aria-label="Хлебные крошки" className="mb-4 text-sm text-muted">
        <ol className="flex flex-wrap gap-1">
          <li>
            <Link href="/" className="hover:text-primary">Главная</Link> ›
          </li>
          <li>
            <Link href={`/${data.section}`} className="hover:text-primary">{sectionTitle}</Link> ›
          </li>
          <li>
            <Link href={categoryHref} className="hover:text-primary">{categoryName}</Link>
          </li>
        </ol>
      </nav>

      <header className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-sm">
        {header.coverUrl ? (
          <Photo src={header.coverUrl} alt={header.title} className="h-40 w-full sm:h-56" sizes="(max-width: 768px) 100vw, 768px" priority />
        ) : (
          <div className="h-28 bg-gradient-to-r from-primary via-[#127c8a] to-[#2aa5a0] sm:h-40" aria-hidden />
        )}
        <div className="px-5 pb-5">
          {header.logoUrl ? (
            <div className="relative -mt-10 size-20 overflow-hidden rounded-3xl border-4 border-white bg-white shadow-md">
              <Photo src={header.logoUrl} alt={`Логотип: ${header.title}`} className="size-full" sizes="80px" priority />
            </div>
          ) : (
            <div className="-mt-10 grid size-20 place-items-center rounded-3xl border-4 border-white bg-highlight text-2xl font-extrabold shadow-md">
              {header.title.replace(/[«»"()]/g, "").trim()[0]}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {header.badges.includes("verified") ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-highlight px-2.5 py-1 text-xs font-extrabold">
                <CheckBadgeIcon className="size-3.5" /> {t.listing.verified}
              </span>
            ) : null}
            {header.badges.includes("russian_speaking") ? (
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">{t.listing.russianSpeaking}</span>
            ) : null}
            {header.badges.includes("documents_checked") ? (
              <span className="rounded-full bg-[#e5f4e4] px-2.5 py-1 text-xs font-bold text-success">Документы проверены</span>
            ) : null}
            {hours?.type === "hours" ? <OpenNowBadge week={hours.data.week} /> : null}
          </div>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">{header.title}</h1>
          <p className="mt-1 text-muted">
            {header.profession ?? categoryName} · {districts.join(", ")}, Хайфа
          </p>
          {header.slogan ? <p className="mt-2 font-semibold">{header.slogan}</p> : null}
          {rating && reviewsCount > 0 ? (
            <p className="mt-2 inline-flex items-center gap-1 font-bold">
              <StarIcon className="size-5 fill-highlight text-highlight" /> {Number(rating).toFixed(1)}
              <span className="font-normal text-muted">
                · {reviewsCount} {pluralRu(reviewsCount, "отзыв", "отзыва", "отзывов")}
                {isDemo ? " (примерные)" : ""}
              </span>
            </p>
          ) : null}

          {/* Короткое фактическое резюме для поисковиков и нейросетей (раздел 8 ТЗ). */}
          <p className="mt-4 rounded-2xl bg-surface-alt p-4 text-sm leading-relaxed">
            {header.title} — {(header.profession ?? categoryName).toLowerCase()} в районе {districts.join(", ")}, Хайфа.
            {contacts.phone ? ` Телефон: ${formatPhone(contacts.phone)}.` : ""}
            {data.blocks.some((b) => b.type === "languages")
              ? ` Языки: ${(data.blocks.find((b) => b.type === "languages") as Extract<ListingBlock, { type: "languages" }>).data.items.join(", ").toLowerCase()}.`
              : ""}
          </p>

          <div className="mt-4 hidden flex-wrap gap-2 md:flex">
            {contacts.phone ? (
              <a href={telHref(contacts.phone)} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-5 font-bold text-white hover:bg-primary-hover">
                <PhoneIcon className="size-5" /> {formatPhone(contacts.phone)}
              </a>
            ) : null}
            {contacts.whatsapp ? (
              <a href={whatsappHref(contacts.whatsapp, waText)} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#1fa855] px-5 font-bold text-white hover:brightness-95">
                <ChatIcon className="size-5" /> {t.listing.whatsapp}
              </a>
            ) : null}
            {contacts.telegram ? (
              <a href={telegramHref(contacts.telegram)} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#29A9EB] px-5 font-bold text-white hover:brightness-95">
                <SendIcon className="size-5" /> {t.listing.telegram}
              </a>
            ) : null}
            <FavoriteButton listingId={listingId} withLabel />
            <a href="#share" className="inline-flex h-12 items-center gap-2 rounded-2xl border border-line px-4 font-bold hover:border-primary">
              <ShareIcon className="size-5" /> {t.listing.share}
            </a>
          </div>
        </div>
      </header>

      <div className="mt-5 grid gap-5">
        {data.blocks.map((b) => (
          <Block key={b.id} block={b} ctx={ctx} />
        ))}

        <Section title={t.listing.reviews} icon="💬">
          <p className="text-muted">Отзывы посетителей и отзывы Google появятся на этапе 3.</p>
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

        <div className="flex flex-wrap gap-3 text-sm">
          <button type="button" className="rounded-full border border-line bg-white px-4 py-2 font-bold hover:border-primary">
            {t.listing.claim}
          </button>
          <button type="button" className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-4 py-2 font-semibold text-muted hover:border-danger hover:text-danger">
            <FlagIcon className="size-4" /> {t.listing.report}
          </button>
          <button type="button" className="rounded-full border border-line bg-white px-4 py-2 font-semibold text-muted hover:border-primary">
            {t.listing.fixData}
          </button>
        </div>
        {data.confirmedAt ? (
          <p className="flex items-center gap-1 text-sm text-muted">
            <ClockIcon className="size-4" /> {t.listing.updated} {formatDateRu(data.confirmedAt)}
          </p>
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
            <a href={whatsappHref(contacts.whatsapp, waText)} className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#1fa855] px-1 font-bold text-white">
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
            <a href="#request" className="flex h-12 min-w-0 flex-1 items-center justify-center rounded-2xl bg-accent px-1 font-bold text-white">
              Записаться
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
