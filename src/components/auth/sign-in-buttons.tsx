"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GoogleLogo, TelegramLogo } from "@/components/icons";
import { useInsideTelegram } from "@/components/telegram/use-inside-telegram";
import { t } from "@/i18n/ru";

export async function startGoogleSignIn(next: string) {
  const supabase = createClient();
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, queryParams: { prompt: "select_account" } },
  });
  if (error) throw error;
}

export function GoogleSignInButton({ next, label = t.auth.google }: { next: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inTelegram = useInsideTelegram();

  // Google запрещает вход во встроенных окнах приложений, поэтому внутри Telegram кнопку не показываем.
  if (inTelegram) return null;

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await startGoogleSignIn(next);
          } catch {
            setError(t.auth.error);
            setBusy(false);
          }
        }}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-line bg-white px-4 font-bold text-ink shadow-sm hover:border-primary disabled:opacity-60"
      >
        <GoogleLogo />
        {busy ? t.common.loading : label}
      </button>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

/**
 * Официальный виджет «Войти через Telegram». Telegram возвращает человека на
 * /api/auth/telegram/widget с подписанными данными. Требует, чтобы домен сайта был указан
 * у бота в @BotFather (/setdomain).
 */
export function TelegramSignInWidget({ botUsername, next }: { botUsername: string; next: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inTelegram = useInsideTelegram();

  useEffect(() => {
    if (inTelegram) return;
    const container = ref.current;
    if (!container) return;
    container.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "16");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-lang", "ru");
    script.setAttribute(
      "data-auth-url",
      `${window.location.origin}/api/auth/telegram/widget?next=${encodeURIComponent(next)}`,
    );
    container.appendChild(script);
  }, [botUsername, next, inTelegram]);

  if (inTelegram) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-primary-soft p-4 text-sm font-semibold text-primary">
        <TelegramLogo /> {t.auth.telegramSigningIn}
      </p>
    );
  }

  return (
    <div>
      <div ref={ref} className="flex min-h-12 justify-center" />
      <p className="mt-2 text-center text-xs text-muted">{t.auth.telegramHint}</p>
    </div>
  );
}
