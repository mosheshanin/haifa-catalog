import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/server/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { LoginRequired, Panel, STATUS_STYLE, Skeleton } from "@/components/cabinet/common";
import { NotifyPrefsForm } from "@/components/cabinet/forms";
import { TelegramStatus } from "@/components/cabinet/telegram-status";
import { t } from "@/i18n/ru";
import { formatDateRu } from "@/lib/format";
import { confirmListingFromCabinet } from "@/app/actions/cabinet";
import { getCategories } from "@/lib/data/dictionaries";
import { listingScore, topCategorySlug, type ListingScore } from "@/lib/blocks/score";
import { filterConfig } from "@/lib/catalog/filter-config";
import type { ListingData } from "@/lib/blocks/types";

export const metadata: Metadata = { title: t.cabinet.title, robots: { index: false } };

// Срок черновика — как SQL draft_expires_at (миграция 20261105000004): 30 дней с последней правки, но не раньше 3 дней
// после напоминания в Telegram.
function draftExpiresAt(l: { created_at: string; last_edit_at: string | null; draft_reminded_at: string | null }): string {
  const edit = new Date(l.last_edit_at ?? l.created_at).getTime();
  const reminded = l.draft_reminded_at ? new Date(l.draft_reminded_at).getTime() : 0;
  const byEdit = edit + 30 * 86400_000;
  const byReminder = reminded >= edit ? reminded + 3 * 86400_000 : 0;
  return new Date(Math.max(byEdit, byReminder)).toISOString();
}

async function CabinetContent() {
  const user = await getSessionUser();
  if (!user) return <LoginRequired next="/kabinet" />;
  const sb = createAdminClient();
  const [{ data: listings }, { data: profile }] = await Promise.all([
    sb.from("listings").select("id, section, slug, title, status, is_demo, updated_at, data_confirmed_at, published_at, created_at, last_edit_at, draft_reminded_at, published_version_id").eq("owner_id", user.id).order("updated_at", { ascending: false }),
    sb.from("profiles").select("telegram_id, notify_prefs").eq("id", user.id).single(),
  ]);
  const ids = (listings ?? []).map((l) => l.id);
  const { data: versions } = ids.length
    ? await sb.from("listing_versions").select("listing_id, status, review_comment, block_decisions, created_at").in("listing_id", ids).in("status", ["draft", "pending", "rejected"]).order("created_at", { ascending: false })
    : { data: [] };
  // Заполненность (5 ноября 2026): по рабочей версии — черновик, иначе на проверке, иначе опубликованная (как в редакторе).
  const pubIds = (listings ?? []).map((l) => l.published_version_id).filter(Boolean) as string[];
  const [{ data: work }, { data: pub }, categories] = await Promise.all([
    ids.length
      ? sb.from("listing_versions").select("listing_id, status, data, created_at").in("listing_id", ids).in("status", ["draft", "pending"]).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<{ listing_id: string; status: string; data: ListingData }> }),
    pubIds.length ? sb.from("listing_versions").select("id, data").in("id", pubIds) : Promise.resolve({ data: [] as Array<{ id: string; data: ListingData }> }),
    getCategories(),
  ]);
  const cats = categories.map((c) => ({ id: c.id, slug: c.slug, parentId: c.parent_id }));
  const scores = new Map<string, ListingScore>();
  for (const l of listings ?? []) {
    const w = (work ?? []).filter((v) => v.listing_id === l.id);
    const d = (w.find((v) => v.status === "draft") ?? w.find((v) => v.status === "pending"))?.data ?? (pub ?? []).find((v) => v.id === l.published_version_id)?.data;
    if (!d) continue;
    const data = d as ListingData;
    const cat = categories.find((c) => c.id === data.header.categoryId);
    const parent = cat?.parent_id ? categories.find((c) => c.id === cat.parent_id) : undefined;
    const places = filterConfig(l.section, cat ? { slug: cat.slug, parentSlug: parent?.slug ?? null } : null).places;
    scores.set(l.id, listingScore(data, { topSlug: topCategorySlug(data.header.categoryId, cats), placeTitle: places.title }));
  }
  const { data: claims } = await sb.from("ownership_claims").select("id, status, created_at, listings(title)").eq("user_id", user.id).eq("status", "pending");

  return (
    <div className="grid grid-cols-1 gap-5">
      <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">🗂️ {t.cabinet.title}</h1>
      <Panel
        title="Ваши карточки"
        actions={
          <Link href="/kabinet/novaya" className="inline-flex min-h-11 items-center rounded-2xl bg-accent px-4 font-bold text-on-accent hover:bg-accent-hover">
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
                  {scores.get(l.id) ? <FillLine id={l.id} score={scores.get(l.id)!} /> : null}
                  {rejected?.review_comment && !pending ? <p className="text-sm text-danger">Комментарий модератора: {rejected.review_comment}</p> : null}
                  {l.status === "draft" ? (
                    <p className="text-sm text-muted">
                      Черновик хранится 30 дней с последней правки — до {formatDateRu(draftExpiresAt(l).slice(0, 10))}. Продолжите заполнение, чтобы он не удалился.
                    </p>
                  ) : null}
                  {l.status === "published" ? <Freshness id={l.id} confirmedAt={l.data_confirmed_at ?? l.published_at} /> : null}
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

// Заполненность карточки и один следующий шаг (ссылка открывает нужный блок в редакторе).
function FillLine({ id, score }: { id: string; score: ListingScore }) {
  const next = score.next[0];
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3">
        <div className="relative h-2 min-w-0 flex-1 rounded-full bg-[#ecebe5]" aria-hidden>
          <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${score.percent}%` }} />
        </div>
        <b className="font-display tabular-nums">{score.percent}%</b>
      </div>
      <p className="text-sm leading-snug text-muted">
        <span className="sr-only">Заполнено {score.percent}%. </span>
        {score.message}
      </p>
      {next ? (
        <Link href={`/kabinet/kartochka/${id}?blok=${next.key}`} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-primary-soft px-3 py-2 text-sm hover:bg-[#ebe8da]">
          <span>
            <span className="text-muted">Следующий шаг:</span> <b>{next.action}</b>
          </span>
          <b className="whitespace-nowrap text-accent-ink">+{next.points}%</b>
        </Link>
      ) : null}
    </div>
  );
}

// Свежесть данных (этап 5): дата подтверждения; через 150 дней — кнопка «Всё верно» (напоминание в Telegram — через 180).
function Freshness({ id, confirmedAt }: { id: string; confirmedAt: string | null }) {
  // eslint-disable-next-line react-hooks/purity -- страница кабинета динамическая, время запроса
  const stale = !confirmedAt || Date.now() - new Date(confirmedAt).getTime() > 150 * 86400_000;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
      <span>🗓 Данные подтверждены: {confirmedAt ? formatDateRu(confirmedAt) : "ещё нет"}</span>
      {stale ? (
        <form action={confirmListingFromCabinet}>
          <input type="hidden" name="listingId" value={id} />
          <button type="submit" className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 font-bold text-ink hover:border-primary">
            ✅ Всё верно
          </button>
        </form>
      ) : null}
    </div>
  );
}
