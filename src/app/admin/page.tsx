import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { MockNotice } from "@/components/ui/mock-notice";
import { t } from "@/i18n/ru";

export const metadata: Metadata = { title: t.admin.title, robots: { index: false } };

const QUEUE = [
  { kind: "Правка карточки", title: "Салон «Лаванда» (пример)", detail: "Описание, фото: 2 блока изменены", age: "2 ч" },
  { kind: "Права владельца", title: "Кафе «Самовар» (пример)", detail: "Контакт: +972 50-000-0002", age: "5 ч" },
  { kind: "Новая карточка", title: "Борис М., электрик (пример)", detail: "Специалисты · Мастера на все руки", age: "1 д" },
  { kind: "Отзыв", title: "Анна К. (пример)", detail: "★★★★★ «Очень аккуратно и быстро…»", age: "1 д" },
  { kind: "Опубликовано без проверки", title: "Салон «Лаванда» (пример)", detail: "Цены: маникюр 140 → 150 ₪", age: "20 мин" },
];

async function AdminContent() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
        <p className="font-bold">{t.admin.noAccess}</p>
        <Link href="/vhod?next=/admin" className="mt-4 inline-flex h-11 items-center rounded-2xl bg-primary px-5 font-bold text-white">
          {t.nav.login}
        </Link>
      </div>
    );
  }
  if (user.role !== "admin" || user.isBlocked) {
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
        <p className="font-bold">{t.admin.noAccess}</p>
        <p className="mt-1 text-sm text-muted">Вход в админку возможен только через Google-аккаунт из списка администраторов.</p>
      </div>
    );
  }

  // Счётчики из базы: администратор видит всё по правилам доступа.
  const supabase = await createClient();
  const [profiles, categories, districts, listings] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("categories").select("id", { count: "exact", head: true }),
    supabase.from("districts").select("id", { count: "exact", head: true }),
    supabase.from("listings").select("id", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "Пользователей", value: profiles.count ?? 0 },
    { label: "Карточек", value: listings.count ?? 0 },
    { label: "Категорий", value: categories.count ?? 0 },
    { label: "Районов", value: districts.count ?? 0 },
  ];

  return (
    <div className="grid gap-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-sm">
            <p className="text-3xl font-extrabold text-primary">{s.value}</p>
            <p className="text-sm text-muted">{s.label}</p>
          </div>
        ))}
      </section>

      <MockNotice text="Счётчики выше — настоящие, из базы. Очередь ниже — макет, она заработает на этапе 3." />

      <section className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-sm">
        <h2 className="text-xl font-extrabold">{t.admin.queue}</h2>
        <ul className="mt-3 divide-y divide-line">
          {QUEUE.map((q, i) => (
            <li key={i} className="flex flex-wrap items-center gap-3 py-3">
              <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">{q.kind}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{q.title}</p>
                <p className="text-sm text-muted">{q.detail}</p>
              </div>
              <span className="text-sm text-muted">{q.age}</span>
              <div className="flex gap-2">
                <button type="button" disabled className="h-9 rounded-xl bg-success px-3 text-sm font-bold text-white opacity-80">
                  {q.kind === "Опубликовано без проверки" ? "Оставить" : "Одобрить"}
                </button>
                <button type="button" disabled className="h-9 rounded-xl border border-line px-3 text-sm font-bold opacity-80">
                  {q.kind === "Опубликовано без проверки" ? "Снять" : "Отклонить"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-sm">
        <h2 className="text-xl font-extrabold">Сравнение «было — стало» (пример)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-[#fbebeb] p-4 text-sm">
            <p className="mb-1 font-bold text-danger">Было</p>
            Небольшой салон с двумя мастерами. Работаем с 2015 года.
          </div>
          <div className="rounded-2xl bg-[#e5f4e4] p-4 text-sm">
            <p className="mb-1 font-bold text-success">Стало</p>
            Небольшой салон с тремя мастерами. Работаем с 2015 года, говорим по-русски, на иврите и английском.
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {["Карточки и импорт", "Пользователи и роли", "Справочники", "Функции и лимиты", "Настройки SEO", "Журнал действий"].map((s) => (
          <div key={s} className="rounded-2xl border border-dashed border-line bg-white p-4 font-bold text-muted">
            {s} <span className="block text-xs font-semibold">этап 3</span>
          </div>
        ))}
      </section>
    </div>
  );
}

export default function AdminPage() {
  return (
    <div className="grid gap-5">
      <h1 className="text-3xl font-extrabold">{t.admin.title}</h1>
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <AdminContent />
      </Suspense>
    </div>
  );
}
