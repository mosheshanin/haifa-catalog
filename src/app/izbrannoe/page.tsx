import type { Metadata } from "next";
import { FavoritesList } from "@/components/listing/favorites-list";
import { getCategories, getDistricts } from "@/lib/data/dictionaries";
import { t } from "@/i18n/ru";

export const metadata: Metadata = { title: t.nav.favorites, robots: { index: false } };

export default async function FavoritesPage() {
  const [districts, categories] = await Promise.all([getDistricts(), getCategories()]);
  return (
    <div className="grid gap-5">
      <h1 className="text-3xl font-extrabold">❤️ {t.nav.favorites}</h1>
      <FavoritesList
        districts={districts.map((d) => ({ id: d.id, name: d.name }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
