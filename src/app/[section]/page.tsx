import type { Metadata } from "next";
import Link from "next/link";
import { Icon3d } from "@/components/ui/icon-3d";
import { categoryIcon3d } from "@/lib/icons-3d";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getFilterAvailability } from "@/lib/data/filters";
import { FiltersForm } from "@/components/catalog/filters-form";
import { Results, ResultsSkeleton } from "@/components/catalog/results";
import { getDistricts, getSectionCategories, isSection } from "@/lib/data/dictionaries";
import { parseFilters } from "@/lib/catalog/params";
import { nonEmptyCategories } from "@/lib/data/listings";
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
    description: `${t.sections[section].lead}. HaifaBusinessClub — сообщество проверенных бизнесов и специалистов Хайфы: контакты, цены, часы работы и отзывы.`,
    alternates: { canonical: `/${section}` },
  };
}

async function Explorer({ section, searchParams }: { section: Section; searchParams: PageProps<"/[section]">["searchParams"] }) {
  const [sp, districts, categories] = await Promise.all([searchParams, getDistricts(), getSectionCategories(section)]);
  const filters = parseFilters(sp);
  const [avail, shown] = await Promise.all([
    getFilterAvailability({ section, categorySlug: filters.category }, filters),
    nonEmptyCategories(categories, filters.category), // выбранная категория остаётся в списке
  ]);
  return (
    <div className="grid grid-cols-1 gap-5">
      <FiltersForm action={`/${section}`} filters={filters} districts={districts} categories={shown} resetHref={`/${section}`} avail={avail} />
      <Results filters={filters} section={section} basePath={`/${section}`} rawParams={sp} />
    </div>
  );
}

export default async function SectionPage({ params, searchParams }: PageProps<"/[section]">) {
  const { section } = await params;
  if (!isSection(section)) notFound();
  // Категории без карточек не выводим (правило 4 ноября 2026)
  const categories = await nonEmptyCategories(await getSectionCategories(section));

  return (
    <div className="grid grid-cols-1 gap-8">
      <div>
        <nav aria-label="Хлебные крошки" className="mb-3 text-sm text-muted">
          <Link href="/" className="hover:text-primary">Главная</Link> › {t.sections[section].title}
        </nav>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold leading-tight sm:text-3xl">
          <Icon3d name={section === "biznes" ? "chart" : "boy"} size={48} priority className="-my-2" />
          <span>{t.sections[section].title} Хайфы</span>
        </h1>
        <p className="mt-2 pl-15 leading-relaxed text-muted">{t.sections[section].lead}</p>
      </div>

      {categories.length ? (
      <ul className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <li key={c.id}>
            <Link href={`/${section}/${c.slug}`} className="flex min-h-11 items-center gap-2 rounded-2xl border border-line bg-white px-4 py-2 text-sm font-bold leading-snug hover:border-primary hover:bg-primary-soft">
              <Icon3d name={categoryIcon3d(c)} size={30} fallback={c.icon} className="-my-1" />
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
      ) : null}

      <Suspense fallback={<ResultsSkeleton />}>
        <Explorer section={section} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
