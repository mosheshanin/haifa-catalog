"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ActionError, audit, requireUser, runAction, type ActionResult } from "@/lib/server/session";
import { rateLimit } from "@/lib/server/protect";
import { assertCanEdit, cleanListingData, getEditState, getListingRow, uniqueSlug } from "@/lib/server/listing-edit";
import { applyChanges, changeTitle, diffListing } from "@/lib/blocks/moderation";
import { BLOCK_TITLES, type ListingData, type Section } from "@/lib/blocks/types";
import { escapeHtml, notifyAdmins, notifyUser } from "@/lib/telegram/notify";
import { onFirstPublish, onOffersPublished } from "@/lib/telegram/channel";
import { decideRequest } from "@/lib/telegram/requests";
import { israelToday } from "@/lib/blocks/expire";

const titles = BLOCK_TITLES as Record<string, string>;

// ---------- Новая карточка («Добавить бизнес или специалиста») ----------
export async function createListing(_: unknown, form: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requireUser();
    await rateLimit(`create-listing:${user.id}`, user.role === "admin" ? 200 : 5, 86400);
    const section = form.get("section") === "specialisty" ? "specialisty" : ("biznes" as Section);
    const title = String(form.get("title") ?? "").trim().slice(0, 120);
    const categoryId = Number(form.get("categoryId"));
    const district = String(form.get("district") ?? "");
    if (title.length < 2) throw new ActionError("Укажите название.");
    const sb = createAdminClient();
    const [{ data: cat }, { data: dist }] = await Promise.all([
      sb.from("categories").select("id").eq("id", categoryId).eq("section", section).eq("is_active", true).maybeSingle(),
      sb.from("districts").select("slug").eq("slug", district).eq("is_active", true).maybeSingle(),
    ]);
    if (!cat) throw new ActionError("Выберите категорию.");
    if (!dist) throw new ActionError("Выберите район.");
    const noOwner = user.role === "admin" && form.get("noOwner") === "1";
    const slug = await uniqueSlug(section, title);
    const { data: listing, error } = await sb
      .from("listings")
      .insert({ section, slug, status: "draft", owner_id: noOwner ? null : user.id, created_by: user.id, title })
      .select("id")
      .single();
    if (error) throw error;
    const data: ListingData = {
      section,
      header: { title, categoryId, districtSlugs: [district], badges: [] },
      contacts: {},
      blocks: [
        { id: `description-${crypto.randomUUID().slice(0, 8)}`, type: "description", data: { text: "" } },
        section === "biznes"
          ? { id: `address-${crypto.randomUUID().slice(0, 8)}`, type: "address", data: { address: "" } }
          : { id: `service_area-${crypto.randomUUID().slice(0, 8)}`, type: "service_area", data: { districtSlugs: [district], formats: ["at_home"] } },
      ],
    };
    const { error: vErr } = await sb.from("listing_versions").insert({ listing_id: listing.id, status: "draft", data, created_by: user.id });
    if (vErr) throw vErr;
    await audit(user.id, "listing.created", "listing", listing.id, { section, title, noOwner });
    return listing.id as string;
  });
  if (result.ok && result.data) redirect(`/kabinet/kartochka/${result.data}`);
  return result;
}

// ---------- Черновик ----------
export async function saveDraft(listingId: string, raw: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const listing = await getListingRow(listingId);
    assertCanEdit(listing, user);
    const state = await getEditState(listing);
    const { data } = await cleanListingData(listing, raw, user, state.published?.data ?? null);
    const sb = createAdminClient();
    if (state.draft) {
      const { error } = await sb.from("listing_versions").update({ data }).eq("id", state.draft.id);
      if (error) throw error;
    } else {
      const { error } = await sb.from("listing_versions").insert({ listing_id: listing.id, status: "draft", data, created_by: user.id });
      if (error) throw error;
    }
  }, "Черновик сохранён.");
}

type SubmitResult = { published: string[]; moderated: string[]; isNew: boolean };

