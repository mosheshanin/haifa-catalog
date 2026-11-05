"use client";

import { useState } from "react";
import { startGoogleSignIn } from "@/components/auth/sign-in-buttons";
import { GoogleIdentityButton } from "@/components/auth/google-identity-button";
import { GoogleLogo, TelegramLogo } from "@/components/icons";
import { t } from "@/i18n/ru";
import { openExternal, useInsideTelegram } from "@/components/telegram/use-inside-telegram";

async function requestLink(target: "telegram" | "google") {
  const res = await fetch("/api/auth/link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target }),
  });
  if (!res.ok) throw new Error("link failed");
  return (await res.json()) as { ok: boolean; url?: string };
}

export function OpenInTelegramButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const inTelegram = useInsideTelegram();

  // Внутри Telegram ссылка на Telegram не нужна (и встроенное окно на ней зависает).
  if (inTelegram) {
    return <p className="text-sm text-muted">Вы сейчас в приложении каталога в Telegram.</p>;
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(false);
          try {
            const { url } = await requestLink("telegram");
            if (url) window.location.href = url;
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#29A9EB] px-4 font-bold text-white hover:brightness-95 disabled:opacity-60"
      >
        <TelegramLogo className="size-5" />
        {busy ? t.common.loading : t.profile.openInTelegram}
      </button>
      <p className="mt-2 text-sm text-muted">{t.profile.openInTelegramHint}</p>
      {error ? <p className="mt-1 text-sm text-danger">{t.common.error}</p> : null}
    </div>
  );
}

export function LinkGoogleButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const inTelegram = useInsideTelegram();

  // Google запрещает вход во встроенных окнах, поэтому из Telegram отправляем в обычный браузер.
  if (inTelegram) {
    return (
      <div>
        <button
          type="button"
          onClick={() => openExternal(`${window.location.origin}/profil`)}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-line bg-white px-4 font-bold hover:border-primary"
        >
          Открыть сайт в браузере
        </button>
        <p className="mt-2 text-sm text-muted">
          Google не разрешает вход внутри Telegram. В браузере войдите через Google и на странице профиля нажмите «
          {t.profile.openInTelegram}» — оба способа входа будут вести в один профиль.
        </p>
      </div>
    );
  }

  // Окно Google с нашего адреса; перед отправкой токена ставим cookie привязки. Прежняя кнопка — запасная.
  const fallback = (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(false);
          try {
            await requestLink("google");
            await startGoogleSignIn("/profil?linked=google");
          } catch {
            setError(true);
            setBusy(false);
          }
        }}
        className="inline-flex h-11 items-center gap-2 rounded-2xl border border-line bg-white px-4 font-bold hover:border-primary disabled:opacity-60"
      >
        <GoogleLogo />
        {busy ? t.common.loading : t.profile.linkGoogle}
      </button>
      {error ? <p className="mt-1 text-sm text-danger">{t.common.error}</p> : null}
    </div>
  );

  return (
    <div className="max-w-sm">
      <GoogleIdentityButton
        next="/profil?linked=google"
        text="continue_with"
        beforeSubmit={async () => {
          await requestLink("google");
        }}
        fallback={fallback}
      />
      <p className="mt-2 text-sm text-muted">{t.profile.linkGoogleHint}</p>
    </div>
  );
}
