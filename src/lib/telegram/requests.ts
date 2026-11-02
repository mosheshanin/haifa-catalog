import "server-only";
import { after } from "next/server";
import type { InlineKeyboardButton } from "grammy/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/env";
import { addDays, israelToday } from "@/lib/blocks/expire";
import { clip, escapeHtml, safeCall } from "@/lib/telegram/api";
import { cardMiniAppLink, getCards } from "@/lib/telegram/cards";
import { sendText, telegramOf } from "@/lib/telegram/notify";

// Заявки в Telegram (раздел 7): владельцу — с кнопками «Принять» и «Отклонить»; клиенту, вошедшему через
// Telegram, — решение владельца и напоминание накануне. Гостям без входа бот не пишет.

export type RequestStatus = "new" | "accepted" | "rejected";

type RequestRow = {
  id: string;
  listing_id: string;
  user_id: string | null;
  name: string;
  contact: string;
  service: string | null;
  master: string | null;
  desired_date: string | null;
  desired_time: string | null;
  comment: string | null;
  status: RequestStatus;
  owner_note: string | null;
  tg_chat_id: number | null;
  tg_message_id: number | null;
};

const COLS = "id, listing_id, user_id, name, contact, service, master, desired_date, desired_time, comment, status, owner_note, tg_chat_id, tg_message_id";

const ruDate = (d: string) => d.split("-").reverse().join(".");
const STATUS_LINE: Record<RequestStatus, string> = { new: "🟡 Новая", accepted: "✅ Принята", rejected: "✖ Отклонена" };

export function requestText(r: RequestRow, listingTitle: string): string {
  const tg = /^@?[A-Za-z][A-Za-z0-9_]{3,31}$/.test(r.contact) && !/^\d+$/.test(r.contact);
  const lines = [
    `✍️ <b>Заявка — «${escapeHtml(listingTitle)}»</b>`,
    `👤 ${escapeHtml(r.name)}`,
    `📞 ${tg ? `@${escapeHtml(r.contact.replace(/^@/, ""))}` : escapeHtml(r.contact)}`,
    r.service ? `🛠 ${escapeHtml(r.service)}` : "",
    r.master ? `🙋 Мастер: ${escapeHtml(r.master)}` : "",
    r.desired_date ? `📅 ${ruDate(r.desired_date)}${r.desired_time ? ` в ${r.desired_time}` : ""}` : "",
    r.comment ? `💬 ${escapeHtml(clip(r.comment, 600))}` : "",
    "",
    STATUS_LINE[r.status],
  ];
  return lines.filter((l, i) => l !== "" || i === lines.length - 2).join("\n");
}

export function requestKeyboard(r: RequestRow): InlineKeyboardButton[][] {
  const rows: InlineKeyboardButton[][] = [];
  if (r.status === "new") rows.push([{ text: "✅ Принять", callback_data: `rq:a:${r.id}` }, { text: "✖ Отклонить", callback_data: `rq:r:${r.id}` }]);
  const tg = r.contact.replace(/^@/, "");
  if (/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(tg)) rows.push([{ text: "✈️ Написать в Telegram", url: `https://t.me/${tg}` }]);
  rows.push([{ text: "📋 Все заявки", url: `${siteUrl()}/kabinet/zayavki` }]);
  return rows;
}

async function load(id: string) {
  const { data } = await createAdminClient().from("requests").select(COLS).eq("id", id).maybeSingle();
  if (!data) return null;
  const { data: l } = await createAdminClient().from("listings").select("title, slug, owner_id").eq("id", data.listing_id).maybeSingle();
  return { r: data as RequestRow, title: (l?.title as string) ?? l?.slug ?? "", ownerId: (l?.owner_id as string | null) ?? null };
}

