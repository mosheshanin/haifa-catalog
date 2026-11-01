import Link from "next/link";
import type { ListingBlock, ListingData } from "@/lib/blocks/types";
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

function Block({ block, districtNames }: { block: ListingBlock; districtNames: Record<string, string> }) {
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
            <OpenNowBadge week={block.data.week} />
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
          <div className="mt-3 grid aspect-[16/7] place-items-center rounded-2xl bg-primary-soft text-sm font-semibold text-primary">
            Карта появится на этапе 2
          </div>
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
          {block.data.pairs.map((p, i) => (
            <div key={i} className="grid grid-cols-2 gap-3">
              <PhotoPlaceholder label="До" url={p.beforeUrl} />
              <PhotoPlaceholder label="После" url={p.afterUrl} />
              {p.caption ? <p className="col-span-2 text-sm text-muted">{p.caption} · слайдер сравнения — этап 2</p> : null}
            </div>
          ))}
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
}: {
  listingId: string;
  data: ListingData;
  categoryName: string;
  categoryHref: string;
  rating?: number | null;
  reviewsCount?: number;
  isDemo?: boolean;
  districtNames: Record<string, string>;
}) {
  const { header, contacts } = data;
  const hours = data.blocks.find((b) => b.type === "hours");
  const address = data.blocks.find((b) => b.type === "address");
  const districts = header.districtSlugs.map((s) => districtNames[s] ?? s);
  const sectionTitle = t.sections[data.section].title;
  const waText = "Здравствуйте! Нашёл(а) вас в каталоге HBC.";

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
          <div className="-mt-10 grid size-20 place-items-center rounded-3xl border-4 border-white bg-highlight text-2xl font-extrabold shadow-md">
            {header.title.replace(/[«»"()]/g, "").trim()[0]}
          </div>
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
            <button type="button" className="inline-flex h-12 items-center gap-2 rounded-2xl border border-line px-4 font-bold hover:border-primary">
              <ShareIcon className="size-5" /> {t.listing.share}
            </button>
          </div>
        </div>
      </header>

      <div className="mt-5 grid gap-5">
        {data.blocks.map((b) => (
          <Block key={b.id} block={b} districtNames={districtNames} />
        ))}

        <Section title={t.listing.reviews} icon="💬">
          <p className="text-muted">Отзывы посетителей и отзывы Google появятся на этапах 2–3.</p>
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
            <a href={telHref(contacts.phone)} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary font-bold text-white">
              <PhoneIcon className="size-5" /> {t.listing.call}
            </a>
          ) : null}
          {contacts.whatsapp ? (
            <a href={whatsappHref(contacts.whatsapp, waText)} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#1fa855] font-bold text-white">
              <ChatIcon className="size-5" /> WhatsApp
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
            <a href="#request" className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-accent font-bold text-white">
              Записаться
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
