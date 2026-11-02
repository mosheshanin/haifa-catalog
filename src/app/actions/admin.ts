"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ActionError, audit, requireAdmin, runAction, type ActionResult } from "@/lib/server/session";
import { getListingRow, getVersion } from "@/lib/server/listing-edit";
import { applyChanges, changeTitle, revertChange } from "@/lib/blocks/moderation";
import { BLOCK_TITLES, type ListingData } from "@/lib/blocks/types";
import { escapeHtml, notifyUser } from "@/lib/telegram/notify";
import { botApi, webhookSecret } from "@/lib/telegram/api";
import { BOT_COMMANDS } from "@/lib/telegram/bot";
import {
  getBotSetting,
  getChannel,
  onFirstPublish,
  onOffersPublished,
  postManually,
  removePost,
  removePostsForChange,
  sendPost,
  setBotSetting,
  type ChannelCandidate,
  type ChannelMode,
} from "@/lib/telegram/channel";
import { telegramBotTokenOptional } from "@/lib/env.server";
import { siteUrl } from "@/lib/env";

const titles = BLOCK_TITLES as Record<string, string>;
const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);

// ---------- Решение по правке или новой карточке: одобрить всё, часть блоков или отклонить (раздел 6) ----------
export async function decideVersion(_: unknown, form: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const admin = await requireAdmin();
    const v = await getVersion(str(form, "versionId", 40));
    if (!v || v.status !== "pending") throw new ActionError("Правка уже обработана.");
    const sb = createAdminClient();
    const { data: vr } = await sb.from("listing_versions").select("listing_id").eq("id", v.id).single();
    const listing = await getListingRow(vr!.listing_id);
    const published = (await getVersion(listing.published_version_id))?.data ?? null;
    const comment = str(form, "comment", 1000) || null;
    const now = new Date().toISOString();
    const title = escapeHtml(v.data.header.title);
    const whole = v.moderated_keys.includes("*") || !published;

    if (whole) {
      if (form.get("decision") === "approve") {
        const { error } = await sb.rpc("publish_listing_version", { p_version: v.id, p_comment: comment });
        if (error) throw error;
        await sb.from("listing_versions").update({ reviewed_by: admin.id }).eq("id", v.id);
        await sb.from("listings").update({ title: v.data.header.title }).eq("id", listing.id);
        notifyUser(listing.owner_id, `✅ Карточка «${title}» опубликована в каталоге.`, `/${listing.section}/${listing.slug}`);
        // Канал (этап 4): первая публикация — пост о карточке.
        if (!published) onFirstPublish(listing.id);
        else onOffersPublished(listing.id, published, v.data, {}, admin.id);
      } else {
        if (!comment) throw new ActionError("Напишите причину отказа — она уйдёт владельцу.");
        await sb.from("listing_versions").update({ status: "rejected", review_comment: comment, reviewed_by: admin.id, reviewed_at: now }).eq("id", v.id);
        if (!published) await sb.from("listings").update({ status: "rejected" }).eq("id", listing.id);
        notifyUser(listing.owner_id, `⛔ Карточка «${title}» не прошла проверку. Причина: ${escapeHtml(comment)}`, `/kabinet/kartochka/${listing.id}`);
      }
      await audit(admin.id, `listing.${form.get("decision") === "approve" ? "approved" : "rejected"}`, "listing", listing.id, { version: v.id, comment });
    } else {
      const approved = new Set(form.getAll("approve").map(String).filter((k) => v.moderated_keys.includes(k)));
      const decisions: Record<string, { ok: boolean; reason?: string }> = {};
      for (const k of v.moderated_keys) {
        const reason = str(form, `reason:${k}`, 300);
        if (!approved.has(k) && !reason) throw new ActionError("Для каждого отклонённого блока напишите причину — её увидит владелец.");
        decisions[k] = approved.has(k) ? { ok: true } : { ok: false, reason };
      }
      if (approved.size) {
        const merged: ListingData = applyChanges(published!, v.data, approved);
        merged.confirmedAt = v.data.confirmedAt;
        const { data: nv, error } = await sb.from("listing_versions").insert({ listing_id: listing.id, status: "draft", data: merged, created_by: admin.id, submitted_at: now }).select("id").single();
        if (error) throw error;
        const { error: pErr } = await sb.rpc("publish_listing_version", { p_version: nv.id, p_comment: comment ?? "Одобрено модератором" });
        if (pErr) throw pErr;
        await sb.from("listing_versions").update({ reviewed_by: admin.id }).eq("id", nv.id);
        await sb.from("listings").update({ title: merged.header.title }).eq("id", listing.id);
      }
      const allOk = approved.size === v.moderated_keys.length;
      await sb
        .from("listing_versions")
        .update({ status: approved.size ? "approved" : "rejected", block_decisions: decisions, review_comment: comment, reviewed_by: admin.id, reviewed_at: now })
        .eq("id", v.id);
      const nameOf = (k: string) => {
        if (k === "header" || k === "contacts") return changeTitle({ type: k }, titles);
        const b = v.data.blocks.find((x) => x.id === k) ?? published?.blocks.find((x) => x.id === k);
        return b ? titles[b.type] : k;
      };
      const rejected = v.moderated_keys.filter((k) => !approved.has(k));
      notifyUser(
        listing.owner_id,
        allOk
          ? `✅ Правки карточки «${title}» одобрены и опубликованы.`
          : `🛡 Проверка карточки «${title}» завершена.${approved.size ? ` Опубликовано: ${[...approved].map(nameOf).join(", ")}.` : ""} Не прошло: ${rejected
              .map((k) => `${nameOf(k)} — ${escapeHtml(decisions[k].reason ?? "")}`)
              .join("; ")}.`,
        `/kabinet/kartochka/${listing.id}`,
      );
      await audit(admin.id, "listing.version_decided", "listing", listing.id, { version: v.id, decisions });
    }
    updateTag("listings");
  });
  if (result.ok) redirect("/admin?tab=queue&done=1");
  return result;
}

