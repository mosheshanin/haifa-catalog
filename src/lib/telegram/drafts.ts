import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/env";
import { formatDateRu } from "@/lib/format";
import { escapeHtml, sendText } from "@/lib/telegram/notify";

// Брошенные черновики (решение заказчика 5 ноября 2026; миграция 20261105000004): через 27 дней без правок — напоминание
// в Telegram, через 30 дней (и не раньше чем через 3 дня после напоминания) черновик удаляется. Это важное сообщение,
// поэтому оно приходит независимо от настроек уведомлений — если человек хоть раз нажал «Старт» у бота.

async function chatOf(userId: string): Promise<number | null> {
  const { data } = await createAdminClient().from("profiles").select("telegram_id, is_blocked").eq("id", userId).maybeSingle();
  return data?.telegram_id && !data.is_blocked ? Number(data.telegram_id) : null;
}

export async function sendDraftReminders(): Promise<number> {
  const { data, error } = await createAdminClient().rpc("claim_draft_reminders", { p_limit: 200 });
  if (error) {
    console.warn("claim_draft_reminders:", error.message);
    return 0;
  }
  let sent = 0;
  for (const d of (data ?? []) as Array<{ id: string; owner_id: string; title: string | null; expires_at: string }>) {
    const chatId = await chatOf(d.owner_id);
    if (!chatId) continue;
    const m = await sendText(
      chatId,
      `📝 Черновик карточки «${escapeHtml(d.title ?? "без названия")}» не заполнялся почти месяц.\n` +
        `Он будет удалён ${formatDateRu(d.expires_at.slice(0, 10))}, если его не продолжить. Достаточно открыть и сохранить любое поле.`,
      [[{ text: "✏️ Продолжить заполнение", url: `${siteUrl()}/kabinet/kartochka/${d.id}` }]],
    );
    if (m) sent++;
  }
  return sent;
}

export async function expireDrafts(): Promise<number> {
  const { data, error } = await createAdminClient().rpc("expire_drafts", { p_limit: 200 });
  if (error) {
    console.warn("expire_drafts:", error.message);
    return 0;
  }
  const rows = (data ?? []) as Array<{ id: string; owner_id: string; title: string | null }>;
  for (const d of rows) {
    const chatId = await chatOf(d.owner_id);
    if (chatId) {
      await sendText(
        chatId,
        `🗑 Черновик карточки «${escapeHtml(d.title ?? "без названия")}» удалён: его не заполняли 30 дней. Начать заново можно в любой момент.`,
        [[{ text: "➕ Добавить карточку", url: `${siteUrl()}/kabinet/novaya` }]],
      );
    }
  }
  return rows.length;
}
