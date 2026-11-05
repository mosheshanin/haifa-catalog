import "server-only";
import { after } from "next/server";
import type { InlineKeyboardButton } from "grammy/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/env";
import { escapeHtml, safeCall } from "@/lib/telegram/api";

export { escapeHtml };

export type NotifyPref = "moderation" | "reviews" | "requests" | "updates" | "tips"; // tips — советы по заполненности (5 ноября 2026)

// Бот может написать человеку, только если тот хоть раз нажал «Старт» у @haifabcbot (раздел 7).
export async function sendText(chatId: number, text: string, keyboard?: InlineKeyboardButton[][]) {
  return safeCall(chatId, (api) =>
    api.sendMessage(chatId, text, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: keyboard?.length ? { inline_keyboard: keyboard } : undefined,
    }),
  );
}

const openButton = (path: string, text = "Открыть"): InlineKeyboardButton[][] => [[{ text, url: `${siteUrl()}${path}` }]];

// Администраторам: новый элемент очереди или правка, опубликованная без проверки. Отправка после ответа пользователю.
export function notifyAdmins(text: string, path = "/admin") {
  after(async () => {
    const { data } = await createAdminClient().from("profiles").select("telegram_id").eq("role", "admin").eq("is_blocked", false).not("telegram_id", "is", null);
    await Promise.all((data ?? []).map((p) => sendText(p.telegram_id as number, text, openButton(path, "Открыть в админке"))));
  });
}

// Telegram-адрес пользователя, если он разрешил этот вид уведомлений (нет отметки — значит разрешил).
export async function telegramOf(userId: string, pref: NotifyPref): Promise<number | null> {
  const { data } = await createAdminClient().from("profiles").select("telegram_id, notify_prefs, is_blocked").eq("id", userId).maybeSingle();
  if (!data?.telegram_id || data.is_blocked) return null;
  const prefs = (data.notify_prefs ?? {}) as Record<string, boolean>;
  return prefs[pref] === false ? null : (data.telegram_id as number);
}

// Пользователю: итог проверки, ответ владельца, решение по заявке и т. п.
export function notifyUser(userId: string | null | undefined, text: string, path?: string, pref: NotifyPref = "moderation") {
  if (!userId) return;
  after(async () => {
    const chatId = await telegramOf(userId, pref);
    if (chatId) await sendText(chatId, text, path ? openButton(path) : undefined);
  });
}