// ---------- Отзывы ----------
export async function decideReview(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdmin();
    const id = str(form, "id", 40);
    const approve = form.get("decision") === "approve";
    const reason = str(form, "reason", 300) || null;
    if (!approve && !reason) throw new ActionError("Укажите причину отклонения.");
    const sb = createAdminClient();
    const { data: r } = await sb.from("reviews").select("id, user_id, listing_id, rating, status, listings(title, owner_id, section, slug)").eq("id", id).maybeSingle();
    if (!r) throw new ActionError("Отзыв не найден.");
    const { error } = await sb
      .from("reviews")
      .update({ status: approve ? "approved" : "rejected", reject_reason: approve ? null : reason, moderated_by: admin.id, moderated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    const l = r.listings as unknown as { title: string; owner_id: string | null; section: string; slug: string } | null;
    notifyUser(r.user_id, approve ? `✅ Ваш отзыв о «${escapeHtml(l?.title ?? "")}» опубликован.` : `⛔ Ваш отзыв о «${escapeHtml(l?.title ?? "")}» не прошёл проверку: ${escapeHtml(reason ?? "")}`);
    if (approve && l?.owner_id) notifyUser(l.owner_id, `💬 Новый отзыв (${"★".repeat(r.rating)}) о «${escapeHtml(l.title)}».`, "/kabinet/otzyvy", "reviews");
    await audit(admin.id, approve ? "review.approved" : "review.rejected", "review", id, { reason });
    updateTag("listings");
    refresh();
  }, "Готово.");
}

// ---------- Жалобы ----------
export async function decideComplaint(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdmin();
    const id = str(form, "id", 40);
    const status = form.get("decision") === "resolved" ? "resolved" : "rejected";
    const decision = str(form, "note", 1000) || null;
    const sb = createAdminClient();
    const { data: c } = await sb.from("complaints").select("id, kind, review_id, user_id, listing_id").eq("id", id).maybeSingle();
    if (!c) throw new ActionError("Жалоба не найдена.");
    const { error } = await sb.from("complaints").update({ status, decision, decided_by: admin.id, decided_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    // Жалоба на отзыв удовлетворена — отзыв снимается с публикации.
    if (status === "resolved" && c.kind === "review" && c.review_id && form.get("hideReview") === "1") {
      await sb.from("reviews").update({ status: "rejected", reject_reason: decision ?? "Снят по жалобе", moderated_by: admin.id, moderated_at: new Date().toISOString() }).eq("id", c.review_id);
      updateTag("listings");
    }
    notifyUser(c.user_id, `📮 По вашему обращению принято решение: ${status === "resolved" ? "удовлетворено" : "отклонено"}.${decision ? ` ${escapeHtml(decision)}` : ""}`);
    await audit(admin.id, `complaint.${status}`, "complaint", id, { decision });
    refresh();
  }, "Готово.");
}

