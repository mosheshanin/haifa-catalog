import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingListItem } from "@/components/listing/listing-list-item";
import { ListingView } from "@/components/listing/listing-view";
import { MockNotice } from "@/components/ui/mock-notice";
import { getCategories, getCategory, getDistricts, isSection } from "@/lib/data/dictionaries";
import { MOCK_LISTINGS, mockListingBySlug, mockListingsFor } from "@/mocks/listings";
import { t } from "@/i18n/ru";

// Адрес /<раздел>/<slug> — это либо категория (/biznes/krasota), либо карточка (/biznes/nazvanie).
// База не даёт им совпасть (раздел 8 ТЗ, постоянные адреса).
export async function generateStaticParams() {
  const categories = await getCategories();
  return [
    ...categories.filter((c) => c.parent_id === null).map((c) => ({ section: c.section, slug: c.slug })),
    ...MOCK_LISTINGS.map((l) => ({ section: l.data.section, slug: l.slug })),
  ];
}

export async function generateMetadata({ params }: PageProps<"/[section]/[slug]">): Promise<Metadata> {
  const { section, slug } = await params;
  if (!isSection(section)) return {};
  const category = await getCategory(section, slug);
  if (category) {
    return {
      title: category.seo_title ?? `${category.name} в Хайфе`,
      description: category.seo_description ?? `${category.name} в Хайфе: русскоязычные ${section === "biznes" ? "бизнесы" : "специалисты"}, контакты, цены и отзывы.`,
      alternates: { canonical: `/${section}/${slug}` },
    };
  }
  const listing = mockListingBySlug(section, slug);
  if (listing) {
    return {
      title: listing.data.header.title,
      description: listing.data.header.slogan,
      // Примерные карточки не индексируются.
      robots: { index: false, follow: false },
    };
  }
  return {};
}

export default async function SlugPage({ params }: PageProps<"/[section]/[slug]">) {
  const { section, slug } = await params;
  if (!isSection(section)) notFound();

  const [category, districts] = await Promise.all([getCategory(section, slug), getDistricts()]);
  const districtNames = Object.fromEntries(districts.map((d) => [d.slug, d.name]));

  if (category) {
    const listings = mockListingsFor(section, category.slug);
    return (
      <div className="grid gap-6">
        <div>
          <nav aria-label="Хлебные крошки" className="mb-2 text-sm text-muted">
            <Link href="/" className="hover:text-primary">Главная</Link> ›{" "}
            <Link href={`/${section}`} className="hover:text-primary">{t.sections[section].title}</Link> › {category.name}
          </nav>
          <h1 className="text-3xl font-extrabold">
            {category.icon ? <span aria-hidden>{category.icon} </span> : null}
            {category.name} в Хайфе
          </h1>
          {category.seo_text ? <p className="mt-2 max-w-3xl text-muted">{category.seo_text}</p> : null}
        </div>
        <ul className="flex flex-wrap gap-2">
          {districts.slice(0, 8).map((d) => (
            <li key={d.id}>
              <span className="block rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold text-muted" title="Страницы «категория + район» — этап 2">
                📍 {d.name}
              </span>
            </li>
          ))}
        </ul>
        <MockNotice />
        {listings.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {listings.map((l) => (
              <ListingListItem key={l.slug} listing={l} districtLabel={l.data.header.districtSlugs.map((s) => districtNames[s] ?? s).slice(0, 2).join(", ")} />
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--radius-card)] border border-line bg-white p-8 text-center">
            <p className="text-lg font-bold">В этой категории пока нет карточек</p>
            <p className="mt-1 text-muted">Знаете хорошего специалиста? Расскажите о нём — или добавьте свой бизнес.</p>
            <Link href="/kabinet" className="mt-4 inline-flex h-11 items-center rounded-2xl bg-accent px-5 font-bold text-white hover:bg-accent-hover">
              {t.nav.addListing}
            </Link>
          </div>
        )}
      </div>
    );
  }

  const listing = mockListingBySlug(section, slug);
  if (!listing) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <MockNotice text="Это примерная карточка для макета. Названия, телефоны и отзывы вымышлены." />
      </div>
      <ListingView
        data={listing.data}
        categoryName={listing.categoryName}
        categoryHref={`/${section}/${listing.categorySlug}`}
        rating={listing.rating}
        reviewsCount={listing.reviewsCount}
        districtNames={districtNames}
      />
    </div>
  );
}
