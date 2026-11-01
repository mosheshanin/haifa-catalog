import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FiltersForm } from "@/components/catalog/filters-form";
import { Results, ResultsSkeleton } from "@/components/catalog/results";
import { getDistricts, getSectionCategories, isSection } from "@/lib/data/dictionaries";
import { parseFilters } from "@/lib/catalog/params";
import { t } from "@/i18n/ru";
import type { Section } from "@/lib/blocks/types";

export async function generateStaticParams() {
  return [{ section: "biznes" }, { section: "specialisty" }];
}

export async function generateMetadata({ params }: PageProps<"/[section]">): Promise<Metadata> {
  const { section } = await params;
  if (!isSection(section)) return {};
  return {
    title: `${t.sections[section].title} Хайфы`,
    description: `${t.sections[section].lead}. Русскоязычный каталог Хайфы: контакты, цены, часы работы и отзывы.`,
    alternates: { canonical: `/${section}` },
  };
}

async function Explorer({ section, searchParams }: { section: Section; searchParams: PageProps<"/[section]">["searchParams"] }) {
  const [sp, districts, categories] = await Promise.all([searchParams, getDistricts(), getSectionCategories(section)]);
  const filters = parseFilters(sp);
  return (
    <div className="grid gap-4">
      <FiltersForm action={`/${section}`} filters={filters} districts={districts} categories={categories} resetHref={`/${section}`} />
      <Results filters={filters} section={section} basePath={`/${section}`} rawParams={sp} />
    </div>
  );
}

export default async function SectionPage({ params, searchParams }: PageProps<"/[section]">) {
  const { section } = await params;
  if (!isSection(section)) notFound();
  const categories = await getSectionCategories(section);

  return (
    <div className="grid gap-6">
      <div>
        <nav aria-label="Хлебные крошки" className="mb-2 text-sm text-muted">
          <Link href="/" className="hover:text-primary">Главная</Link> › {t.sections[section].title}
        </nav>
        <h1 className="text-3xl font-extrabold">{section === "biznes" ? "🏢" : "👷"} {t.sections[section].title} Хайфы</h1>
        <p className="mt-1 text-muted">{t.sections[section].lead}</p>
      </div>

      <ul className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <li key={c.id}>
            <Link href={`/${section}/${c.slug}`} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-sm font-bold hover:border-primary hover:bg-primary-soft">
              {c.icon ? <span aria-hidden>{c.icon}</span> : null}
              {c.name}
            </Link>
          </li>
        ))}
      </ul>

      <Suspense fallback={<ResultsSkeleton />}>
        <Explorer section={section} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
