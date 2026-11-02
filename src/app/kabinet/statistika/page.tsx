import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/server/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { LoginRequired, Panel, Skeleton } from "@/components/cabinet/common";
import { addDays, israelToday } from "@/lib/blocks/expire";

export const metadata: Metadata = { title: "Статистика", robots: { index: false } };

const KINDS = [
  { k: "view", label: "👁 Просмотры" },
  { k: "phone", label: "📞 Телефон" },
  { k: "whatsapp", label: "💬 WhatsApp" },
  { k: "telegram", label: "✈️ Telegram" },
  { k: "route", label: "🧭 Маршрут" },
  { k: "share", label: "📲 Поделиться" },
  { k: "request", label: "✍️ Заявки" },
] as const;

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getSessionUser();
  if (!user) return <LoginRequired next="/kabinet/statistika" />;
  const sp = await searchParams;
  const days = sp.days === "7" ? 7 : sp.days === "90" ? 90 : 30;
  const from = addDays(israelToday(), -(days - 1));
  const sb = createAdminClient();
  const { data: listings } = await sb.from("listings").select("id, title").eq("owner_id", user.id);
  const ids = (listings ?? []).map((l) => l.id);
  const [{ data: stats }, { data: favs }] = await Promise.all([
    ids.length ? sb.from("listing_stats").select("listing_id, kind, count").in("listing_id", ids).gte("day", from) : Promise.resolve({ data: [] as { listing_id: string; kind: string; count: number }[] }),
    ids.length ? sb.from("favorites").select("listing_id").in("listing_id", ids) : Promise.resolve({ data: [] as { listing_id: string }[] }),
  ]);
  const sum = (lid: string, kind: string) => (stats ?? []).filter((s) => s.listing_id === lid && s.kind === kind).reduce((a, s) => a + s.count, 0);

  return (
    <Panel title="📊 Статистика">
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {[7, 30, 90].map((d) => (
          <Link key={d} href={`/kabinet/statistika?days=${d}`} className={`min-h-11 rounded-full px-4 py-2.5 font-bold ${days === d ? "bg-primary text-white" : "border border-line bg-white"}`}>
            {d} дней
          </Link>
        ))}
      </div>
      {listings?.length ? (
        <div className="grid grid-cols-1 gap-4">
          {listings.map((l) => (
            <div key={l.id} className="rounded-2xl border border-line p-4">
              <h3 className="mb-3 font-extrabold">{l.title}</h3>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {KINDS.map((k) => (
                  <div key={k.k} className="rounded-xl bg-surface-alt p-3">
                    <dt className="text-xs text-muted">{k.label}</dt>
                    <dd className="text-2xl font-extrabold text-primary">{sum(l.id, k.k)}</dd>
                  </div>
                ))}
                <div className="rounded-xl bg-surface-alt p-3">
                  <dt className="text-xs text-muted">❤️ В избранном сейчас</dt>
                  <dd className="text-2xl font-extrabold text-primary">{(favs ?? []).filter((f) => f.listing_id === l.id).length}</dd>
                </div>
              </dl>
            </div>
          ))}
          <p className="text-xs text-muted">Считаем без cookie: просмотр — один раз за посещение, нажатия — на кнопки контактов в карточке.</p>
        </div>
      ) : (
        <p className="text-muted">У вас пока нет карточек.</p>
      )}
    </Panel>
  );
}

export default function StatsPage({ searchParams }: PageProps<"/kabinet/statistika">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
