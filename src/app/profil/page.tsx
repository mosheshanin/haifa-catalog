import type { Metadata } from "next";
import Link from "next/link";
import { telegramState } from "@/components/cabinet/telegram-status";
import { TELEGRAM_BOT_USERNAME } from "@/lib/env";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { LinkGoogleButton, OpenInTelegramButton } from "@/components/auth/link-accounts";
import { GoogleLogo, TelegramLogo, UserIcon } from "@/components/icons";
import { t } from "@/i18n/ru";

export const metadata: Metadata = { title: t.profile.title, robots: { index: false } };

async function ProfileContent({ searchParams }: { searchParams: PageProps<"/profil">["searchParams"] }) {
  const [user, sp] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) {
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
        <p className="font-bold">Вы не вошли.</p>
        <Link href="/vhod?next=/profil" className="mt-4 inline-flex h-11 items-center rounded-2xl bg-primary px-5 font-bold text-white">
          {t.nav.login}
        </Link>
      </div>
    );
  }

  const linked = typeof sp.linked === "string" ? sp.linked : undefined;
  const error = typeof sp.error === "string";

  return (
    <div className="grid gap-5">
      {linked ? (
        <p role="status" className="rounded-2xl bg-[#e5f4e4] p-3 font-semibold text-success">
          {linked === "google" ? "Google привязан к профилю." : "Telegram привязан к профилю."}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-2xl bg-[#fbebeb] p-3 font-semibold text-danger">
          Не удалось привязать аккаунт. Попробуйте ещё раз.
        </p>
      ) : null}

      <section className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-sm">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" className="size-16 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="grid size-16 place-items-center rounded-full bg-primary-soft text-primary">
            <UserIcon className="size-8" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-xl font-extrabold">{user.displayName}</p>
          <p className="text-sm text-muted">
            {t.profile.role}: {t.profile.roles[user.role]}
            {user.isBlocked ? " · заблокирован" : ""}
          </p>
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-extrabold">{t.profile.accounts}</h2>
        <div className="grid gap-5">
          <div className="flex flex-wrap items-start gap-3">
            <GoogleLogo className="mt-1 size-6" />
            <div className="flex-1">
              {user.hasGoogle ? (
                <p className="font-bold">
                  {t.profile.googleLinked}: <span className="font-normal">{user.googleEmail}</span>
                </p>
              ) : (
                <>
                  <p className="mb-2 font-bold">{t.profile.googleNotLinked}</p>
                  <LinkGoogleButton />
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <TelegramLogo className="mt-1 size-6" />
            <div className="flex-1">
              <p className="mb-2 font-bold">
                {user.hasTelegram
                  ? `${t.profile.telegramLinked}${user.telegramUsername ? `: @${user.telegramUsername}` : ""}`
                  : t.profile.telegramNotLinked}
              </p>
              <OpenInTelegramButton />
              {user.hasTelegram ? <BotHint userId={user.id} /> : null}
            </div>
          </div>
        </div>
      </section>

      <MyActivity userId={user.id} />

      <div className="flex flex-wrap gap-3">
        <Link href="/kabinet" className="inline-flex h-11 items-center rounded-2xl border border-line bg-white px-5 font-bold hover:border-primary">
          {t.nav.cabinet}
        </Link>
        {user.role === "admin" ? (
          <Link href="/admin" className="inline-flex h-11 items-center rounded-2xl border border-line bg-white px-5 font-bold hover:border-primary">
            {t.nav.admin}
          </Link>
        ) : null}
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="inline-flex h-11 items-center rounded-2xl px-5 font-bold text-muted hover:text-danger">
            {t.nav.logout}
          </button>
        </form>
      </div>
    </div>
  );
}

const REQ_STATUS: Record<string, string> = { new: "🕓 Отправлена", accepted: "✅ Принята", rejected: "✖ Отклонена" };
const REV_STATUS: Record<string, string> = { pending: "🕓 На проверке", approved: "✅ Опубликован", rejected: "✖ Не прошёл проверку" };

// История своих заявок и отзывов (раздел 2 ТЗ: у пользователя — история своих заявок).
async function MyActivity({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [{ data: requests }, { data: reviews }] = await Promise.all([
    supabase.from("requests").select("id, status, created_at, desired_date, desired_time, listings(title, section, slug)").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
    supabase.from("reviews").select("id, status, rating, reject_reason, created_at, listings(title, section, slug)").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
  ]);
  if (!requests?.length && !reviews?.length) return null;
  type L = { title: string; section: string; slug: string } | null;
  return (
    <section className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-sm">
      {requests?.length ? (
        <div>
          <h2 className="mb-2 text-lg font-extrabold">✍️ Мои заявки</h2>
          <ul className="grid gap-2 text-sm">
            {requests.map((r) => {
              const l = r.listings as unknown as L;
              return (
                <li key={r.id} className="flex flex-wrap gap-x-2">
                  <Link href={`/${l?.section}/${l?.slug}`} className="font-bold text-primary">{l?.title}</Link>
                  <span>{REQ_STATUS[r.status]}</span>
                  <span className="text-muted">{new Date(r.created_at).toLocaleDateString("ru-RU")}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {reviews?.length ? (
        <div>
          <h2 className="mb-2 text-lg font-extrabold">💬 Мои отзывы</h2>
          <ul className="grid gap-2 text-sm">
            {reviews.map((r) => {
              const l = r.listings as unknown as L;
              return (
                <li key={r.id} className="flex flex-wrap gap-x-2">
                  <Link href={`/${l?.section}/${l?.slug}`} className="font-bold text-primary">{l?.title}</Link>
                  <span className="text-highlight">{"★".repeat(r.rating)}</span>
                  <span>{REV_STATUS[r.status]}</span>
                  {r.status === "rejected" && r.reject_reason ? <span className="text-muted">({r.reject_reason})</span> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default function ProfilePage(props: PageProps<"/profil">) {
  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <h1 className="text-3xl font-extrabold">{t.profile.title}</h1>
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <ProfileContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

// Клиенту: что пришлёт бот и как это включить (этап 4).
async function BotHint({ userId }: { userId: string }) {
  const state = await telegramState(userId);
  return (
    <p className="mt-2 text-sm text-muted">
      {state === "ok" ? (
        <>✈️ Бот пришлёт решение владельца по вашей заявке, напоминание накануне и новые акции из избранного. </>
      ) : (
        <>
          ✈️ Нажмите «Старт» у{" "}
          <a href={`https://t.me/${TELEGRAM_BOT_USERNAME}`} target="_blank" rel="noopener noreferrer" className="font-bold text-primary">
            @{TELEGRAM_BOT_USERNAME}
          </a>
          , чтобы бот сообщал о решениях по вашим заявкам и акциях в избранном.{" "}
        </>
      )}
      <Link href="/kabinet" className="font-bold text-primary">Настроить уведомления</Link>
    </p>
  );
}