// ---------- Отправка: часть правок публикуется сразу, часть ждёт проверки (раздел 2 ТЗ) ----------
export async function submitListing(listingId: string, raw: unknown): Promise<ActionResult<SubmitResult>> {
  return runAction(async () => {
    const user = await requireUser();
    await rateLimit(`submit:${user.id}`, 60, 3600);
    const listing = await getListingRow(listingId);
    assertCanEdit(listing, user);
    const state = await getEditState(listing);
    const publishedData = state.published?.data ?? null;
    const { data, errors } = await cleanListingData(listing, raw, user, publishedData);
    if (errors.length) throw new ActionError(errors.join(" "));
    data.confirmedAt = israelToday();
    const sb = createAdminClient();
    const now = new Date().toISOString();
    const title = escapeHtml(data.header.title);

    // Администратор публикует сразу целиком («редактирование от имени владельца», раздел 6).
    if (user.role === "admin") {
      const { data: v, error } = await sb.from("listing_versions").insert({ listing_id: listing.id, status: "draft", data, created_by: user.id, submitted_at: now }).select("id").single();
      if (error) throw error;
      const { error: pErr } = await sb.rpc("publish_listing_version", { p_version: v.id, p_comment: "Правка администратора" });
      if (pErr) throw pErr;
      if (state.draft) await sb.from("listing_versions").update({ status: "superseded" }).eq("id", state.draft.id);
      await sb.from("listings").update({ title: data.header.title }).eq("id", listing.id);
      await audit(user.id, "listing.admin_published", "listing", listing.id, { version: v.id });
      // Канал: первая публикация — пост о карточке; иначе — пост о новых спецпредложениях (этап 4).
      if (!publishedData) onFirstPublish(listing.id);
      else onOffersPublished(listing.id, publishedData, data, {}, user.id);
      updateTag("listings");
      return { published: ["Вся карточка"], moderated: [], isNew: !publishedData };
    }

    const supersede = async (keepId?: string) => {
      const ids = [state.pending?.id, state.draft?.id].filter((id): id is string => Boolean(id) && id !== keepId);
      if (ids.length) await sb.from("listing_versions").update({ status: "superseded" }).in("id", ids);
    };
    const toPending = async (moderatedKeys: string[]) => {
      const keep = state.draft?.id ?? state.pending?.id;
      if (keep) {
        const { error } = await sb.from("listing_versions").update({ status: "pending", data, moderated_keys: moderatedKeys, submitted_at: now, block_decisions: {} }).eq("id", keep);
        if (error) throw error;
      } else {
        const { error } = await sb.from("listing_versions").insert({ listing_id: listing.id, status: "pending", data, created_by: user.id, moderated_keys: moderatedKeys, submitted_at: now });
        if (error) throw error;
      }
      await supersede(keep);
    };

    // Новая карточка проверяется целиком.
    if (!publishedData) {
      await toPending(["*"]);
      await sb.from("listings").update({ status: "pending", title: data.header.title }).eq("id", listing.id);
      notifyAdmins(`🆕 Новая карточка на проверку: «${title}».`, "/admin?tab=queue");
      return { published: [], moderated: ["Вся карточка"], isNew: true };
    }

    const changes = diffListing(publishedData, data);
    const instant = changes.filter((c) => !c.moderated);
    const moderated = changes.filter((c) => c.moderated);

    if (instant.length) {
      const merged = applyChanges(publishedData, data, new Set(instant.map((c) => c.key)));
      merged.confirmedAt = data.confirmedAt;
      const { data: v, error } = await sb.from("listing_versions").insert({ listing_id: listing.id, status: "draft", data: merged, created_by: user.id, submitted_at: now }).select("id").single();
      if (error) throw error;
      const { error: pErr } = await sb.rpc("publish_listing_version", { p_version: v.id, p_comment: "Опубликовано без проверки" });
      if (pErr) throw pErr;
      const { data: journal, error: jErr } = await sb
        .from("instant_changes")
        .insert(instant.map((c) => ({ listing_id: listing.id, version_id: v.id, block_key: c.key, block_type: c.type, before: c.before, after: c.after, created_by: user.id })))
        .select("id, block_key");
      if (jErr) throw jErr;
      // Спецпредложения публикуются без проверки: пост в канал и сообщение тем, у кого карточка в избранном.
      // Связь с записью журнала нужна, чтобы «Снять» удалило и пост.
      onOffersPublished(listing.id, publishedData, merged, Object.fromEntries((journal ?? []).map((j) => [j.block_key as string, j.id as number])), user.id);
      notifyAdmins(
        `✏️ Опубликовано без проверки — «${title}»: ${instant.map((c) => changeTitle(c, titles).toLowerCase()).join(", ")}.`,
        "/admin?tab=instant",
      );
    }
    if (moderated.length) {
      await toPending(moderated.map((c) => c.key));
      notifyAdmins(`🕓 Правка на проверку — «${title}»: ${moderated.map((c) => changeTitle(c, titles).toLowerCase()).join(", ")}.`, "/admin?tab=queue");
    } else {
      await supersede();
    }
    if (!instant.length && !moderated.length && state.draft) {
      await sb.from("listing_versions").update({ status: "superseded" }).eq("id", state.draft.id);
    }
    await audit(user.id, "listing.submitted", "listing", listing.id, { instant: instant.map((c) => c.key), moderated: moderated.map((c) => c.key) });
    updateTag("listings");
    return {
      published: instant.map((c) => changeTitle(c, titles)),
      moderated: moderated.map((c) => changeTitle(c, titles)),
      isNew: false,
    };
  });
}

