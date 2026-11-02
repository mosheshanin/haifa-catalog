import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionError, type SessionUser } from "@/lib/server/session";
import { sanitizeListingData } from "@/lib/blocks/sanitize";
import { FREE_LIMITS, type Limits, type ListingData, type Section } from "@/lib/blocks/types";
import { isGoogleMapsUrl, parseGoogleMapsUrl } from "@/lib/blocks/links";

export type ListingRow = {
  id: string;
  section: Section;
  slug: string;
  status: "draft" | "pending" | "published" | "rejected" | "archived";
  owner_id: string | null;
  title: string | null;
  is_demo: boolean;
  is_verified: boolean;
  features: Record<string, unknown> | null;
  published_version_id: string | null;
};

export type VersionRow = {
  id: string;
  status: "draft" | "pending" | "approved" | "rejected" | "superseded";
  data: ListingData;
  moderated_keys: string[];
  block_decisions: Record<string, { ok: boolean; reason?: string }>;
  review_comment: string | null;
  created_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
};

const VERSION_COLS = "id, status, data, moderated_keys, block_decisions, review_comment, created_at, submitted_at, reviewed_at";

export async function getListingRow(id: string): Promise<ListingRow> {
  const { data } = await createAdminClient()
    .from("listings")
    .select("id, section, slug, status, owner_id, title, is_demo, is_verified, features, published_version_id")
    .eq("id", id)
    .maybeSingle();
  if (!data) throw new ActionError("Карточка не найдена.");
  return data as ListingRow;
}

// Редактировать может владелец карточки или администратор (раздел 2 ТЗ).
export function assertCanEdit(listing: ListingRow, user: SessionUser) {
  if (user.role === "admin") return;
  if (listing.owner_id !== user.id) throw new ActionError("Это не ваша карточка.");
  if (listing.status === "archived") throw new ActionError("Карточка в архиве. Напишите администратору.");
}

export async function getVersion(id: string | null): Promise<VersionRow | null> {
  if (!id) return null;
  const { data } = await createAdminClient().from("listing_versions").select(VERSION_COLS).eq("id", id).maybeSingle();
  return (data as VersionRow) ?? null;
}

// Состояние для редактора: опубликованная версия, ожидающая проверки, черновик и последнее решение модератора.
export async function getEditState(listing: ListingRow) {
  const sb = createAdminClient();
  const [published, { data: rest }] = await Promise.all([
    getVersion(listing.published_version_id),
    sb.from("listing_versions").select(VERSION_COLS).eq("listing_id", listing.id).in("status", ["draft", "pending", "rejected", "approved"]).order("created_at", { ascending: false }).limit(20),
  ]);
  const versions = (rest ?? []) as VersionRow[];
  const draft = versions.find((v) => v.status === "draft") ?? null;
  const pending = versions.find((v) => v.status === "pending") ?? null;
  // Последнее решение модератора с отказом (целиком или по части блоков) — чтобы показать причину владельцу.
  const lastDecision =
    versions.find((v) => v.status === "rejected" || (v.status === "approved" && Object.values(v.block_decisions ?? {}).some((d) => d && !d.ok))) ?? null;
  return { published, draft, pending, lastDecision };
}

export function limitsOf(listing: Pick<ListingRow, "features">): Limits {
  const over = (listing.features?.limits ?? {}) as Partial<Limits>;
  return { ...FREE_LIMITS, ...over };
}

export async function dictionaries(section: Section) {
  const sb = createAdminClient();
  const [{ data: districts }, { data: categories }] = await Promise.all([
    sb.from("districts").select("slug").eq("is_active", true),
    sb.from("categories").select("id").eq("section", section).eq("is_active", true),
  ]);
  return { districts: (districts ?? []).map((d) => d.slug as string), categoryIds: (categories ?? []).map((c) => c.id as number) };
}

// Короткие ссылки Google Карт (maps.app.goo.gl) раскрываем на сервере, чтобы достать код места.
async function resolveGoogleUrl(url: string): Promise<string> {
  let current = url;
  for (let i = 0; i < 4; i++) {
    if (!/maps\.app\.goo\.gl|goo\.gl\/maps/.test(current)) break;
    try {
      const res = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(5000) });
      const next = res.headers.get("location");
      if (!next) break;
      current = new URL(next, current).toString();
    } catch {
      break;
    }
  }
  return current;
}

export async function cleanListingData(
  listing: ListingRow,
  raw: unknown,
  user: SessionUser,
  badgesFrom: ListingData | null,
): Promise<{ data: ListingData; errors: string[] }> {
  const dict = await dictionaries(listing.section);
  const rawObj = (raw ?? {}) as { header?: { badges?: unknown } };
  const adminBadges = Array.isArray(rawObj.header?.badges)
    ? (rawObj.header!.badges as unknown[]).filter((b): b is ListingData["header"]["badges"][number] => b === "verified" || b === "russian_speaking" || b === "documents_checked")
    : [];
  const result = sanitizeListingData(raw, {
    section: listing.section,
    limits: limitsOf(listing),
    districts: dict.districts,
    categoryIds: dict.categoryIds,
    // Отметки «Проверено» и т. п. меняет только администратор.
    badges: user.role === "admin" ? adminBadges : (badgesFrom?.header.badges ?? []),
  });
  // Код места Google из короткой ссылки.
  for (const b of result.data.blocks) {
    if (b.type === "google" && !b.data.placeId && !b.data.cid && isGoogleMapsUrl(b.data.url)) {
      const full = await resolveGoogleUrl(b.data.url);
      Object.assign(b.data, parseGoogleMapsUrl(full));
    }
  }
  return result;
}

// Адрес карточки из названия: транслитерация, уникальность в разделе, без совпадения с категориями.
const TR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};
export function slugify(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/\(пример\)/g, "")
    .split("")
    .map((ch) => TR[ch] ?? ch)
    .join("")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || "kartochka";
}

export async function uniqueSlug(section: Section, title: string): Promise<string> {
  const sb = createAdminClient();
  const base = slugify(title);
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const [{ data: l }, { data: c }, { data: h }] = await Promise.all([
      sb.from("listings").select("id").eq("section", section).eq("slug", slug).maybeSingle(),
      sb.from("categories").select("id").eq("section", section).eq("slug", slug).maybeSingle(),
      sb.from("listing_slug_history").select("listing_id").eq("section", section).eq("slug", slug).maybeSingle(),
    ]);
    if (!l && !c && !h) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}