// ---------- Права владельца ----------
export async function decideClaim(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdmin();
    const id = str(form, "id", 40);
    const approve = form.get("decision") === "approve";
    const comment = str(form, "comment", 500) || null;
    const sb = createAdminClient();
    const { data: c } = await sb.from("ownership_claims").select("id, listing_id, user_id, status, listings(title)").eq("id", id).maybeSingle();
    if (!c || c.status !== "pending") throw new ActionError("Заявка уже обработана.");
    const now = new Date().toISOString();
    await sb.from("ownership_claims").update({ status: approve ? "approved" : "rejected", admin_comment: comment, decided_by: admin.id, decided_at: now }).eq("id", id);
    const title = escapeHtml((c.listings as unknown as { title: string } | null)?.title ?? "");
    if (approve) {
      await sb.from("listings").update({ owner_id: c.user_id }).eq("id", c.listing_id);
      await sb
        .from("ownership_claims")
        .update({ status: "rejected", admin_comment: "Права подтверждены у другого пользователя", decided_by: admin.id, decided_at: now })
        .eq("listing_id", c.listing_id)
        .eq("status", "pending");
      notifyUser(c.user_id, `🔑 Права на карточку «${title}» подтверждены. Теперь её можно редактировать в кабинете.`, "/kabinet");
    } else {
      notifyUser(c.user_id, `⛔ Заявка на права на «${title}» отклонена.${comment ? ` ${escapeHtml(comment)}` : ""}`);
    }
    await audit(admin.id, approve ? "claim.approved" : "claim.rejected", "listing", c.listing_id, { claim: id, comment });
    updateTag("listings");
    refresh();
  }, "Готово.");
}

// ---------- «Снять» правку, опубликованную без проверки ----------
export async function revertInstant(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdmin();
    const id = Number(form.get("id"));
    const reason = str(form, "reason", 300);
    if (!reason) throw new ActionError("Напишите причину — её увидит владелец.");
    const sb = createAdminClient();
    const { data: ch } = await sb.from("instant_changes").select("*").eq("id", id).maybeSingle();
    if (!ch || ch.reverted_at) throw new ActionError("Правка уже снята.");
    const listing = await getListingRow(ch.listing_id);
    if (ch.block_type === "review_reply") {
      const reviewId = String(ch.block_key).split(":")[1];
      await sb.from("reviews").update({ owner_reply: ch.before, owner_reply_at: ch.before ? new Date().toISOString() : null }).eq("id", reviewId);
    } else {
      const current = (await getVersion(listing.published_version_id))?.data;
      if (!current) throw new ActionError("Нет опубликованной версии.");
      const reverted = revertChange(current, ch);
      const { data: nv, error } = await sb.from("listing_versions").insert({ listing_id: listing.id, status: "draft", data: reverted, created_by: admin.id }).select("id").single();
      if (error) throw error;
      const { error: pErr } = await sb.rpc("publish_listing_version", { p_version: nv.id, p_comment: `Снято модератором: ${reason}` });
      if (pErr) throw pErr;
    }
    await sb.from("instant_changes").update({ reverted_at: new Date().toISOString(), reverted_by: admin.id, revert_reason: reason }).eq("id", id);
    // Снятое спецпредложение убирается и из канала (решение 2 ноября 2026 к этапу 4).
    if (ch.block_type === "offers") await removePostsForChange(id);
    const what = ch.block_type === "review_reply" ? "ответ на отзыв" : changeTitle({ type: ch.block_type }, titles).toLowerCase();
    notifyUser(listing.owner_id, `↩️ Модератор снял правку «${what}» в карточке «${escapeHtml(listing.title ?? "")}». Причина: ${escapeHtml(reason)}`, `/kabinet/kartochka/${listing.id}`);
    await audit(admin.id, "instant_change.reverted", "listing", listing.id, { change: id, reason });
    updateTag("listings");
    refresh();
  }, "Правка снята.");
}

