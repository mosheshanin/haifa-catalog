import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { telegramBotTokenOptional } from "@/lib/env.server";
import { siteUrl } from "@/lib/env";

// Простые уведомления через Bot API (этап 3). Полноценный бот — этап 4.
// Бот может написать человеку, только если тот хоть раз нажал «Старт» у @haifabcbot.
async function send(chatId: number, text: string) {
  const token = telegramBotTokenOptional();
  if (!token) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.warn("Telegram sendMessage:", res.status, await res.text());
  } catch (e) {
    console.warn("Telegram sendMessage failed", e);
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Администраторам: новый элемент очереди или правка, опубликованная без проверки. Отправка после ответа пользователю.
export function notifyAdmins(text: string, path = "/admin") {
  after(async () => {
    const { data } = await createAdminClient().from("profiles").select("telegram_id").eq("role", "admin").eq("is_blocked", false).not("telegram_id", "is", null);
    const link = `${siteUrl()}${path}`;
    await Promise.all((data ?? []).map((p) => send(p.telegram_id as number, `${text}\n\n<a href="${link}">Открыть в админке</a>`)));
  });
}

// Пользователю (владельцу): итог проверки и т. п., если он разрешил такие уведомления.
export function notifyUser(userId: string | null | undefined, text: string, path?: string, pref: "moderation" | "reviews" | "requests" = "moderation") {
  if (!userId) return;
  after(async () => {
    const { data } = await createAdminClient().from("profiles").select("telegram_id, notify_prefs").eq("id", userId).maybeSingle();
    if (!data?.telegram_id) return;
    const prefs = (data.notify_prefs ?? {}) as Record<string, boolean>;
    if (prefs[pref] === false) return;
    await send(data.telegram_id as number, path ? `${text}\n\n<a href="${siteUrl()}${path}">Открыть</a>` : text);
  });
}
