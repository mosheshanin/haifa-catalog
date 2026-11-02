import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";

export type ReviewRules = { minLength: number; forbidLinks: boolean; forbidPhones: boolean };
// amenities — общие отметки «Особенностей» у бизнесов, amenitiesSpecialisty — у специалистов;
// свои отметки каждой категории — categories.amenities (этап 5, вариант В).
// legal — кто публикует документы и куда писать о данных (политика, условия, доступность; этап 5). Пусто — на страницах
// документов видна пометка «будет указано».
export type LegalSettings = { owner: string; email: string };
export type SiteSettings = { reviewRules: ReviewRules; amenities: string[]; amenitiesSpecialisty: string[]; languages: string[]; legal: LegalSettings };

export const DEFAULT_SETTINGS: SiteSettings = {
  reviewRules: { minLength: 20, forbidLinks: true, forbidPhones: true },
  amenities: ["Оплата картой", "Оплата через Bit", "Wi-Fi", "Доступно для колясок", "Парковка"],
  amenitiesSpecialisty: ["Оплата картой", "Оплата через Bit", "Выдаёт чек"],
  languages: ["Русский", "Иврит", "Английский", "Арабский"],
  legal: { owner: "", email: "" },
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
    amenitiesSpecialisty: Array.isArray(map.amenities_specialisty) ? map.amenities_specialisty : DEFAULT_SETTINGS.amenitiesSpecialisty,
    languages: Array.isArray(map.languages) ? map.languages : DEFAULT_SETTINGS.languages,
    legal: { ...DEFAULT_SETTINGS.legal, ...(map.legal ?? {}) },
  };
}
