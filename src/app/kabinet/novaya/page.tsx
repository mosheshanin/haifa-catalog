import type { Metadata } from "next";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/server/session";
import { getCategories, getDistricts } from "@/lib/data/dictionaries";
import { LoginRequired, Panel, Skeleton } from "@/components/cabinet/common";
import { NewListingForm } from "@/components/cabinet/new-listing-form";

export const metadata: Metadata = { title: "Добавить бизнес или специалиста", robots: { index: false } };

async function Content() {
  const user = await getSessionUser();
  if (!user) return <LoginRequired next="/kabinet/novaya" text="Чтобы добавить карточку, войдите через Google или Telegram." />;
  const [categories, districts] = await Promise.all([getCategories(), getDistricts()]);
  return (
    <Panel title="➕ Добавить бизнес или специалиста">
      <NewListingForm categories={categories} districts={districts} isAdmin={user.role === "admin"} />
    </Panel>
  );
}

export default function NewListingPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Content />
    </Suspense>
  );
}
