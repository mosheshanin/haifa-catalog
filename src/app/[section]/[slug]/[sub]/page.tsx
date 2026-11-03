import type { Metadata } from "next";
import Link from "next/link";
import { Icon3d } from "@/components/ui/icon-3d";
import { categoryIcon3d } from "@/lib/icons-3d";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getFilterAvailability } from "@/lib/data/filters";
import { FiltersForm } from "@/components/catalog/filters-form";
import { Results, ResultsSkeleton } from "@/components/catalog/results";
import { getCategories, getDistricts, isSection, type Category, type District } from "@/lib/data/dictionaries";
import { searchListings } from "@/lib/data/listings";
import { parseFilters } from "@/lib/catalog/params";
import { breadcrumbsJsonLd, jsonLdScript } from "@/lib/seo/jsonld";
import { siteUrl } from "@/lib/env";
import { t } from "@/i18n/ru";
import type { Section } from "@/lib/blocks/types";

// Второй уровень: подкатегория (/biznes/krasota/manikyur) или «категория + район» (/biznes/krasota/hadar).
// Страница «категория + район» индексируется, только когда в ней не меньше MIN_INDEXABLE карточек (раздел 3 ТЗ).
const MIN_INDEXABLE = 3;

type Resolved =
  | { kind: "district"; category: Category; district: District }
  | { kind: "subcategory"; category: Category; parent: Category };

async function resolve(section: Section, slug: string, sub: string): Promise<Resolved | null> {
  const [categories, districts] = await Promise.all([getCategories(), getDistricts()]);
  const category = categories.find((c) => c.section === section && c.slug === slug && c.parent_id === null);
  if (!category) return null;
  const subcat = categories.find((c) => c.section === section && c.slug === sub && c.parent_id === category.id);
  if (subcat) return { kind: "subcategory", category: subcat, parent: category };
  const district = districts.find((d) => d.slug === sub);
  if (district) return { kind: "district", category, district };
  return null;
}

export async function generateStaticParams() {
  const categories = await getCategories();
  const first = categories.find((c) => c.parent_id === null);
  // Хотя бы один адрес обязателен; остальные страницы собираются при первом посещении.
  return first ? [{ section: first.section, slug: first.slug, sub: "hadar" }] : [];
}

export async function generateMetadata({ params }: PageProps<"/[section]/[slug]/[sub]">): Promise<Metadata> {
  const { section, slug, sub } = await params;
  if (!isSection(section)) return {};
  const r = await resolve(section, slug, sub);
  if (!r) return {};
  if (r.kind === "subcategory") {
    return {
      title: r.category.seo_title ?? `${r.category.name} в Хайфе`,
      description: r.category.seo_description ?? `${r.category.name} в Хайфе: проверенные специалисты и заведения, цены и отзывы.`,
      alternates: { canonical: `/${section}/${slug}/${sub}` },
    };
  }
  const found = await searchListings({ section, category: r.category.slug, district: r.district.slug, limit: 1 });
  const count = found[0]?.total_count ?? 0;
  return {
    title: `${r.category.name} — ${r.district.name}, Хайфа`,
    description: `${r.category.name} в районе ${r.district.name}: проверенные ${section === "biznes" ? "бизнесы" : "специалисты"}, контакты и цены.`,
    alternates: { canonical: `/${section}/${slug}/${sub}` },
    robots: count >= MIN_INDEXABLE ? undefined : { index: false, follow: true },
  };
}

async function Explorer({ section, base, fixed, searchParams }: { section: Section; base: string; fixed: { category: string; district?: string }; searchParams: PageProps<"/[section]/[slug]/[sub]">["searchParams"] }) {
  const [sp, districts] = await Promise.all([searchParams, getDistricts()]);
  const filters = parseFilters(sp, fixed);
  const avail = await getFilterAvailability({ section, categorySlug: fixed.category }, filters);
  return (
    <div className="grid grid-cols-1 gap-5">
      <FiltersForm action={base} filters={filters} districts={districts} showDistrict={!fixed.district} resetHref={base} avail={avail} />
      <Results filters={filters} section={section} basePath={base} rawParams={sp} />
    </div>
  );
}

export default async function SubPage({ params, searchParams }: PageProps<"/[section]/[slug]/[sub]">) {
  const { section, slug, sub } = await params;
  if (!isSection(section)) notFound();
  const r = await resolve(section, slug, sub);
  if (!r) notFound();

  const base = `/${section}/${slug}/${sub}`;
  const parent = r.kind === "subcategory" ? r.parent : r.category;
  const title = r.kind === "subcategory" ? `${r.category.name} в Хайфе` : `${r.category.name} — ${r.district.name}`;
  const url = siteUrl();

  return (
    <div className="grid grid-cols-1 gap-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          breadcrumbsJsonLd([
            { name: "Главная", url },
            { name: t.sections[section].title, url: `${url}/${section}` },
            { name: parent.name, url: `${url}/${section}/${parent.slug}` },
            { name: title, url: `${url}${base}` },
          ]),
        )}
      />
      <div>
        <nav aria-label="Хлебные крошки" className="mb-3 text-sm text-muted">
          <Link href="/" className="hover:text-primary">Главная</Link> ›{" "}
          <Link href={`/${section}`} className="hover:text-primary">{t.sections[section].title}</Link> ›{" "}
          <Link href={`/${section}/${parent.slug}`} className="hover:text-primary">{parent.name}</Link> ›{" "}
          {r.kind === "subcategory" ? r.category.name : r.district.name}
        </nav>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold leading-tight sm:text-3xl">
          <Icon3d name={categoryIcon3d(parent)} size={52} fallback={r.kind === "subcategory" ? r.category.icon : parent.icon} priority className="-my-2" />
          <span>{title}</span>
        </h1>
        {r.kind === "district" ? (
          <p className="mt-3 pl-16 leading-relaxed text-muted">
            Проверенные {section === "biznes" ? "заведения и компании" : "специалисты"} в районе {r.district.name} и рядом.
          </p>
        ) : r.category.seo_text ? (
          <p className="mt-2 max-w-3xl pl-16 text-muted">{r.category.seo_text}</p>
        ) : null}
      </div>
      <Suspense fallback={<ResultsSkeleton />}>
        <Explorer
          section={section}
          base={base}
          fixed={r.kind === "subcategory" ? { category: r.category.slug } : { category: r.category.slug, district: r.district.slug }}
          searchParams={searchParams}
        />
      </Suspense>
    </div>
  );
}
