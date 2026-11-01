import type { ListingBlock, ListingData } from "@/lib/blocks/types";

const DAY_SCHEMA: Record<string, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

const LANG_CODES: Record<string, string> = { Русский: "ru", Иврит: "he", Английский: "en", Арабский: "ar" };

// Структурированные данные карточки (раздел 8 ТЗ). Отзывы Google сюда не попадают;
// рейтинг — только по отзывам нашей платформы.
export function listingJsonLd(opts: {
  url: string;
  data: ListingData;
  schemaType: string | null;
  categoryName: string;
  districtNames: string[];
  rating?: { value: number; count: number } | null;
}) {
  const { data } = opts;
  const block = <T extends ListingBlock["type"]>(type: T) =>
    data.blocks.find((b) => b.type === type && !b.hidden) as Extract<ListingBlock, { type: T }> | undefined;

  const address = block("address");
  const hours = block("hours");
  const languages = block("languages");
  const services = block("services");
  const description = block("description");
  const isPerson = data.section === "specialisty";

  const sameAs = [
    data.contacts.website,
    data.contacts.instagram ? `https://instagram.com/${data.contacts.instagram}` : undefined,
    data.contacts.facebook,
    data.contacts.telegram ? `https://t.me/${data.contacts.telegram}` : undefined,
  ].filter(Boolean);

  const json: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": isPerson ? "ProfessionalService" : (opts.schemaType ?? "LocalBusiness"),
    "@id": opts.url,
    url: opts.url,
    name: data.header.title,
    description: description?.data.text,
    image: data.header.coverUrl,
    telephone: data.contacts.phone,
    knowsLanguage: languages?.data.items.map((l) => LANG_CODES[l] ?? l),
    areaServed: opts.districtNames.map((n) => ({ "@type": "Place", name: `${n}, Хайфа` })),
    sameAs: sameAs.length ? sameAs : undefined,
  };

  if (address) {
    json.address = { "@type": "PostalAddress", streetAddress: address.data.address, addressLocality: "Хайфа", addressCountry: "IL" };
    if (address.data.lat && address.data.lng) {
      json.geo = { "@type": "GeoCoordinates", latitude: address.data.lat, longitude: address.data.lng };
    }
  }

  if (hours) {
    json.openingHoursSpecification = Object.entries(hours.data.week).flatMap(([day, intervals]) =>
      (intervals ?? []).map((i) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: DAY_SCHEMA[day], opens: i.open, closes: i.close })),
    );
  }

  if (services) {
    json.hasOfferCatalog = {
      "@type": "OfferCatalog",
      name: "Услуги и цены",
      itemListElement: services.data.groups.flatMap((g) =>
        g.items.map((s) => ({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: s.name },
          ...(s.price !== undefined ? { price: s.price, priceCurrency: "ILS" } : {}),
        })),
      ),
    };
  }

  if (opts.rating && opts.rating.count > 0) {
    json.aggregateRating = { "@type": "AggregateRating", ratingValue: opts.rating.value, reviewCount: opts.rating.count };
  }

  return json;
}

export function breadcrumbsJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })),
  };
}

// Безопасная вставка JSON-LD в HTML.
export function jsonLdScript(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
