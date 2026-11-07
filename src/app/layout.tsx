import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MiniAppBridge } from "@/components/telegram/mini-app-bridge";
import { TelegramBackButton } from "@/components/telegram/mini-app-chrome";
import { FavoritesProvider } from "@/components/listing/favorites-provider";
import { AnalyticsRouteHits, ConsentBanner } from "@/components/legal/consent";
import { BING_SITE_VERIFICATION, GOOGLE_SITE_VERIFICATION, SITE_INDEXABLE, siteUrl } from "@/lib/env";
import { t } from "@/i18n/ru";
// Шрифты Onest (текст) и Manrope (заголовки) лежат в проекте и раздаются с нашего домена: без запросов к Google в браузере.
// Браузер скачивает только нужные части (кириллица, латиница) по unicode-range.
import "@fontsource-variable/onest/wght.css";
import "@fontsource-variable/manrope/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${t.site.name} — ${t.site.tagline}`, template: `%s — ${t.site.name}` },
  description: t.site.description,
  applicationName: t.site.name,
  openGraph: { type: "website", locale: "ru_RU", siteName: t.site.name },
  // Пока сайт на временном адресе, поисковики его не индексируют.
  robots: SITE_INDEXABLE ? { index: true, follow: true } : { index: false, follow: false },
  verification: {
    google: GOOGLE_SITE_VERIFICATION || undefined,
    other: BING_SITE_VERIFICATION ? { "msvalidate.01": BING_SITE_VERIFICATION } : undefined,
  },
};

export const viewport: Viewport = {
  themeColor: "#26262b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" dir="ltr" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2">
          К содержимому
        </a>
        <FavoritesProvider>
          <SiteHeader />
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
            {children}
          </main>
          <SiteFooter />
        </FavoritesProvider>
        <ConsentBanner />
        <Suspense fallback={null}>
          <AnalyticsRouteHits />
        </Suspense>
        <MiniAppBridge />
        <Suspense fallback={null}>
          <TelegramBackButton />
        </Suspense>
      </body>
    </html>
  );
}
