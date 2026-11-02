import "server-only";
import { createHmac } from "node:crypto";
import { Api, GrammyError } from "grammy";
import { createAdminClient } from "@/lib/supabase/admin";
import { telegramBotTokenOptional } from "@/lib/env.server";

let cached: { token: string; api: Api } | null = null;

// Клиент Bot API (grammY). Без токена — null: уведомления молча пропускаются (разработка, превью).
export function botApi(): Api | null {
  const token = telegramBotTokenOptional();
  if (!token) return null;
  if (cached?.token !== token) cached = { token, api: new Api(token) };
  return cached.api;
}

// Секрет вебхука выводится из токена бота: отдельная переменная в Vercel не нужна, а без токена его не подобрать.
// Telegram присылает его в заголовке X-Telegram-Bot-Api-Secret-Token (допустимы A-Z, a-z, 0-9, _ и -).
export function webhookSecret(token: string): string {
  return createHmac("sha256", token).update("hbc-telegram-webhook").digest("hex");
}

// Человек заблокировал бота или ни разу не нажал «Старт» — запоминаем, чтобы кабинет мог подсказать.
async function markUnreachable(chatId: number) {
  if (chatId <= 0) return;
  await createAdminClient()
    .from("telegram_chats")
    .upsert({ telegram_id: chatId, blocked_at: new Date().toISOString() }, { onConflict: "telegram_id" });
}

// Вызов Bot API без исключений наружу: уведомление не должно ломать действие пользователя.
export async function safeCall<T>(chatId: number | null, fn: (api: Api) => Promise<T>): Promise<T | null> {
  const api = botApi();
  if (!api) return null;
  try {
    return await fn(api);
  } catch (e) {
    if (e instanceof GrammyError && e.error_code === 403 && chatId) {
      await markUnreachable(chatId).catch(() => {});
    } else {
      console.warn("Telegram:", e instanceof GrammyError ? `${e.method} ${e.error_code} ${e.description}` : e);
    }
    return null;
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}
