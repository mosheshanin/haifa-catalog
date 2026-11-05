import type { Metadata } from "next";
import Link from "next/link";
import { Icon3d } from "@/components/ui/icon-3d";
import { categoryIcon3d } from "@/lib/icons-3d";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { getFilterAvailability } from "@/lib/data/filters";
import { FiltersForm } from "@/components/catalog/filters-form";
import { Results, ResultsSkeleton } from "@/components/catalog/results";
import { ListingView } from "@/components/listing/listing-view";
import { ListingListItem } from "@/components/listing/listing-list-item";
import { MockNotice } from "@/components/ui/mock-notice";
import { getCategories, getCategory, getDistricts, isSection, type Category } from "@/lib/data/dictionaries";
import { getCategoryDistrictCounts, getCategoryListingCounts, getListingBySlug, getPublishedSlugs, getSimilar } from "@/lib/data/listings";
import { parseFilters } from "@/lib/catalog/params";
import { breadcrumbsJsonLd, jsonLdScript, listingEventsJsonLd, listingFaqJsonLd, listingJsonLd } from "@/lib/seo/jsonld";
import { isListingComplete } from "@/lib/seo/indexable";
import { miniAppLink, siteUrl, SITE_INDEXABLE } from "@/lib/env";
import QRCode from "qrcode";
import { getVimeoThumbs } from "@/lib/data/video";
import { getListingReviews } from "@/lib/data/reviews";
import { t } from "@/i18n/ru";
import type { Section } from "@/lib/blocks/types";
import { districtLabels, districtNameMap, singleDistrictName } from "@/lib/catalog/districts";

// Адрес /<раздел>/<slug> — это либо категория (/biznes/krasota), либо карточка (/biznes/nazvanie).
// База не даёт им совпасть (раздел 8 ТЗ, постоянные адреса).
export async function generateStaticParams() {
  const [categories, listings] = await Promise.all([getCategories(), getPublishedSlugs()]);
  return [
    ...categories.filter((c) => c.parent_id === null).map((c) => ({ section: c.section, slug: c.slug })),
    ...listings.map((l) => ({ section: l.section, slug: l.slug })),
  ];
}

export async function generateMetadata({ params }: PageProps<"/[section]/[slug]">): Promise<Metadata> {
  const { section, slug } = await params;
  if (!isSection(section)) return {};
  const category = await getCategory(section, slug);
  if (category) {
    return {
      title: category.seo_title ?? `${category.name} в Хайфе`,
      description:
        category.seo_description ??
        `${category.name} в Хайфе: проверенные ${section === "biznes" ? "бизнесы" : "специалисты"}, контакты, цены, часы работы и отзывы.`,
      alternates: { canonical: `/${section}/${slug}` },
    };
  }
  const listing = await getListingBySlug(section, slug);
  if (!listing || "redirect" in listing) return {};
  const { header } = listing.data;
  const [categories, districts] = await Promise.all([getCategories(), getDistricts()]);
  const cat = categories.find((c) => c.id === listing.categoryId);
  const district = singleDistrictName(header.districtSlugs, districts);
  // Шаблон описания (раздел 8 ТЗ): «Название — категория в районе X, Хайфа. Профессия или слоган. Контакты, часы, отзывы».
  const where = district ? `в районе ${district}, Хайфа` : "в Хайфе";
  const description = [
    `${header.title} — ${(cat?.name ?? (section === "biznes" ? "бизнес" : "специалист")).toLowerCase()} ${where}.`,
    header.profession ?? header.slogan,
    "Телефон, цены, часы работы и отзывы.",
  ]
    .filter((x): x is string => Boolean(x))
    .map((x) => (/[.!?…]$/.test(x.trim()) ? x.trim() : `${x.trim()}.`))
    .join(" ");
  return {
    title: district ? `${header.title} — ${district}, Хайфа` : `${header.title}, Хайфа`,
    description: description.slice(0, 300),
    alternates: { canonical: `/${section}/${slug}` },
    // Примерные и незаполненные карточки не индексируются (раздел 8 ТЗ); ссылки с них поисковик проходит.
    robots: listing.isDemo ? { index: false, follow: false } : isListingComplete(listing.data) ? undefined : { index: false, follow: true },
  };
}

async function CategoryExplorer({ section, category, searchParams }: { section: Section; category: Category; searchParams: PageProps<"/[section]/[slug]">["searchParams"] }) {
  const [sp, districts] = await Promise.all([searchParams, getDistricts()]);
  const filters = parseFilters(sp, { category: category.slug });
  const base = `/${section}/${category.slug}`;
  const avail = await getFilterAvailability({ section, category }, filters);
  return (
    <div className="grid grid-cols-1 gap-5">
      <FiltersForm action={base} filters={filters} districts={districts} resetHref={base} avail={avail} />
      <Results filters={filters} section={section} basePath={base} rawParams={sp} />
    </div>
  );
}

