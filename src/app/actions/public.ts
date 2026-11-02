"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { ActionError, audit, getSessionUser, requireUser, runAction, type ActionResult } from "@/lib/server/session";
import { clientIp, honeypot, rateLimit, verifyCaptcha } from "@/lib/server/protect";
import { escapeHtml, notifyAdmins, notifyUser } from "@/lib/telegram/notify";
import { getSiteSettings } from "@/lib/data/settings";
import { israelToday } from "@/lib/blocks/expire";

const text = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);

async function publishedListing(id: string) {
  const { data } = await createAdminClient()
    .from("listings")
    .select("id, section, slug, title, owner_id, status, published_version_id")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.status !== "published") throw new ActionError("Карточка не найдена.");
  return data;
}

// Имя автора отзыва: имя и первая буква фамилии (раздел 5 ТЗ).
function shortName(full: string): string {
  const parts = full.replace(/[^\p{L}\s-]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Пользователь";
  return parts[1] ? `${parts[0]} ${parts[1][0].toUpperCase()}.` : parts[0];
}

const LINK_RE = /(https?:\/\/|www\.|\b[\w-]+\.(com|co\.il|ru|net|org|il|io|me)\b|t\.me\/|wa\.me\/)/i;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;

export async function submitReview(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    honeypot(form);
    const user = await requireUser();
    await verifyCaptcha(form.get("cf-turnstile-response"));
    await rateLimit(`review:${user.id}`, 5, 86400);
    const listing = await publishedListing(text(form, "listingId", 40));
    if (listing.owner_id === user.id) throw new ActionError("Нельзя оставить отзыв на свою карточку.");
    const rating = Number(form.get("rating"));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ActionError("Поставьте оценку от 1 до 5 звёзд.");
    const body = text(form, "text", 3000);
    const { reviewRules: rules } = await getSiteSettings();
    if (body.length < rules.minLength) throw new ActionError(`Напишите хотя бы ${rules.minLength} символов.`);
    if (rules.forbidLinks && LINK_RE.test(body)) throw new ActionError("Ссылки в отзыве не допускаются.");
    if (rules.forbidPhones && PHONE_RE.test(body)) throw new ActionError("Телефоны в отзыве не допускаются.");

    const sb = createAdminClient();
    const { data: existing } = await sb.from("reviews").select("id").eq("listing_id", listing.id).eq("user_id", user.id).maybeSingle();
    if (existing) throw new ActionError("Вы уже оставили отзыв на эту карточку.");
    const { data: review, error } = await sb
      .from("reviews")
      .insert({ listing_id: listing.id, user_id: user.id, rating, text: body, author_name: shortName(user.displayName) })
      .select("id")
      .single();
    if (error) throw error;
    await audit(user.id, "review.created", "review", review.id, { listing: listing.id, rating });
    notifyAdmins(`⭐ Новый отзыв (${"★".repeat(rating)}) на «${escapeHtml(listing.title ?? "")}» — ждёт проверки.`, "/admin?tab=queue");
  }, "Спасибо! Отзыв появится после проверки.");
}

const COMPLAINT_REASONS = {
  listing: ["Неверные данные", "Бизнес закрыт", "Мошенничество", "Оскорбительное содержание", "Другое"],
  review: ["Ложный отзыв", "Оскорбления", "Реклама или спам", "Личные данные", "Другое"],
  data_request: ["Исправить данные", "Удалить мои данные", "Удалить карточку"],
} as const;

