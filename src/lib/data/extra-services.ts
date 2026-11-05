import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import { isOfferStep, type ExtraService } from "@/lib/extra-services";

export type ExtraServiceRow = {
  code: string;
  title: string;
  description: string;
  price: number | null;
  icon: string;
  exclusive_group: string | null;
  offer_steps: string[];
  step_text: string | null;
  sort: number;
  is_active: boolean;
};

export const EXTRA_SERVICE_COLUMNS = "code, title, description, price, icon, exclusive_group, offer_steps, step_text, sort, is_active";

export const toExtraService = (r: ExtraServiceRow): ExtraService => ({
  code: r.code,
  title: r.title,
  text: r.description,
  price: r.price,
  icon: r.icon,
  group: r.exclusive_group || undefined,
  steps: (r.offer_steps ?? []).filter(isOfferStep),
  stepText: r.step_text || undefined,
});

// Включённые услуги по порядку — для мастера добавления и проверки заказа на сервере.
// Кэш с тегом extra_services: админка сбрасывает его при сохранении (updateTag).
export async function getExtraServices(): Promise<ExtraService[]> {
  "use cache";
  cacheTag("extra_services");
  cacheLife("hours");
  const { data, error } = await createPublicClient()
    .from("extra_services")
    .select(EXTRA_SERVICE_COLUMNS)
    .eq("is_active", true)
    .order("sort")
    .order("title");
  if (error || !data) return [];
  return (data as ExtraServiceRow[]).map(toExtraService);
}
