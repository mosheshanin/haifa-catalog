import Link from "next/link";
import { CheckBadgeIcon, HeartIcon, MapPinIcon, StarIcon, TagIcon } from "@/components/icons";
import { OpenNowBadge } from "@/components/listing/open-now";
import { pluralRu } from "@/lib/format";
import type { MockListing } from "@/mocks/listings";
import { t } from "@/i18n/ru";
import { Photo } from "@/components/ui/photo";

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

// Карточка в списке: фото, название, категория, район, рейтинг, «Открыто сейчас» (раздел 10 ТЗ).
export function ListingListItem({ listing, districtLabel }: { listing: MockListing; districtLabel: string }) {
  const { data } = listing;
  const hours = data.blocks.find((b) => b.type === "hours");
  const href = `/${data.section}/${listing.slug}`;
  return (
    <article className="group relative flex gap-4 rounded-[var(--radius-card)] border border-line bg-white p-3 shadow-sm transition hover:border-primary hover:shadow-md sm:p-4">
      <div className="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[#138a99] text-2xl font-extrabold text-white sm:size-28">
        {data.header.coverUrl ? (
          <Photo src={data.header.coverUrl} alt="" className="absolute inset-0 size-full" sizes="112px" />
        ) : (
          initials(data.header.title)
        )}
        {listing.hasOffer ? (
          <span className="absolute left-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold">
            <TagIcon className="size-3" /> Акция
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 text-lg font-extrabold leading-tight">
            <Link href={href} className="after:absolute after:inset-0 focus:outline-none">
              {data.header.title}
            </Link>
          </h3>
          <button
            type="button"
            className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-primary-soft hover:text-accent"
            aria-label="Добавить в избранное"
            title="Избранное появится на этапе 2"
          >
            <HeartIcon className="size-5" />
          </button>
        </div>
        <p className="mt-0.5 text-sm text-muted">{data.header.profession ?? listing.categoryName}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <span className="inline-flex items-center gap-1 font-bold">
            <StarIcon className="size-4 fill-highlight text-highlight" />
            {listing.rating.toFixed(1)}
            <span className="font-normal text-muted">
              ({listing.reviewsCount} {pluralRu(listing.reviewsCount, "отзыв", "отзыва", "отзывов")})
            </span>
          </span>
          <span className="inline-flex items-center gap-1 text-muted">
            <MapPinIcon className="size-4" />
            {districtLabel}
          </span>
          {hours?.type === "hours" ? <OpenNowBadge week={hours.data.week} /> : null}
          {data.header.badges.includes("verified") ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-highlight/40 px-2 py-0.5 text-xs font-bold">
              <CheckBadgeIcon className="size-3.5" /> {t.listing.verified}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