export async function submitComplaint(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    honeypot(form);
    const kind = text(form, "kind", 20) as keyof typeof COMPLAINT_REASONS;
    if (!(kind in COMPLAINT_REASONS)) throw new ActionError("Неизвестный тип обращения.");
    // Жалобы на карточку и отзыв — после входа (раздел 2); запрос на исправление данных может отправить и гость.
    const user = kind === "data_request" ? await getSessionUser() : await requireUser();
    await verifyCaptcha(form.get("cf-turnstile-response"));
    await rateLimit(`complaint:${user?.id ?? (await clientIp())}`, 10, 3600);
    const listing = await publishedListing(text(form, "listingId", 40));
    const reason = text(form, "reason", 80);
    if (!(COMPLAINT_REASONS[kind] as readonly string[]).includes(reason)) throw new ActionError("Выберите причину.");
    const contact = text(form, "contact", 120) || null;
    if (kind === "data_request" && !contact && !user) throw new ActionError("Оставьте контакт, чтобы мы могли ответить.");
    const reviewId = kind === "review" ? text(form, "reviewId", 40) : null;
    const sb = createAdminClient();
    if (reviewId) {
      const { data: r } = await sb.from("reviews").select("id").eq("id", reviewId).eq("listing_id", listing.id).maybeSingle();
      if (!r) throw new ActionError("Отзыв не найден.");
    }
    const { data: c, error } = await sb
      .from("complaints")
      .insert({ kind, listing_id: listing.id, review_id: reviewId, user_id: user?.id ?? null, reason, text: text(form, "text", 2000) || null, contact })
      .select("id")
      .single();
    if (error) throw error;
    await audit(user?.id ?? null, "complaint.created", "complaint", c.id, { kind, listing: listing.id });
    const what = kind === "data_request" ? "Запрос на исправление данных" : kind === "review" ? "Жалоба на отзыв" : "Жалоба на карточку";
    notifyAdmins(`🚩 ${what}: «${escapeHtml(listing.title ?? "")}» — ${escapeHtml(reason)}.`, "/admin?tab=queue");
  }, "Спасибо, обращение отправлено администратору.");
}

export async function submitRequest(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    honeypot(form);
    await verifyCaptcha(form.get("cf-turnstile-response"));
    const user = await getSessionUser();
    await rateLimit(`request:${user?.id ?? (await clientIp())}`, 5, 3600);
    const listing = await publishedListing(text(form, "listingId", 40));
    const name = text(form, "name", 80);
    const contact = text(form, "contact", 120);
    if (!name) throw new ActionError("Укажите имя.");
    if (contact.replace(/\D/g, "").length < 7 && !/^@?[A-Za-z0-9_]{4,32}$/.test(contact) && !/@.+\./.test(contact)) {
      throw new ActionError("Укажите телефон, ник в Telegram или email.");
    }
    const date = text(form, "date", 10) || null;
    const time = text(form, "time", 5) || null;
    const today = israelToday();
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today)) throw new ActionError("Выберите сегодняшнюю или будущую дату.");
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new ActionError("Неверное время.");
    const sb = createAdminClient();
    const { error } = await sb
      .from("requests")
      .insert({
        listing_id: listing.id,
        user_id: user?.id ?? null,
        name,
        contact,
        service: text(form, "service", 200) || null,
        master: text(form, "master", 80) || null,
        desired_date: date,
        desired_time: time,
        comment: text(form, "comment", 1000) || null,
      })
    if (error) throw error;
    // Счётчик заявок в статистике владельца.
    const { data: stat } = await sb.from("listing_stats").select("count").eq("listing_id", listing.id).eq("day", today).eq("kind", "request").maybeSingle();
    await sb.from("listing_stats").upsert({ listing_id: listing.id, day: today, kind: "request", count: (stat?.count ?? 0) + 1 });
    notifyUser(listing.owner_id, `✍️ Новая заявка на «${escapeHtml(listing.title ?? "")}» от ${escapeHtml(name)}.`, "/kabinet/zayavki", "requests");
  }, "Заявка отправлена. Владелец свяжется с вами.");
}

export async function submitClaim(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    honeypot(form);
    const user = await requireUser();
    await verifyCaptcha(form.get("cf-turnstile-response"));
    await rateLimit(`claim:${user.id}`, 5, 86400);
    const listing = await publishedListing(text(form, "listingId", 40));
    if (listing.owner_id === user.id) throw new ActionError("Вы уже владелец этой карточки.");
    const contact = text(form, "contact", 120);
    if (contact.length < 5) throw new ActionError("Укажите телефон или другой контакт для проверки.");
    const sb = createAdminClient();
    const { data: dup } = await sb.from("ownership_claims").select("id").eq("listing_id", listing.id).eq("user_id", user.id).eq("status", "pending").maybeSingle();
    if (dup) throw new ActionError("Ваша заявка уже на проверке.");
    const { data: c, error } = await sb
      .from("ownership_claims")
      .insert({ listing_id: listing.id, user_id: user.id, contact, message: text(form, "message", 1000) || null })
      .select("id")
      .single();
    if (error) throw error;
    await audit(user.id, "claim.created", "listing", listing.id, { claim: c.id });
    notifyAdmins(`🔑 Заявка на права владельца: «${escapeHtml(listing.title ?? "")}», контакт ${escapeHtml(contact)}.`, "/admin?tab=queue");
  }, "Заявка отправлена. Администратор свяжется с вами для проверки.");
}
