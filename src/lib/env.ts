// Публичные значения (видны в браузере, не секрет). Значения по умолчанию — рабочие для этого проекта;
// переменные NEXT_PUBLIC_* в Vercel их переопределяют. Секреты читаются только в server-only модулях.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kqzrnjjeyppkmqtwnspo.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_VvVZ-5gZbn86HDU4vi-yzg_chbbFFSB";
export const TELEGRAM_BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "haifabcbot";
// Короткое имя Mini App из @BotFather (t.me/<бот>/<имя>). Пусто — используется главное приложение бота.
export const TELEGRAM_MINIAPP_SHORT_NAME = process.env.NEXT_PUBLIC_TELEGRAM_MINIAPP_SHORT_NAME ?? "";

export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
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
