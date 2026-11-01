import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingListItem } from "@/components/listing/listing-list-item";
import { MockNotice } from "@/components/ui/mock-notice";
import { getDistricts, getSectionCategories, isSection } from "@/lib/data/dictionaries";
import { mockListingsFor } from "@/mocks/listings";
import { t } from "@/i18n/ru";

export async function generateStaticParams() {
  return [{ section: "biznes" }, { section: "specialisty" }];
}

export async function generateMetadata({ params }: PageProps<"/[section]">): Promise<Metadata> {
  const { section } = await params;
  if (!isSection(section)) return {};
  return {
    title: `${t.sections[section].title} Хайфы`,
    description: `${t.sections[section].lead}. Русскоязычный каталог Хайфы.`,
    alternates: { canonical: `/${section}` },
  };
}

export default async function SectionPage({ params }: PageProps<"/[section]">) {
  const { section } = await params;
  if (!isSection(section)) notFound();

  const [categories, districts] = await Promise.all([getSectionCategories(section), getDistricts()]);
  const listings = mockListingsFor(section);
  const districtName = (slug: string) => districts.find((d) => d.slug === slug)?.name ?? slug;

  return (
    <div className="grid gap-6">
      <div>
        <nav aria-label="Хлебные крошки" className="mb-2 text-sm text-muted">
          <Link href="/" className="hover:text-primary">Главная</Link> › {t.sections[section].title}
        </nav>
        <h1 className="text-3xl font-extrabold">{section === "biznes" ? "🏢" : "🧑‍🔧"} {t.sections[section].title} Хайфы</h1>
        <p className="mt-1 text-muted">{t.sections[section].lead}</p>
      </div>

      <ul className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <li key={c.id}>
            <Link href={`/${section}/${c.slug}`} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-sm font-bold hover:border-primary hover:bg-primary-soft">
              {c.icon ? <span aria-hidden>{c.icon}</span> : null}
              {c.name}
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2 rounded-2xl bg-white p-3 text-sm shadow-sm">
        <span className="font-bold">Фильтры:</span>
        {["📍 Район", "🗣️ Язык общения", "🕒 Открыто сейчас", "🚗 Выезд на дом", "💻 Онлайн", "🎁 Спецпредложение", "🏥 Больничные кассы"].map((f) => (
          <span key={f} className="rounded-full border border-line px-3 py-1 text-muted">{f}</span>
        ))}
        <span className="text-muted">· заработают на этапе 2</span>
      </div>

      <MockNotice />

      <div className="grid gap-3 md:grid-cols-2">
        {listings.map((l) => (
          <ListingListItem key={l.slug} listing={l} districtLabel={l.data.header.districtSlugs.map(districtName).slice(0, 2).join(", ")} />
        ))}
      </div>
    </div>
  );
}