async function CategoryPage({ section, category, searchParams }: { section: Section; category: Category; searchParams: PageProps<"/[section]/[slug]">["searchParams"] }) {
  const [districts, categories, perDistrict, perCategory] = await Promise.all([
    getDistricts(),
    getCategories(),
    getCategoryDistrictCounts(category.id),
    getCategoryListingCounts(),
  ]);
  // Подкатегории — только с карточками (правило 4 ноября 2026)
  const subcategories = categories.filter((c) => c.parent_id === category.id && (perCategory.get(c.id) ?? 0) > 0);
  // Районы — только те, где в этой категории есть карточки (решение 2 ноября 2026): пустые страницы «категория + район»
  // не нужны ни посетителю, ни поиску. Список свёрнут, ссылки остаются в разметке для поисковиков.
  const withCards = districts.filter((d) => perDistrict.has(d.id)).sort((a, b) => (perDistrict.get(b.id) ?? 0) - (perDistrict.get(a.id) ?? 0) || a.sort - b.sort);
  const url = siteUrl();
  const { intro, guide } = splitCategoryText(category.seo_text);
  return (
    <div className="grid grid-cols-1 gap-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          breadcrumbsJsonLd([
            { name: "Главная", url },
            { name: t.sections[section].title, url: `${url}/${section}` },
            { name: category.name, url: `${url}/${section}/${category.slug}` },
          ]),
        )}
      />
      <div>
        <nav aria-label="Хлебные крошки" className="mb-3 text-sm text-muted">
          <Link href="/" className="hover:text-primary">Главная</Link> ›{" "}
          <Link href={`/${section}`} className="hover:text-primary">{t.sections[section].title}</Link> › {category.name}
        </nav>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold leading-tight sm:text-3xl">
          <Icon3d name={categoryIcon3d(category)} size={52} fallback={category.icon} priority className="-my-2" />
          <span>{category.name} в Хайфе</span>
        </h1>
        {intro ? <p className="mt-3 max-w-3xl pl-16 leading-relaxed text-muted">{intro}</p> : null}
      </div>

      {subcategories.length ? (
        <ul className="flex flex-wrap gap-2">
          {subcategories.map((c) => (
            <li key={c.id}>
              <Link href={`/${section}/${category.slug}/${c.slug}`} className="flex min-h-11 items-center gap-2 rounded-2xl border border-line bg-white px-4 py-2 text-sm font-bold leading-snug hover:border-primary hover:bg-primary-soft">
                {/* Своя 3D-иконка подкатегории, иначе — иконка категории (решение 3 ноября 2026) */}
                <Icon3d name={categoryIcon3d(c, category)} size={26} fallback={c.icon} className="-my-1" />
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {withCards.length ? (
        <details className="group rounded-2xl border border-line bg-white px-4 py-1">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-bold [&::-webkit-details-marker]:hidden">
            📍 По районам
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">{withCards.length}</span>
            <span className="ml-auto text-muted transition group-open:rotate-90" aria-hidden>›</span>
          </summary>
          <ul className="flex flex-wrap gap-2 pb-3 pt-1">
            {withCards.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/${section}/${category.slug}/${d.slug}`}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold hover:border-primary hover:bg-primary-soft"
                >
                  {d.name} <span className="text-xs font-normal text-muted">{perDistrict.get(d.id)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <Suspense fallback={<ResultsSkeleton />}>
        <CategoryExplorer section={section} category={category} searchParams={searchParams} />
      </Suspense>

      {guide.length ? (
        <section aria-label="Как выбрать" className="max-w-3xl rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-8">
          {guide.map((g, i) =>
            g.kind === "h" ? (
              <h2 key={i} className={`text-xl font-extrabold leading-snug ${i ? "mt-6" : ""}`}>{g.text}</h2>
            ) : g.kind === "li" ? (
              <ul key={i} className="mt-3 grid gap-1.5 pl-5 leading-relaxed [list-style:disc]">
                {g.items.map((it, j) => <li key={j}>{it}</li>)}
              </ul>
            ) : (
              <p key={i} className="mt-3 leading-relaxed">{g.text}</p>
            ),
          )}
        </section>
      ) : null}
    </div>
  );
}

// Текст страницы категории (раздел 8 ТЗ, правится в админке): первый абзац — под заголовком,
// остальное — блок «Как выбрать» под списком. Абзацы разделяются пустой строкой, «## » — подзаголовок, «- » — пункт списка.
type GuidePart = { kind: "h" | "p"; text: string } | { kind: "li"; items: string[] };
function splitCategoryText(text: string | null): { intro: string | null; guide: GuidePart[] } {
  const parts = (text ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const [first, ...rest] = parts;
  if (!first || first.startsWith("## ")) return { intro: null, guide: parse(parts) };
  return { intro: first, guide: parse(rest) };
  function parse(list: string[]): GuidePart[] {
    return list.map((p) => {
      if (p.startsWith("## ")) return { kind: "h", text: p.slice(3).trim() };
      const lines = p.split("\n").map((l) => l.trim());
      if (lines.every((l) => l.startsWith("- "))) return { kind: "li", items: lines.map((l) => l.slice(2)) };
      return { kind: "p", text: p };
    });
  }
}

export default async function SlugPage({ params, searchParams }: PageProps<"/[section]/[slug]">) {
  const { section, slug } = await params;
  if (!isSection(section)) notFound();

  const category = await getCategory(section, slug);
  if (category?.parent_id) {
    // Подкатегория живёт под своей категорией: /biznes/krasota/salony-krasoty
    const parent = (await getCategories()).find((c) => c.id === category.parent_id);
    if (parent) permanentRedirect(`/${section}/${parent.slug}/${category.slug}`);
    notFound();
  }
  if (category) return <CategoryPage section={section} category={category} searchParams={searchParams} />;

  const listing = await getListingBySlug(section, slug);
  if (!listing) notFound();
  if ("redirect" in listing) permanentRedirect(listing.redirect);

  const [categories, districts] = await Promise.all([getCategories(), getDistricts()]);
  const districtNames = districtNameMap(districts);
  const cat = categories.find((c) => c.id === listing.categoryId);
  const parent = cat?.parent_id ? categories.find((c) => c.id === cat.parent_id) : undefined;
  const topCategory = parent ?? cat;
  const url = `${siteUrl()}/${section}/${slug}`;
  const similar = await getSimilar({
    id: listing.id,
    section,
    categorySlug: topCategory?.slug,
    districtSlug: listing.data.header.districtSlugs[0],
  });
  const districtById = new Map(districts.map((d) => [d.id, d.name]));

  // «Поделиться»: QR ведёт на короткую ссылку /k/<код> (раздел 4 ТЗ), Mini App открывает карточку по start_param.
  const shortUrl = listing.shortCode ? `${siteUrl()}/k/${listing.shortCode}` : undefined;
  const qrSvg = await QRCode.toString(shortUrl ?? url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#26262b", light: "#ffffff" }, // основной цвет сайта
  });
  const vimeoIds = listing.data.blocks.flatMap((b) => (b.type === "video" && !b.hidden ? b.data.items.filter((v) => v.provider === "vimeo").map((v) => v.videoId) : []));
  const [vimeoThumbs, reviews] = await Promise.all([vimeoIds.length ? getVimeoThumbs(vimeoIds) : Promise.resolve({}), getListingReviews(listing.id)]);

  return (
    <div className="mx-auto max-w-3xl lg:max-w-none">
      {!listing.isDemo ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript([
            listingJsonLd({
              url,
              data: listing.data,
              schemaType: topCategory?.schema_type ?? null,
              categoryName: cat?.name ?? "",
              districtNames: districtLabels(listing.data.header.districtSlugs, districtNames),
              // Рейтинг — только по отзывам нашей платформы (раздел 8 ТЗ)
              rating: listing.ratingCount > 0 && listing.ratingAvg ? { value: Number(listing.ratingAvg), count: listing.ratingCount } : null,
            }),
            breadcrumbsJsonLd([
              { name: "Главная", url: siteUrl() },
              { name: t.sections[section].title, url: `${siteUrl()}/${section}` },
              ...(topCategory ? [{ name: topCategory.name, url: `${siteUrl()}/${section}/${topCategory.slug}` }] : []),
              { name: listing.data.header.title, url },
            ]),
            ...listingEventsJsonLd({ url, data: listing.data }),
            ...listingFaqJsonLd(listing.data),
          ])}
        />
      ) : (
        <div className="mb-4">
          <MockNotice text="Это примерная карточка. Названия, телефоны и отзывы вымышлены." />
        </div>
      )}
      <ListingView
        listingId={listing.id}
        data={listing.data}
        categoryName={cat?.name ?? ""}
        categoryHref={topCategory ? `/${section}/${topCategory.slug}` : `/${section}`}
        rating={listing.ratingAvg}
        reviewsCount={listing.ratingCount}
        isDemo={listing.isDemo}
        districtNames={districtNames}
        vimeoThumbs={vimeoThumbs}
        reviews={reviews}
        hasOwner={listing.hasOwner}
        wide
        share={{
          url,
          shortUrl,
          qrSvg,
          miniAppUrl: miniAppLink(`${section === "biznes" ? "b" : "s"}_${slug}`),
          temporaryAddress: !SITE_INDEXABLE,
        }}
      />
      {similar.length ? (
        <section className="mt-12" aria-labelledby="similar">
          <h2 id="similar" className="mb-5 text-2xl font-extrabold">🔁 {t.listing.similar}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {similar.map((l) => (
              // «Похожие» — из той же категории, поэтому рекомендуемые здесь тоже первые и во всю ширину
              <div key={l.id} className={`grid min-w-0 ${l.is_recommended ? "md:col-span-2" : ""}`}>
                <ListingListItem
                  listing={l}
                  subtitle={l.summary ?? ""}
                  districtLabel={l.district_ids.map((id) => districtById.get(id) ?? "").filter(Boolean).slice(0, 2).join(", ")}
                  wide={l.is_recommended}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
