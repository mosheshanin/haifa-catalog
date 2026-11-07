import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/server/session";
import { getListingRow, getVersion } from "@/lib/server/listing-edit";
import { getCategories, getDistricts } from "@/lib/data/dictionaries";
import { Panel, Skeleton } from "@/components/cabinet/common";
import { VersionDecision } from "@/components/admin/forms";
import { BlockPreview, ListingView } from "@/components/listing/listing-view";
import { Photo } from "@/components/ui/photo";
import { changeTitle } from "@/lib/blocks/moderation";
import { BLOCK_TITLES, type ListingBlock, type ListingData } from "@/lib/blocks/types";
import { districtLabels, districtNameMap } from "@/lib/catalog/districts";

export const metadata: Metadata = { title: "Проверка правки", robots: { index: false } };

const HEADER_LABELS: Record<string, string> = {
  title: "Название",
  slogan: "Слоган",
  profession: "Профессия",
  categoryId: "Категория",
  districtSlugs: "Районы",
  logoUrl: "Логотип",
  coverUrl: "Обложка",
  badges: "Отметки",
  phone: "Телефон",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  email: "Email",
  website: "Сайт",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
};

function Val({ k, v, names }: { k: string; v: unknown; names: { cat: Record<number, string>; dist: Record<string, string> } }) {
  if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) return <span className="text-muted">—</span>;
  if ((k === "logoUrl" || k === "coverUrl") && typeof v === "string") return <Photo src={v} alt={k} className="h-20 w-32 rounded-lg" sizes="128px" />;
  if (k === "categoryId") return <>{names.cat[Number(v)] ?? String(v)}</>;
  if (k === "districtSlugs" && Array.isArray(v)) return <>{districtLabels(v as string[], names.dist).join(", ")}</>;
  return <span className="break-words">{Array.isArray(v) ? v.join(", ") : String(v)}</span>;
}

function FieldsDiff({ before, after, names }: { before: Record<string, unknown>; after: Record<string, unknown>; names: { cat: Record<number, string>; dist: Record<string, string> } }) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter((k) => JSON.stringify(before?.[k] ?? null) !== JSON.stringify(after?.[k] ?? null));
  return (
    <table className="w-full table-fixed text-sm">
      <thead>
        <tr className="text-left text-xs text-muted">
          <th className="w-1/4 py-1">Поле</th>
          <th className="py-1">Было</th>
          <th className="py-1">Стало</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((k) => (
          <tr key={k} className="border-t border-line align-top">
            <td className="py-2 pr-2 font-bold">{HEADER_LABELS[k] ?? k}</td>
            <td className="bg-[#fdecea]/50 p-2"><Val k={k} v={before?.[k]} names={names} /></td>
            <td className="bg-[#e5f4e4]/60 p-2"><Val k={k} v={after?.[k]} names={names} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || user.role !== "admin") notFound();
  const v = await getVersion(/^[0-9a-f-]{36}$/.test(id) ? id : null);
  if (!v) notFound();
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data: vr } = await createAdminClient().from("listing_versions").select("listing_id").eq("id", v.id).single();
  const listing = await getListingRow(vr!.listing_id);
  const published: ListingData | null = (await getVersion(listing.published_version_id))?.data ?? null;
  const [cats, dists] = await Promise.all([getCategories(), getDistricts()]);
  const names = { cat: Object.fromEntries(cats.map((c) => [c.id, c.name])), dist: districtNameMap(dists) };
  const whole = v.moderated_keys.includes("*") || !published;

  if (v.status !== "pending") {
    return (
      <Panel title="Правка уже обработана">
        <Link href="/admin?tab=queue" className="font-bold text-primary">← К очереди</Link>
      </Panel>
    );
  }

  const blockOf = (data: ListingData | null, key: string) => data?.blocks.find((b) => b.id === key) ?? null;
  const items = whole
    ? []
    : v.moderated_keys.map((k) => {
        const after = k === "header" || k === "contacts" ? null : blockOf(v.data, k);
        const before = k === "header" || k === "contacts" ? null : blockOf(published, k);
        const type = k === "header" || k === "contacts" ? k : (after ?? before)?.type ?? "description";
        return { key: k, title: changeTitle({ type }, BLOCK_TITLES), before, after };
      });

  return (
    <div className="grid grid-cols-1 gap-5">
      <Link href="/admin?tab=queue" className="text-sm font-bold text-primary">← К очереди</Link>
      <h1 className="text-2xl font-extrabold">🛡 {whole ? "Новая карточка" : "Правка карточки"}: {v.data.header.title}</h1>
      <p className="text-sm text-muted">
        {listing.section === "biznes" ? "Бизнес" : "Специалист"} · отправлено {v.submitted_at ? new Date(v.submitted_at).toLocaleString("ru-RU", { timeZone: "Asia/Jerusalem" }) : "—"}
        {published ? (
          <>
            {" · "}
            <Link href={`/${listing.section}/${listing.slug}`} className="font-bold text-primary" target="_blank">открыть текущую версию ↗</Link>
          </>
        ) : null}
      </p>
      {whole ? (
        <div className="rounded-[var(--radius-card)] border-2 border-dashed border-primary/40 p-2 sm:p-4">
          <ListingView
            listingId={listing.id}
            data={v.data}
            categoryName={names.cat[v.data.header.categoryId ?? 0] ?? ""}
            categoryHref="#"
            districtNames={names.dist}
            share={{ url: "#", miniAppUrl: "#", temporaryAddress: true }}
            preview
          />
        </div>
      ) : (
        items.map((it) => (
          <Panel key={it.key} title={`${it.title}`}>
            {it.key === "header" || it.key === "contacts" ? (
              <FieldsDiff
                before={(published?.[it.key as "header" | "contacts"] ?? {}) as Record<string, unknown>}
                after={(v.data[it.key as "header" | "contacts"] ?? {}) as Record<string, unknown>}
                names={names}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="min-w-0 rounded-xl bg-[#fdecea]/50 p-2">
                  <p className="mb-1 text-xs font-extrabold text-danger">БЫЛО</p>
                  {it.before ? <BlockPreview block={it.before as ListingBlock} districtNames={names.dist} section={listing.section} /> : <p className="text-sm text-muted">Блока не было</p>}
                </div>
                <div className="min-w-0 rounded-xl bg-[#e5f4e4]/60 p-2">
                  <p className="mb-1 text-xs font-extrabold text-success">СТАЛО</p>
                  {it.after ? <BlockPreview block={it.after as ListingBlock} districtNames={names.dist} section={listing.section} /> : <p className="text-sm text-muted">Блок удалён</p>}
                </div>
              </div>
            )}
          </Panel>
        ))
      )}
      <VersionDecision versionId={v.id} whole={whole} items={items.map((i) => ({ key: i.key, title: i.title }))} />
    </div>
  );
}

export default function ReviewVersionPage({ params }: PageProps<"/admin/proverka/[id]">) {
  return (
    <div className="mx-auto max-w-4xl">
      <Suspense fallback={<Skeleton />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}
