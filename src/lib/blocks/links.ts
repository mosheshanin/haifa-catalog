import { SUPABASE_URL } from "@/lib/env";

// Безопасные ссылки: на странице выводятся только http(s), tel:, mailto: — никаких javascript: и data:.
export function safeHref(u: string | undefined | null): string | undefined {
  if (!u) return undefined;
  const v = u.trim();
  return /^(https?:\/\/|tel:|mailto:)/i.test(v) ? v : undefined;
}

export const MEDIA_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/media/`;
// PDF меню с 5 ноября 2026 лежат в отдельном хранилище docs (до 10 МБ); старые PDF остались в media.
export const DOCS_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/docs/`;

// Своё фото с маленькой копией: `<id>.l.webp` (1600 px) → `<id>.s.webp` (640 px). У старых фото копии нет.
export function mediaSmall(u: string): string | undefined {
  return u.startsWith(MEDIA_PREFIX) && u.endsWith(".l.webp") ? `${u.slice(0, -".l.webp".length)}.s.webp` : undefined;
}

// Фото и файлы карточек: только из нашего хранилища (и Unsplash для примерных карточек).
export function isMediaUrl(u: unknown): u is string {
  return typeof u === "string" && (u.startsWith(MEDIA_PREFIX) || u.startsWith(DOCS_PREFIX) || /^https:\/\/images\.unsplash\.com\/photo-[\w-]+$/.test(u));
}

// Видео: из ссылки YouTube или Vimeo получить провайдера и код ролика.
export function parseVideoUrl(input: string): { provider: "youtube" | "vimeo"; videoId: string } | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return { provider: "youtube", videoId: s };
  let m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  if (m) return { provider: "youtube", videoId: m[1] };
  m = s.match(/vimeo\.com\/(?:video\/|channels\/[\w-]+\/)?(\d{5,12})/i);
  if (m) return { provider: "vimeo", videoId: m[1] };
  return null;
}

// Google Карты: из полной ссылки на место берём код места (Place ID, «!19sChIJ…») и cid («0x…:0x…» или cid=).
// Хранить Place ID разрешено бессрочно (условия Google Maps Platform).
export function parseGoogleMapsUrl(input: string): { placeId?: string; cid?: string } {
  const s = decodeURIComponent(input.trim());
  const out: { placeId?: string; cid?: string } = {};
  const pid = s.match(/!19s(ChIJ[\w-]{10,})/) ?? s.match(/place_id[:=](ChIJ[\w-]{10,})/i) ?? s.match(/\b(ChIJ[\w-]{20,})\b/);
  if (pid) out.placeId = pid[1];
  const hex = s.match(/0x[0-9a-f]+:0x([0-9a-f]+)/i);
  if (hex) out.cid = BigInt(`0x${hex[1]}`).toString();
  const cid = s.match(/[?&]cid=(\d{5,25})/);
  if (cid) out.cid = cid[1];
  return out;
}

export function isGoogleMapsUrl(u: string): boolean {
  return /^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(u.trim());
}
