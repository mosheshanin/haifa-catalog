import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import type { Section } from "@/lib/blocks/types";

export type SitemapEntry = { section: Section; path: string; lastmod: string | null };

// Адреса для sitemap.xml (раздел 8 ТЗ) — SQL sitemap_entries: заполненные карточки без примеров, категории,
// подкатегории с карточками, «категория + район» от 3 карточек. Обновляется вместе с каталогом (тег listings).
export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  "use cache";
  cacheTag("listings", "dictionaries");
  cacheLife("hours");
  const { data, error } = await createPublicClient().rpc("sitemap_entries");
  if (error) {
    console.warn("sitemap_entries:", error.message);
    return [];
  }
  return (data ?? []) as SitemapEntry[];
}

// Страницы, которые не зависят от базы.
export const STATIC_PAGES = ["/", "/biznes", "/specialisty", "/politika", "/usloviya", "/dostupnost"];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function urlsetXml(base: string, items: Array<{ path: string; lastmod?: string | null }>) {
  const body = items
    .map((i) => `<url><loc>${esc(base + (i.path === "/" ? "" : encodeURI(i.path)))}</loc>${i.lastmod ? `<lastmod>${i.lastmod.slice(0, 10)}</lastmod>` : ""}</url>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export const xmlResponse = (xml: string) =>
  new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
