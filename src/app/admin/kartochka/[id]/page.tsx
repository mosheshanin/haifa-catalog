import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/server/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getListingRow } from "@/lib/server/listing-edit";
import { Panel, STATUS_STYLE, Skeleton } from "@/components/cabinet/common";
import { ListingAdminForms } from "@/components/admin/forms";
import { t } from "@/i18n/ru";

export const metadata: Metadata = { title: "Управление карточкой", robots: { index: false } };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || user.role !== "admin") notFound();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const listing = await getListingRow(id).catch(() => null);
  if (!listing) notFound();
  const sb = createAdminClient();
  const [{ data: owner }, { data: versions }, { data: log }] = await Promise.all([
    listing.owner_id ? sb.from("profiles").select("display_name, google_email, telegram_username").eq("id", listing.owner_id).maybeSingle() : Promise.resolve({ data: null }),
    sb.from("listing_versions").select("id, status, created_at, review_comment").eq("listing_id", id).order("created_at", { ascending: false }).limit(20),
    sb.from("audit_log").select("action, created_at, details").eq("entity_id", id).order("created_at", { ascending: false }).limit(30),
  ]);
  const ownerLabel = owner ? [owner.display_name, owner.google_email, owner.telegram_username ? `@${owner.telegram_username}` : null].filter(Boolean).join(" · ") : "нет";
  return (
    <div className="grid gap-5">
      <Link href="/admin?tab=listings" className="text-sm font-bold text-primary">← К карточкам</Link>
      <h1 className="text-2xl font-extrabold">{listing.title}</h1>
      <div className="flex flex-wrap gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[listing.status]}`}>{t.cabinet.statuses[listing.status]}</span>
        {listing.is_demo ? <span className="rounded-full bg-[#f0efec] px-3 py-1 text-xs font-bold text-muted">Примерная</span> : null}
        <Link href={`/kabinet/kartochka/${id}`} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-bold text-white">✏️ Редактировать от имени владельца</Link>
        {listing.status === "published" ? (
          <Link href={`/${listing.section}/${listing.slug}`} className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-bold" target="_blank">Открыть ↗</Link>
        ) : null}
      </div>
      <Panel title="Действия">
        <ListingAdminForms id={id} status={listing.status} verified={listing.is_verified} ownerLabel={ownerLabel} features={JSON.stringify(listing.features ?? {}, null, 1)} />
      </Panel>
      <Panel title="Версии">
        <ul className="divide-y divide-line text-sm">
          {(versions ?? []).map((v) => (
            <li key={v.id} className="flex flex-wrap gap-2 py-2">
              <span className="text-muted">{new Date(v.created_at).toLocaleString("ru-RU", { timeZone: "Asia/Jerusalem" })}</span>
              <b>{v.status}</b>
              {v.review_comment ? <span className="text-muted">· {v.review_comment}</span> : null}
              {v.status === "pending" ? <Link href={`/admin/proverka/${v.id}`} className="font-bold text-primary">проверить</Link> : null}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="История">
        <ul className="divide-y divide-line text-sm">
          {(log ?? []).map((e, i) => (
            <li key={i} className="py-2">
              <span className="text-muted">{new Date(e.created_at).toLocaleString("ru-RU", { timeZone: "Asia/Jerusalem" })}</span> · {e.action}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

export default function AdminListingPage({ params }: PageProps<"/admin/kartochka/[id]">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<Skeleton />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}
