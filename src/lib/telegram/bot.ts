import "server-only";
import { Bot, type Context } from "grammy";
import type { InlineKeyboardButton, InlineQueryResult } from "grammy/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/server";
import { miniAppLink, siteUrl } from "@/lib/env";
import type { Section } from "@/lib/blocks/types";
import { clip, escapeHtml } from "@/lib/telegram/api";
import { cardLine, cardMeta, cardMiniAppLink, cardSummary, cardWebUrl, describe, getCards, type CardInfo } from "@/lib/telegram/cards";
import { decideRequest, requestKeyboard, requestText, type RequestStatus } from "@/lib/telegram/requests";
import { confirmListingData } from "@/lib/telegram/freshness";
import { turnOffTips } from "@/lib/telegram/fill";
import { getChannel, setBotSetting, type ChannelCandidate, type ChannelConfig } from "@/lib/telegram/channel";

// Бот каталога на grammY (раздел 7 ТЗ): /start, /search, /favorites, /leads, поиск в любом чате (@бот маникюр),
// кнопки заявок, подключение канала. Сообщения приходят на вебхук /api/telegram/webhook.

export const BOT_COMMANDS = [
  { command: "search", description: "Найти бизнес или специалиста" },
  { command: "favorites", description: "Моё избранное" },
  { command: "leads", description: "Новые заявки (для владельцев)" },
  { command: "start", description: "Открыть каталог" },
];

const isPrivate = (ctx: Context) => ctx.chat?.type === "private";

// В личном чате карточка открывается прямо в Mini App (web_app), в группах — ссылкой.
function openButton(ctx: Context, c: CardInfo, text = "Открыть"): InlineKeyboardButton {
  return isPrivate(ctx) ? { text, web_app: { url: cardWebUrl(c) } } : { text, url: cardMiniAppLink(c) };
}

function catalogButton(ctx: Context): InlineKeyboardButton {
  return isPrivate(ctx) ? { text: "📱 Открыть каталог", web_app: { url: siteUrl() } } : { text: "📱 Открыть каталог", url: miniAppLink() };
}

type SearchRow = { id: string; section: Section; slug: string; title: string; summary: string | null; cover_url: string | null; category_id: number | null; district_ids: number[]; rating_avg: number | null; rating_count: number };

async function search(q: string, limit: number, offset = 0): Promise<CardInfo[]> {
  const { data, error } = await createPublicClient().rpc("search_listings", { p_q: q.trim().slice(0, 100) || null, p_limit: limit, p_offset: offset });
  if (error) throw error;
  return describe((data ?? []) as SearchRow[]);
}

async function profileByTelegram(telegramId: number) {
  const { data } = await createAdminClient().from("profiles").select("id, role, is_blocked, display_name").eq("telegram_id", telegramId).maybeSingle();
  return data && !data.is_blocked ? data : null;
}

async function replyCards(ctx: Context, cards: CardInfo[], heading: string) {
  if (!cards.length) return;
  const text = `${heading}\n\n${cards.map((c, i) => `${i + 1}. ${cardLine(c)}`).join("\n\n")}`;
  const keyboard = cards.map((c, i) => [openButton(ctx, c, `${i + 1}. ${clip(c.title, 40)}`)]);
  await ctx.reply(text, { parse_mode: "HTML", link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: keyboard } });
}

async function doSearch(ctx: Context, q: string) {
  const query = q.trim();
  if (!query) {
    await ctx.reply("Напишите, что ищете, например: <i>маникюр Адар</i> или <i>электрик</i>.", { parse_mode: "HTML" });
    return;
  }
  const cards = await search(query, 5);
  if (!cards.length) {
    await ctx.reply(`По запросу «${escapeHtml(clip(query, 60))}» ничего не нашлось. Попробуйте другое слово или откройте каталог.`, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[catalogButton(ctx)]] },
    });
    return;
  }
  await replyCards(ctx, cards, `🔎 Нашлось по запросу «${escapeHtml(clip(query, 60))}»:`);
}

