import "server-only";
import { cacheLife } from "next/cache";

// Обложки Vimeo берём через их открытый oEmbed на сервере (у YouTube обложка доступна по адресу без запроса).
// Ошибка сети не ломает карточку: без обложки показывается цветная заглушка с кнопкой ▶.
export async function getVimeoThumbs(ids: string[]): Promise<Record<string, string>> {
  "use cache";
  cacheLife("days");
  const out: Record<string, string> = {};
  await Promise.all(
    ids
      .filter((id) => /^\d{5,12}$/.test(id))
      .slice(0, 10)
      .map(async (id) => {
        try {
          const res = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${id}`)}&width=640`, {
            signal: AbortSignal.timeout(4000),
          });
          if (!res.ok) return;
          const body = (await res.json()) as { thumbnail_url?: string };
          if (body.thumbnail_url?.startsWith("https://")) out[id] = body.thumbnail_url;
        } catch {
          // без обложки
        }
      }),
  );
  return out;
}
