import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/server/session";
import { getCategories, getDistricts } from "@/lib/data/dictionaries";
import { getSiteSettings } from "@/lib/data/settings";
import { getEditState, getListingRow, limitsOf } from "@/lib/server/listing-edit";
import { LoginRequired, Skeleton } from "@/components/cabinet/common";
import { ListingEditor } from "@/components/editor/listing-editor";
import { changeTitle } from "@/lib/blocks/moderation";
import { BLOCK_TITLES, type ListingData } from "@/lib/blocks/types";

export const metadata: Metadata = { title: "Редактор карточки", robots: { index: false } };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return <LoginRequired next={`/kabinet/kartochka/${id}`} />;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const listing = await getListingRow(id).catch(() => null);
  if (!listing || (user.role !== "admin" && listing.owner_id !== user.id)) notFound();

  const [state, categories, districts, settings] = await Promise.all([getEditState(listing), getCategories(), getDistricts(), getSiteSettings()]);
  // Черновик новее заявки на проверку, заявка новее опубликованной версии.
  const working: ListingData | undefined = (state.draft ?? state.pending ?? state.published)?.data;
  if (!working) notFound();
  const decision = state.lastDecision && (!state.pending || state.lastDecision.created_at > state.pending.created_at) ? state.lastDecision : null;
  const blockTitle = (key: string) => {
    if (key === "header" || key === "contacts" || key === "order") return changeTitle({ type: key }, BLOCK_TITLES);
    const b = (decision?.data.blocks ?? []).find((x) => x.id === key);
    return b ? BLOCK_TITLES[b.type] : "Блок";
  };

  return (
    <ListingEditor
      listing={{ id: listing.id, section: listing.section, slug: listing.slug, status: listing.status, isDemo: listing.is_demo }}
      initial={working}
      hasPublished={Boolean(state.published)}
      pending={state.pending ? { submittedAt: state.pending.submitted_at } : null}
      lastDecision={
        decision
          ? {
              comment: decision.review_comment,
              reasons: Object.entries(decision.block_decisions ?? {})
                .filter(([, d]) => d && !d.ok && d.reason)
                .map(([k, d]) => ({ title: blockTitle(k), reason: d.reason! })),
              at: decision.reviewed_at,
              rejected: decision.status === "rejected",
            }
          : null
      }
      categories={categories.filter((c) => c.section === listing.section).map((c) => ({ id: c.id, name: c.name, slug: c.slug, icon: c.icon, parentId: c.parent_id }))}
      districts={districts.map((d) => ({ value: d.slug, label: d.name }))}
      amenities={settings.amenities}
      languages={settings.languages}
      limits={limitsOf(listing)}
      isAdmin={user.role === "admin"}
    />
  );
}

export default function EditorPage({ params }: PageProps<"/kabinet/kartochka/[id]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Content params={params} />
    </Suspense>
  );
}
