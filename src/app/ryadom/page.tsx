import type { Metadata } from "next";
import { NearMe } from "@/components/catalog/near-me";
import { getCategories, getDistricts } from "@/lib/data/dictionaries";
import { t } from "@/i18n/ru";

export const metadata: Metadata = { title: t.search.nearMe, robots: { index: false, follow: true } };

export default async function NearMePage() {
  const [districts, categories] = await Promise.all([getDistricts(), getCategories()]);
  return (
    <div className="grid grid-cols-1 gap-5">
      <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">📍 {t.search.nearMe}</h1>
      <NearMe
        districts={districts.map((d) => ({ id: d.id, slug: d.slug, name: d.name }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
