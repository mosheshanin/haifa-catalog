import type { Metadata } from "next";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/server/session";
import { getCategories, getDistricts } from "@/lib/data/dictionaries";
import { getSiteSettings } from "@/lib/data/settings";
import { limitsOf } from "@/lib/server/listing-edit";
import { LoginRequired, Skeleton } from "@/components/cabinet/common";
import { ListingWizard } from "@/components/cabinet/listing-wizard";

export const metadata: Metadata = { title: "Добавить бизнес или специалиста", robots: { index: false } };

async function Content() {
  const user = await getSessionUser();
  if (!user) return <LoginRequired next="/kabinet/novaya" text="Чтобы добавить карточку, войдите через Google или Telegram." />;
  const [categories, districts, settings] = await Promise.all([getCategories(), getDistricts(), getSiteSettings()]);
  // Пошаговое добавление (3 ноября 2026): по одному вопросу на экран, необязательное можно пропустить.
  return (
    <div className="mx-auto w-full max-w-2xl">
      <ListingWizard
        categories={categories.map((c) => ({ id: c.id, section: c.section, name: c.name, slug: c.slug, icon: c.icon, icon_3d: c.icon_3d, parentId: c.parent_id, amenities: c.amenities ?? [] }))}
        districts={districts.map((d) => ({ value: d.slug, label: d.name }))}
        haifaDistricts={districts.filter((d) => d.kind === "haifa").map((d) => d.slug)}
        amenities={{ biznes: settings.amenities, specialisty: settings.amenitiesSpecialisty }}
        languages={settings.languages}
        limits={limitsOf({ features: {} })}
        isAdmin={user.role === "admin"}
      />
    </div>
  );
}

export default function NewListingPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Content />
    </Suspense>
  );
}
