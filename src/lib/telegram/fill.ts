import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/env";
import { getCategories } from "@/lib/data/dictionaries";
import { filterConfig } from "@/lib/catalog/filter-config";
import { STRONG_AT, listingScore, topCategorySlug } from "@/lib/blocks/score";
import type { ListingData, Section } from "@/lib/blocks/types";
import { escapeHtml, sendText, telegramOf } from "@/lib/telegram/notify";

// Еженедельный совет по заполненности (решение заказчика 5 ноября 2026, миграция 20261105000006): опубликованной карточке
// с владельцем, через 7+ дней после публикации, не чаще раза в 7 дней, пока заполненность ниже «Сильной» (75%), не больше
// MAX_TIPS раз. Совет — первый пункт listingScore().next; кнопки: открыть нужный блок в редакторе, «Через неделю»
// (callback fill:later:<id>, ничего не меняет — следующий совет и так через неделю) и «Не напоминать» (fill:off:<id>,
// выключает настройку уведомлений `tips`, включить обратно — кабинет → «Уведомления в Telegram»).

const WEEK = 7 * 86400_000;
export const MAX_TIPS = 6;

export async function sendFillReminders(): Promise<number> {
  const sb = createAdminClient();
  const weekAgo = new Date(Date.now() - WEEK).toISOString();
  const { data: rows, error } = await sb
    .from("listings")
    .select("id, owner_id, title, section, published_version_id, fill_reminders_sent")
    .eq("status", "published")
    .eq("is_demo", false)
    .not("owner_id", "is", null)
    .not("published_version_id", "is", null)
    .lt("published_at", weekAgo)
    .lt("fill_reminders_sent", MAX_TIPS)
    .or(`fill_reminded_at.is.null,fill_reminded_at.lt.${weekAgo}`)
    .limit(200);
  if (error) {
    console.warn("fill reminders:", error.message);
    return 0;
  }
  if (!rows?.length) return 0;
  const { data: versions } = await sb.from("listing_versions").select("id, data").in("id", rows.map((r) => r.published_version_id as string));
  const categories = await getCategories();
  const cats = categories.map((c) => ({ id: c.id, slug: c.slug, parentId: c.parent_id }));

  let sent = 0;
  for (const l of rows) {
    const data = (versions ?? []).find((v) => v.id === l.published_version_id)?.data as ListingData | undefined;
    if (!data) continue;
    const cat = categories.find((c) => c.id === data.header.categoryId);
    const parent = cat?.parent_id ? categories.find((c) => c.id === cat.parent_id) : undefined;
    const places = filterConfig(l.section as Section, cat ? { slug: cat.slug, parentSlug: parent?.slug ?? null } : null).places;
    const score = listingScore(data, { topSlug: topCategorySlug(data.header.categoryId, cats), placeTitle: places.title });
    const tip = score.next[0];
    if (score.percent >= STRONG_AT || !tip) continue;

    const chatId = await telegramOf(l.owner_id as string, "tips");
    if (!chatId) continue;
    // Сначала отметка: повторный запуск задачи не пришлёт второй совет.
    const { data: claimed } = await sb
      .from("listings")
      .update({ fill_reminded_at: new Date().toISOString(), fill_reminders_sent: (l.fill_reminders_sent as number) + 1 })
      .eq("id", l.id)
      .eq("fill_reminders_sent", l.fill_reminders_sent as number)
      .select("id");
    if (!claimed?.length) continue;

    const progress = tip.need && tip.have ? ` Сейчас ${tip.have} из ${tip.need}.` : "";
    const m = await sendText(
      chatId,
      `💡 Карточка «${escapeHtml(l.title ?? data.header.title)}» заполнена на <b>${score.percent}%</b>.\n${escapeHtml(score.message)}\n\n` +
        `Совет недели: <b>${escapeHtml(tip.action)}</b> (+${tip.points}%).${tip.why ? ` ${escapeHtml(tip.why)}` : ""}${progress}`,
      [
        [{ text: `✏️ ${tip.action}`, url: `${siteUrl()}/kabinet/kartochka/${l.id}?blok=${tip.key}` }],
        [
          { text: "⏰ Через неделю", callback_data: `fill:later:${l.id}` },
          { text: "🔕 Не напоминать", callback_data: `fill:off:${l.id}` },
        ],
      ],
    );
    if (m) sent++;
  }
  return sent;
}

// «Не напоминать»: выключает советы для этого человека (настройка `tips`).
export async function turnOffTips(profileId: string): Promise<void> {
  const sb = createAdminClient();
  const { data } = await sb.from("profiles").select("notify_prefs").eq("id", profileId).maybeSingle();
  const prefs = { ...((data?.notify_prefs ?? {}) as Record<string, boolean>), tips: false };
  const { error } = await sb.from("profiles").update({ notify_prefs: prefs }).eq("id", profileId);
  if (error) throw error;
}
