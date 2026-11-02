"use server";

import { updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionError, audit, requireAdmin, runAction, type ActionResult } from "@/lib/server/session";
import { uniqueSlug } from "@/lib/server/listing-edit";
import { normalizePhone, sanitizeListingData } from "@/lib/blocks/sanitize";
import { isGoogleMapsUrl, parseGoogleMapsUrl } from "@/lib/blocks/links";
import { parseHours, splitList, splitUrls, type ImportRow } from "@/lib/import/rows";
import { FREE_LIMITS, type ListingBlock, type ListingData, type Section } from "@/lib/blocks/types";
import { siteUrl } from "@/lib/env";

type Dict = {
  categories: Array<{ id: number; section: Section; slug: string; name: string }>;
  districts: Array<{ slug: string; name: string; aliases: string[] | null }>;
};

async function loadDict(): Promise<Dict> {
  const sb = createAdminClient();
  const [{ data: categories }, { data: districts }] = await Promise.all([
    sb.from("categories").select("id, section, slug, name").eq("is_active", true),
    sb.from("districts").select("slug, name, aliases").eq("is_active", true),
  ]);
  return { categories: (categories ?? []) as Dict["categories"], districts: (districts ?? []) as Dict["districts"] };
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[«»"'().,-]/g, " ").replace(/\s+/g, " ").trim();

function resolveRow(row: ImportRow, dict: Dict) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sec = norm(row.section ?? "");
  const section: Section | null = sec.startsWith("биз") || sec === "biznes" ? "biznes" : sec.startsWith("спец") || sec === "specialisty" ? "specialisty" : null;
  if (!section) errors.push("Раздел: «бизнес» или «специалист».");
  const catKey = norm(row.category ?? "");
  const category = dict.categories.find((c) => c.section === section && (c.slug === catKey || norm(c.name) === catKey));
  if (!category) errors.push(`Категория «${row.category ?? ""}» не найдена в разделе.`);
  const districts = splitList(row.districts)
    .map((d) => {
      const k = norm(d);
      const hit = dict.districts.find((x) => x.slug === k || norm(x.name) === k || (x.aliases ?? []).includes(k));
      if (!hit) errors.push(`Район «${d}» не найден.`);
      return hit?.slug;
    })
    .filter((x): x is string => Boolean(x));
  if (!districts.length && !errors.some((e) => e.startsWith("Район"))) errors.push("Укажите район.");
  if (!row.title || row.title.length < 2) errors.push("Укажите название.");
  const phone = normalizePhone(row.phone);
  if (row.phone && !phone) warnings.push("Телефон не распознан.");
  if (!phone && !row.whatsapp && !row.telegram && !row.email) errors.push("Нужен хотя бы один контакт: телефон, WhatsApp, Telegram или email.");
  const hours = parseHours(row.hours);
  if (!hours.ok) warnings.push("Часы работы распознаны не полностью — проверьте формат «Вс-Чт 09:00-18:00; Пт 09:00-13:00».");
  if (section === "biznes" && !row.address) warnings.push("Нет адреса — карточка будет без карты.");
  if (row.google && !isGoogleMapsUrl(row.google)) warnings.push("Ссылка Google Карт не распознана.");
  return { errors, warnings, section, category, districts, phone, hours };
}

export type PreviewRow = { line: number; title: string; errors: string[]; warnings: string[]; duplicate?: string };

// Предпросмотр: обязательные поля, неизвестные категории и районы, возможные дубли по телефону и названию.
export async function previewImport(rows: ImportRow[]): Promise<ActionResult<PreviewRow[]>> {
  return runAction(async () => {
    await requireAdmin();
    if (!Array.isArray(rows) || rows.length > 500) throw new ActionError("Не больше 500 строк за раз.");
    const dict = await loadDict();
    const sb = createAdminClient();
    const { data: listings } = await sb.from("listings").select("id, title, published_version_id").neq("status", "archived");
    const versionIds = (listings ?? []).map((l) => l.published_version_id).filter(Boolean) as string[];
    const { data: phones } = versionIds.length ? await sb.from("listing_versions").select("listing_id, phone:data->contacts->>phone").in("id", versionIds) : { data: [] };
    const byTitle = new Map((listings ?? []).map((l) => [norm(l.title ?? ""), l.title]));
    const byPhone = new Map((phones ?? []).filter((p) => p.phone).map((p) => [p.phone as string, (listings ?? []).find((l) => l.id === p.listing_id)?.title]));
    const seenPhone = new Map<string, number>();
    const seenTitle = new Map<string, number>();
    return rows.map((row) => {
      const r = resolveRow(row, dict);
      let duplicate: string | undefined;
      const t = norm(row.title ?? "");
      if (r.phone && byPhone.has(r.phone)) duplicate = `телефон уже есть в каталоге: «${byPhone.get(r.phone)}»`;
      else if (t && byTitle.has(t)) duplicate = `название уже есть в каталоге: «${byTitle.get(t)}»`;
      else if (r.phone && seenPhone.has(r.phone)) duplicate = `тот же телефон в строке ${seenPhone.get(r.phone)}`;
      else if (t && seenTitle.has(t)) duplicate = `то же название в строке ${seenTitle.get(t)}`;
      if (r.phone) seenPhone.set(r.phone, row.line);
      if (t) seenTitle.set(t, row.line);
      return { line: row.line, title: row.title ?? "", errors: r.errors, warnings: r.warnings, duplicate };
    });
  });
}

// Фото по ссылке → WebP до 2000 px → наше хранилище (раздел 6: фото скачиваются в собственное хранилище).
async function importPhoto(url: string): Promise<string | undefined> {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(u.hostname)) return undefined;
    const res = await fetch(u, { signal: AbortSignal.timeout(10000), headers: { "User-Agent": "HBC-catalog-import/1.0" } });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) return undefined;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 10 * 1024 * 1024) return undefined;
    const sharp = (await import("sharp")).default;
    const webp = await sharp(buf).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    const path = `import/${crypto.randomUUID()}.webp`;
    const sb = createAdminClient();
    const { error } = await sb.storage.from("media").upload(path, webp, { contentType: "image/webp", cacheControl: "31536000" });
    if (error) return undefined;
    return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
  } catch {
    return undefined;
  }
}

