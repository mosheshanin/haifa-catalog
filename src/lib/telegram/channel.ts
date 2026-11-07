import "server-only";
import { after } from "next/server";
import type { InlineKeyboardButton } from "grammy/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { miniAppLink } from "@/lib/env";
import type { ListingData, OfferItem } from "@/lib/blocks/types";
import { botApi, clip, escapeHtml, safeCall } from "@/lib/telegram/api";
import { offerSummary } from "@/lib/blocks/offers";
import { cardMeta, cardMiniAppLink, cardPhoto, cardSummary, getCards, type CardInfo } from "@/lib/telegram/cards";
import { sendText, telegramOf } from "@/lib/telegram/notify";

// Канал каталога (раздел 7 ТЗ, решения 2 ноября 2026 к этапу 4):
// пост при первой публикации карточки и при публикации спецпредложения у проверенной карточки;
// без примерных карточек и импорта; режим — сразу, еженедельный дайджест или выключено.

export type ChannelMode = "instant" | "digest" | "off";
export type ChannelConfig = { chatId: number; title: string; username: string | null; mode: ChannelMode };
export type ChannelCandidate = { chatId: number; title: string; username: string | null; at: string };

export async function getBotSetting<T>(key: string): Promise<T | null> {
  const { data } = await createAdminClient().from("bot_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? null;
}

export async function setBotSetting(key: string, value: unknown | null) {
  const sb = createAdminClient();
  if (value === null) await sb.from("bot_settings").delete().eq("key", key);
  else await sb.from("bot_settings").upsert({ key, value, updated_at: new Date().toISOString() });
}

export const getChannel = () => getBotSetting<ChannelConfig>("channel");

type PostRow = { id: number; listing_id: string; kind: "listing" | "offer"; item_key: string; item_title: string | null };

const openKeyboard = (c: CardInfo): InlineKeyboardButton[][] => [[{ text: "Открыть", url: cardMiniAppLink(c) }]];

// Текст поста. Подпись к фото — до 1024 символов.
async function composePost(post: PostRow, c: CardInfo): Promise<string> {
  const meta = escapeHtml(cardMeta(c));
  if (post.kind === "offer") {
    const offer = await currentOffer(c.id, post.item_key);
    const deal = offer ? offerSummary(offer) : "";
    const head = `🎁 <b>${escapeHtml(offer?.title ?? post.item_title ?? "Спецпредложение")}</b>${deal ? ` — ${escapeHtml(deal)}` : ""}`;
    const body = offer?.description ? `\n${escapeHtml(clip(offer.description, 300))}` : "";
    const until = offer?.validUntil ? `\n⏳ До ${offer.validUntil.split("-").reverse().join(".")}` : "";
    const promo = offer?.promoCode ? `\n🏷 Промокод: <code>${escapeHtml(offer.promoCode)}</code>` : "";
    return `${head}${body}${until}${promo}\n\n<b>${escapeHtml(c.title)}</b>${meta ? `\n${meta}` : ""}`;
  }
  const summary = cardSummary(c, 400);
  return `🆕 <b>${escapeHtml(c.title)}</b>${meta ? `\n${meta}` : ""}${summary ? `\n\n${summary}` : ""}\n\nНовое в каталоге.`;
}

async function currentOffer(listingId: string, key: string): Promise<OfferItem | null> {
  const sb = createAdminClient();
  const { data: l } = await sb.from("listings").select("published_version_id").eq("id", listingId).maybeSingle();
  if (!l?.published_version_id) return null;
  const { data: v } = await sb.from("listing_versions").select("data").eq("id", l.published_version_id).maybeSingle();
  const data = v?.data as ListingData | undefined;
  for (const item of offerItems(data)) if (item.key === key) return item.offer;
  return null;
}

// Спецпредложения карточки с ключом «<id блока>:<название>» (видимые блоки).
export function offerItems(data: ListingData | null | undefined): Array<{ key: string; offer: OfferItem }> {
  const out: Array<{ key: string; offer: OfferItem }> = [];
  for (const b of data?.blocks ?? []) {
    if (b.type !== "offers" || b.hidden) continue;
    for (const o of b.data.items ?? []) if (o.title?.trim()) out.push({ key: `${b.id}:${o.title.trim().slice(0, 120)}`, offer: o });
  }
  return out;
}

// Отправить один пост в канал прямо сейчас.
export async function sendPost(postId: number): Promise<{ ok: boolean; error?: string }> {
  const sb = createAdminClient();
  const channel = await getChannel();
  if (!channel) return { ok: false, error: "Канал не подключён." };
  const { data: post } = await sb.from("channel_posts").select("id, listing_id, kind, item_key, item_title, status").eq("id", postId).maybeSingle();
  if (!post) return { ok: false, error: "Пост не найден." };
  const [card] = await getCards([post.listing_id]);
  if (!card || card.status !== "published") {
    await sb.from("channel_posts").update({ status: "cancelled", error: "Карточка не опубликована" }).eq("id", postId);
    return { ok: false, error: "Карточка не опубликована." };
  }
  const text = await composePost(post as PostRow, card);
  const photo = await cardPhoto(card);
  let messageId: number | null = null;
  let error: string | undefined;
  const api = botApi();
  if (!api) return { ok: false, error: "Нет токена бота." };
  try {
    const m = photo && text.length <= 1024
      ? await api.sendPhoto(channel.chatId, photo, { caption: text, parse_mode: "HTML", reply_markup: { inline_keyboard: openKeyboard(card) } })
      : await api.sendMessage(channel.chatId, text, { parse_mode: "HTML", link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: openKeyboard(card) } });
    messageId = m.message_id;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.warn("Канал:", error);
  }
  await sb
    .from("channel_posts")
    .update(messageId ? { status: "posted", chat_id: channel.chatId, message_id: messageId, posted_at: new Date().toISOString(), error: null } : { status: "failed", error: clip(error ?? "Ошибка", 300) })
    .eq("id", postId);
  return messageId ? { ok: true } : { ok: false, error: "Telegram не принял пост. Проверьте, что бот — администратор канала с правом публикации." };
}

