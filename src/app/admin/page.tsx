import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/server/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { LoginRequired, Panel, STATUS_STYLE, Skeleton } from "@/components/cabinet/common";
import {
  CategoryForm,
  ChannelModeForm,
  ChannelPostButtons,
  ClaimDecision,
  ComplaintDecision,
  ConnectCandidateButton,
  DisconnectChannelButton,
  DistrictForm,
  RevertForm,
  ReviewDecision,
  SetupBotButton,
  SettingsForm,
  SynonymForm,
  UserAccessForm,
} from "@/components/admin/forms";
import { botApi } from "@/lib/telegram/api";
import { getBotSetting, getChannel, type ChannelCandidate } from "@/lib/telegram/channel";
import { siteUrl } from "@/lib/env";
import { ImportPanel } from "@/components/admin/import-panel";
import { BlockPreview } from "@/components/listing/listing-view";
import { changeTitle } from "@/lib/blocks/moderation";
import { BLOCK_TITLES, type ListingBlock } from "@/lib/blocks/types";
import { getSiteSettings } from "@/lib/data/settings";
import { addDays, israelToday } from "@/lib/blocks/expire";
import { t } from "@/i18n/ru";

export const metadata: Metadata = { title: t.admin.title, robots: { index: false } };

const TABS = [
  { k: "queue", label: "🛡 Очередь" },
  { k: "instant", label: "⚡ Правки без проверки" },
  { k: "listings", label: "🗂️ Карточки" },
  { k: "users", label: "👥 Пользователи" },
  { k: "dict", label: "📚 Справочники" },
  { k: "import", label: "📥 Импорт" },
  { k: "telegram", label: "✈️ Telegram" },
  { k: "log", label: "🧾 Журнал" },
] as const;
type Tab = (typeof TABS)[number]["k"];

