import type { MetadataRoute } from "next";
import { SITE_INDEXABLE, siteUrl } from "@/lib/env";

// До запуска на постоянном домене сайт закрыт от индексации.
// После запуска (SITE_INDEXABLE=true) открыты поисковики и поисковые краулеры ИИ (раздел 8 и 14 ТЗ).
export default function robots(): MetadataRoute.Robots {
  if (!SITE_INDEXABLE) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/kabinet", "/profil", "/vhod", "/api/", "/auth/"] },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
