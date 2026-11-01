import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { MockNotice } from "@/components/ui/mock-notice";
import { BLOCK_TITLES } from "@/lib/blocks/types";
import { t } from "@/i18n/ru";

export const metadata: Metadata = { title: t.cabinet.title, robots: { index: false } };

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[#f0efec] text-muted",
  pending: "bg-[#f9eeda] text-[#8a5a00]",
  published: "bg-[#e5f4e4] text-success",
  rejected: "bg-[#fbebeb] text-danger",
  archived: "bg-[#f0efec] text-muted",
};

const EDITOR_BLOCKS: Array<{ type: keyof typeof BLOCK_TITLES | "header" | "contacts"; title: string; required?: boolean; on: boolean; fast?: boolean }> = [
  { type: "header", title: "Шапка", required: true, on: true },
  { type: "contacts", title: "Контакты и кнопки", required: true, on: true },
  { type: "description", title: BLOCK_TITLES.description, required: true, on: true },
  { type: "offers", title: BLOCK_TITLES.offers, on: true, fast: true },
  { type: "services", title: BLOCK_TITLES.services, on: true, fast: true },
  { type: "hours", title: BLOCK_TITLES.hours, on: true, fast: true },
  { type: "gallery", title: BLOCK_TITLES.gallery, on: true },
  { type: "before_after", title: BLOCK_TITLES.before_after, on: false },
  { type: "faq", title: BLOCK_TITLES.faq, on: true },
  { type: "request", title: BLOCK_TITLES.request, on: true },
];

async function CabinetContent() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
        <p className="font-bold">Чтобы управлять карточками, войдите.</p>
        <Link href="/vhod?next=/kabinet" className="mt-4 inline-flex h-11 items-center rounded-2xl bg-primary px-5 font-bold text-white">
          {t.nav.login}
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: listings } = await supabase
    .from("listings")
    .select("id, section, slug, title, status, updated_at")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="grid gap-6">
      <section className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold">Ваши карточки</h2>
          <button type="button" disabled className="inline-flex h-11 items-center rounded-2xl bg-accent px-5 font-bold text-white opacity-70" title="Этап 3">
            + {t.nav.addListing}
          </button>
        </div>
        {listings?.length ? (
          <ul className="mt-4 divide-y divide-line">
            {listings.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-3">
                <span className="font-bold">{l.title ?? l.slug}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[l.status]}`}>
                  {t.cabinet.statuses[l.status as keyof typeof t.cabinet.statuses]}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-muted">
            {t.cabinet.empty} Если ваш бизнес уже есть в каталоге, откройте его карточку и нажмите «{t.listing.claim}».
          </p>
        )}
      </section>

      <MockNotice text="Ниже — макет редактора карточки. Он заработает на этапе 3." />

      <section className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-extrabold">Салон «Лаванда» (пример)</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE.pending}`}>{t.cabinet.statuses.pending}</span>
          </div>
          <p className="mt-1 text-sm text-muted">Посетители видят прежнюю опубликованную версию, пока правка на проверке.</p>
          <ul className="mt-4 grid gap-2">
            {EDITOR_BLOCKS.map((b) => (
              <li key={b.type} className="flex items-center gap-3 rounded-2xl border border-line px-3 py-2.5">
                <span className="cursor-grab select-none text-muted" aria-hidden>⋮⋮</span>
                <span className="flex-1 font-semibold">
                  {b.title}
                  {b.required ? <span className="ml-2 text-xs font-bold text-muted">обязательный</span> : null}
                  {b.fast ? <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">публикуется сразу</span> : null}
                </span>
                <span className={`relative h-6 w-11 rounded-full ${b.on ? "bg-primary" : "bg-line"}`} aria-label={b.on ? "Включён" : "Скрыт"}>
                  <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow ${b.on ? "left-[1.375rem]" : "left-0.5"}`} />
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled className="h-11 rounded-2xl border border-line px-4 font-bold opacity-70">Предпросмотр</button>
            <button type="button" disabled className="h-11 rounded-2xl border border-line px-4 font-bold opacity-70">Сохранить черновик</button>
            <button type="button" disabled className="h-11 rounded-2xl bg-primary px-4 font-bold text-white opacity-70">Отправить на проверку</button>
          </div>
        </div>
        <aside className="grid content-start gap-4">
          <div className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-sm">
            <h3 className="font-extrabold">Заявки</h3>
            <p className="mt-1 text-3xl font-extrabold text-primary">3</p>
            <p className="text-sm text-muted">новых · пример</p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-sm">
            <h3 className="font-extrabold">Статистика за 30 дней</h3>
            <dl className="mt-2 grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted">Просмотры</dt><dd className="text-right font-bold">412</dd>
              <dt className="text-muted">Звонки</dt><dd className="text-right font-bold">27</dd>
              <dt className="text-muted">WhatsApp</dt><dd className="text-right font-bold">19</dd>
              <dt className="text-muted">Маршрут</dt><dd className="text-right font-bold">8</dd>
            </dl>
          </div>
          <div className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-sm">
            <h3 className="font-extrabold">Тариф</h3>
            <p className="mt-1 text-sm">Бесплатный. Скоро: расширенные возможности.</p>
          </div>
        </aside>
      </section>
    </div>
  );
}

export default function CabinetPage() {
  return (
    <div className="grid gap-5">
      <h1 className="text-3xl font-extrabold">{t.cabinet.title}</h1>
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <CabinetContent />
      </Suspense>
    </div>
  );
}
