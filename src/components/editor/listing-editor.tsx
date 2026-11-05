"use client";

import Link from "next/link";
import { Component, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import type { ListingBlock, ListingData, Limits } from "@/lib/blocks/types";
import { BLOCK_ICONS, BLOCK_TITLES } from "@/lib/blocks/types";
import { MODERATED_TYPES } from "@/lib/blocks/moderation";
import { ADDABLE_ORDER, BLOCK_SCHEMAS, defaultBlockData, type Field, type Option } from "@/lib/editor/schemas";
import { EditorContext, Fields, PhotoInput } from "@/components/editor/fields";
import { amenityList } from "@/lib/catalog/amenities";
import { filterConfig } from "@/lib/catalog/filter-config";
import { inputCls, labelCls } from "@/components/forms/ui";
import { ListingView } from "@/components/listing/listing-view";
import { saveDraft, submitListing } from "@/app/actions/cabinet";
import { districtNameMap } from "@/lib/catalog/districts";
import { BLOCK_POINTS, listingScore, suggestedBlocks, topCategorySlug, type ScoreItem, type ScoreTarget } from "@/lib/blocks/score";
import { FillMeter, NextStepCard } from "@/components/cabinet/fill-meter";

type Obj = Record<string, unknown>;
type Category = { id: number; name: string; slug: string; icon: string | null; parentId: number | null; amenities: string[] };

const CONTACT_FIELDS: Field[] = [
  { k: "phone", label: "Телефон", type: "tel", placeholder: "050-000-0000" },
  { k: "whatsapp", label: "WhatsApp", type: "tel", placeholder: "050-000-0000" },
  { k: "telegram", label: "Telegram (ник без @)", type: "text", max: 40, placeholder: "my_salon" },
  { k: "email", label: "Email", type: "email", max: 120 },
  { k: "website", label: "Сайт", type: "url", max: 300, placeholder: "https://…" },
  { k: "instagram", label: "Instagram (ник)", type: "text", max: 60 },
  { k: "facebook", label: "Facebook", type: "url", max: 300, placeholder: "https://facebook.com/…" },
  { k: "tiktok", label: "TikTok", type: "url", max: 300 },
  { k: "youtube", label: "YouTube", type: "url", max: 300 },
];

const BADGES: Option[] = [
  { value: "verified", label: "✅ Проверено" },
  { value: "documents_checked", label: "📜 Документы проверены" },
];

// Предпросмотр недозаполненной карточки не должен ронять редактор.
class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p className="p-4 text-sm text-muted">Предпросмотр появится, когда обязательные поля будут заполнены.</p> : this.props.children;
  }
}

function Card({ title, icon, children, hint, actions }: { title: string; icon: string; children: React.ReactNode; hint?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-[var(--radius-card)] border border-line bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3 pl-4">
        <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-lg" aria-hidden>
          {icon}
        </span>
        <h2 className="min-w-0 flex-1 text-lg font-extrabold">{title}</h2>
        {actions}
      </div>
      {hint ? <div className="px-4 pt-3 text-xs">{hint}</div> : null}
      <div className="grid gap-4 p-4">{children}</div>
    </section>
  );
}

function ModerationHint({ moderated }: { moderated: boolean }) {
  return moderated ? (
    <span className="inline-flex rounded-full bg-[#f9eeda] px-2.5 py-1 font-bold text-[#8a5a00]">🛡 Проверяется перед публикацией</span>
  ) : (
    <span className="inline-flex rounded-full bg-[#e5f4e4] px-2.5 py-1 font-bold text-success">⚡ Публикуется сразу</span>
  );
}

