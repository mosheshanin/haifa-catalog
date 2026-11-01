"use client";

import { useRouter } from "next/navigation";
import { HeartIcon } from "@/components/icons";
import { useFavorites } from "@/components/listing/favorites-provider";

export function FavoriteButton({ listingId, className = "", withLabel = false }: { listingId: string; className?: string; withLabel?: boolean }) {
  const fav = useFavorites();
  const router = useRouter();
  const active = fav?.ids.has(listingId) ?? false;

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? "Убрать из избранного" : "Добавить в избранное"}
      title={active ? "Убрать из избранного" : "Добавить в избранное"}
      onClick={async () => {
        if (!fav) return;
        const result = await fav.toggle(listingId);
        if (result === "login") router.push(`/vhod?next=${encodeURIComponent(window.location.pathname)}`);
      }}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-bold transition ${
        withLabel ? "h-12 border border-line bg-white px-4 hover:border-accent" : "size-10 hover:bg-primary-soft"
      } ${active ? "text-accent" : "text-muted hover:text-accent"} ${className}`}
    >
      <HeartIcon className={`size-5 ${active ? "fill-accent" : ""}`} />
      {withLabel ? (active ? "В избранном" : "В избранное") : null}
    </button>
  );
}
