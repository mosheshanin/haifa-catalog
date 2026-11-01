"use client";

import { useState } from "react";
import { startGoogleSignIn } from "@/components/auth/sign-in-buttons";
import { GoogleLogo, TelegramLogo } from "@/components/icons";
import { t } from "@/i18n/ru";

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
  return (
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
      <p className="mt-2 text-sm text-muted">{t.profile.linkGoogleHint}</p>
      {error ? <p className="mt-1 text-sm text-danger">{t.common.error}</p> : null}
    </div>
  );
}
