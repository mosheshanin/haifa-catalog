import { renderOg, OG_SIZE } from "@/lib/seo/og";
import { t } from "@/i18n/ru";

// Картинка предпросмотра для главной и всех страниц без своей (раздел 8 ТЗ).
export const alt = t.site.brand;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return renderOg({ title: t.site.brand, subtitle: t.site.tagline });
}