async function geocode(address: string): Promise<{ lat: number; lng: number } | undefined> {
  try {
    const params = new URLSearchParams({ q: address, format: "jsonv2", limit: "1", countrycodes: "il", "accept-language": "ru", viewbox: "34.90,32.95,35.20,32.68" });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": "HBC-catalog/1.0 (https://haifa-catalog.vercel.app)" },
      signal: AbortSignal.timeout(8000),
    });
    const found = (await res.json()) as Array<{ lat: string; lon: string }>;
    return found[0] ? { lat: Number(Number(found[0].lat).toFixed(6)), lng: Number(Number(found[0].lon).toFixed(6)) } : undefined;
  } catch {
    return undefined;
  }
}

// Одна строка: карточка без владельца, сразу опубликованная. Вызывается по очереди, чтобы не превышать
// ограничения бесплатного геокодера (не чаще запроса в секунду) и времени работы функции.
export async function importRow(row: ImportRow): Promise<ActionResult<{ url: string; warnings: string[] }>> {
  return runAction(async () => {
    const admin = await requireAdmin();
    const dict = await loadDict();
    const r = resolveRow(row, dict);
    if (r.errors.length) throw new ActionError(r.errors.join(" "));
    const section = r.section!;
    const warnings = [...r.warnings];
    const id = () => crypto.randomUUID().slice(0, 8);

    const photoUrls = splitUrls(row.photos);
    const coverSrc = row.cover && /^https?:\/\//.test(row.cover) ? row.cover : photoUrls[0];
    const [cover, ...gallery] = await Promise.all([coverSrc ? importPhoto(coverSrc) : Promise.resolve(undefined), ...photoUrls.map(importPhoto)]);
    const photos = gallery.filter((x): x is string => Boolean(x));
    if (photoUrls.length && photos.length < photoUrls.length) warnings.push(`Скачано фото: ${photos.length} из ${photoUrls.length}.`);

    const blocks: ListingBlock[] = [];
    if (row.description) blocks.push({ id: `description-${id()}`, type: "description", data: { text: row.description } });
    if (row.address) {
      const geo = await geocode(row.address);
      if (!geo) warnings.push("Адрес не найден на карте — поставьте метку вручную в редакторе.");
      blocks.push({ id: `address-${id()}`, type: "address", data: { address: row.address, ...geo } });
    } else if (section === "specialisty") {
      blocks.push({ id: `service_area-${id()}`, type: "service_area", data: { districtSlugs: r.districts, formats: ["at_home"] } });
    }
    if (Object.keys(r.hours.week).length) blocks.push({ id: `hours-${id()}`, type: "hours", data: { week: r.hours.week } });
    if (photos.length) blocks.push({ id: `gallery-${id()}`, type: "gallery", data: { photos: photos.slice(0, FREE_LIMITS.gallery).map((url) => ({ url })) } });
    const langs = splitList(row.languages);
    if (langs.length) blocks.push({ id: `languages-${id()}`, type: "languages", data: { items: langs } });
    const feats = splitList(row.features);
    if (feats.length) blocks.push({ id: `features-${id()}`, type: "features", data: { items: feats } });
    if (row.google && isGoogleMapsUrl(row.google)) blocks.push({ id: `google-${id()}`, type: "google", data: { url: row.google, ...parseGoogleMapsUrl(row.google) } });

    const raw: ListingData = {
      section,
      header: { title: row.title!, slogan: row.slogan, profession: row.profession, coverUrl: cover, categoryId: r.category!.id, districtSlugs: r.districts, badges: [] },
      contacts: { phone: row.phone, whatsapp: row.whatsapp ?? row.phone, telegram: row.telegram, email: row.email, website: row.website, instagram: row.instagram, facebook: row.facebook },
      blocks,
      confirmedAt: new Date().toISOString().slice(0, 10),
    };
    const { data, errors } = sanitizeListingData(raw, {
      section,
      districts: dict.districts.map((d) => d.slug),
      categoryIds: dict.categories.filter((c) => c.section === section).map((c) => c.id),
      badges: [],
    });
    if (errors.length) throw new ActionError(errors.join(" "));

    const sb = createAdminClient();
    const slug = await uniqueSlug(section, data.header.title);
    const { data: listing, error } = await sb.from("listings").insert({ section, slug, status: "draft", owner_id: null, created_by: admin.id, title: data.header.title }).select("id").single();
    if (error) throw error;
    const { data: v, error: vErr } = await sb.from("listing_versions").insert({ listing_id: listing.id, status: "draft", data, created_by: admin.id }).select("id").single();
    if (vErr) throw vErr;
    const { error: pErr } = await sb.rpc("publish_listing_version", { p_version: v.id, p_comment: "Импорт" });
    if (pErr) throw pErr;
    await audit(admin.id, "listing.imported", "listing", listing.id, { line: row.line });
    updateTag("listings");
    return { url: `${siteUrl()}/${section}/${slug}`, warnings };
  });
}
