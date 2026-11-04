import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchForm } from "@/components/search/search-form";
import { getFilterAvailability } from "@/lib/data/filters";
import { FiltersForm } from "@/components/catalog/filters-form";
import { Results, ResultsSkeleton } from "@/components/catalog/results";
import { getCategories, getDistricts } from "@/lib/data/dictionaries";
import { parseFilters } from "@/lib/catalog/params";
import { nonEmptyCategories } from "@/lib/data/listings";

export const metadata: Metadata = {
  title: "Поиск",
  robots: { index: false, follow: true },
};

// Поиск понимает русские словоформы, синонимы и опечатки, распознаёт категорию и район во фразе
// («маникюр кирьят бялик») — раздел 5 ТЗ и анализ аналогов.
async function SearchContent({ searchParams }: { searchParams: PageProps<"/poisk">["searchParams"] }) {
  const [sp, districts, categories] = await Promise.all([searchParams, getDistricts(), getCategories()]);
  const filters = parseFilters(sp);
  const [avail, topCategories] = await Promise.all([
    getFilterAvailability({ categorySlug: filters.category }, filters),
    // Только категории с карточками; выбранная остаётся в списке (правило 4 ноября 2026)
    nonEmptyCategories(categories.filter((c) => c.parent_id === null), filters.category),
  ]);
  return (
    <>
      <div className="max-w-2xl">
        <SearchForm defaultValue={filters.q} />
      </div>
      <FiltersForm
        action="/poisk"
        filters={filters}
        districts={districts}
        categories={topCategories}
        resetHref={filters.q ? `/poisk?q=${encodeURIComponent(filters.q)}` : "/poisk"}
        avail={avail}
      />
      <Results filters={filters} basePath="/poisk" rawParams={sp} />
    </>
  );
}

export default function SearchPage(props: PageProps<"/poisk">) {
  return (
    <div className="grid grid-cols-1 gap-5">
      <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">🔎 Поиск</h1>
      <Suspense fallback={<ResultsSkeleton />}>
        <SearchContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