const dt = (s: string) => new Date(s).toLocaleString("ru-RU", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" });

async function Queue() {
  const sb = createAdminClient();
  const [{ data: versions }, { data: reviews }, { data: complaints }, { data: claims }] = await Promise.all([
    sb.from("listing_versions").select("id, listing_id, moderated_keys, submitted_at, data, listings!listing_versions_listing_id_fkey(title, section, status)").eq("status", "pending").order("submitted_at", { ascending: true }).limit(100),
    sb.from("reviews").select("id, rating, text, author_name, created_at, listings(title, section, slug)").eq("status", "pending").order("created_at").limit(100),
    sb.from("complaints").select("id, kind, reason, text, contact, created_at, review_id, listings(title, section, slug), reviews(text, author_name)").eq("status", "new").order("created_at").limit(100),
    sb.from("ownership_claims").select("id, contact, message, created_at, listings(title, section, slug), profiles!ownership_claims_user_id_fkey(display_name, google_email, telegram_username)").eq("status", "pending").order("created_at").limit(100),
  ]);
  const empty = !versions?.length && !reviews?.length && !complaints?.length && !claims?.length;
  type L = { title: string; section: string; slug: string; status?: string } | null;
  return (
    <div className="grid gap-5">
      {empty ? <Panel title="🎉 Очередь пуста">Новых правок, отзывов, жалоб и заявок на права нет.</Panel> : null}
      {versions?.length ? (
        <Panel title={`🗂️ Карточки и правки (${versions.length})`}>
          <ul className="divide-y divide-line">
            {versions.map((v) => {
              const l = v.listings as unknown as L;
              const isNew = (v.moderated_keys as string[]).includes("*");
              const data = v.data as { blocks: ListingBlock[] };
              const what = isNew
                ? "Новая карточка"
                : (v.moderated_keys as string[])
                    .map((k) => (k === "header" || k === "contacts" ? changeTitle({ type: k }, BLOCK_TITLES) : BLOCK_TITLES[data.blocks.find((b) => b.id === k)?.type ?? "description"]))
                    .join(", ");
              return (
                <li key={v.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${isNew ? "bg-primary-soft text-primary" : STATUS_STYLE.pending}`}>{isNew ? "Новая" : "Правка"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{l?.title}</p>
                    <p className="text-sm text-muted">{what}</p>
                  </div>
                  <span className="text-xs text-muted">{v.submitted_at ? dt(v.submitted_at) : ""}</span>
                  <Link href={`/admin/proverka/${v.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-bold text-white">
                    Проверить
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}
      {reviews?.length ? (
        <Panel title={`⭐ Отзывы (${reviews.length})`}>
          <ul className="grid gap-4">
            {reviews.map((r) => {
              const l = r.listings as unknown as L;
              return (
                <li key={r.id} className="grid gap-2 rounded-2xl border border-line p-4">
                  <p className="text-sm text-muted">
                    <Link href={`/${l?.section}/${l?.slug}`} className="font-bold text-primary">{l?.title}</Link> · {dt(r.created_at)}
                  </p>
                  <p>
                    <b>{r.author_name}</b> <span className="text-highlight">{"★".repeat(r.rating)}</span>
                  </p>
                  <p className="whitespace-pre-line">{r.text}</p>
                  <ReviewDecision id={r.id} />
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}
      {complaints?.length ? (
        <Panel title={`🚩 Жалобы и запросы (${complaints.length})`}>
          <ul className="grid gap-4">
            {complaints.map((c) => {
              const l = c.listings as unknown as L;
              const rv = c.reviews as unknown as { text: string; author_name: string } | null;
              return (
                <li key={c.id} className="grid gap-2 rounded-2xl border border-line p-4">
                  <p className="text-sm text-muted">
                    {c.kind === "data_request" ? "Исправить или удалить данные" : c.kind === "review" ? "Жалоба на отзыв" : "Жалоба на карточку"} ·{" "}
                    <Link href={`/${l?.section}/${l?.slug}`} className="font-bold text-primary">{l?.title}</Link> · {dt(c.created_at)}
                  </p>
                  <p className="font-bold">{c.reason}</p>
                  {c.text ? <p className="whitespace-pre-line">{c.text}</p> : null}
                  {c.contact ? <p className="text-sm">📞 {c.contact}</p> : null}
                  {rv ? <p className="rounded-xl bg-surface-alt p-3 text-sm">Отзыв {rv.author_name}: «{rv.text}»</p> : null}
                  <ComplaintDecision id={c.id} isReview={c.kind === "review"} />
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}
      {claims?.length ? (
        <Panel title={`🔑 Права владельца (${claims.length})`}>
          <ul className="grid gap-4">
            {claims.map((c) => {
              const l = c.listings as unknown as L;
              const p = c.profiles as unknown as { display_name: string | null; google_email: string | null; telegram_username: string | null } | null;
              return (
                <li key={c.id} className="grid gap-2 rounded-2xl border border-line p-4">
                  <p>
                    <Link href={`/${l?.section}/${l?.slug}`} className="font-bold text-primary">{l?.title}</Link> · {dt(c.created_at)}
                  </p>
                  <p className="text-sm">
                    👤 {p?.display_name ?? "—"} {p?.google_email ? `· ${p.google_email}` : ""} {p?.telegram_username ? `· @${p.telegram_username}` : ""}
                  </p>
                  <p className="text-sm">📞 Контакт для проверки: {c.contact}</p>
                  {c.message ? <p className="text-sm">💬 {c.message}</p> : null}
                  <p className="text-xs text-muted">Перед подтверждением свяжитесь с владельцем по контакту из карточки.</p>
                  <ClaimDecision id={c.id} />
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

async function Instant({ districtNames }: { districtNames: Record<string, string> }) {
  const sb = createAdminClient();
  const { data } = await sb
    .from("instant_changes")
    .select("id, listing_id, block_key, block_type, before, after, created_at, reverted_at, revert_reason, listings(title, section, slug)")
    .order("created_at", { ascending: false })
    .limit(80);
  const render = (type: string, v: unknown) => {
    if (v === null || v === undefined) return <p className="text-sm text-muted">— нет —</p>;
    if (type === "review_reply") return <p className="whitespace-pre-line text-sm">{String(v)}</p>;
    if (type === "order") return <p className="text-sm text-muted">Порядок блоков изменён</p>;
    return <BlockPreview block={v as ListingBlock} districtNames={districtNames} />;
  };
  return (
    <Panel title="⚡ Правки, опубликованные без проверки">
      {data?.length ? (
        <ul className="grid gap-5">
          {data.map((c) => {
            const l = c.listings as unknown as { title: string; section: string; slug: string } | null;
            return (
              <li key={c.id} className={`grid gap-3 rounded-2xl border p-4 ${c.reverted_at ? "border-line opacity-60" : "border-primary/30"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/${l?.section}/${l?.slug}`} className="font-bold text-primary">{l?.title}</Link>
                  <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">
                    {c.block_type === "review_reply" ? "Ответ на отзыв" : changeTitle({ type: c.block_type }, BLOCK_TITLES)}
                  </span>
                  <span className="ml-auto text-xs text-muted">{dt(c.created_at)}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="min-w-0 rounded-xl bg-[#fdecea]/50 p-2">
                    <p className="mb-1 text-xs font-extrabold text-danger">БЫЛО</p>
                    {render(c.block_type, c.before)}
                  </div>
                  <div className="min-w-0 rounded-xl bg-[#e5f4e4]/60 p-2">
                    <p className="mb-1 text-xs font-extrabold text-success">СТАЛО</p>
                    {render(c.block_type, c.after)}
                  </div>
                </div>
                {c.reverted_at ? <p className="text-sm text-muted">↩️ Снято: {c.revert_reason}</p> : <RevertForm id={c.id} />}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted">Таких правок пока не было.</p>
      )}
    </Panel>
  );
}

async function Listings({ q, status }: { q?: string; status?: string }) {
  const sb = createAdminClient();
  let query = sb.from("listings").select("id, section, slug, title, status, owner_id, is_demo, is_verified, updated_at").order("updated_at", { ascending: false }).limit(200);
  if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`);
  if (status) query = query.eq("status", status);
  const { data } = await query;
  return (
    <Panel
      title="🗂️ Карточки"
      actions={
        <Link href="/kabinet/novaya" className="inline-flex min-h-11 items-center rounded-2xl bg-accent px-4 text-sm font-bold text-white">
          + Создать карточку
        </Link>
      }
    >
      <form className="mb-4 flex flex-wrap gap-2">
        <input type="hidden" name="tab" value="listings" />
        <input name="q" defaultValue={q} placeholder="Поиск по названию" className="h-11 min-w-0 flex-1 rounded-xl border border-line px-3" />
        <select name="status" defaultValue={status ?? ""} className="h-11 rounded-xl border border-line px-3">
          <option value="">Все статусы</option>
          {Object.entries(t.cabinet.statuses).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className="min-h-11 rounded-xl bg-primary px-4 font-bold text-white">Найти</button>
      </form>
      <ul className="divide-y divide-line">
        {(data ?? []).map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-2 py-3">
            <span className="min-w-0 flex-1 font-bold">
              {l.title ?? l.slug} {l.is_demo ? <span className="text-xs font-normal text-muted">(пример)</span> : null}
              {!l.owner_id ? <span className="ml-1 text-xs font-normal text-muted">· без владельца</span> : null}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[l.status]}`}>{t.cabinet.statuses[l.status as keyof typeof t.cabinet.statuses]}</span>
            <Link href={`/admin/kartochka/${l.id}`} className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-sm font-bold hover:border-primary">
              Управление
            </Link>
            <Link href={`/kabinet/kartochka/${l.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-3 text-sm font-bold text-white">
              ✏️ Редактировать
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

async function Users({ q, selfId }: { q?: string; selfId: string }) {
  const sb = createAdminClient();
  let query = sb.from("profiles").select("id, display_name, google_email, telegram_username, role, is_blocked, created_at").order("created_at", { ascending: false }).limit(200);
  if (q) {
    const s = q.replace(/[%_,()]/g, "");
    query = query.or(`display_name.ilike.%${s}%,google_email.ilike.%${s}%,telegram_username.ilike.%${s}%`);
  }
  const { data } = await query;
  return (
    <Panel title="👥 Пользователи">
      <form className="mb-4 flex gap-2">
        <input type="hidden" name="tab" value="users" />
        <input name="q" defaultValue={q} placeholder="Имя, почта или ник Telegram" className="h-11 min-w-0 flex-1 rounded-xl border border-line px-3" />
        <button className="min-h-11 rounded-xl bg-primary px-4 font-bold text-white">Найти</button>
      </form>
      <ul className="grid gap-3">
        {(data ?? []).map((u) => (
          <li key={u.id} className="grid gap-2 rounded-2xl border border-line p-3">
            <p className="font-bold">
              {u.display_name ?? "—"}{" "}
              <span className="text-sm font-normal text-muted">
                {u.google_email ? `· ${u.google_email}` : ""} {u.telegram_username ? `· @${u.telegram_username}` : ""} · с {new Date(u.created_at).toLocaleDateString("ru-RU")}
              </span>
            </p>
            <UserAccessForm id={u.id} role={u.role} blocked={u.is_blocked} self={u.id === selfId} />
            <Link href={`/admin?tab=log&actor=${u.id}`} className="w-fit text-sm font-bold text-primary">
              История действий
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

async function Dictionaries() {
  const sb = createAdminClient();
  const [{ data: cats }, { data: dists }, { data: syns }, settings] = await Promise.all([
    sb.from("categories").select("*").order("section").order("sort"),
    sb.from("districts").select("*").order("sort"),
    sb.from("search_synonyms").select("term, expands_to").order("term"),
    getSiteSettings(),
  ]);
  const top = (cats ?? []).filter((c) => !c.parent_id);
  return (
    <div className="grid gap-5">
      <Panel title="⚙️ Настройки">
        <SettingsForm rules={settings.reviewRules} amenities={settings.amenities} languages={settings.languages} />
      </Panel>
      <Panel title={`🏷️ Категории (${cats?.length ?? 0})`}>
        <details className="mb-4 rounded-2xl border-2 border-dashed border-line p-3">
          <summary className="min-h-11 cursor-pointer font-bold text-primary">+ Новая категория или подкатегория</summary>
          <div className="mt-3">
            <CategoryForm parents={top.map((c) => ({ id: c.id, name: c.name, section: c.section }))} />
          </div>
        </details>
        <div className="grid gap-2">
          {top.map((c) => (
            <details key={c.id} className="rounded-2xl border border-line p-3">
              <summary className="min-h-11 cursor-pointer font-bold">
                {c.icon} {c.name} <span className="text-xs font-normal text-muted">· {c.section === "biznes" ? "бизнесы" : "специалисты"} · {c.slug}{c.is_active ? "" : " · скрыта"}</span>
              </summary>
              <div className="mt-3 grid gap-4">
                <CategoryForm c={c} parents={[]} />
                {(cats ?? [])
                  .filter((s) => s.parent_id === c.id)
                  .map((s) => (
                    <details key={s.id} className="rounded-xl bg-surface-alt p-3">
                      <summary className="min-h-11 cursor-pointer text-sm font-bold">
                        — {s.icon} {s.name} <span className="font-normal text-muted">· {s.slug}</span>
                      </summary>
                      <div className="mt-3">
                        <CategoryForm c={s} parents={[]} />
                      </div>
                    </details>
                  ))}
              </div>
            </details>
          ))}
        </div>
      </Panel>
      <Panel title={`📍 Районы (${dists?.length ?? 0})`}>
        <details className="mb-4 rounded-2xl border-2 border-dashed border-line p-3">
          <summary className="min-h-11 cursor-pointer font-bold text-primary">+ Новый район</summary>
          <div className="mt-3">
            <DistrictForm />
          </div>
        </details>
        <div className="grid gap-2">
          {(dists ?? []).map((d) => (
            <details key={d.id} className="rounded-2xl border border-line p-3">
              <summary className="min-h-11 cursor-pointer font-bold">
                {d.name} <span className="text-xs font-normal text-muted">· {d.slug}</span>
              </summary>
              <div className="mt-3">
                <DistrictForm d={d} />
              </div>
            </details>
          ))}
        </div>
      </Panel>
      <Panel title={`🔎 Синонимы поиска (${syns?.length ?? 0})`}>
        <div className="grid gap-3">
          <SynonymForm />
          {(syns ?? []).map((s) => (
            <SynonymForm key={s.term} term={s.term} expands={s.expands_to} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

async function Log({ actor }: { actor?: string }) {
  const sb = createAdminClient();
  let query = sb.from("audit_log").select("id, actor_id, action, entity_type, entity_id, details, created_at, profiles(display_name)").order("created_at", { ascending: false }).limit(200);
  if (actor && /^[0-9a-f-]{36}$/.test(actor)) query = query.eq("actor_id", actor);
  const { data } = await query;
  return (
    <Panel title="🧾 Журнал действий">
      <ul className="divide-y divide-line text-sm">
        {(data ?? []).map((e) => (
          <li key={e.id} className="grid gap-1 py-2">
            <p>
              <span className="text-muted">{dt(e.created_at)}</span> · <b>{(e.profiles as unknown as { display_name: string } | null)?.display_name ?? "система"}</b> · {e.action}
            </p>
            <p className="break-all text-xs text-muted">
              {e.entity_type}:{e.entity_id} {Object.keys(e.details ?? {}).length ? JSON.stringify(e.details).slice(0, 200) : ""}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}


const POST_STATUS: Record<string, string> = { queued: "🕓 В очереди", posted: "✅ В канале", deleted: "🗑 Удалён", failed: "⚠️ Ошибка", cancelled: "✖ Отменён" };

// Бот и канал (этап 4): подключение вебхука, встроенный поиск, канал и его очередь.
async function TelegramTab({ adminTelegramId }: { adminTelegramId: number | null }) {
  const api = botApi();
  const sb = createAdminClient();
  const [me, hook, channel, candidate, { data: posts }, { data: chat }] = await Promise.all([
    api?.getMe().catch(() => null) ?? null,
    api?.getWebhookInfo().catch(() => null) ?? null,
    getChannel(),
    getBotSetting<ChannelCandidate>("channel_candidate"),
    sb.from("channel_posts").select("id, kind, item_title, status, error, created_at, posted_at, listings(title, section, slug)").order("created_at", { ascending: false }).limit(40),
    adminTelegramId ? sb.from("telegram_chats").select("blocked_at").eq("telegram_id", adminTelegramId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const expectedUrl = `${siteUrl()}/api/telegram/webhook`;
  const hookOk = Boolean(hook && hook.url === expectedUrl);
  const ok = (b: boolean) => (b ? "✅" : "⚠️");
  return (
    <div className="grid gap-5">
      <Panel title="🤖 Бот">
        {!api ? (
          <p className="text-sm text-danger">В Vercel не задан TELEGRAM_BOT_TOKEN — бот не работает.</p>
        ) : (
          <div className="grid gap-3 text-sm">
            <p>
              {ok(Boolean(me))} Бот: {me ? <b>@{me.username}</b> : "Telegram не ответил"}
            </p>
            <p className="break-words">
              {ok(hookOk)} Приём сообщений (вебхук): {hookOk ? "подключён" : hook?.url ? `указан другой адрес: ${hook.url}` : "не подключён"}
              {hook?.pending_update_count ? ` · в очереди ${hook.pending_update_count}` : ""}
            </p>
            {hook?.last_error_message ? (
              <p className="break-words text-danger">
                Последняя ошибка ({hook.last_error_date ? dt(new Date(hook.last_error_date * 1000).toISOString()) : ""}): {hook.last_error_message}
              </p>
            ) : null}
            <p>
              {ok(Boolean(me?.supports_inline_queries))} Поиск в чатах (@{me?.username ?? "бот"} маникюр):{" "}
              {me?.supports_inline_queries ? "включён" : "выключен — включается в @BotFather командой /setinline"}
            </p>
            <p>
              {ok(Boolean(adminTelegramId && chat && !chat.blocked_at))} Уведомления вам:{" "}
              {!adminTelegramId ? "привяжите Telegram в профиле" : !chat ? "нажмите «Старт» у бота" : chat.blocked_at ? "бот заблокирован или «Старт» не нажат" : "бот может вам писать"}
            </p>
            <SetupBotButton label={hookOk ? "🔄 Обновить настройки бота" : "🔌 Подключить бота"} />
            <p className="text-xs text-muted">Кнопка ставит адрес приёма сообщений, меню команд и описание бота. Нажимать безопасно сколько угодно раз.</p>
          </div>
        )}
      </Panel>

      <Panel title="📣 Канал">
        {channel ? (
          <div className="grid gap-3 text-sm">
            <p>
              ✅ Подключён: <b>{channel.title}</b>
              {channel.username ? (
                <>
                  {" "}
                  ·{" "}
                  <a href={`https://t.me/${channel.username}`} target="_blank" rel="noopener noreferrer" className="font-bold text-primary">
                    @{channel.username}
                  </a>
                </>
              ) : null}
            </p>
            <ChannelModeForm mode={channel.mode} />
            <p className="text-xs text-muted">
              В канал попадают: первая публикация карточки и новые спецпредложения проверенных карточек. Примерные карточки и импорт — нет. Отдельную карточку можно
              отправить вручную или исключить на её странице управления.
            </p>
            <DisconnectChannelButton />
          </div>
        ) : (
          <div className="grid gap-3 text-sm">
            <p>Канал не подключён. Добавьте бота @{me?.username ?? "haifabcbot"} в администраторы своего канала с правом публиковать сообщения.</p>
            {candidate ? <ConnectCandidateButton title={candidate.title} /> : <p className="text-muted">Если вы вошли через Telegram, канал подключится сам, как только вы добавите бота.</p>}
          </div>
        )}
      </Panel>

      <Panel title="🧾 Посты канала">
        {posts?.length ? (
          <ul className="divide-y divide-line">
            {posts.map((p) => {
              const l = p.listings as unknown as { title: string; section: string; slug: string } | null;
              return (
                <li key={p.id} className="grid gap-2 py-3 text-sm">
                  <p className="min-w-0 break-words">
                    <span className="text-muted">{dt(p.posted_at ?? p.created_at)}</span> · {POST_STATUS[p.status] ?? p.status} · {p.kind === "offer" ? `🎁 ${p.item_title ?? ""} — ` : "🆕 "}
                    <b>{l?.title ?? ""}</b>
                  </p>
                  {p.error ? <p className="break-words text-xs text-danger">{p.error}</p> : null}
                  {["queued", "failed", "posted"].includes(p.status) ? <ChannelPostButtons id={p.id} status={p.status} /> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted">Постов пока не было.</p>
        )}
      </Panel>
    </div>
  );
}

async function AdminContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getSessionUser();
  if (!user) return <LoginRequired next="/admin" text={t.admin.noAccess} />;
  if (user.role !== "admin" || user.isBlocked) {
    return (
      <Panel title={t.admin.noAccess}>
        <p className="text-sm text-muted">Вход в админку возможен только через Google-аккаунт из списка администраторов.</p>
      </Panel>
    );
  }
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const tab = (TABS.some((x) => x.k === one("tab")) ? one("tab") : "queue") as Tab;
  const sb = createAdminClient();
  const [v, r, c, cl, ic, dists] = await Promise.all([
    sb.from("listing_versions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("complaints").select("id", { count: "exact", head: true }).eq("status", "new"),
    sb.from("ownership_claims").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("instant_changes").select("id", { count: "exact", head: true }).is("reverted_at", null).gte("created_at", addDays(israelToday(), -7)),
    sb.from("districts").select("slug, name"),
  ]);
  const queueCount = (v.count ?? 0) + (r.count ?? 0) + (c.count ?? 0) + (cl.count ?? 0);
  const districtNames = Object.fromEntries((dists.data ?? []).map((d) => [d.slug, d.name]));

  return (
    <div className="grid gap-5">
      <h1 className="text-3xl font-extrabold">🛠 {t.admin.title}</h1>
      {one("done") ? <p className="rounded-2xl bg-[#e5f4e4] p-3 text-sm font-bold text-success">✅ Решение сохранено, владелец получит уведомление.</p> : null}
      <nav aria-label="Разделы админки" className="flex flex-wrap gap-2">
        {TABS.map((x) => (
          <Link
            key={x.k}
            href={`/admin?tab=${x.k}`}
            className={`min-h-11 rounded-full px-4 py-2.5 text-sm font-bold ${tab === x.k ? "bg-primary text-white" : "border border-line bg-white hover:border-primary"}`}
          >
            {x.label}
            {x.k === "queue" && queueCount ? <span className="ml-1 rounded-full bg-accent px-2 text-white">{queueCount}</span> : null}
            {x.k === "instant" && ic.count ? <span className="ml-1 rounded-full bg-highlight px-2">{ic.count}</span> : null}
          </Link>
        ))}
      </nav>
      {tab === "queue" ? <Queue /> : null}
      {tab === "instant" ? <Instant districtNames={districtNames} /> : null}
      {tab === "listings" ? <Listings q={one("q")} status={one("status")} /> : null}
      {tab === "users" ? <Users q={one("q")} selfId={user.id} /> : null}
      {tab === "dict" ? <Dictionaries /> : null}
      {tab === "import" ? <ImportPanel /> : null}
      {tab === "telegram" ? <TelegramTab adminTelegramId={user.telegramId} /> : null}
      {tab === "log" ? <Log actor={one("actor")} /> : null}
    </div>
  );
}

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <div className="mx-auto max-w-4xl">
      <Suspense fallback={<Skeleton />}>
        <AdminContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