// ---------- Управление карточкой ----------
export async function updateListingAdmin(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdmin();
    const listing = await getListingRow(str(form, "id", 40));
    const sb = createAdminClient();
    const op = str(form, "op", 30);
    if (op === "archive" || op === "unarchive") {
      if (op === "unarchive" && !listing.published_version_id) throw new ActionError("У карточки нет опубликованной версии.");
      await sb.from("listings").update({ status: op === "archive" ? "archived" : "published" }).eq("id", listing.id);
    } else if (op === "verified") {
      await sb.from("listings").update({ is_verified: form.get("value") === "1" }).eq("id", listing.id);
    } else if (op === "owner") {
      const who = str(form, "owner", 120).replace(/^@/, "");
      let ownerId: string | null = null;
      if (who && who !== "-") {
        const q = who.includes("@") ? sb.from("profiles").select("id").eq("google_email", who.toLowerCase()) : sb.from("profiles").select("id").ilike("telegram_username", who);
        const { data: p } = await q.maybeSingle();
        if (!p) throw new ActionError("Пользователь не найден. Он должен хотя бы раз войти на сайт.");
        ownerId = p.id;
      }
      await sb.from("listings").update({ owner_id: ownerId }).eq("id", listing.id);
      if (ownerId) notifyUser(ownerId, `🔑 Вам выданы права на карточку «${escapeHtml(listing.title ?? "")}».`, "/kabinet");
    } else if (op === "channel") {
      await sb.from("listings").update({ publish_to_channel: form.get("value") === "1" }).eq("id", listing.id);
    } else if (op === "features") {
      let features: unknown;
      try {
        features = JSON.parse(str(form, "features", 4000) || "{}");
      } catch {
        throw new ActionError("Неверный формат: нужен JSON, например {\"google_reviews_text\": true}.");
      }
      if (!features || typeof features !== "object" || Array.isArray(features)) throw new ActionError("Нужен объект JSON.");
      await sb.from("listings").update({ features }).eq("id", listing.id);
    } else {
      throw new ActionError("Неизвестное действие.");
    }
    await audit(admin.id, `listing.${op}`, "listing", listing.id, { value: form.get("value") ?? form.get("owner") ?? null });
    updateTag("listings");
    refresh();
  }, "Сохранено.");
}

// ---------- Пользователи: роль и блокировка (через SQL-функцию с проверкой прав) ----------
export async function setUserAccess(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdmin();
    const userId = str(form, "id", 40);
    const role = form.get("role") === "admin" ? "admin" : "user";
    const blocked = form.get("blocked") === "1";
    const sb = createAdminClient();
    const { data: p } = await sb.from("profiles").select("id, google_email").eq("id", userId).maybeSingle();
    if (!p) throw new ActionError("Пользователь не найден.");
    if (role === "admin" && !p.google_email) throw new ActionError("Администратором можно сделать только пользователя, который входил через Google (вход в админку — только через Google).");
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_set_user_access", { p_user_id: userId, p_role: role, p_blocked: blocked });
    if (error) throw new ActionError(error.message);
    if (role === "admin") await sb.from("admin_emails").upsert({ email: p.google_email, added_by: admin.id });
    else if (p.google_email) await sb.from("admin_emails").delete().eq("email", p.google_email);
    refresh();
  }, "Сохранено.");
}

// ---------- Справочники ----------
const slugRe = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const aliasesOf = (s: string) =>
  s
    .split(/[,\n]/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 50);

// Списки особенностей и языков: регистр сохраняем («Wi-Fi»), он совпадает с отметками в карточках.
const listOf = (s: string) =>
  [...new Set(s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean))].slice(0, 60);

export async function saveCategory(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdmin();
    const sb = createAdminClient();
    const id = Number(form.get("id")) || null;
    const row = {
      name: str(form, "name", 100),
      icon: str(form, "icon", 8) || null,
      aliases: aliasesOf(str(form, "aliases", 2000)),
      seo_title: str(form, "seo_title", 120) || null,
      seo_description: str(form, "seo_description", 300) || null,
      seo_text: str(form, "seo_text", 3000) || null,
      ...(form.has("amenities") ? { amenities: listOf(str(form, "amenities", 2000)) } : {}),
      sort: Number(form.get("sort")) || 0,
      is_active: form.get("is_active") === "on",
    };
    if (!row.name) throw new ActionError("Укажите название.");
    if (id) {
      const { error } = await sb.from("categories").update(row).eq("id", id);
      if (error) throw new ActionError(error.message);
      // Псевдонимы категории попадают в поиск карточек — пересчитываем их (см. CLAUDE.md).
      const { data: kids } = await sb.from("categories").select("id").eq("parent_id", id);
      const catIds = [id, ...(kids ?? []).map((k) => k.id as number)];
      const { data: ls } = await sb.from("listings").select("id").in("category_id", catIds);
      for (const l of ls ?? []) await sb.rpc("refresh_listing_search", { p_listing: l.id });
    } else {
      const slug = str(form, "slug", 60);
      if (!slugRe.test(slug)) throw new ActionError("Адрес: латиница, цифры и дефисы, например nogti.");
      const section = form.get("section") === "specialisty" ? "specialisty" : "biznes";
      const parent_id = Number(form.get("parent_id")) || null;
      const { error } = await sb.from("categories").insert({ ...row, slug, section, parent_id });
      if (error) throw new ActionError(error.message);
    }
    await audit(admin.id, id ? "category.updated" : "category.created", "category", String(id ?? row.name), {});
    updateTag("dictionaries");
    updateTag("listings");
    refresh();
  }, "Сохранено.");
}

