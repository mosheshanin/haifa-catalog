import type { Metadata } from "next";
import { Suspense } from "react";
import { GoogleSignInButton, TelegramSignInWidget } from "@/components/auth/sign-in-buttons";
import { safeNext } from "@/lib/auth/current-user";
import { TELEGRAM_BOT_USERNAME } from "@/lib/env";
import { t } from "@/i18n/ru";

export const metadata: Metadata = { title: t.auth.title, robots: { index: false } };

async function SignInOptions({ searchParams }: { searchParams: PageProps<"/vhod">["searchParams"] }) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : undefined);
  const error = typeof sp.error === "string" ? sp.error : undefined;

  return (
    <div className="grid gap-4">
      {error ? (
        <p role="alert" className="rounded-2xl bg-[#fbebeb] p-3 text-sm font-semibold text-danger">
          {t.auth.error}
        </p>
      ) : null}
      <GoogleSignInButton next={next} />
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted">
        <span className="h-px flex-1 bg-line" /> или <span className="h-px flex-1 bg-line" />
      </div>
      <TelegramSignInWidget botUsername={TELEGRAM_BOT_USERNAME} next={next} />
    </div>
  );
}

export default function SignInPage(props: PageProps<"/vhod">) {
  return (
    <div className="mx-auto max-w-md rounded-[2rem] border border-line bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-extrabold">{t.auth.title}</h1>
      <p className="mt-2 text-muted">{t.auth.lead}</p>
      <div className="mt-6">
        <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
          <SignInOptions searchParams={props.searchParams} />
        </Suspense>
      </div>
      <p className="mt-6 text-xs text-muted">{t.auth.consent}</p>
    </div>
  );
}
