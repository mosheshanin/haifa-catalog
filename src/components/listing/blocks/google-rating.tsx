"use client";

import { useState } from "react";
import { GOOGLE_MAPS_EMBED_KEY } from "@/lib/env";
import { safeHref } from "@/lib/blocks/links";

// «Рейтинг на Google»: бесплатная карта Google (Maps Embed API) с названием, рейтингом, числом отзывов и ссылкой
// на отзывы в Google Картах. Загружается по нажатию: до этого Google не ставит cookie (раздел 4 ТЗ).
function embedSrc(placeId?: string, cid?: string): string | undefined {
  if (GOOGLE_MAPS_EMBED_KEY && placeId) {
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(GOOGLE_MAPS_EMBED_KEY)}&q=place_id:${encodeURIComponent(placeId)}&language=ru`;
  }
  // Пока ключа нет — встраивание по коду места (cid), как в «Поделиться → Встроить карту» на Google Картах.
  if (cid) return `https://maps.google.com/maps?cid=${encodeURIComponent(cid)}&hl=ru&output=embed`;
  if (placeId) return `https://maps.google.com/maps?q=place_id:${encodeURIComponent(placeId)}&hl=ru&output=embed`;
  return undefined;
}

export function GoogleRating({ url, placeId, cid }: { url: string; placeId?: string; cid?: string }) {
  const [shown, setShown] = useState(false);
  const src = embedSrc(placeId, cid);
  const href = safeHref(url);
  return (
    <div className="grid gap-3">
      {shown && src ? (
        <iframe
          src={src}
          title="Карта Google с рейтингом и отзывами"
          className="h-80 w-full rounded-2xl border border-line"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      ) : src ? (
        <button
          type="button"
          onClick={() => setShown(true)}
          className="flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line bg-surface-alt p-4 text-center hover:border-primary"
        >
          <span className="text-lg font-extrabold">🗺️ Показать на карте Google</span>
          <span className="text-xs text-muted">На широком экране карта показывает рейтинг и число отзывов</span>
        </button>
      ) : null}
      {/* На узкой карте Google прячет карточку с рейтингом, поэтому отзывы всегда доступны по кнопке
          (на телефоне откроется приложение Google Карт). */}
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 justify-self-start whitespace-nowrap rounded-2xl border border-line bg-white px-4 text-sm font-bold hover:border-primary">
          ⭐ Отзывы в Google Картах ↗
        </a>
      ) : null}
    </div>
  );
}
