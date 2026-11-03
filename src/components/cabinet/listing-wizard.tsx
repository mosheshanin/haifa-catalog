"use client";

// Пошаговое добавление карточки (решение заказчика 3 ноября 2026): по одному вопросу на экран, всё после
// первых четырёх шагов можно пропустить. После шага «Район» создаётся черновик (startListing), каждый
// следующий шаг сохраняет его (saveDraft), поэтому можно прерваться и продолжить в обычном редакторе.
// На последнем шаге — дополнительные услуги (src/lib/extra-services.ts) и отправка на проверку.
// Поля блоков — те же схемы, что в редакторе (BLOCK_SCHEMAS), чтобы данные были в одном формате.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Limits, ListingBlock, ListingData } from "@/lib/blocks/types";
import { BLOCK_SCHEMAS, defaultBlockData, type Field, type Option } from "@/lib/editor/schemas";
import { EditorContext, Fields, PhotoInput } from "@/components/editor/fields";
import { amenityList } from "@/lib/catalog/amenities";
import { filterConfig } from "@/lib/catalog/filter-config";
import { categoryIcon3d } from "@/lib/icons-3d";
import { ALL_HAIFA, isAllHaifa } from "@/lib/catalog/districts";
import { Icon3d } from "@/components/ui/icon-3d";
import { EXTRA_SERVICES, formatShekels } from "@/lib/extra-services";
import { inputCls, labelCls } from "@/components/forms/ui";
import { orderExtras, saveDraft, startListing, submitListing } from "@/app/actions/cabinet";

type Obj = Record<string, unknown>;
type Section = "biznes" | "specialisty";
export type WizardCategory = { id: number; section: string; name: string; slug: string; icon: string | null; icon_3d: string | null; parentId: number | null; amenities: string[] };

type StepKey = "type" | "name" | "category" | "district" | "contacts" | "about" | "place" | "hours" | "services" | "photos" | "languages" | "features" | "final";
type BlockType = ListingBlock["type"];

const MAIN_CONTACTS: Field[] = [
  { k: "phone", label: "Телефон", type: "tel", placeholder: "050-000-0000" },
  { k: "whatsapp", label: "WhatsApp", type: "tel", placeholder: "050-000-0000" },
  { k: "telegram", label: "Telegram (ник без @)", type: "text", max: 40, placeholder: "my_salon" },
];
const MORE_CONTACTS: Field[] = [
  { k: "email", label: "Email", type: "email", max: 120 },
  { k: "website", label: "Сайт", type: "url", max: 300, placeholder: "https://…" },
  { k: "instagram", label: "Instagram (ник)", type: "text", max: 60 },
  { k: "facebook", label: "Facebook", type: "url", max: 300, placeholder: "https://facebook.com/…" },
];

// Какой блок заполняет шаг. Порядок блоков в карточке — как порядок шагов.
const STEP_BLOCK: Partial<Record<StepKey, (s: Section) => BlockType>> = {
  about: () => "description",
  place: (s) => (s === "biznes" ? "address" : "service_area"),
  hours: () => "hours",
  services: () => "services",
  languages: () => "languages",
  features: () => "features",
};
const BLOCK_ORDER: BlockType[] = ["description", "services", "hours", "address", "service_area", "gallery", "features", "languages"];

const REQUIRED: StepKey[] = ["type", "name", "category", "district"];

// Какие дополнительные услуги предлагать на шаге (коды из src/lib/extra-services.ts).
const OFFERS_BY_STEP: Partial<Record<StepKey, string[]>> = {
  contacts: ["subdomain_site", "description"],
  about: ["description", "interview"],
  place: ["description"],
  hours: ["description"],
  services: ["consult", "description"],
  photos: ["photoshoot", "description"],
  languages: ["description"],
  features: ["description"],
};
// Короткий текст предложения на шаге, если он отличается от описания услуги.
const STEP_OFFER_TEXT: Record<string, string> = {
  description: "Не хотите писать сами? Редактор HBC сделает описание за вас.",
  subdomain_site: "Нет своего сайта? Сделаем сайт на основе этой карточки.",
  photoshoot: "Нет хороших фото? Пришлём фотографа.",
  interview: "Расскажите о себе в интервью — опубликуем в карточке и на главной.",
  consult: "Подскажем, как выстроить цены и привлечь клиентов.",
};