export function ListingEditor(props: {
  listing: { id: string; section: "biznes" | "specialisty"; slug: string; status: string; isDemo: boolean };
  initial: ListingData;
  hasPublished: boolean;
  pending: { submittedAt: string | null } | null;
  lastDecision: { comment: string | null; reasons: Array<{ title: string; reason: string }>; at: string | null; rejected: boolean } | null;
  categories: Category[];
  districts: Option[];
  amenities: string[]; // общие отметки раздела; свои отметки категории добавляются по выбранной категории
  languages: string[];
  limits: Limits;
  isAdmin: boolean;
  haifaDistricts?: string[];
}) {
  const { listing, isAdmin } = props;
  const [data, setData] = useState<ListingData>(props.initial);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pendingSave, startSave] = useTransition();
  const [pendingSubmit, startSubmit] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  // Согласие при первой отправке карточки (раздел 9 ТЗ): владелец подтверждает права на данные и фото.
  const needsConsent = !isAdmin && !props.hasPublished;
  const [agree, setAgree] = useState(true); // отмечено по умолчанию (решение заказчика 5 ноября 2026)

  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty]);

  const update = (next: ListingData) => {
    setData(next);
    setDirty(true);
    setMsg(null);
  };
  const setHeader = (h: Obj) => update({ ...data, header: h as ListingData["header"] });
  const setContacts = (c: Obj) => update({ ...data, contacts: c as ListingData["contacts"] });
  const setBlock = (id: string, b: ListingBlock) => update({ ...data, blocks: data.blocks.map((x) => (x.id === id ? b : x)) });
  const moveBlock = (id: string, to: number) => {
    const from = data.blocks.findIndex((b) => b.id === id);
    if (from < 0 || to < 0 || to >= data.blocks.length) return;
    const blocks = [...data.blocks];
    const [b] = blocks.splice(from, 1);
    blocks.splice(to, 0, b);
    update({ ...data, blocks });
  };

  const categoryOptions = useMemo(() => {
    const top = props.categories.filter((c) => !c.parentId);
    return top.flatMap((t) => [
      { value: String(t.id), label: `${t.icon ?? ""} ${t.name}`.trim() },
      ...props.categories.filter((c) => c.parentId === t.id).map((c) => ({ value: String(c.id), label: `   — ${c.name}` })),
    ]);
  }, [props.categories]);

  const present = new Set(data.blocks.map((b) => b.type));
  const addable = ADDABLE_ORDER.filter((t) => !present.has(t));
  const districtNames = districtNameMap(props.districts.map((d) => ({ slug: d.value, name: d.label, kind: props.haifaDistricts?.includes(d.value) ? "haifa" : undefined })));
  const categoryName = props.categories.find((c) => c.id === data.header.categoryId)?.name ?? "";
  // Фильтры категории: какие поля «Особенностей» показывать (кассы, доставка/выезд) и как их назвать.
  const filter = useMemo(() => {
    const cat = props.categories.find((c) => c.id === data.header.categoryId);
    const parent = cat?.parentId ? props.categories.find((c) => c.id === cat.parentId) : undefined;
    return filterConfig(listing.section, cat ? { slug: cat.slug, parentSlug: parent?.slug ?? null } : null);
  }, [props.categories, data.header.categoryId, listing.section]);

  // Заполненность (5 ноября 2026): шкала в нижней панели, совет «следующий шаг», «+5%» на блоках, похвала, когда
  // блок засчитался. Ссылка ?blok=<пункт> (из мастера, кабинета и бота) добавляет блок, если его нет, и прокручивает к нему.
  const topSlug = topCategorySlug(data.header.categoryId, props.categories);
  const score = listingScore(data, { topSlug, placeTitle: filter.places.title });
  const suggested = suggestedBlocks(listing.section, topSlug);
  const [cheer, setCheer] = useState<string | null>(null);
  const doneRef = useRef<Set<string> | null>(null);
  const doneKeys = score.items.filter((i) => i.done).map((i) => i.key).join(",");
  useEffect(() => {
    const now = new Set(doneKeys ? doneKeys.split(",") : []);
    const before = doneRef.current;
    doneRef.current = now;
    if (!before) return;
    const fresh = score.items.find((i) => i.done && !before.has(i.key));
    if (!fresh) return;
    setCheer(`«${fresh.title}» — засчитано, +${fresh.points}%. ${score.percent}% заполнено.`);
    const t = setTimeout(() => setCheer(null), 5000);
    return () => clearTimeout(t);
    // score меняется на каждый ввод; реагируем только на смену набора засчитанных пунктов
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneKeys]);

  const focusTarget = (key: ScoreTarget, d: ListingData = data) => {
    let id = key === "cover" ? "ed-header" : key === "contact" ? "ed-contacts" : null;
    let next = d;
    if (!id) {
      const type = (key === "description" ? "description" : key === "place" ? (listing.section === "biznes" ? "address" : "service_area") : key) as ListingBlock["type"];
      let b = d.blocks.find((x) => x.type === type);
      if (!b) {
        b = { id: `${type}-${crypto.randomUUID().slice(0, 8)}`, type, data: defaultBlockData(type) } as ListingBlock;
        next = { ...d, blocks: [...d.blocks, b] };
        update(next);
      } else if (b.hidden) {
        next = { ...d, blocks: d.blocks.map((x) => (x.id === b!.id ? ({ ...x, hidden: false } as ListingBlock) : x)) };
        update(next);
      }
      id = `blk-${b.id}`;
    }
    setPreview(false);
    window.setTimeout(() => {
      const el = document.getElementById(id!);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.querySelector<HTMLElement>("input:not([type=checkbox]):not([type=hidden]), textarea, select")?.focus({ preventScroll: true });
    }, 80);
  };
  // ?blok= из ссылки — один раз при открытии.
  useEffect(() => {
    const url = new URL(window.location.href);
    const key = url.searchParams.get("blok");
    if (!key) return;
    // В обработчике таймера, а не в теле эффекта (правило react-hooks); адрес чистим там же — иначе двойной
    // запуск эффекта в режиме разработки потерял бы параметр.
    const timer = window.setTimeout(() => {
      url.searchParams.delete("blok");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      const known = score.items.some((i) => i.key === key) || (ADDABLE_ORDER as string[]).includes(key);
      if (known) focusTarget(key as ScoreTarget, props.initial);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onNextStep = (item: ScoreItem) => focusTarget(item.key);

  // «Особенности»: свой список категории (этап 5, вариант В) + общий список раздела.
  const amenities = useMemo(() => amenityList(data.header.categoryId, props.categories, props.amenities), [data.header.categoryId, props.categories, props.amenities]);

  const doSave = () =>
    startSave(async () => {
      const r = await saveDraft(listing.id, data);
      setMsg(r.ok ? { ok: true, text: r.message ?? "Сохранено" } : { ok: false, text: r.error });
      if (r.ok) setDirty(false);
    });
  const doSubmit = () =>
    startSubmit(async () => {
      if (needsConsent && !agree) {
        setMsg({ ok: false, text: "Отметьте согласие с условиями внизу страницы, чтобы отправить карточку на проверку." });
        return;
      }
      const r = await submitListing(listing.id, data, needsConsent ? agree : undefined);
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setDirty(false);
      const d = r.data!;
      const parts = [
        d.published.length ? `Опубликовано сразу: ${d.published.join(", ")}.` : "",
        d.moderated.length ? `Отправлено на проверку: ${d.moderated.join(", ")}. Обычно проверка занимает до 48 часов, результат придёт в Telegram.` : "",
      ].filter(Boolean);
      setMsg({ ok: true, text: parts.join(" ") || "Изменений нет — всё уже опубликовано." });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

  const statusLine = props.pending
    ? "🕓 Есть правки на проверке. Вы можете продолжать редактировать — при отправке они заменят предыдущие."
    : !props.hasPublished
      ? "📝 Карточка ещё не опубликована. Заполните её и отправьте на проверку."
      : "✅ Карточка опубликована.";

  return (
    <EditorContext.Provider value={{ districts: props.districts, amenities, languages: props.languages, limits: props.limits, section: listing.section, filter }}>
      <div className="grid gap-4 pb-44">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link href={isAdmin ? "/admin?tab=listings" : "/kabinet"} className="font-bold text-primary">
            ← {isAdmin ? "К карточкам в админке" : "Мои карточки"}
          </Link>
          {listing.status === "published" ? (
            <Link href={`/${listing.section}/${listing.slug}`} className="ml-auto font-bold text-primary" target="_blank">
              Открыть на сайте ↗
            </Link>
          ) : null}
        </div>
        <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">✏️ {data.header.title || "Новая карточка"}</h1>
        <p className="rounded-2xl bg-surface-alt p-3 text-sm">{statusLine}</p>
        {props.lastDecision ? (
          <div className="rounded-2xl border-2 border-danger/30 bg-[#fdecea] p-3 text-sm">
            <p className="font-extrabold text-danger">{props.lastDecision.rejected ? "⛔ Правка отклонена модератором" : "⚠️ Часть правок не прошла проверку"}</p>
            {props.lastDecision.comment ? <p className="mt-1">Комментарий: {props.lastDecision.comment}</p> : null}
            {props.lastDecision.reasons.map((r) => (
              <p key={r.title} className="mt-1">
                <b>{r.title}:</b> {r.reason}
              </p>
            ))}
          </div>
        ) : null}
        {isAdmin ? <p className="rounded-2xl bg-primary-soft p-3 text-sm font-bold text-primary">🛠 Вы редактируете как администратор: «Опубликовать» сразу выкладывает всю карточку.</p> : null}
        {msg ? (
          <p role={msg.ok ? "status" : "alert"} className={`rounded-2xl p-3 text-sm font-bold ${msg.ok ? "bg-[#e5f4e4] text-success" : "bg-[#fdecea] text-danger"}`}>
            {msg.ok ? "✅ " : "⚠️ "}
            {msg.text}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPreview(false)} aria-pressed={!preview} className={`min-h-11 rounded-full px-4 font-bold ${!preview ? "bg-primary text-white" : "border border-line bg-white"}`}>
            ✏️ Редактор
          </button>
          <button type="button" onClick={() => setPreview(true)} aria-pressed={preview} className={`min-h-11 rounded-full px-4 font-bold ${preview ? "bg-primary text-white" : "border border-line bg-white"}`}>
            👁 Как увидит посетитель
          </button>
        </div>

        {preview ? (
          <div className="rounded-[var(--radius-card)] border-2 border-dashed border-primary/40 p-2 sm:p-4">
            <PreviewBoundary>
            <ListingView
              listingId={listing.id}
              data={data}
              categoryName={categoryName}
              categoryHref="#"
              districtNames={districtNames}
              isDemo={listing.isDemo}
              share={{ url: `/${listing.section}/${listing.slug}`, miniAppUrl: "#", temporaryAddress: true }}
              preview
            />
            </PreviewBoundary>
          </div>
        ) : (
          <>
            <NextStepCard score={score} onAction={onNextStep} />
            <div id="ed-header" className="scroll-mt-4">
            <Card title="Шапка" icon="🏷️" hint={<ModerationHint moderated />}>
              <Fields
                fields={[
                  { k: "title", label: "Название", type: "text", max: 120, required: true },
                  ...(listing.section === "specialisty" ? [{ k: "profession", label: "Профессия", type: "text", max: 100, placeholder: "Мастер маникюра на дому" } as Field] : []),
                  { k: "slogan", label: "Слоган", type: "text", max: 160, placeholder: "Коротко: чем вы полезны" },
                ]}
                obj={data.header as unknown as Obj}
                onChange={setHeader}
              />
              <label className={labelCls}>
                Категория *
                <select value={String(data.header.categoryId ?? "")} onChange={(e) => setHeader({ ...data.header, categoryId: Number(e.target.value) || undefined })} className={inputCls}>
                  <option value="">Выберите…</option>
                  {categoryOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <Fields
                fields={[
                  { k: "districtSlugs", label: "Районы *", type: "multiselect", options: "districts" },
                  ...(isAdmin ? [{ k: "badges", label: "Отметки (ставит администратор)", type: "multiselect", options: BADGES } as Field] : []),
                ]}
                obj={data.header as unknown as Obj}
                onChange={setHeader}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1">
                  <span className="text-sm font-bold">Логотип</span>
                  <PhotoInput label="Логотип" value={data.header.logoUrl} onChange={(v) => setHeader({ ...data.header, logoUrl: v })} />
                </div>
                <div className="grid gap-1">
                  <span className="text-sm font-bold">Обложка</span>
                  <PhotoInput label="Обложка" value={data.header.coverUrl} onChange={(v) => setHeader({ ...data.header, coverUrl: v })} />
                </div>
              </div>
            </Card>
            </div>

            <div id="ed-contacts" className="scroll-mt-4">
            <Card title="Контакты и кнопки" icon="📞" hint={<ModerationHint moderated />}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Fields fields={CONTACT_FIELDS} obj={data.contacts as unknown as Obj} onChange={setContacts} />
              </div>
            </Card>
            </div>

            {data.blocks.map((b, i) => (
              <div
                key={b.id}
                id={`blk-${b.id}`}
                draggable={false}
                onDragOver={(e) => dragId && e.preventDefault()}
                onDrop={() => {
                  if (dragId && dragId !== b.id) moveBlock(dragId, i);
                  setDragId(null);
                }}
                className={`scroll-mt-4 ${dragId === b.id ? "opacity-50" : ""}`}
              >
                <Card
                  title={b.type === "service_area" ? filter.places.title : BLOCK_TITLES[b.type]}
                  icon={BLOCK_ICONS[b.type]}
                  hint={
                    <span className="flex flex-wrap gap-2">
                      <ModerationHint moderated={MODERATED_TYPES.has(b.type)} />
                      {b.hidden ? <span className="inline-flex rounded-full bg-[#f0efec] px-2.5 py-1 font-bold text-muted">🙈 Скрыт</span> : null}
                    </span>
                  }
                  actions={
                    <span className="flex items-center">
                      <span
                        draggable
                        onDragStart={() => setDragId(b.id)}
                        onDragEnd={() => setDragId(null)}
                        className="hidden size-11 cursor-grab place-items-center rounded-lg text-muted hover:bg-surface-alt sm:grid"
                        title="Перетащите, чтобы поменять порядок"
                        aria-hidden
                      >
                        ⠿
                      </span>
                      <button type="button" onClick={() => moveBlock(b.id, i - 1)} disabled={i === 0} className="grid size-11 place-items-center rounded-lg hover:bg-surface-alt disabled:opacity-30" aria-label="Выше">
                        ↑
                      </button>
                      <button type="button" onClick={() => moveBlock(b.id, i + 1)} disabled={i === data.blocks.length - 1} className="grid size-11 place-items-center rounded-lg hover:bg-surface-alt disabled:opacity-30" aria-label="Ниже">
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => setBlock(b.id, { ...b, hidden: !b.hidden } as ListingBlock)}
                        className="grid size-11 place-items-center rounded-lg hover:bg-surface-alt"
                        aria-label={b.hidden ? "Показать блок" : "Скрыть блок"}
                        title={b.hidden ? "Показать" : "Скрыть, не удаляя"}
                      >
                        {b.hidden ? "🙈" : "👁"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Удалить блок «${b.type === "service_area" ? filter.places.title : BLOCK_TITLES[b.type]}» со всеми данными?`)) update({ ...data, blocks: data.blocks.filter((x) => x.id !== b.id) });
                        }}
                        className="grid size-11 place-items-center rounded-lg text-danger hover:bg-[#fdecea]"
                        aria-label="Удалить блок"
                      >
                        🗑
                      </button>
                    </span>
                  }
                >
                  <Fields fields={BLOCK_SCHEMAS[b.type]} obj={b.data as Obj} onChange={(d) => setBlock(b.id, { ...b, data: d } as ListingBlock)} />
                </Card>
              </div>
            ))}

            {addable.length ? (
              <section className="rounded-[var(--radius-card)] border-2 border-dashed border-line p-4">
                <h2 className="text-lg font-extrabold">➕ Добавить блок</h2>
                <p className="mb-3 mt-1 text-sm text-muted">
                  Каждый заполненный блок — <b className="text-accent-ink">+{BLOCK_POINTS}%</b>. Отмеченные точкой чаще всего пригодятся в вашей категории.
                </p>
                <div className="flex flex-wrap gap-2">
                  {[...addable.filter((t) => suggested.includes(t)), ...addable.filter((t) => !suggested.includes(t))].map((t) => {
                    const rec = suggested.includes(t);
                    const counts = t !== "description" && t !== (listing.section === "biznes" ? "address" : "service_area");
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => focusTarget(t)}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-sm font-bold hover:border-primary hover:bg-primary-soft"
                      >
                        {rec ? <span aria-hidden className="size-2 rounded-full bg-accent ring-1 ring-[#c9a10c]" /> : null}
                        {BLOCK_ICONS[t]} {t === "service_area" ? filter.places.title : BLOCK_TITLES[t]}
                        {counts ? <span className="text-accent-ink">+{BLOCK_POINTS}%</span> : null}
                        {rec ? <span className="sr-only"> (советуем)</span> : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </>
        )}

        {/* Закреплённая панель действий */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
            {cheer ? (
              <p role="status" className="w-full rounded-2xl bg-primary px-3 py-2 text-sm font-bold text-white">
                <span aria-hidden className="mr-1.5 inline-grid size-5 place-items-center rounded-full bg-accent text-xs text-on-accent">✓</span>
                {cheer}
              </p>
            ) : null}
            <div className="flex w-full">
              <FillMeter score={score} compact />
            </div>
            {needsConsent ? (
              <label className="flex w-full items-start gap-2 text-xs leading-snug">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-primary" />
                <span>
                  Подтверждаю, что вправе публиковать эти данные и фото, и принимаю{" "}
                  <Link href="/usloviya#kartochki" target="_blank" className="font-semibold text-primary underline">условия</Link> и{" "}
                  <Link href="/politika" target="_blank" className="font-semibold text-primary underline">политику конфиденциальности</Link>.
                </span>
              </label>
            ) : null}
            <span className="hidden min-w-0 flex-1 text-xs text-muted sm:block">{dirty ? "Есть несохранённые изменения" : "Всё сохранено"}</span>
            {!isAdmin ? (
              <button type="button" onClick={doSave} disabled={pendingSave || pendingSubmit} className="min-h-12 flex-1 rounded-2xl border border-line bg-white px-3 font-bold hover:border-primary disabled:opacity-60 sm:flex-none">
                {pendingSave ? "Сохраняем…" : "💾 Черновик"}
              </button>
            ) : null}
            <button type="button" onClick={doSubmit} disabled={pendingSave || pendingSubmit} className="min-h-12 flex-1 rounded-2xl bg-accent px-3 font-bold text-on-accent hover:bg-accent-hover disabled:opacity-60 sm:flex-none sm:px-5">
              {pendingSubmit ? "Отправляем…" : isAdmin ? "🚀 Опубликовать" : props.hasPublished ? "📤 Отправить" : "📤 На проверку"}
            </button>
          </div>
        </div>
      </div>
    </EditorContext.Provider>
  );
}
