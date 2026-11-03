import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import type { Section } from "@/lib/blocks/types";

export type Category = {
  id: number;
  section: Section;
  parent_id: number | null;
  slug: string;
  name: string;
  icon: string | null;
  icon_3d: string | null; // 3D-иконка (public/icons/3d); пусто у подкатегории — берётся иконка категории
  sort: number;
  schema_type: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_text: string | null;
  amenities: string[]; // свои отметки «Особенностей» (у категорий верхнего уровня), этап 5
};

export type District = { id: number; slug: string; name: string; kind: "haifa" | "suburb"; sort: number };

// Справочники меняются редко; после правки в админке кэш сбрасывается тегом "dictionaries".
export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheTag("dictionaries");
  cacheLife("hours");
  const { data, error } = await createPublicClient()
    .from("categories")
    .select("id, section, parent_id, slug, name, icon, icon_3d, sort, schema_type, seo_title, seo_description, seo_text, amenities")
    .eq("is_active", true)
    .order("sort");
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function getDistricts(): Promise<District[]> {
  "use cache";
  cacheTag("dictionaries");
  cacheLife("hours");
  const { data, error } = await createPublicClient()
    .from("districts")
    .select("id, slug, name, kind, sort")
    .eq("is_active", true)
    .order("sort");
  if (error) throw error;
  return (data ?? []) as District[];
}

export async function getSectionCategories(section: Section): Promise<Category[]> {
  const all = await getCategories();
  return all.filter((c) => c.section === section && c.parent_id === null);
}

export async function getCategory(section: Section, slug: string): Promise<Category | undefined> {
  const all = await getCategories();
  return all.find((c) => c.section === section && c.slug === slug);
}

export async function districtNames(slugs: string[]): Promise<string[]> {
  const all = await getDistricts();
  return slugs.map((s) => all.find((d) => d.slug === s)?.name ?? s);
}

export function isSection(value: string): value is Section {
  return value === "biznes" || value === "specialisty";
}
