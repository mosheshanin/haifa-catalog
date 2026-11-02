import type { Metadata } from "next";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/server/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { LoginRequired, Panel, Skeleton } from "@/components/cabinet/common";
import { ReplyForm } from "@/components/cabinet/forms";
import { ComplaintButton } from "@/components/listing/public-forms";
import { formatDateRu } from "@/lib/format";

export const metadata: Metadata = { title: "Отзывы", robots: { index: false } };

async function Content() {
  const user = await getSessionUser();
  if (!user) return <LoginRequired next="/kabinet/otzyvy" />;
  const sb = createAdminClient();
  const { data: listings } = await sb.from("listings").select("id, title").eq("owner_id", user.id);
  const ids = (listings ?? []).map((l) => l.id);
  const none = ["00000000-0000-0000-0000-000000000000"];
  const [{ data: reviews }, { count: pendingCount }] = await Promise.all([
    sb.from("reviews").select("id, listing_id, rating, text, author_name, owner_reply, created_at").in("listing_id", ids.length ? ids : none).eq("status", "approved").order("created_at", { ascending: false }).limit(200),
    sb.from("reviews").select("id", { count: "exact", head: true }).in("listing_id", ids.length ? ids : none).eq("status", "pending"),
  ]);
  const titleOf = new Map((listings ?? []).map((l) => [l.id, l.title]));
  return (
    <Panel title="💬 Отзывы">
      <p className="mb-4 text-sm text-muted">
        Удалить отзыв нельзя — можно ответить или пожаловаться, решение примет администратор.
        {pendingCount ? ` На проверке ещё ${pendingCount}.` : ""}
      </p>
      {reviews?.length ? (
        <ul className="grid gap-4">
          {reviews.map((r) => (
            <li key={r.id} className="grid min-w-0 gap-2 rounded-2xl border border-line p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-bold">{r.author_name}</span>
                <span className="text-highlight">{"★".repeat(r.rating)}<span className="text-line">{"★".repeat(5 - r.rating)}</span></span>
                <span className="text-sm text-muted">{formatDateRu(r.created_at)}</span>
              </div>
              <p className="text-sm text-muted">{titleOf.get(r.listing_id)}</p>
              <p className="whitespace-pre-line">{r.text}</p>
              <ReplyForm reviewId={r.id} reply={r.owner_reply} />
              <ComplaintButton listingId={r.listing_id} kind="review" reviewId={r.id} label="🚩 Пожаловаться на отзыв" className="w-fit min-h-11 text-sm font-semibold text-muted hover:text-danger" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">Одобренных отзывов пока нет.</p>
      )}
    </Panel>
  );
}

export default function ReviewsPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Content />
    </Suspense>
  );
}