const uid = (t: string) => `${t}-${crypto.randomUUID().slice(0, 8)}`;
const hasContact = (c: ListingData["contacts"] | undefined) => Boolean(c && (c.phone || c.whatsapp || c.telegram || c.email));

function ChoiceTile({ selected, onClick, icon, title, text }: { selected: boolean; onClick: () => void; icon?: React.ReactNode; title: string; text?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left transition ${selected ? "border-primary bg-primary-soft" : "border-line bg-white hover:border-primary/50"}`}
    >
      {icon ? <span className="grid size-12 shrink-0 place-items-center">{icon}</span> : null}
      <span className="min-w-0">
        <span className="block font-bold leading-snug">{title}</span>
        {text ? <span className="mt-0.5 block text-sm text-muted">{text}</span> : null}
      </span>
    </button>
  );
}

export function ListingWizard(props: {
  categories: WizardCategory[];
  districts: Option[];
  haifaDistricts: string[]; // районы Хайфы для варианта «Вся Хайфа»
  amenities: { biznes: string[]; specialisty: string[] };
  languages: string[];
  limits: Limits;
  isAdmin: boolean;
}) {
  const { isAdmin } = props;
  const [section, setSection] = useState<Section | null>(null);
  const [title, setTitle] = useState("");
  const [profession, setProfession] = useState("");
  const [topId, setTopId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [districts, setDistricts] = useState<string[]>([]);

  const [listingId, setListingId] = useState<string | null>(null);
  const [data, setData] = useState<ListingData | null>(null);
  const [local, setLocal] = useState<Obj>({}); // данные блока на текущем шаге до нажатия «Дальше»
  const [moreContacts, setMoreContacts] = useState(false);

  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const [extras, setExtras] = useState<Set<string>>(new Set());
  const [extrasComment, setExtrasComment] = useState("");
  const [agree, setAgree] = useState(false);
  const [done, setDone] = useState<{ moderated: boolean; ordered: boolean; orderError?: string } | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);

  const steps: StepKey[] = ["type", "name", "category", "district", "contacts", "about", "place", "hours", "services", "photos", "languages", "features", "final"];
  const step = steps[stepIdx];
  const sec: Section = section ?? "biznes";

  const sectionCats = useMemo(() => props.categories.filter((c) => c.section === sec), [props.categories, sec]);
  const tops = sectionCats.filter((c) => !c.parentId);
  const subs = topId ? sectionCats.filter((c) => c.parentId === topId) : [];
  const category = sectionCats.find((c) => c.id === categoryId);
  const parent = category?.parentId ? sectionCats.find((c) => c.id === category.parentId) : undefined;
  const filter = useMemo(() => filterConfig(sec, category ? { slug: category.slug, parentSlug: parent?.slug ?? null } : null), [sec, category, parent]);
  const amenities = useMemo(
    () => amenityList(categoryId, props.categories, props.amenities[sec]),
    [categoryId, props.categories, props.amenities, sec],
  );

  // Фокус на вопросе при смене шага: экранный диктор читает новый вопрос, на телефоне экран начинается сверху.
  useEffect(() => {
    headingRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stepIdx, done]);

  // Данные блока для шага: уже заполненный блок или значения по умолчанию.
  const blockTypeOf = (k: StepKey) => STEP_BLOCK[k]?.(sec);
  const enterStep = (idx: number, d: ListingData | null = data) => {
    const k = steps[idx];
    const t = blockTypeOf(k);
    if (t) {
      const b = d?.blocks.find((x) => x.type === t);
      setLocal(b ? { ...(b.data as Obj) } : defaultBlockData(t));
    } else if (k === "photos") {
      const g = d?.blocks.find((x) => x.type === "gallery");
      setLocal({ logoUrl: d?.header.logoUrl, coverUrl: d?.header.coverUrl, photos: (g?.data as Obj | undefined)?.photos ?? [] });
    } else if (k === "contacts") {
      setLocal({ ...(d?.contacts ?? {}) });
    }
    setError(null);
    setStepIdx(idx);
  };

  const upsertBlock = (d: ListingData, type: BlockType, blockData: Obj): ListingData => {
    const exists = d.blocks.some((b) => b.type === type);
    const blocks = exists
      ? d.blocks.map((b) => (b.type === type ? ({ ...b, data: blockData } as ListingBlock) : b))
      : [...d.blocks, { id: uid(type), type, data: blockData } as ListingBlock];
    const rank = (t: BlockType) => {
      const i = BLOCK_ORDER.indexOf(t);
      return i < 0 ? 99 : i;
    };
    return { ...d, blocks: [...blocks].sort((a, b) => rank(a.type) - rank(b.type)) };
  };

  const persist = (next: ListingData, then: () => void) => {
    if (!listingId) return;
    start(async () => {
      const r = await saveDraft(listingId, next);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setData(next);
      setSaved("Черновик сохранён");
      then();
    });
  };

  // ---------- «Дальше» ----------
  const next = () => {
    setError(null);
    setSaved(null);
    if (step === "type") {
      if (!section) return setError("Выберите, кого добавляем.");
      return enterStep(stepIdx + 1);
    }
    if (step === "name") {
      if (title.trim().length < 2) return setError(sec === "biznes" ? "Напишите название." : "Напишите имя.");
      return enterStep(stepIdx + 1);
    }
    if (step === "category") {
      if (!categoryId) return setError("Выберите категорию.");
      return enterStep(stepIdx + 1);
    }
    if (step === "district") {
      if (!districts.length) return setError("Выберите хотя бы один район.");
      if (listingId && data) {
        // Черновик уже создан (вернулись назад): обновляем шапку.
        const nextData = { ...data, header: { ...data.header, title: title.trim(), profession: profession.trim() || undefined, categoryId: categoryId!, districtSlugs: districts } };
        return persist(nextData, () => enterStep(stepIdx + 1, nextData));
      }
      return start(async () => {
        const r = await startListing({ section: sec, title, profession, categoryId: categoryId!, district: districts[0] });
        if (!r.ok) return setError(r.error);
        const created = r.data!;
        let d = created.data;
        if (districts.length > 1) d = { ...d, header: { ...d.header, districtSlugs: districts } };
        setListingId(created.id);
        if (districts.length > 1) {
          const s = await saveDraft(created.id, d);
          if (!s.ok) return setError(s.error);
        }
        setData(d);
        setSaved("Черновик создан — можно прерваться и продолжить позже в «Мои карточки»");
        enterStep(stepIdx + 1, d);
      });
    }
    if (!data) return;
    if (step === "contacts") {
      const nextData = { ...data, contacts: local as ListingData["contacts"] };
      return persist(nextData, () => enterStep(stepIdx + 1, nextData));
    }
    if (step === "photos") {
      let nextData: ListingData = { ...data, header: { ...data.header, logoUrl: local.logoUrl as string | undefined, coverUrl: local.coverUrl as string | undefined } };
      const photos = (local.photos as Obj[] | undefined)?.filter((p) => p && p.url) ?? [];
      if (photos.length) nextData = upsertBlock(nextData, "gallery", { photos });
      return persist(nextData, () => enterStep(stepIdx + 1, nextData));
    }
    const t = blockTypeOf(step);
    if (t) {
      const nextData = upsertBlock(data, t, local);
      return persist(nextData, () => enterStep(stepIdx + 1, nextData));
    }
  };

  const skip = () => {
    setSaved(null);
    enterStep(stepIdx + 1);
  };
  const back = () => {
    setSaved(null);
    if (stepIdx > 0) enterStep(stepIdx - 1);
  };

  // ---------- Отправка ----------
  const toggleExtra = (code: string) => {
    const s = new Set(extras);
    const item = EXTRA_SERVICES.find((x) => x.code === code);
    if (s.has(code)) s.delete(code);
    else {
      // Два вида интервью — взаимоисключающие.
      if (item?.group) EXTRA_SERVICES.filter((x) => x.group === item.group).forEach((x) => s.delete(x.code));
      s.add(code);
    }
    setExtras(s);
  };
  const extrasTotal = EXTRA_SERVICES.filter((x) => extras.has(x.code)).reduce((sum, x) => sum + x.price, 0);
  const needsConsent = !isAdmin;
  const contactOk = hasContact(data?.contacts);

  const submit = () =>
    start(async () => {
      setError(null);
      if (!listingId || !data) return;
      if (needsConsent && !agree) return setError("Отметьте согласие с условиями, чтобы отправить карточку.");
      const r = await submitListing(listingId, data, needsConsent ? agree : undefined);
      if (!r.ok) return setError(r.error);
      let ordered = false;
      let orderError: string | undefined;
      if (extras.size) {
        const o = await orderExtras(listingId, [...extras], extrasComment);
        if (o.ok) ordered = true;
        else orderError = o.error;
      }
      setDone({ moderated: !isAdmin, ordered, orderError });
    });

  // ---------- Экран «Готово» ----------
  if (done && listingId) {
    return (
      <div className="grid gap-5 rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-sm sm:p-8">
        <Icon3d name="tick" size={72} className="drop-shadow-[0_8px_8px_rgba(0,0,0,0.15)]" />
        <h1 ref={headingRef} tabIndex={-1} style={{ outline: "none" }} className="text-2xl font-extrabold leading-tight sm:text-3xl">
          {done.moderated ? "Карточка отправлена на проверку" : "Карточка опубликована"}
        </h1>
        <p className="leading-relaxed text-muted">
          {done.moderated
            ? "Обычно проверка занимает до 48 часов. Результат придёт в Telegram, если он привязан, и появится в «Мои карточки»."
            : "Карточка уже в каталоге."}
        </p>
        {done.ordered ? (
          <p className="rounded-2xl bg-primary-soft p-3 text-sm font-bold">Заказ дополнительных услуг принят. Администратор свяжется с вами, чтобы обсудить детали и оплату.</p>
        ) : null}
        {done.orderError ? (
          <p role="alert" className="rounded-2xl bg-[#fdecea] p-3 text-sm font-bold text-danger">
            Карточка отправлена, но заказ услуг не прошёл: {done.orderError} Напишите администратору или попробуйте позже.
          </p>
        ) : null}
        <p className="text-sm text-muted">Видео, команду, меню, спецпредложения и другие блоки можно добавить в редакторе карточки.</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/kabinet/kartochka/${listingId}`} className="inline-flex min-h-12 items-center rounded-2xl bg-primary px-5 font-bold text-white hover:bg-primary-hover">
            Открыть редактор карточки
          </Link>
          <Link href="/kabinet" className="inline-flex min-h-12 items-center rounded-2xl border border-line bg-white px-5 font-bold hover:border-primary">
            Мои карточки
          </Link>
        </div>
      </div>
    );
  }

  const total = steps.length;
  const optional = !REQUIRED.includes(step) && step !== "final";
  const q = QUESTIONS(sec)[step];

  return (
    <EditorContext.Provider value={{ districts: props.districts, amenities, languages: props.languages, limits: props.limits, section: sec, filter }}>
      <div className="grid gap-5">
        {/* Прогресс */}
        <div className="grid gap-2">
          <span className="text-sm font-bold text-muted">
            Шаг {stepIdx + 1} из {total}
          </span>
          <div className="h-2 overflow-hidden rounded-full bg-surface-alt" aria-hidden>
            <div className="h-full rounded-full bg-accent transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${((stepIdx + 1) / total) * 100}%` }} />
          </div>
          {saved ? <span className="text-xs font-semibold text-success" role="status">{saved}</span> : null}
        </div>

        <section className="grid gap-5 rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-sm sm:p-7">
          <div className="grid gap-2">
            <h1 ref={headingRef} tabIndex={-1} style={{ outline: "none" }} className="text-2xl font-extrabold leading-tight sm:text-[1.75rem]">
              {q.title}
            </h1>
            {q.hint ? <p className="leading-relaxed text-muted">{q.hint}</p> : null}
          </div>

          {/* ---------- Шаги ---------- */}
          {step === "type" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceTile selected={section === "biznes"} onClick={() => { setSection("biznes"); setTopId(null); setCategoryId(null); }} icon={<Icon3d name="chart" size={48} />} title="Бизнес" text="Салон, кафе, клиника, магазин, компания" />
              <ChoiceTile selected={section === "specialisty"} onClick={() => { setSection("specialisty"); setTopId(null); setCategoryId(null); }} icon={<Icon3d name="boy" size={48} />} title="Специалист" text="Частный мастер, врач, репетитор, юрист" />
            </div>
          ) : null}

          {step === "name" ? (
            <div className="grid gap-4">
              <label className={labelCls}>
                {sec === "biznes" ? "Название" : "Имя и фамилия"}
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoFocus className={inputCls} placeholder={sec === "biznes" ? "Салон «Лаванда»" : "Анна Коэн"} />
              </label>
              {sec === "specialisty" ? (
                <label className={labelCls}>
                  Кем вы работаете (необязательно)
                  <input value={profession} onChange={(e) => setProfession(e.target.value)} maxLength={100} className={inputCls} placeholder="Мастер маникюра на дому" />
                </label>
              ) : null}
            </div>
          ) : null}

          {step === "category" ? (
            <div className="grid gap-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {tops.map((c) => (
                  <ChoiceTile
                    key={c.id}
                    selected={topId === c.id}
                    onClick={() => {
                      setTopId(c.id);
                      setCategoryId(c.id);
                    }}
                    icon={<Icon3d name={categoryIcon3d(c)} size={46} fallback={c.icon} />}
                    title={c.name}
                  />
                ))}
              </div>
              {subs.length ? (
                <div className="grid gap-2 rounded-2xl bg-surface-alt p-3">
                  <p className="text-sm font-bold">Уточните, если подходит:</p>
                  <div className="flex flex-wrap gap-2">
                    {[{ id: topId!, name: "Всё подряд / другое", icon_3d: null, icon: null, parentId: null } as Pick<WizardCategory, "id" | "name" | "icon_3d" | "icon" | "parentId">, ...subs].map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCategoryId(c.id)}
                        aria-pressed={categoryId === c.id}
                        className={`inline-flex min-h-11 items-center gap-2 rounded-full border-2 py-1 pl-2 pr-3.5 text-sm font-bold ${categoryId === c.id ? "border-primary bg-white" : "border-transparent bg-white hover:border-primary/40"}`}
                      >
                        {c.id !== topId ? <Icon3d name={categoryIcon3d(c, tops.find((t) => t.id === topId))} size={24} /> : null}
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === "district" ? (
            <div className="flex flex-wrap gap-2">
              {/* «Вся Хайфа» (3 ноября 2026) отмечает все районы Хайфы; в карточке они покажутся одной строкой «Вся Хайфа» */}
              {props.haifaDistricts.length ? (() => {
                const all = isAllHaifa(districts, props.haifaDistricts);
                return (
                  <button
                    type="button"
                    aria-pressed={all}
                    onClick={() =>
                      setDistricts(all ? districts.filter((x) => !props.haifaDistricts.includes(x)) : [...props.haifaDistricts, ...districts.filter((x) => !props.haifaDistricts.includes(x))])
                    }
                    className={`min-h-11 rounded-full border-2 px-3.5 text-sm font-extrabold ${all ? "border-primary bg-accent text-on-accent" : "border-primary/40 bg-white hover:border-primary"}`}
                  >
                    {all ? "✓ " : ""}
                    {ALL_HAIFA}
                  </button>
                );
              })() : null}
              {props.districts.map((d) => {
                const on = districts.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDistricts(on ? districts.filter((x) => x !== d.value) : [...districts, d.value])}
                    className={`min-h-11 rounded-full border-2 px-3.5 text-sm font-bold ${on ? "border-primary bg-primary-soft" : "border-line bg-white hover:border-primary/40"}`}
                  >
                    {on ? "✓ " : ""}
                    {d.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          {step === "contacts" ? (
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Fields fields={MAIN_CONTACTS} obj={local} onChange={setLocal} />
              </div>
              {moreContacts ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Fields fields={MORE_CONTACTS} obj={local} onChange={setLocal} />
                </div>
              ) : (
                <button type="button" onClick={() => setMoreContacts(true)} className="justify-self-start text-sm font-bold text-primary underline">
                  + Email, сайт, Instagram, Facebook
                </button>
              )}
            </div>
          ) : null}

          {step === "photos" ? (
            <div className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1">
                  <span className="text-sm font-bold">Логотип или ваше фото</span>
                  <PhotoInput label="Логотип" value={local.logoUrl as string | undefined} onChange={(v) => setLocal({ ...local, logoUrl: v })} />
                </div>
                <div className="grid gap-1">
                  <span className="text-sm font-bold">Обложка</span>
                  <PhotoInput label="Обложка" value={local.coverUrl as string | undefined} onChange={(v) => setLocal({ ...local, coverUrl: v })} />
                </div>
              </div>
              <Fields fields={BLOCK_SCHEMAS.gallery} obj={local} onChange={setLocal} />
            </div>
          ) : null}

          {blockTypeOf(step) ? <Fields fields={fieldsFor(blockTypeOf(step)!)} obj={local} onChange={setLocal} /> : null}

          {step === "final" ? (
            <div className="grid gap-6">
              {/* Что заполнено */}
              <div className="grid gap-2">
                <h2 className="text-lg font-extrabold">Что в карточке</h2>
                <ul className="grid gap-1.5 text-sm">
                  {steps.slice(4, -1).map((k, i) => {
                    const filled = isFilled(k, data, sec);
                    return (
                      <li key={k} className="flex flex-wrap items-center gap-2">
                        <span aria-hidden>{filled ? "✅" : "⬜"}</span>
                        <span className={filled ? "font-semibold" : "text-muted"}>{QUESTIONS(sec)[k].short}</span>
                        {!filled ? (
                          <button type="button" onClick={() => enterStep(4 + i)} className="font-bold text-primary underline">
                            заполнить
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                {!contactOk ? (
                  <p role="alert" className="rounded-2xl bg-[#fdecea] p-3 text-sm font-bold text-danger">
                    Нужен хотя бы один способ связи: телефон, WhatsApp, Telegram или email.{" "}
                    <button type="button" onClick={() => enterStep(steps.indexOf("contacts"))} className="underline">
                      Добавить контакты
                    </button>
                  </p>
                ) : null}
              </div>

              {/* Дополнительные услуги */}
              <div className="grid gap-3">
                <div>
                  <h2 className="text-lg font-extrabold">Хотите, мы поможем?</h2>
                  <p className="mt-1 text-sm text-muted">Необязательно. Отметьте, что интересно, — администратор свяжется с вами и обсудит детали и оплату.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {EXTRA_SERVICES.map((x) => {
                    const on = extras.has(x.code);
                    return (
                      <button
                        key={x.code}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleExtra(x.code)}
                        className={`flex items-start gap-3 rounded-2xl border-2 p-3 text-left transition ${on ? "border-accent bg-primary-soft" : "border-line bg-white hover:border-primary/40"}`}
                      >
                        <Icon3d name={x.icon} size={44} className="mt-0.5" />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <span className="font-bold leading-snug">{x.title}</span>
                            <span className="whitespace-nowrap font-extrabold tabular-nums">{formatShekels(x.price)}</span>
                          </span>
                          <span className="mt-0.5 block text-sm leading-snug text-muted">{x.text}</span>
                        </span>
                        <span aria-hidden className={`mt-1 grid size-6 shrink-0 place-items-center rounded-md border-2 text-sm font-black ${on ? "border-accent bg-accent text-on-accent" : "border-line"}`}>
                          {on ? "✓" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {extras.size ? (
                  <>
                    <p className="text-sm font-bold">
                      Выбрано: {extras.size} · итого <span className="tabular-nums">{formatShekels(extrasTotal)}</span>
                    </p>
                    <label className={labelCls}>
                      Комментарий к заказу (необязательно)
                      <textarea value={extrasComment} onChange={(e) => setExtrasComment(e.target.value)} maxLength={1000} rows={3} className={`${inputCls} h-auto py-2`} placeholder="Удобное время для звонка, пожелания" />
                    </label>
                  </>
                ) : null}
              </div>

              {needsConsent ? (
                <label className="flex items-start gap-2 text-sm leading-snug">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-primary" />
                  <span>
                    Подтверждаю, что вправе публиковать эти данные и фото, и принимаю{" "}
                    <Link href="/usloviya#kartochki" target="_blank" className="font-semibold text-primary underline">условия</Link> и{" "}
                    <Link href="/politika" target="_blank" className="font-semibold text-primary underline">политику конфиденциальности</Link>.
                  </span>
                </label>
              ) : null}
            </div>
          ) : null}

          {/* Дополнительные услуги по ходу заполнения (3 ноября 2026): «Улучшить описание» — на каждом шаге,
              остальное — там, где к месту. Отмеченное попадает в заказ на последнем шаге. */}
          {listingId && step !== "final" && OFFERS_BY_STEP[step] ? (
            <div className="grid gap-2">
              {OFFERS_BY_STEP[step]!.map((code) => {
                const x = EXTRA_SERVICES.find((e) => e.code === code);
                if (!x) return null;
                const on = extras.has(code);
                return (
                  <div key={code} className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 ${on ? "border-accent bg-primary-soft" : "border-dashed border-line bg-surface-alt"}`}>
                    <Icon3d name={x.icon} size={36} />
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="text-sm font-bold leading-snug">
                        {x.title} · <span className="whitespace-nowrap tabular-nums">{formatShekels(x.price)}</span>
                      </p>
                      <p className="text-xs leading-snug text-muted">{STEP_OFFER_TEXT[code] ?? x.text}</p>
                    </div>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleExtra(code)}
                      className={`min-h-10 whitespace-nowrap rounded-xl px-3 text-sm font-bold ${on ? "bg-accent text-on-accent" : "border border-line bg-white hover:border-primary"}`}
                    >
                      {on ? "✓ Добавлено" : "Хочу"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-2xl bg-[#fdecea] p-3 text-sm font-bold text-danger">
              {error}
            </p>
          ) : null}

          {/* ---------- Кнопки ---------- */}
          {/* На телефоне главная кнопка во всю ширину сверху, «Назад» и «Пропустить» — под ней */}
          <div className="grid grid-cols-2 gap-2 border-t border-line pt-4 sm:flex sm:items-center">
            {stepIdx > 0 ? (
              <button type="button" onClick={back} disabled={busy} className="order-2 min-h-12 rounded-2xl border border-line bg-white px-4 font-bold hover:border-primary disabled:opacity-60 sm:order-none">
                ← Назад
              </button>
            ) : null}
            <span className="hidden flex-1 sm:block" />
            {optional ? (
              <button type="button" onClick={skip} disabled={busy} className="order-3 min-h-12 rounded-2xl px-4 font-bold text-muted hover:bg-surface-alt disabled:opacity-60 sm:order-none">
                Пропустить
              </button>
            ) : null}
            {step === "final" ? (
              <button type="button" onClick={submit} disabled={busy || !contactOk} className="order-1 col-span-2 min-h-12 rounded-2xl bg-accent px-5 font-bold text-on-accent hover:bg-accent-hover disabled:opacity-60 sm:order-none">
                {busy ? "Отправляем…" : isAdmin ? "Опубликовать" : extras.size ? "Отправить карточку и заказ" : "Отправить на проверку"}
              </button>
            ) : (
              <button type="button" onClick={next} disabled={busy} className="order-1 col-span-2 min-h-12 rounded-2xl bg-primary px-5 font-bold text-white hover:bg-primary-hover disabled:opacity-60 sm:order-none">
                {busy ? "Сохраняем…" : "Дальше →"}
              </button>
            )}
          </div>
        </section>
        {listingId ? (
          <p className="text-center text-sm text-muted">
            Можно прерваться: черновик сохраняется на каждом шаге. Продолжить можно в{" "}
            <Link href={`/kabinet/kartochka/${listingId}`} className="font-bold text-primary underline">
              редакторе карточки
            </Link>
            .
          </p>
        ) : null}
      </div>
    </EditorContext.Provider>
  );
}

// Поля шага: схема блока без лишнего (метка на карте и «как добраться» остаются, это главное для адреса).
function fieldsFor(t: BlockType): Field[] {
  if (t === "description") return [{ k: "text", label: "Описание", type: "textarea", rows: 7, max: 5000, help: "Кто вы, чем занимаетесь, чем отличаетесь. 3–5 предложений достаточно." }];
  if (t === "address") return BLOCK_SCHEMAS.address.filter((f) => f.k !== "parking");
  return BLOCK_SCHEMAS[t];
}

function isFilled(k: StepKey, d: ListingData | null, sec: Section): boolean {
  if (!d) return false;
  const block = (t: BlockType) => d.blocks.find((b) => b.type === t)?.data as Obj | undefined;
  switch (k) {
    case "contacts":
      return hasContact(d.contacts);
    case "about":
      return Boolean(String(block("description")?.text ?? "").trim());
    case "place":
      return sec === "biznes" ? Boolean(String(block("address")?.address ?? "").trim()) : Boolean(block("service_area"));
    case "hours":
      return Boolean(block("hours"));
    case "services":
      return Boolean((block("services")?.groups as Obj[] | undefined)?.some((g) => ((g.items as unknown[]) ?? []).length));
    case "photos":
      return Boolean(d.header.coverUrl || d.header.logoUrl || ((block("gallery")?.photos as unknown[]) ?? []).length);
    case "languages":
      return Boolean(((block("languages")?.items as unknown[]) ?? []).length);
    case "features":
      return Boolean(((block("features")?.items as unknown[]) ?? []).length);
    default:
      return true;
  }
}

function QUESTIONS(sec: Section): Record<StepKey, { title: string; hint?: string; short: string }> {
  const biz = sec === "biznes";
  return {
    type: { title: "Кого добавляем?", hint: "Бизнес — заведение или компания. Специалист — частный мастер, который работает сам.", short: "Тип" },
    name: { title: biz ? "Как называется ваш бизнес?" : "Как вас зовут?", hint: biz ? "Так, как написано на вывеске или в соцсетях." : "Так, как вас знают клиенты: имя и фамилия.", short: "Название" },
    category: { title: "Чем вы занимаетесь?", hint: "Выберите категорию, а потом уточните, если подходит.", short: "Категория" },
    district: { title: biz ? "В каком районе вы находитесь?" : "В каких районах вы работаете?", hint: "Можно выбрать несколько.", short: "Район" },
    contacts: { title: "Как с вами связаться?", hint: "Достаточно одного способа. Клиенты увидят кнопки «Позвонить», «WhatsApp», «Telegram».", short: "Контакты" },
    about: { title: biz ? "Расскажите о бизнесе" : "Расскажите о себе", hint: "Пара абзацев о том, чем вы полезны клиентам. Можно пропустить и написать позже.", short: "Описание" },
    place: biz
      ? { title: "Где вас найти?", hint: "Адрес появится в карточке и на карте.", short: "Адрес" }
      : { title: "Как и где вы работаете?", hint: "Выезжаете к клиентам, принимаете у себя или работаете онлайн.", short: "Где работаете" },
    hours: { title: "Когда вы работаете?", hint: "Посетители увидят «Открыто сейчас» или «Закрыто».", short: "Часы работы" },
    services: { title: "Какие у вас услуги и цены?", hint: "Несколько главных услуг с ценой. Остальное можно добавить потом.", short: "Услуги и цены" },
    photos: { title: "Добавьте фото", hint: "Карточки с фото открывают в несколько раз чаще. Хватит обложки и 3–5 фото работ или места.", short: "Фото" },
    languages: { title: "На каких языках вы общаетесь?", short: "Языки" },
    features: { title: "Что у вас есть особенного?", hint: "По этим отметкам вас найдут фильтры каталога.", short: "Особенности" },
    final: { title: "Почти готово", hint: "Проверьте, что заполнено, и отправьте карточку на проверку.", short: "Отправка" },
  };
}