async function showFavorites(ctx: Context) {
  const profile = ctx.from ? await profileByTelegram(ctx.from.id) : null;
  if (!profile) {
    await ctx.reply("Избранное хранится в вашем профиле каталога. Откройте каталог — вход через Telegram произойдёт сам, — и отмечайте ❤️ понравившиеся карточки.", {
      reply_markup: { inline_keyboard: [[catalogButton(ctx)]] },
    });
    return;
  }
  const { data } = await createAdminClient().from("favorites").select("listing_id").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(20);
  const cards = (await getCards((data ?? []).map((f) => f.listing_id as string))).filter((c) => c.status === "published").slice(0, 10);
  if (!cards.length) {
    await ctx.reply("В избранном пока пусто. Отмечайте ❤️ карточки в каталоге — они появятся здесь.", { reply_markup: { inline_keyboard: [[catalogButton(ctx)]] } });
    return;
  }
  await replyCards(ctx, cards, "❤️ Ваше избранное:");
}

async function showLeads(ctx: Context) {
  const profile = ctx.from ? await profileByTelegram(ctx.from.id) : null;
  if (!profile) {
    await ctx.reply("Заявки видны владельцам карточек. Откройте каталог (вход через Telegram произойдёт сам) и добавьте свой бизнес или подтвердите права на карточку.", {
      reply_markup: { inline_keyboard: [[catalogButton(ctx)]] },
    });
    return;
  }
  const sb = createAdminClient();
  const { data: listings } = await sb.from("listings").select("id, title, slug").eq("owner_id", profile.id);
  if (!listings?.length) {
    await ctx.reply("У вас пока нет своих карточек. Добавить бизнес или специалиста можно в каталоге.", {
      reply_markup: { inline_keyboard: [[{ text: "➕ Добавить карточку", url: `${siteUrl()}/kabinet/novaya` }]] },
    });
    return;
  }
  const { data: reqs } = await sb
    .from("requests")
    .select("id, listing_id, user_id, name, contact, service, master, desired_date, desired_time, comment, status, owner_note, tg_chat_id, tg_message_id")
    .in("listing_id", listings.map((l) => l.id))
    .eq("status", "new")
    .order("created_at", { ascending: false })
    .limit(10);
  if (!reqs?.length) {
    await ctx.reply("Новых заявок нет. Все заявки — в кабинете.", { reply_markup: { inline_keyboard: [[{ text: "📋 Все заявки", url: `${siteUrl()}/kabinet/zayavki` }]] } });
    return;
  }
  await ctx.reply(`📥 Новых заявок: ${reqs.length}${reqs.length === 10 ? " (показаны последние 10)" : ""}.`);
  for (const r of reqs.slice(0, 10)) {
    const l = listings.find((x) => x.id === r.listing_id);
    const m = await ctx.reply(requestText(r as never, (l?.title as string) ?? ""), { parse_mode: "HTML", link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: requestKeyboard(r as never) } });
    await sb.from("requests").update({ tg_chat_id: m.chat.id, tg_message_id: m.message_id }).eq("id", r.id);
  }
}

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  // Любое сообщение в личке = человек нажал «Старт» и бот может ему писать.
  bot.use(async (ctx, next) => {
    if (isPrivate(ctx) && ctx.from && (ctx.message || ctx.callbackQuery)) {
      await createAdminClient()
        .from("telegram_chats")
        .upsert({ telegram_id: ctx.from.id, username: ctx.from.username ?? null, blocked_at: null }, { onConflict: "telegram_id" });
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    const payload = ctx.match?.trim() ?? "";
    if (payload === "leads") return showLeads(ctx);
    if (payload === "favorites") return showFavorites(ctx);
    await ctx.reply(
      [
        "👋 Это каталог бизнесов и специалистов Хайфы.",
        "",
        "🔎 Просто напишите, что ищете: <i>маникюр Адар</i>, <i>электрик</i>, <i>кафе с Wi-Fi</i>.",
        "❤️ /favorites — ваше избранное",
        "📥 /leads — новые заявки (для владельцев)",
        `💬 В любом чате наберите <code>@${escapeHtml(ctx.me.username)} маникюр</code> — и отправьте карточку другу.`,
        "",
        "Владельцам: сюда приходят заявки с кнопками «Принять» и «Отклонить».",
      ].join("\n"),
      { parse_mode: "HTML", reply_markup: { inline_keyboard: [[catalogButton(ctx)]] } },
    );
  });

  bot.command("help", (ctx) => ctx.reply("🔎 Напишите, что ищете. /favorites — избранное, /leads — заявки владельцу.", { reply_markup: { inline_keyboard: [[catalogButton(ctx)]] } }));
  bot.command("search", (ctx) => doSearch(ctx, ctx.match ?? ""));
  bot.command("favorites", showFavorites);
  bot.command("leads", showLeads);

  // Кнопки заявки: принять / отклонить. Нажать может только владелец карточки или администратор.
  bot.callbackQuery(/^rq:([ar]):([0-9a-f-]{36})$/, async (ctx) => {
    const status: RequestStatus = ctx.match[1] === "a" ? "accepted" : "rejected";
    const id = ctx.match[2];
    const profile = await profileByTelegram(ctx.from.id);
    const sb = createAdminClient();
    const { data: r } = await sb.from("requests").select("id, status, listing_id").eq("id", id).maybeSingle();
    const { data: l } = r ? await sb.from("listings").select("owner_id").eq("id", r.listing_id).maybeSingle() : { data: null };
    if (!r || !profile || (l?.owner_id !== profile.id && profile.role !== "admin")) {
      await ctx.answerCallbackQuery({ text: "Нет доступа к этой заявке.", show_alert: true });
      return;
    }
    if (r.status !== "new") {
      await ctx.answerCallbackQuery({ text: r.status === "accepted" ? "Заявка уже принята." : "Заявка уже отклонена." });
      return;
    }
    // Сообщение, в котором нажали, тоже обновится (его адрес мог быть не записан, если это /leads из другого чата).
    if (ctx.callbackQuery.message) {
      await sb.from("requests").update({ tg_chat_id: ctx.callbackQuery.message.chat.id, tg_message_id: ctx.callbackQuery.message.message_id }).eq("id", id);
    }
    await decideRequest(id, status);
    await ctx.answerCallbackQuery({ text: status === "accepted" ? "✅ Заявка принята. Свяжитесь с клиентом." : "Заявка отклонена." });
  });
  // «Всё верно» из напоминания о свежести данных (этап 5): обновляет дату подтверждения на карточке.
  bot.callbackQuery(/^fresh:([0-9a-f-]{36})$/, async (ctx) => {
    const profile = await profileByTelegram(ctx.from.id);
    const title = profile ? await confirmListingData(ctx.match[1], profile) : null;
    if (title === null) {
      await ctx.answerCallbackQuery({ text: "Нет доступа к этой карточке.", show_alert: true });
      return;
    }
    await ctx.answerCallbackQuery({ text: "✅ Спасибо! Дата подтверждения обновлена." });
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }).catch(() => undefined);
  });
  // Совет по заполненности (5 ноября 2026): «Через неделю» ничего не меняет (следующий совет и так через 7 дней),
  // «Не напоминать» выключает настройку уведомлений tips. В обоих случаях остаётся только кнопка редактора.
  bot.callbackQuery(/^fill:(later|off):([0-9a-f-]{36})$/, async (ctx) => {
    const keepEditor = async () => {
      const rows = ctx.callbackQuery.message && "reply_markup" in ctx.callbackQuery.message ? ctx.callbackQuery.message.reply_markup?.inline_keyboard ?? [] : [];
      const editor = rows.filter((r) => r.some((b) => "url" in b));
      await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: editor } }).catch(() => undefined);
    };
    if (ctx.match[1] === "later") {
      await ctx.answerCallbackQuery({ text: "Хорошо, напомню через неделю." });
      await keepEditor();
      return;
    }
    const profile = await profileByTelegram(ctx.from.id);
    if (!profile) {
      await ctx.answerCallbackQuery({ text: "Не нашли ваш профиль. Выключить советы можно в кабинете на сайте.", show_alert: true });
      return;
    }
    await turnOffTips(profile.id);
    await ctx.answerCallbackQuery({ text: "Больше не буду присылать советы. Включить снова — в кабинете, «Уведомления в Telegram».", show_alert: true });
    await keepEditor();
  });
  bot.on("callback_query:data", (ctx) => ctx.answerCallbackQuery());

  // Встроенный поиск в любом чате: @бот маникюр → карточки с кнопкой «Открыть».
  bot.on("inline_query", async (ctx) => {
    const q = ctx.inlineQuery.query;
    const offset = Number(ctx.inlineQuery.offset) || 0;
    const cards = await search(q, 20, offset);
    const results: InlineQueryResult[] = cards.map((c) => {
      const thumb = c.coverUrl?.startsWith("https://images.unsplash.com/") ? `${c.coverUrl}?w=160&h=160&q=60&fm=jpg&fit=crop` : c.coverUrl?.startsWith("https://") ? c.coverUrl : undefined;
      const summary = cardSummary(c, 300);
      return {
        type: "article",
        id: c.id,
        title: c.title,
        description: clip(cardMeta(c) || c.summary || "", 100),
        thumbnail_url: thumb,
        input_message_content: {
          message_text: `${cardLine(c)}${summary ? `\n\n${summary}` : ""}`,
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        },
        reply_markup: { inline_keyboard: [[{ text: "Открыть", url: cardMiniAppLink(c) }]] },
      };
    });
    await ctx.answerInlineQuery(results, {
      cache_time: 60,
      is_personal: false,
      next_offset: cards.length === 20 ? String(offset + 20) : "",
      button: { text: "📱 Открыть каталог", web_app: { url: siteUrl() } },
    });
  });

  // Бота добавили в канал или убрали из него; личный чат заблокирован или разблокирован.
  bot.on("my_chat_member", async (ctx) => {
    const upd = ctx.myChatMember;
    const status = upd.new_chat_member.status;
    if (upd.chat.type === "private") {
      await createAdminClient()
        .from("telegram_chats")
        .upsert({ telegram_id: upd.chat.id, blocked_at: status === "kicked" ? new Date().toISOString() : null }, { onConflict: "telegram_id" });
      return;
    }
    if (upd.chat.type !== "channel") return;
    const current = await getChannel();
    if (status === "administrator") {
      const info = { chatId: upd.chat.id, title: upd.chat.title, username: upd.chat.username ?? null };
      const adder = await profileByTelegram(upd.from.id);
      if (adder?.role === "admin") {
        const cfg: ChannelConfig = { ...info, mode: current?.chatId === info.chatId ? current.mode : "instant" };
        await setBotSetting("channel", cfg);
        await setBotSetting("channel_candidate", null);
        await ctx.api.sendMessage(upd.from.id, `📣 Канал «${escapeHtml(info.title)}» подключён к каталогу. Режим публикации меняется в админке → «Telegram».`, { parse_mode: "HTML" }).catch(() => {});
      } else {
        const cand: ChannelCandidate = { ...info, at: new Date().toISOString() };
        await setBotSetting("channel_candidate", cand);
      }
    } else if ((status === "left" || status === "kicked" || status === "member") && current?.chatId === upd.chat.id) {
      await setBotSetting("channel", null);
    }
  });

  // Обычный текст в личке — поиск.
  bot.on("message:text", async (ctx) => {
    if (!isPrivate(ctx) || ctx.message.text.startsWith("/")) return;
    await doSearch(ctx, ctx.message.text);
  });

  bot.catch((err) => console.error("Бот:", err.error));
  return bot;
}
