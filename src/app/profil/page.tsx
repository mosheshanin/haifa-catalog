import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
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
            </div>
          </div>
        </div>
      </section>

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
