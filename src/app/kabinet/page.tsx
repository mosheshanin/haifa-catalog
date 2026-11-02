import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/server/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { LoginRequired, Panel, STATUS_STYLE, Skeleton } from "@/components/cabinet/common";
import { NotifyPrefsForm } from "@/components/cabinet/forms";
import { TelegramStatus } from "@/components/cabinet/telegram-status";
import { t } from "@/i18n/ru";

export const metadata: Metadata = { title: t.cabinet.title, robots: { index: false } };

async function CabinetContent() {
  const user = await getSessionUser();
  if (!user) return <LoginRequired next="/kabinet" />;
  const sb = createAdminClient();
  const [{ data: listings }, { data: profile }] = await Promise.all([
    sb.from("listings").select("id, section, slug, title, status, is_demo, updated_at").eq("owner_id", user.id).order("updated_at", { ascending: false }),
    sb.from("profiles").select("telegram_id, notify_prefs").eq("id", user.id).single(),
  ]);
  const ids = (listings ?? []).map((l) => l.id);
  const { data: versions } = ids.length
    ? await sb.from("listing_versions").select("listing_id, status, review_comment, block_decisions, created_at").in("listing_id", ids).in("status", ["draft", "pending", "rejected"]).order("created_at", { ascending: false })
    : { data: [] };
  const { data: claims } = await sb.from("ownership_claims").select("id, status, created_at, listings(title)").eq("user_id", user.id).eq("status", "pending");

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">🗂️ {t.cabinet.title}</h1>
      <Panel
        title="Ваши карточки"
        actions={
          <Link href="/kabinet/novaya" className="inline-flex min-h-11 items-center rounded-2xl bg-accent px-4 font-bold text-white hover:bg-accent-hover">
            + {t.nav.addListingShort}
          </Link>
        }
      >
        {listings?.length ? (
          <ul className="divide-y divide-line">
            {listings.map((l) => {
              const v = (versions ?? []).filter((x) => x.listing_id === l.id);
              const pending = v.find((x) => x.status === "pending");
              const draft = v.find((x) => x.status === "draft");
              const rejected = v.find((x) => x.status === "rejected");
              const label = pending ? "pending" : l.status;
              return (
                <li key={l.id} className="grid gap-2 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 font-bold">{l.title ?? l.slug}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[label]}`}>
                      {pending && l.status === "published" ? "Опубликовано, правки на проверке" : t.cabinet.statuses[label as keyof typeof t.cabinet.statuses]}
                    </span>
                    {draft ? <span className="rounded-full bg-[#f0efec] px-3 py-1 text-xs font-bold text-muted">Есть черновик</span> : null}
                  </div>
                  {rejected?.review_comment && !pending ? <p className="text-sm text-danger">Комментарий модератора: {rejected.review_comment}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/kabinet/kartochka/${l.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-bold text-white hover:bg-primary-hover">
                      ✏️ Редактировать
                    </Link>
                    {l.status === "published" ? (
                      <Link href={`/${l.section}/${l.slug}`} className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-bold hover:border-primary">
                        Открыть на сайте
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted">
            {t.cabinet.empty} Если ваш бизнес уже есть в каталоге, откройте его карточку и нажмите «{t.listing.claim}». Если нет — добавьте новую карточку.
          </p>
        )}
        {claims?.length ? (
          <p className="mt-3 rounded-xl bg-[#f9eeda] p-3 text-sm">
            🔑 Заявки на права владельца на проверке: {claims.map((c) => (c.listings as unknown as { title: string } | null)?.title ?? "карточка").join(", ")}.
          </p>
        ) : null}
      </Panel>

      <Panel title="🔔 Уведомления в Telegram">
        <TelegramStatus userId={user.id} context="settings" />
        <NotifyPrefsForm prefs={(profile?.notify_prefs ?? {}) as Record<string, boolean>} />
      </Panel>

      <Panel title="💎 Тариф">
        <p>Сейчас у всех карточек бесплатный тариф с щедрыми лимитами: 30 фото в галерее, 20 работ в портфолио, 20 сотрудников и т. д.</p>
        <p className="mt-2 text-sm text-muted">Скоро: расширенные возможности — тексты отзывов Google на странице, продвижение в поиске, больше фото.</p>
      </Panel>
    </div>
  );
}

export default function CabinetPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <CabinetContent />
    </Suspense>
  );
}
