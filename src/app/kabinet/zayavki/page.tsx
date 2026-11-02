import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/server/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { LoginRequired, Panel, STATUS_STYLE, Skeleton } from "@/components/cabinet/common";
import { RequestStatusForm } from "@/components/cabinet/forms";
import { formatDayMonth, telHref, whatsappHref } from "@/lib/format";
import { TelegramStatus } from "@/components/cabinet/telegram-status";

export const metadata: Metadata = { title: "Заявки", robots: { index: false } };

const LABEL: Record<string, string> = { new: "Новая", accepted: "Принята", rejected: "Отклонена" };

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getSessionUser();
  if (!user) return <LoginRequired next="/kabinet/zayavki" />;
  const sp = await searchParams;
  const status = typeof sp.status === "string" && ["new", "accepted", "rejected"].includes(sp.status) ? sp.status : undefined;
  const sb = createAdminClient();
  const { data: listings } = await sb.from("listings").select("id, title").eq("owner_id", user.id);
  const ids = (listings ?? []).map((l) => l.id);
  let q = sb.from("requests").select("*").in("listing_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).order("created_at", { ascending: false }).limit(200);
  if (status) q = q.eq("status", status);
  const { data: requests } = await q;
  const titleOf = new Map((listings ?? []).map((l) => [l.id, l.title]));

  return (
    <Panel title="✍️ Заявки">
      {ids.length ? <TelegramStatus userId={user.id} context="requests" /> : null}
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {[undefined, "new", "accepted", "rejected"].map((s) => (
          <Link key={s ?? "all"} href={s ? `/kabinet/zayavki?status=${s}` : "/kabinet/zayavki"} className={`min-h-11 rounded-full px-4 py-2.5 font-bold ${status === s ? "bg-primary text-white" : "border border-line bg-white"}`}>
            {s ? LABEL[s] : "Все"}
          </Link>
        ))}
      </div>
      {requests?.length ? (
        <ul className="grid grid-cols-1 gap-4">
          {requests.map((r) => {
            const phone = r.contact.replace(/[^\d+]/g, "");
            const isPhone = phone.replace(/\D/g, "").length >= 9;
            return (
              <li key={r.id} className="grid min-w-0 gap-2 rounded-2xl border border-line p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold">{r.name}</span>
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[r.status]}`}>{LABEL[r.status]}</span>
                  <span className="ml-auto text-xs text-muted">{new Date(r.created_at).toLocaleString("ru-RU", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" })}</span>
                </div>
                <p className="text-sm text-muted">{titleOf.get(r.listing_id)}</p>
                <p className="break-words">📞 {r.contact}</p>
                {r.service ? <p className="text-sm">💰 {r.service}</p> : null}
                {r.master ? <p className="text-sm">👤 К мастеру: {r.master}</p> : null}
                {r.desired_date || r.desired_time ? (
                  <p className="text-sm">🗓️ Желаемое время: {r.desired_date ? formatDayMonth(r.desired_date, true) : ""} {r.desired_time ?? ""}</p>
                ) : null}
                {r.comment ? <p className="whitespace-pre-line text-sm">💬 {r.comment}</p> : null}
                {isPhone ? (
                  <div className="flex flex-wrap gap-2">
                    <a href={telHref(phone)} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-bold text-white">📞 Позвонить</a>
                    <a href={whatsappHref(phone, `Здравствуйте, ${r.name}! Это по вашей заявке в каталоге HBC.`)} className="inline-flex min-h-11 items-center rounded-xl bg-[#1fa855] px-4 text-sm font-bold text-white">💬 WhatsApp</a>
                  </div>
                ) : null}
                <RequestStatusForm id={r.id} status={r.status} note={r.owner_note} />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted">Заявок пока нет. Чтобы получать заявки, включите блок «Заявка и запись» в редакторе карточки.</p>
      )}
    </Panel>
  );
}

export default function RequestsPage({ searchParams }: PageProps<"/kabinet/zayavki">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