// ---------- Ответ владельца на отзыв: публикуется сразу, администратор получает уведомление ----------
export async function replyToReview(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    await rateLimit(`reply:${user.id}`, 60, 3600);
    const reviewId = String(form.get("reviewId") ?? "");
    const reply = String(form.get("reply") ?? "").trim().slice(0, 2000);
    const sb = createAdminClient();
    const { data: r } = await sb.from("reviews").select("id, listing_id, user_id, owner_reply, status").eq("id", reviewId).maybeSingle();
    if (!r || r.status !== "approved") throw new ActionError("Отзыв не найден.");
    const listing = await getListingRow(r.listing_id);
    assertCanEdit(listing, user);
    const { error } = await sb.from("reviews").update({ owner_reply: reply || null, owner_reply_at: reply ? new Date().toISOString() : null }).eq("id", r.id);
    if (error) throw error;
    await sb.from("instant_changes").insert({
      listing_id: listing.id,
      block_key: `review_reply:${r.id}`,
      block_type: "review_reply",
      before: r.owner_reply,
      after: reply || null,
      created_by: user.id,
    });
    notifyAdmins(`💬 Ответ владельца на отзыв — «${escapeHtml(listing.title ?? "")}».`, "/admin?tab=instant");
    // Автору отзыва — если он вошёл через Telegram и ответ новый или изменён.
    if (reply && reply !== r.owner_reply && r.user_id && r.user_id !== user.id) {
      notifyUser(r.user_id, `💬 Владелец «${escapeHtml(listing.title ?? "")}» ответил на ваш отзыв:\n«${escapeHtml(reply.slice(0, 500))}»`, `/${listing.section}/${listing.slug}#reviews`, "updates");
    }
    updateTag("listings");
    refresh();
  }, "Ответ опубликован.");
}

// ---------- Заявки: статус и заметка владельца ----------
export async function updateRequest(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const id = String(form.get("id") ?? "");
    const status = String(form.get("status") ?? "");
    if (!["new", "accepted", "rejected"].includes(status)) throw new ActionError("Неверный статус.");
    const sb = createAdminClient();
    const { data: r } = await sb.from("requests").select("id, listing_id").eq("id", id).maybeSingle();
    if (!r) throw new ActionError("Заявка не найдена.");
    assertCanEdit(await getListingRow(r.listing_id), user);
    const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;
    // Общая логика с кнопками в Telegram: обновит сообщение владельцу и сообщит клиенту о решении.
    await decideRequest(id, status as "new" | "accepted" | "rejected", note);
    refresh();
  }, "Сохранено.");
}

// ---------- Настройки уведомлений ----------
export async function updateNotifyPrefs(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const prefs = {
      requests: form.get("requests") === "on",
      reviews: form.get("reviews") === "on",
      moderation: form.get("moderation") === "on",
      updates: form.get("updates") === "on",
    };
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ notify_prefs: prefs }).eq("id", user.id);
    if (error) throw error;
    refresh();
  }, "Настройки сохранены.");
}

// ---------- Метка на карте по адресу: бесплатный геокодер на данных OpenStreetMap (раздел 11) ----------
export async function geocodeAddress(address: string): Promise<ActionResult<{ lat: number; lng: number; label: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    await rateLimit(`geocode:${user.id}`, 30, 3600);
    const q = address.trim().slice(0, 200);
    if (q.length < 3) throw new ActionError("Введите адрес.");
    const params = new URLSearchParams({ q, format: "jsonv2", limit: "1", countrycodes: "il", "accept-language": "ru", viewbox: "34.90,32.95,35.20,32.68" });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": "HBC-catalog/1.0 (https://haifa-catalog.vercel.app)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new ActionError("Сервис карт сейчас недоступен. Укажите координаты вручную.");
    const found = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!found.length) throw new ActionError("Адрес не найден. Попробуйте написать улицу и номер дома по-английски или на иврите.");
    return { lat: Number(Number(found[0].lat).toFixed(6)), lng: Number(Number(found[0].lon).toFixed(6)), label: found[0].display_name.split(",").slice(0, 3).join(",") };
  });
}