export async function saveDistrict(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdmin();
    const sb = createAdminClient();
    const id = Number(form.get("id")) || null;
    const row = {
      name: str(form, "name", 100),
      aliases: aliasesOf(str(form, "aliases", 2000)),
      seo_title: str(form, "seo_title", 120) || null,
      seo_description: str(form, "seo_description", 300) || null,
      sort: Number(form.get("sort")) || 0,
      is_active: form.get("is_active") === "on",
    };
    if (!row.name) throw new ActionError("Укажите название.");
    if (id) {
      const { error } = await sb.from("districts").update(row).eq("id", id);
      if (error) throw new ActionError(error.message);
      const { data: ls } = await sb.from("listings").select("id").contains("district_ids", [id]);
      for (const l of ls ?? []) await sb.rpc("refresh_listing_search", { p_listing: l.id });
    } else {
      const slug = str(form, "slug", 60);
      if (!slugRe.test(slug)) throw new ActionError("Адрес: латиница, цифры и дефисы.");
      const { error } = await sb.from("districts").insert({ ...row, slug, kind: form.get("kind") === "suburb" ? "suburb" : "haifa" });
      if (error) throw new ActionError(error.message);
    }
    await audit(admin.id, id ? "district.updated" : "district.created", "district", String(id ?? row.name), {});
    updateTag("dictionaries");
    updateTag("listings");
    refresh();
  }, "Сохранено.");
}

export async function saveSynonym(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdmin();
    const term = str(form, "term", 60).toLowerCase();
    const expands = aliasesOf(str(form, "expands", 1000));
    if (!term) throw new ActionError("Укажите слово.");
    const sb = createAdminClient();
    if (form.get("delete") === "1" || !expands.length) {
      await sb.from("search_synonyms").delete().eq("term", term);
    } else {
      const { error } = await sb.from("search_synonyms").upsert({ term, expands_to: expands });
      if (error) throw new ActionError(error.message);
    }
    await audit(admin.id, "synonym.saved", "synonym", term, { expands });
    updateTag("listings");
    refresh();
  }, "Сохранено.");
}

const legalEmail = (s: string) => {
  if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new ActionError("Проверьте email для запросов о данных.");
  return s;
};

export async function saveSettings(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdmin();
    const sb = createAdminClient();
    const rows = [
      {
        key: "review_rules",
        value: {
          minLength: Math.max(0, Math.min(500, Number(form.get("minLength")) || 0)),
          forbidLinks: form.get("forbidLinks") === "on",
          forbidPhones: form.get("forbidPhones") === "on",
        },
      },
      { key: "amenities", value: listOf(str(form, "amenities", 3000)) },
      { key: "amenities_specialisty", value: listOf(str(form, "amenities_specialisty", 3000)) },
      { key: "languages", value: listOf(str(form, "languages", 1000)) },
      { key: "legal", value: { owner: str(form, "legal_owner", 120), email: legalEmail(str(form, "legal_email", 120)) } },
    ].map((r) => ({ ...r, updated_by: admin.id, updated_at: new Date().toISOString() }));
    const { error } = await sb.from("site_settings").upsert(rows);
    if (error) throw error;
    await audit(admin.id, "settings.saved", "settings", "site", {});
    updateTag("settings");
    refresh();
  }, "Сохранено.");
}

// ---------- Telegram: бот и канал (этап 4) ----------

