import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import type { HoursException, HoursInterval, ListingData, Section, WeekdayKey } from "@/lib/blocks/types";
import { israelToday, pruneExpired } from "@/lib/blocks/expire";

// Строка результата поиска (функция public.search_listings).
export type ListingSummary = {
  id: string;
  section: Section;
  slug: string;
  title: string;
  summary: string | null;
  cover_url: string | null;
  category_id: number | null;
  district_ids: number[];
  languages: string[];
  formats: string[];
  has_offer: boolean;
  rating_avg: number | null;
  rating_count: number;
  hours: (Partial<Record<WeekdayKey, HoursInterval[]>> & { exceptions?: HoursException[] }) | null; // + исключения
  is_verified: boolean;
  is_demo: boolean;
  distance_m: number | null;
  rank: number;
  detected_category: string | null;
  detected_district: string | null;
  total_count: number;
};

export type SearchParams = {
  q?: string;
  section?: Section;
  category?: string;
  district?: string;
  language?: string;
  formats?: string[];
  hasOffer?: boolean;
  kupa?: string;
  amenities?: string[];
  openNow?: boolean;
  sort?: "relevance" | "rating" | "new" | "distance";
  limit?: number;
  offset?: number;
};

export const PAGE_SIZE = 24;

function rpcArgs(p: SearchParams) {
  return {
    p_q: p.q?.trim() || null,
    p_section: p.section ?? null,
    p_category: p.category ?? null,
    p_district: p.district ?? null,
    p_language: p.language ?? null,
    p_formats: p.formats?.length ? p.formats : null,
    p_has_offer: Boolean(p.hasOffer),
    p_kupa: p.kupa ?? null,
    p_features: p.amenities?.length ? p.amenities : null,
    p_open_now: Boolean(p.openNow),
    p_sort: p.sort ?? "relevance",
    p_limit: p.limit ?? PAGE_SIZE,
    p_offset: p.offset ?? 0,
  };
}

// Поиск и списки. «Открыто сейчас» зависит от времени, поэтому такие запросы кэшируются ненадолго.
export async function searchListings(p: SearchParams): Promise<ListingSummary[]> {
  "use cache";
  cacheTag("listings");
  if (p.openNow) cacheLife("seconds");
  else cacheLife("minutes");
  const { data, error } = await createPublicClient().rpc("search_listings", rpcArgs(p));
  if (error) throw error;
  return (data ?? []) as ListingSummary[];
}

export type ListingPoint = { id: string; lat: number; lng: number };

// Координаты карточек для карты (у специалистов с выездом адреса может не быть — их на карте нет).
export async function getListingPoints(ids: string[]): Promise<ListingPoint[]> {
  "use cache";
  cacheTag("listings");
  cacheLife("hours");
  if (!ids.length) return [];
  const { data, error } = await createPublicClient().rpc("listing_points", { p_ids: ids.slice(0, 200) });
  if (error) throw error;
  return (data ?? []) as ListingPoint[];
}

export type ListingPage = {
  id: string;
  section: Section;
  slug: string;
  categoryId: number | null;
  isVerified: boolean;
  isDemo: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  shortCode: string | null;
  hasOwner: boolean;
  publishedAt: string | null;
  updatedAt: string;
  data: ListingData;
};

// Опубликованная карточка по адресу. null — нет такой; { redirect } — карточку переименовали (301).
export async function getListingBySlug(
  section: Section,
  slug: string,
): Promise<ListingPage | { redirect: string } | null> {
  "use cache";
  cacheTag("listings");
  cacheLife("hours");
  const sb = createPublicClient();
  const { data: l, error } = await sb
    .from("listings")
    .select("id, section, slug, category_id, is_verified, is_demo, rating_avg, rating_count, short_code, owner_id, published_version_id, published_at, updated_at")
    .eq("section", section)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;

  if (!l) {
    const { data: old } = await sb
      .from("listing_slug_history")
      .select("listing_id")
      .eq("section", section)
      .eq("slug", slug)
      .maybeSingle();
    if (!old) return null;
    const { data: target } = await sb
      .from("listings")
      .select("section, slug")
      .eq("id", old.listing_id)
      .eq("status", "published")
      .maybeSingle();
    return target ? { redirect: `/${target.section}/${target.slug}` } : null;
  }

  const { data: v, error: vErr } = await sb.from("listing_versions").select("data").eq("id", l.published_version_id).single();
  if (vErr) throw vErr;

  return {
    id: l.id,
    section: l.section,
    slug: l.slug,
    categoryId: l.category_id,
    isVerified: l.is_verified,
    isDemo: l.is_demo,
    ratingAvg: l.rating_avg,
    ratingCount: l.rating_count,
    shortCode: l.short_code,
    hasOwner: Boolean(l.owner_id),
    publishedAt: l.published_at,
    updatedAt: l.updated_at,
    // Устаревшие спецпредложения, мероприятия и вакансии скрываются (раздел 4 ТЗ).
    data: pruneExpired(v.data as ListingData, israelToday()),
  };
}

// Короткая ссылка /k/<код> → адрес карточки. Код не зависит от названия, поэтому переживает переименование.
export async function getListingPathByShortCode(code: string): Promise<string | null> {
  "use cache";
  cacheTag("listings");
  cacheLife("hours");
  if (!/^[a-z0-9]{4,12}$/i.test(code)) return null;
  const { data, error } = await createPublicClient()
    .from("listings")
    .select("section, slug")
    .eq("short_code", code.toLowerCase())
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return data ? `/${data.section}/${data.slug}` : null;
}

// Адреса опубликованных карточек для предварительной сборки страниц.
export async function getPublishedSlugs(): Promise<Array<{ section: Section; slug: string }>> {
  "use cache";
  cacheTag("listings");
  cacheLife("hours");
  const { data, error } = await createPublicClient()
    .from("listings")
    .select("section, slug")
    .eq("status", "published")
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as Array<{ section: Section; slug: string }>;
}

// Похожие карточки: та же категория, по возможности тот же район.
export async function getSimilar(listing: { id: string; section: Section; categorySlug?: string; districtSlug?: string }) {
  const byDistrict = listing.categorySlug
    ? await searchListings({ section: listing.section, category: listing.categorySlug, district: listing.districtSlug, limit: 5 })
    : [];
  const byCategory =
    byDistrict.length < 4 && listing.categorySlug
      ? await searchListings({ section: listing.section, category: listing.categorySlug, limit: 5 })
      : [];
  const seen = new Set<string>([listing.id]);
  return [...byDistrict, ...byCategory].filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true))).slice(0, 4);
}
