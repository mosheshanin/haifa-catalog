import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";

export type ReviewRules = { minLength: number; forbidLinks: boolean; forbidPhones: boolean };
export type SiteSettings = { reviewRules: ReviewRules; amenities: string[]; languages: string[] };

export const DEFAULT_SETTINGS: SiteSettings = {
  reviewRules: { minLength: 20, forbidLinks: true, forbidPhones: true },
  amenities: ["Оплата картой", "Оплата через Bit", "Wi-Fi", "Доступно для колясок", "Детская зона", "Кошерно", "Парковка"],
  languages: ["Русский", "Иврит", "Английский", "Арабский"],
};

// Настройки, которые правятся в админке (раздел 6): правила отзывов, списки особенностей и языков.
export async function getSiteSettings(): Promise<SiteSettings> {
  "use cache";
  cacheTag("settings");
  cacheLife("hours");
  const { data, error } = await createPublicClient().from("site_settings").select("key, value");
  if (error || !data) return DEFAULT_SETTINGS;
  const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
  return {
    reviewRules: { ...DEFAULT_SETTINGS.reviewRules, ...(map.review_rules ?? {}) },
    amenities: Array.isArray(map.amenities) ? map.amenities : DEFAULT_SETTINGS.amenities,
    languages: Array.isArray(map.languages) ? map.languages : DEFAULT_SETTINGS.languages,
  };
}
