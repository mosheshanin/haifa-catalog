import { renderOg, photoForOg, OG_SIZE } from "@/lib/seo/og";
import { getCategories, getCategory, getDistricts, isSection } from "@/lib/data/dictionaries";
import { getListingBySlug } from "@/lib/data/listings";
import { t } from "@/i18n/ru";

// Предпросмотр ссылки на категорию или карточку (раздел 8 ТЗ): название, категория и район, обложка карточки.
// Страницы «категория + район» и подкатегории берут картинку своей категории.
export const alt = "HaifaBusinessClub";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ section: string; slug: string }> }) {
  const { section, slug } = await params;
  if (!isSection(section)) return renderOg({ title: t.site.brand, subtitle: t.site.tagline });
  const category = await getCategory(section, slug);
  if (category) {
    return renderOg({
      eyebrow: t.sections[section].title,
      title: `${category.name} в Хайфе`,
      subtitle: section === "biznes" ? "Проверенные бизнесы: контакты, цены, часы работы и отзывы" : "Проверенные специалисты: контакты, цены и отзывы",
    });
  }
  const listing = await getListingBySlug(section, slug);
  if (!listing || "redirect" in listing) return renderOg({ title: t.site.brand, subtitle: t.site.tagline });
  const [categories, districts] = await Promise.all([getCategories(), getDistricts()]);
  const cat = categories.find((c) => c.id === listing.categoryId);
  const district = districts.find((d) => d.slug === listing.data.header.districtSlugs[0])?.name;
  const { header } = listing.data;
  return renderOg({
    eyebrow: [cat?.name, district].filter(Boolean).join(" · "),
    title: header.title,
    subtitle: header.profession ?? header.slogan,
    photo: await photoForOg(header.coverUrl),
  });
}
