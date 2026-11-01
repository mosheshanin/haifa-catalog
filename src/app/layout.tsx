import type { Metadata, Viewport } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MiniAppBridge } from "@/components/telegram/mini-app-bridge";
import { SITE_INDEXABLE, siteUrl } from "@/lib/env";
import { t } from "@/i18n/ru";
// Шрифт Nunito лежит в проекте и раздаётся с нашего домена: без запросов к Google в браузере.
// Браузер скачивает только нужные части (кириллица, латиница) по unicode-range.
import "@fontsource-variable/nunito/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${t.site.name} — ${t.site.tagline}`, template: `%s — ${t.site.name}` },
  description: t.site.description,
  applicationName: t.site.name,
  openGraph: { type: "website", locale: "ru_RU", siteName: t.site.name },
  // Пока сайт на временном адресе, поисковики его не индексируют.
  robots: SITE_INDEXABLE ? { index: true, follow: true } : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0a5f6b",
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
        <SiteHeader />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
        <SiteFooter />
        <MiniAppBridge />
      </body>
    </html>
  );
}
