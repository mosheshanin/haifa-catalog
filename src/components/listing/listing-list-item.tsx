import Link from "next/link";
import { CheckBadgeIcon, MapPinIcon, StarIcon, TagIcon } from "@/components/icons";
import { OpenNowBadge } from "@/components/listing/open-now";
import { FavoriteButton } from "@/components/listing/favorite-button";
import { Photo } from "@/components/ui/photo";
import { pluralRu } from "@/lib/format";
import { t } from "@/i18n/ru";
import type { HoursException, HoursInterval, Section, WeekdayKey } from "@/lib/blocks/types";

// Минимум данных для строки списка (подходит и для результатов поиска, и для избранного).
export type ListItemData = {
  id: string;
  section: Section;
  slug: string;
  title: string;
  summary: string | null;
  cover_url: string | null;
  languages: string[];
  has_offer: boolean;
  rating_avg: number | null;
  rating_count: number;
  hours: (Partial<Record<WeekdayKey, HoursInterval[]>> & { exceptions?: HoursException[] }) | null;
  is_verified: boolean;
  is_demo: boolean;
  distance_m?: number | null;
};

const LANG_SHORT: Record<string, string> = {
  Русский: "Рус",
  Иврит: "Ивр",
  Английский: "Англ",
  Арабский: "Араб",
  Украинский: "Укр",
  Французский: "Фр",
  Амхарский: "Амх",
};

function initials(title: string) {
  return title
    .replace(/[«»"()]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m / 10) * 10} м` : `${(m / 1000).toFixed(1).replace(".", ",")} км`;
}

// Строка в списке: фото, название, категория, район, рейтинг, «Открыто сейчас», языки, метки совпадений
// (раздел 10 ТЗ и анализ аналогов).
export function ListingListItem({
  listing,
  subtitle,
  districtLabel,
  reasons = [],
}: {
  listing: ListItemData;
  subtitle: string;
  districtLabel: string;
  reasons?: string[];
}) {
  const href = `/${listing.section}/${listing.slug}`;
  const langs = listing.languages.map((l) => LANG_SHORT[l] ?? l);
  return (
    <article className="group relative flex gap-3 rounded-[var(--radius-card)] border border-line bg-white p-3 shadow-sm transition hover:border-primary hover:shadow-md sm:gap-4 sm:p-4">
      <div className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[#138a99] text-2xl font-extrabold text-white sm:size-28">
        {listing.cover_url ? (
          <Photo src={listing.cover_url} alt="" className="absolute inset-0 size-full" sizes="112px" />
        ) : (
          initials(listing.title)
        )}
        {listing.has_offer ? (
          <span className="absolute left-1 top-1 z-10 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-xs font-bold">
            <TagIcon className="size-3" /> Акция
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        {/* «В избранное» — в углу карточки, чтобы название получило всю ширину */}
        <FavoriteButton listingId={listing.id} className="absolute right-1.5 top-1.5 z-10" />
        <h3 className="min-w-0 pr-8 text-lg font-extrabold leading-snug text-balance">
          <Link href={href} className="after:absolute after:inset-0 focus:outline-none">
            {listing.title}
          </Link>
        </h3>
        <p className="mt-0.5 truncate text-sm text-muted">{subtitle}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          {/* Рейтинг показываем только при наличии отзывов — без «нулей» (анализ аналогов). */}
          {listing.rating_count > 0 && listing.rating_avg ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap font-bold">
              <StarIcon className="size-4 fill-highlight text-highlight" />
              {Number(listing.rating_avg).toFixed(1)}
              <span className="font-normal text-muted">
                ({listing.rating_count} {pluralRu(listing.rating_count, "отзыв", "отзыва", "отзывов")})
              </span>
            </span>
          ) : null}
          {districtLabel ? (
            <span className="inline-flex min-w-0 max-w-full items-center gap-1 text-muted">
              <MapPinIcon className="size-4 shrink-0" />
              <span className="truncate">{districtLabel}</span>
            </span>
          ) : null}
          {listing.distance_m != null ? <span className="whitespace-nowrap font-semibold text-primary">📍 {formatDistance(listing.distance_m)}</span> : null}
          {listing.hours ? <OpenNowBadge week={listing.hours} /> : null}
          {listing.is_verified ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-highlight/40 px-2 py-0.5 text-xs font-bold">
              <CheckBadgeIcon className="size-3.5" /> {t.listing.verified}
            </span>
          ) : null}
          {langs.length ? <span className="whitespace-nowrap text-muted" title="Языки общения">🗣️ {langs.join(" · ")}</span> : null}
        </div>
        {reasons.length ? (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Почему в результатах">
            {reasons.map((r) => (
              <li key={r} className="whitespace-nowrap rounded-full bg-[#e5f4e4] px-2 py-0.5 text-xs font-bold text-success">
                {r}
              </li>
            ))}
          </ul>
        ) : null}
        {listing.is_demo ? <p className="mt-1.5 text-xs font-semibold text-muted">Пример карточки</p> : null}
      </div>
    </article>
  );
}
