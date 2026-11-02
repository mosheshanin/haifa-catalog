import type { ListingData } from "@/lib/blocks/types";

// Карточка заполнена достаточно, чтобы её индексировать (раздел 8 ТЗ, решение 2 ноября 2026, раздел 14):
// обложка, описание от 100 знаков, телефон или мессенджер, адрес или зона выезда.
// То же правило в базе — SQL listing_is_complete (sitemap); менять оба места вместе.
export const MIN_DESCRIPTION = 100;

export function isListingComplete(data: ListingData): boolean {
  const visible = data.blocks.filter((b) => !b.hidden);
  const description = visible.find((b) => b.type === "description");
  const hasDescription = description?.type === "description" && description.data.text.trim().length >= MIN_DESCRIPTION;
  const hasContact = Boolean(data.contacts.phone || data.contacts.whatsapp || data.contacts.telegram);
  const hasPlace = visible.some(
    (b) => (b.type === "address" && Boolean(b.data.address)) || (b.type === "service_area" && b.data.districtSlugs.length > 0),
  );
  return Boolean(data.header.coverUrl) && hasDescription && hasContact && hasPlace;
}