// Подключить бота: адрес вебхука с секретом, команды меню, описание. Повторное нажатие безопасно.
export async function setupBot(): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdmin();
    const token = telegramBotTokenOptional();
    const api = botApi();
    if (!token || !api) throw new ActionError("В Vercel не задан TELEGRAM_BOT_TOKEN.");
    const url = `${siteUrl()}/api/telegram/webhook`;
    if (!url.startsWith("https://")) throw new ActionError("Вебхук работает только на адресе https (на сайте Vercel).");
    try {
      await api.setWebhook(url, {
        secret_token: webhookSecret(token),
        allowed_updates: ["message", "callback_query", "inline_query", "my_chat_member"],
        max_connections: 20,
      });
      await api.setMyCommands(BOT_COMMANDS);
      await api.setMyShortDescription("Каталог бизнесов и специалистов Хайфы: поиск, избранное, заявки.");
      await api.setMyDescription("Найдите мастера, кафе или специалиста в Хайфе. Нажмите «Старт», чтобы искать и получать заявки и ответы владельцев.");
    } catch (e) {
      throw new ActionError(`Telegram не принял настройки: ${e instanceof Error ? e.message : e}`);
    }
    await audit(admin.id, "telegram.webhook_set", "settings", "telegram", { url });
    refresh();
  }, "Бот подключён.");
}

export async function setChannelMode(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdmin();
    const mode = String(form.get("mode")) as ChannelMode;
    if (!["instant", "digest", "off"].includes(mode)) throw new ActionError("Неизвестный режим.");
    const channel = await getChannel();
    if (!channel) throw new ActionError("Канал не подключён.");
    await setBotSetting("channel", { ...channel, mode });
    // Выключили — накопленная очередь отменяется, чтобы при включении не ушли старые посты.
    if (mode === "off") await createAdminClient().from("channel_posts").update({ status: "cancelled" }).eq("status", "queued");
    await audit(admin.id, "telegram.channel_mode", "settings", "channel", { mode });
    refresh();
  }, "Режим сохранён.");
}

export async function connectChannelCandidate(): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdmin();
    const cand = await getBotSetting<ChannelCandidate>("channel_candidate");
    if (!cand) throw new ActionError("Бот не добавлен ни в один новый канал.");
    const member = await botApi()?.getChatMember(cand.chatId, (await botApi()!.getMe()).id).catch(() => null);
    if (!member || member.status !== "administrator") throw new ActionError("Бот больше не администратор этого канала. Добавьте его снова.");
    await setBotSetting("channel", { chatId: cand.chatId, title: cand.title, username: cand.username, mode: "instant" });
    await setBotSetting("channel_candidate", null);
    await audit(admin.id, "telegram.channel_connected", "settings", "channel", { title: cand.title });
    refresh();
  }, "Канал подключён.");
}

export async function disconnectChannel(): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdmin();
    await setBotSetting("channel", null);
    await createAdminClient().from("channel_posts").update({ status: "cancelled" }).eq("status", "queued");
    await audit(admin.id, "telegram.channel_disconnected", "settings", "channel", {});
    refresh();
  }, "Канал отключён от каталога. Бота из канала удалите в настройках канала.");
}

// Пост в очереди: отправить сейчас / отменить; опубликованный — удалить из канала.
export async function channelPostAction(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdmin();
    const id = Number(form.get("id"));
    const op = String(form.get("op"));
    const sb = createAdminClient();
    const { data: p } = await sb.from("channel_posts").select("id, status, chat_id, message_id").eq("id", id).maybeSingle();
    if (!p) throw new ActionError("Пост не найден.");
    if (op === "send") {
      if (p.status !== "queued" && p.status !== "failed") throw new ActionError("Пост уже обработан.");
      const r = await sendPost(id);
      if (!r.ok) throw new ActionError(r.error ?? "Не отправилось.");
    } else if (op === "remove") {
      const ok = await removePost(p as never);
      if (!ok) throw new ActionError("Удалить не получилось — удалите пост в канале вручную.");
    } else throw new ActionError("Неизвестное действие.");
    await audit(admin.id, `telegram.post_${op}`, "channel_post", String(id), {});
    refresh();
  }, "Готово.");
}

export async function postListingToChannel(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdmin();
    const listing = await getListingRow(str(form, "id", 40));
    if (!(await getChannel())) throw new ActionError("Сначала подключите канал: админка → «Telegram».");
    const r = await postManually(listing.id, admin.id);
    if (!r.ok) throw new ActionError(r.error ?? "Не отправилось.");
    await audit(admin.id, "telegram.post_manual", "listing", listing.id, {});
    refresh();
  }, "Пост опубликован в канале.");
}
