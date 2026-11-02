import "server-only";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/env";
import { formatDateRu } from "@/lib/format";
import { escapeHtml, sendText, telegramOf } from "@/lib/telegram/notify";

// Свежесть данных (раздел 8 ТЗ; решение 2 ноября 2026, раздел 14): через 180 дней без подтверждения владельцу
// приходит напоминание с кнопками «✅ Всё верно» (callback fresh:<id>) и «✏️ Обновить» (редактор). Не чаще раза в 30 дней.

export async function sendFreshnessReminders(): Promise<number> {
  const sb = createAdminClient();
  const { data, error } = await sb.rpc("stale_listings", { p_limit: 200 });
  if (error) {
    console.warn("stale_listings:", error.message);
    return 0;
  }
  let sent = 0;
  for (const l of (data ?? []) as Array<{ id: string; owner_id: string; title: string | null; confirmed_at: string }>) {
    // Сначала отметка: повторный запуск задачи не пришлёт второе напоминание.
    const { data: claimed } = await sb
      .from("listings")
      .update({ freshness_reminded_at: new Date().toISOString() })
      .eq("id", l.id)
      .or(`freshness_reminded_at.is.null,freshness_reminded_at.lt.${new Date(Date.now() - 30 * 86400_000).toISOString()}`)
      .select("id");
    if (!claimed?.length) continue;
    const chatId = await telegramOf(l.owner_id, "updates");
    if (!chatId) continue;
    const m = await sendText(
      chatId,
      `🗓 Данные карточки «${escapeHtml(l.title ?? "")}» подтверждались ${formatDateRu(l.confirmed_at.slice(0, 10))}.\n` +
        "Проверьте, пожалуйста: телефон, адрес, часы работы и цены. Если всё верно — нажмите кнопку, на карточке появится новая дата.",
      [
        [{ text: "✅ Всё верно", callback_data: `fresh:${l.id}` }],
        [{ text: "✏️ Обновить данные", url: `${siteUrl()}/kabinet/kartochka/${l.id}` }],
      ],
    );
    if (m) sent++;
  }
  return sent;
}

// «Всё верно»: только владелец карточки или администратор.
export async function confirmListingData(listingId: string, profile: { id: string; role: string }): Promise<string | null> {
  const sb = createAdminClient();
  const { data: l } = await sb.from("listings").select("owner_id, title").eq("id", listingId).maybeSingle();
  if (!l || (l.owner_id !== profile.id && profile.role !== "admin")) return null;
  const { error } = await sb.rpc("confirm_listing_data", { p_listing: listingId });
  if (error) throw error;
  revalidateTag("listings", "max");
  return (l.title as string | null) ?? "";
}
