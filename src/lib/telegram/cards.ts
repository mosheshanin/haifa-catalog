import "server-only";
import { InputFile } from "grammy";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCategories, getDistricts } from "@/lib/data/dictionaries";
import { districtListParts } from "@/lib/catalog/districts";
import { miniAppLink, siteUrl } from "@/lib/env";
import type { Section } from "@/lib/blocks/types";
import { clip, escapeHtml } from "@/lib/telegram/api";

export type CardInfo = {
  id: string;
  section: Section;
  slug: string;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  categoryId: number | null;
  category: string | null; // «💅 Маникюр»
  districts: string[];
  ratingAvg: number | null;
  ratingCount: number;
  isDemo: boolean;
  status: string;
  publishToChannel: boolean;
  ownerId: string | null;
};

type Row = {
  id: string;
  section: Section;
  slug: string;
  title: string | null;
  summary?: string | null;
  cover_url?: string | null;
  category_id: number | null;
  district_ids: number[] | null;
  rating_avg?: number | null;
  rating_count?: number | null;
  is_demo?: boolean | null;
  status?: string;
  publish_to_channel?: boolean;
  owner_id?: string | null;
};

// Подписи категорий и районов из справочников (кэшируются).
export async function describe(rows: Row[]): Promise<CardInfo[]> {
  const [cats, dists] = await Promise.all([getCategories(), getDistricts()]);
  const catName = (id: number | null) => {
    const c = cats.find((x) => x.id === id);
    return c ? `${c.icon ? `${c.icon} ` : ""}${c.name}` : null;
  };
  return rows.map((r) => ({
    id: r.id,
    section: r.section,
    slug: r.slug,
    title: r.title ?? r.slug,
    summary: r.summary ?? null,
    coverUrl: r.cover_url ?? null,
    categoryId: r.category_id,
    category: catName(r.category_id),
    districts: districtListParts(r.district_ids, dists),
    ratingAvg: r.rating_avg ?? null,
    ratingCount: r.rating_count ?? 0,
    isDemo: Boolean(r.is_demo),
    status: r.status ?? "published",
    publishToChannel: r.publish_to_channel ?? true,
    ownerId: r.owner_id ?? null,
  }));
}

export async function getCards(ids: string[]): Promise<CardInfo[]> {
  if (!ids.length) return [];
  const { data } = await createAdminClient()
    .from("listings")
    .select("id, section, slug, title, summary, cover_url, category_id, district_ids, rating_avg, rating_count, is_demo, status, publish_to_channel, owner_id")
    .in("id", ids);
  const cards = await describe((data ?? []) as Row[]);
  return ids.map((id) => cards.find((c) => c.id === id)).filter((c): c is CardInfo => Boolean(c));
}

// Ссылка, которая открывает карточку в Mini App (работает из чатов и каналов, раздел 7).
export const cardMiniAppLink = (c: Pick<CardInfo, "section" | "slug">) => miniAppLink(`${c.section === "biznes" ? "b" : "s"}_${c.slug}`);
export const cardWebUrl = (c: Pick<CardInfo, "section" | "slug">) => `${siteUrl()}/${c.section}/${c.slug}`;

// «💅 Маникюр · 📍 Адар · ⭐ 4.8»
export function cardMeta(c: CardInfo): string {
  const parts = [c.category, c.districts.length ? `📍 ${c.districts.length > 2 ? `${c.districts.slice(0, 2).join(", ")} и ещё ${c.districts.length - 2}` : c.districts.join(", ")}` : null, c.ratingAvg && c.ratingCount ? `⭐ ${c.ratingAvg}` : null];
  return parts.filter(Boolean).join(" · ");
}

export function cardLine(c: CardInfo): string {
  const meta = cardMeta(c);
  return `<b>${escapeHtml(c.title)}</b>${meta ? `\n${escapeHtml(meta)}` : ""}`;
}

export function cardSummary(c: CardInfo, max = 220): string {
  return c.summary ? escapeHtml(clip(c.summary, max)) : "";
}

// Фото для Telegram: свои фото хранятся в WebP, а Telegram надёжно принимает только JPEG/PNG — перекодируем.
export async function cardPhoto(c: CardInfo): Promise<InputFile | null> {
  const src = c.coverUrl;
  if (!src || !/^https:\/\//.test(src)) return null;
  const url = src.startsWith("https://images.unsplash.com/") ? `${src}?w=1280&q=75&fm=jpg&fit=crop` : src;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const sharp = (await import("sharp")).default;
    const jpg = await sharp(buf).rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    return new InputFile(jpg, "photo.jpg");
  } catch (e) {
    console.warn("Telegram photo:", e);
    return null;
  }
}
