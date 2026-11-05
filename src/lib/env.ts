// Публичные значения (видны в браузере, не секрет). Значения по умолчанию — рабочие для этого проекта;
// переменные NEXT_PUBLIC_* в Vercel их переопределяют. Секреты читаются только в server-only модулях.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kqzrnjjeyppkmqtwnspo.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_VvVZ-5gZbn86HDU4vi-yzg_chbbFFSB";
export const TELEGRAM_BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "haifabcbot";
// Короткое имя Mini App из @BotFather (t.me/<бот>/<имя>). Пусто — используется главное приложение бота.
export const TELEGRAM_MINIAPP_SHORT_NAME = process.env.NEXT_PUBLIC_TELEGRAM_MINIAPP_SHORT_NAME ?? "";

// Свой домен (куплен 5 ноября 2026). www.haifa.business в Vercel перенаправляется сюда.
export const PRODUCTION_SITE_URL = "https://haifa.business";

export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  // Рабочая сборка — всегда свой домен; предпросмотры (preview) — свой адрес *.vercel.app.
  if (process.env.VERCEL_ENV === "production") return PRODUCTION_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

// Пока выбран временный адрес, сайт закрыт от индексации.
export const SITE_INDEXABLE = process.env.SITE_INDEXABLE === "true";

export function miniAppLink(startParam?: string): string {
  const base = TELEGRAM_MINIAPP_SHORT_NAME
    ? `https://t.me/${TELEGRAM_BOT_USERNAME}/${TELEGRAM_MINIAPP_SHORT_NAME}`
    : `https://t.me/${TELEGRAM_BOT_USERNAME}`;
  if (!startParam) return TELEGRAM_MINIAPP_SHORT_NAME ? base : `${base}?startapp`;
  return `${base}?startapp=${encodeURIComponent(startParam)}`;
}

// Client ID приложения Google (OAuth client «HBC web», вид …apps.googleusercontent.com; не секрет). С ним вход через
// Google идёт окном Google прямо с сайта — в окне написано haifa.business, а не адрес Supabase. Пусто — прежний вход
// через сервер Supabase. В Google Cloud у этого клиента в «Authorized JavaScript origins» должны быть адреса сайта.
export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "113628238037-err1h4nq81gm2h79a5e8eb7ou3p8hjpa.apps.googleusercontent.com";

// Cloudflare Turnstile (капча форм): ключ сайта не секретный. Пока пусто — формы работают с ограничением частоты,
// а проверка капчи включится, когда в Vercel появится TURNSTILE_SECRET_KEY и здесь — ключ сайта.
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAAF0nuedjfu42CK31";

// Ключ Google Maps Embed API (бесплатная карта с рейтингом). Не секретный: ограничен адресом сайта в Google Cloud.
// Пока пусто — используется встраивание карты без ключа по коду места (cid).
export const GOOGLE_MAPS_EMBED_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY || "";

// Этап 5: Google Analytics 4 (идентификатор вида G-XXXXXXX, не секрет). Пусто — аналитика и баннер cookie выключены.
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || "G-B7FVV3T3F8";

// Коды подтверждения Google Search Console и Bing Webmaster Tools (мета-тег, не секрет). Подключаем после своего домена.
export const GOOGLE_SITE_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "";
export const BING_SITE_VERIFICATION = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || "";
