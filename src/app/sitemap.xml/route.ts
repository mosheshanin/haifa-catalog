import { siteUrl } from "@/lib/env";
import { xmlResponse } from "@/lib/data/sitemap";

// Индекс карт сайта (раздел 8 ТЗ): общие страницы и по одной карте на раздел.
const FILES = ["pages", "biznes", "specialisty"] as const;

export async function GET() {
  const base = siteUrl();
  const items = FILES.map((f) => `<sitemap><loc>${base}/sitemaps/${f}.xml</loc></sitemap>`).join("");
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`);
}
