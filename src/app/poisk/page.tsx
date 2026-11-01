import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchForm } from "@/components/search/search-form";
import { ListingListItem } from "@/components/listing/listing-list-item";
import { MockNotice } from "@/components/ui/mock-notice";
import { getDistricts } from "@/lib/data/dictionaries";
import { MOCK_LISTINGS } from "@/mocks/listings";

export const metadata: Metadata = {
  title: "Поиск",
  robots: { index: false, follow: true },
};

// Временный поиск по примерным карточкам. Настоящий поиск с русскими словоформами,
// синонимами и опечатками — этап 2 (раздел 5 ТЗ).
async function Results({ searchParams }: { searchParams: PageProps<"/poisk">["searchParams"] }) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();
  const districts = await getDistricts();
  const districtName = (slug: string) => districts.find((d) => d.slug === slug)?.name ?? slug;

  const found = q
    ? MOCK_LISTINGS.filter((l) => JSON.stringify(l.data).toLowerCase().includes(q) || l.categoryName.toLowerCase().includes(q))
    : MOCK_LISTINGS;

  return (
    <>
      <div className="max-w-2xl">
        <SearchForm defaultValue={q} />
      </div>
      <p className="text-muted">{q ? `По запросу «${q}» найдено: ${found.length}` : "Введите запрос"}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {found.map((l) => (
          <ListingListItem key={l.slug} listing={l} districtLabel={l.data.header.districtSlugs.map(districtName).slice(0, 2).join(", ")} />
        ))}
      </div>
    </>
  );
}

export default function SearchPage(props: PageProps<"/poisk">) {
  return (
    <div className="grid gap-5">
      <h1 className="text-3xl font-extrabold">Поиск</h1>
      <MockNotice text="Поиск работает по примерным карточкам. Полноценный поиск — этап 2." />
      <Suspense fallback={<p className="text-muted">Ищем…</p>}>
        <Results searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
