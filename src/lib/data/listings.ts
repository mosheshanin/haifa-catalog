import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import type { ListingData, Section } from "@/lib/blocks/types";

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
  hours: Record<string, Array<{ open: string; close: string }>> | null;
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

export type ListingPage = {
  id: string;
  section: Section;
  slug: string;
  categoryId: number | null;
  isVerified: boolean;
  isDemo: boolean;
  ratingAvg: number | null;
  ratingCount: number;
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
    .select("id, section, slug, category_id, is_verified, is_demo, rating_avg, rating_count, published_version_id, published_at, updated_at")
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
    publishedAt: l.published_at,
    updatedAt: l.updated_at,
    data: v.data as ListingData,
  };
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
