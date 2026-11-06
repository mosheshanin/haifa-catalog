"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useFavorites } from "@/components/listing/favorites-provider";
import { ListingListItem, type ListItemData } from "@/components/listing/listing-list-item";
import { districtListLabel } from "@/lib/catalog/districts";
import { t } from "@/i18n/ru";

type Row = ListItemData & { district_ids: number[]; category_id: number | null };

const COLUMNS =
  "id, section, slug, title, summary, cover_url, languages, has_offer, rating_avg, rating_count, hours, is_verified, is_demo, is_recommended, district_ids, category_id";

export function FavoritesList({
  districts,
  categories,
}: {
  districts: Array<{ id: number; name: string; kind: string; sort: number }>;
  categories: Array<{ id: number; name: string }>;
}) {
  const fav = useFavorites();
  const [rows, setRows] = useState<Row[] | null>(null);
  const idsKey = fav ? [...fav.ids].sort().join(",") : "";
  const userId = fav?.userId;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const ids = idsKey ? idsKey.split(",") : [];
    (async () => {
      if (!ids.length) {
        if (active) setRows([]);
        return;
      }
      const { data } = await createClient().from("listings").select(COLUMNS).in("id", ids).eq("status", "published");
      if (active) setRows((data ?? []) as Row[]);
    })();
    return () => {
      active = false;
    };
  }, [userId, idsKey]);

  if (fav?.userId === null) {
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 text-center">
        <p className="text-4xl" aria-hidden>🤍</p>
        <p className="mt-2 font-bold">Войдите, чтобы сохранять карточки в избранное</p>
        <Link href="/vhod?next=/izbrannoe" className="mt-4 inline-flex h-11 items-center rounded-2xl bg-primary px-5 font-bold text-white">
          {t.nav.login}
        </Link>
      </div>
    );
  }

  if (!fav || fav.userId === undefined || rows === null) {
    return <p className="text-muted">{t.common.loading}</p>;
  }

  if (!rows.length) {
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 text-center">
        <p className="text-4xl" aria-hidden>🤍</p>
        <p className="mt-2 font-bold">Здесь пока пусто</p>
        <p className="mt-1 text-sm text-muted">Нажимайте на сердечко на карточках — они появятся здесь, на сайте и в Telegram.</p>
        <Link href="/" className="mt-4 inline-flex h-11 items-center rounded-2xl bg-primary px-5 font-bold text-white">
          В каталог
        </Link>
      </div>
    );
  }

  const categoryName = (id: number | null) => categories.find((c) => c.id === id)?.name ?? "";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {rows.map((l) => (
        <ListingListItem
          key={l.id}
          listing={l}
          subtitle={l.section === "specialisty" && l.summary ? l.summary : categoryName(l.category_id)}
          districtLabel={districtListLabel(l.district_ids, districts)}
        />
      ))}
    </div>
  );
}