// Новая заявка — владельцу в Telegram с кнопками (после ответа посетителю).
export function notifyNewRequest(requestId: string) {
  after(async () => {
    const x = await load(requestId);
    if (!x?.ownerId) return;
    const chatId = await telegramOf(x.ownerId, "requests");
    if (!chatId) return;
    const m = await sendText(chatId, requestText(x.r, x.title), requestKeyboard(x.r));
    if (m) await createAdminClient().from("requests").update({ tg_chat_id: chatId, tg_message_id: m.message_id }).eq("id", requestId);
  });
}

// Решение владельца из Telegram или из кабинета. Права проверяет вызывающий код.
export async function decideRequest(requestId: string, status: RequestStatus, note?: string | null): Promise<{ changed: boolean; title: string } | null> {
  const x = await load(requestId);
  if (!x) return null;
  const changed = x.r.status !== status;
  const patch: Record<string, unknown> = { status };
  if (note !== undefined) patch.owner_note = note;
  if (changed) patch.decided_at = status === "new" ? null : new Date().toISOString();
  const { error } = await createAdminClient().from("requests").update(patch).eq("id", requestId);
  if (error) throw error;
  const updated = { ...x.r, status, owner_note: note === undefined ? x.r.owner_note : note };

  // Сообщение владельцу в Telegram: обновить статус и убрать кнопки.
  if (changed && x.r.tg_chat_id && x.r.tg_message_id) {
    await safeCall(x.r.tg_chat_id, (api) =>
      api.editMessageText(x.r.tg_chat_id!, x.r.tg_message_id!, requestText(updated, x.title), {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_markup: { inline_keyboard: requestKeyboard(updated) },
      }),
    );
  }

  // Клиенту, вошедшему через Telegram.
  if (changed && status !== "new" && x.r.user_id && x.r.user_id !== x.ownerId) {
    const chatId = await telegramOf(x.r.user_id, "updates");
    if (chatId) {
      const [card] = await getCards([x.r.listing_id]);
      const when = x.r.desired_date ? ` на ${ruDate(x.r.desired_date)}${x.r.desired_time ? ` в ${x.r.desired_time}` : ""}` : "";
      const text =
        status === "accepted"
          ? `✅ «${escapeHtml(x.title)}» принял(а) вашу заявку${when}. С вами свяжутся по контакту из заявки.`
          : `✖ «${escapeHtml(x.title)}» не сможет принять вашу заявку${when}.`;
      // Заметка владельца — «для себя» (подсказка в кабинете), клиенту её не отправляем.
      await sendText(chatId, text, card ? [[{ text: "Открыть карточку", url: cardMiniAppLink(card) }]] : undefined);
    }
  }
  return { changed, title: x.title };
}

// Напоминание накануне: принятые заявки на завтра (по Израилю). Ежедневная задача; повторно не шлёт.
export async function sendReminders(): Promise<number> {
  const sb = createAdminClient();
  const tomorrow = addDays(israelToday(), 1);
  const { data } = await sb.from("requests").select(COLS).eq("status", "accepted").eq("desired_date", tomorrow).is("reminded_at", null).not("user_id", "is", null).limit(500);
  let sent = 0;
  for (const raw of data ?? []) {
    const r = raw as RequestRow;
    // Сначала отметка: повторный запуск задачи не пришлёт второе напоминание.
    const { data: claimed } = await sb.from("requests").update({ reminded_at: new Date().toISOString() }).eq("id", r.id).is("reminded_at", null).select("id");
    if (!claimed?.length) continue;
    const chatId = await telegramOf(r.user_id!, "updates");
    if (!chatId) continue;
    const [card] = await getCards([r.listing_id]);
    if (!card) continue;
    const m = await sendText(
      chatId,
      `⏰ Напоминание: завтра, ${ruDate(r.desired_date!)}${r.desired_time ? ` в ${r.desired_time}` : ""} — «${escapeHtml(card.title)}».${r.service ? `\n🛠 ${escapeHtml(r.service)}` : ""}`,
      [[{ text: "Открыть карточку", url: cardMiniAppLink(card) }]],
    );
    if (m) sent++;
  }
  return sent;
}