// Поставить пост в очередь; в режиме «сразу» — отправить после ответа пользователю.
async function enqueue(rows: Array<Omit<PostRow, "id"> & { instant_change_id?: number | null; created_by?: string | null }>) {
  if (!rows.length) return;
  const channel = await getChannel();
  if (!channel || channel.mode === "off") return;
  const { data } = await createAdminClient()
    .from("channel_posts")
    .upsert(rows, { onConflict: "listing_id,kind,item_key", ignoreDuplicates: true })
    .select("id");
  if (channel.mode === "instant" && data?.length) {
    after(async () => {
      for (const r of data) await sendPost(r.id as number);
    });
  }
}

const eligible = (c: CardInfo | undefined): c is CardInfo => Boolean(c && !c.isDemo && c.publishToChannel && c.status === "published");

// Первая публикация карточки (проверка или администратор). Импорт сюда не обращается.
export function onFirstPublish(listingId: string) {
  after(async () => {
    const [card] = await getCards([listingId]);
    if (!eligible(card)) return;
    await enqueue([{ listing_id: listingId, kind: "listing", item_key: "", item_title: card.title }]);
  });
}

// Новые спецпредложения у уже опубликованной карточки: пост в канал и сообщение тем, у кого карточка в избранном.
export function onOffersPublished(listingId: string, before: ListingData | null, next: ListingData, instantChangeIds: Record<string, number> = {}, actorId?: string) {
  const old = new Set(offerItems(before).map((o) => o.key));
  const added = offerItems(next).filter((o) => !old.has(o.key));
  if (!added.length || !before) return;
  after(async () => {
    const [card] = await getCards([listingId]);
    if (!card || card.isDemo || card.status !== "published") return;
    if (eligible(card)) {
      await enqueue(
        added.map((o) => ({
          listing_id: listingId,
          kind: "offer" as const,
          item_key: o.key,
          item_title: o.offer.title,
          instant_change_id: instantChangeIds[o.key.split(":")[0]] ?? null,
          created_by: actorId ?? null,
        })),
      );
    }
    await notifyFavoriters(card, added.map((o) => o.offer));
  });
}

async function notifyFavoriters(card: CardInfo, offers: OfferItem[]) {
  const { data: favs } = await createAdminClient().from("favorites").select("user_id").eq("listing_id", card.id).limit(5000);
  const text = `🎁 Новое спецпредложение в избранном — <b>${escapeHtml(card.title)}</b>:\n${offers
    .slice(0, 3)
    .map((o) => {
      const deal = offerSummary(o);
      return `• ${escapeHtml(o.title)}${deal ? ` (${escapeHtml(deal)})` : ""}`;
    })
    .join("\n")}`;
  for (const f of favs ?? []) {
    if (f.user_id === card.ownerId) continue;
    const chatId = await telegramOf(f.user_id as string, "updates");
    if (chatId) await sendText(chatId, text, [[{ text: "Открыть", url: cardMiniAppLink(card) }]]);
  }
}

// «Снять» правку со спецпредложением: пост из очереди отменяется, опубликованный — удаляется из канала.
export async function removePostsForChange(instantChangeId: number) {
  const sb = createAdminClient();
  const { data } = await sb.from("channel_posts").select("id, status, chat_id, message_id").eq("instant_change_id", instantChangeId).in("status", ["queued", "posted"]);
  for (const p of data ?? []) await removePost(p);
}

export async function removePost(p: { id: number; status: string; chat_id: number | null; message_id: number | null }): Promise<boolean> {
  const sb = createAdminClient();
  if (p.status === "posted" && p.chat_id && p.message_id) {
    // Пункт еженедельного дайджеста: всё сообщение не удаляем, только помечаем.
    const { count } = await sb.from("channel_posts").select("id", { count: "exact", head: true }).eq("chat_id", p.chat_id).eq("message_id", p.message_id);
    if ((count ?? 0) > 1) {
      await sb.from("channel_posts").update({ error: "Пункт в дайджесте: сообщение общее, уберите строку в канале вручную." }).eq("id", p.id);
      return false;
    }
    const ok = await safeCall(null, (api) => api.deleteMessage(p.chat_id!, p.message_id!));
    await sb.from("channel_posts").update(ok ? { status: "deleted" } : { error: "Telegram не дал удалить пост — удалите его в канале вручную." }).eq("id", p.id);
    return Boolean(ok);
  }
  await sb.from("channel_posts").update({ status: "cancelled" }).eq("id", p.id);
  return true;
}

// Вручную из админки: в очередь (если уже был — заново) и сразу в канал, независимо от режима и отметки карточки.
export async function postManually(listingId: string, actorId: string) {
  const sb = createAdminClient();
  const [card] = await getCards([listingId]);
  if (!card || card.status !== "published") return { ok: false, error: "Карточка не опубликована." };
  const key = `manual:${new Date().toISOString()}`;
  const { data, error } = await sb
    .from("channel_posts")
    .insert({ listing_id: listingId, kind: "listing", item_key: key, item_title: card.title, created_by: actorId })
    .select("id")
    .single();
  if (error) return { ok: false, error: "Не удалось поставить пост." };
  return sendPost(data.id as number);
}

// Еженедельный дайджест: одно сообщение со всем, что накопилось. Возвращает число пунктов.
export async function sendDigest(): Promise<number> {
  const channel = await getChannel();
  if (!channel || channel.mode !== "digest") return 0;
  const sb = createAdminClient();
  const { data: posts } = await sb.from("channel_posts").select("id, listing_id, kind, item_key, item_title").eq("status", "queued").order("created_at").limit(40);
  if (!posts?.length) return 0;
  const cards = await getCards([...new Set(posts.map((p) => p.listing_id as string))]);
  const live = posts.filter((p) => cards.find((c) => c.id === p.listing_id)?.status === "published");
  const line = (p: (typeof posts)[number]) => {
    const c = cards.find((x) => x.id === p.listing_id)!;
    const meta = cardMeta(c);
    return p.kind === "offer"
      ? `• <a href="${cardMiniAppLink(c)}">${escapeHtml(p.item_title ?? "Спецпредложение")}</a> — ${escapeHtml(c.title)}`
      : `• <a href="${cardMiniAppLink(c)}">${escapeHtml(c.title)}</a>${meta ? ` — ${escapeHtml(meta)}` : ""}`;
  };
  const fresh = live.filter((p) => p.kind === "listing").map(line);
  const offers = live.filter((p) => p.kind === "offer").map(line);
  const cancelled = posts.filter((p) => !live.includes(p)).map((p) => p.id);
  if (cancelled.length) await sb.from("channel_posts").update({ status: "cancelled" }).in("id", cancelled);
  if (!live.length) return 0;
  const text = [
    "📰 <b>Новое в каталоге за неделю</b>",
    fresh.length ? `\n🆕 <b>Новые карточки</b>\n${fresh.join("\n")}` : "",
    offers.length ? `\n🎁 <b>Спецпредложения</b>\n${offers.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const m = await safeCall(null, (api) =>
    api.sendMessage(channel.chatId, text.slice(0, 4000), {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: [[{ text: "📱 Открыть каталог", url: miniAppLink() }]] },
    }),
  );
  if (!m) return 0;
  await sb
    .from("channel_posts")
    .update({ status: "posted", chat_id: channel.chatId, message_id: m.message_id, posted_at: new Date().toISOString() })
    .in("id", live.map((p) => p.id));
  return live.length;
}
