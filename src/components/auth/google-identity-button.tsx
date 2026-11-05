"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { GOOGLE_CLIENT_ID } from "@/lib/env";
import { t } from "@/i18n/ru";

/**
 * Кнопка Google Identity Services: окно выбора аккаунта открывается с нашего адреса, поэтому Google пишет
 * «haifa.business», а не адрес Supabase. Google отдаёт подписанный токен, мы отправляем его на /auth/google,
 * там Supabase создаёт сессию. Кнопку рисует сам Google (так требуют его правила), мы задаём размер и вид.
 * Нет Client ID или скрипт Google не загрузился — показываем `fallback` (прежний вход через Supabase).
 */

type GisCredential = { credential: string };
type GisId = {
  initialize(cfg: {
    client_id: string;
    callback: (r: GisCredential) => void;
    nonce: string;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: "signin" | "signup" | "use";
    ux_mode?: "popup" | "redirect";
    itp_support?: boolean;
  }): void;
  renderButton(el: HTMLElement, opts: Record<string, string | number>): void;
  disableAutoSelect(): void;
};
declare global {
  interface Window {
    google?: { accounts?: { id?: GisId } };
  }
}

let gisPromise: Promise<GisId> | null = null;
function loadGis(): Promise<GisId> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  gisPromise ??= new Promise<GisId>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("gis")));
    s.onerror = () => reject(new Error("gis"));
    document.head.appendChild(s);
  }).catch((e) => {
    gisPromise = null;
    throw e;
  });
  return gisPromise;
}

// Одноразовое число: Google кладёт в токен его SHA-256, Supabase сверяет с исходным.
async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return { raw, hashed };
}

export function GoogleIdentityButton({
  next,
  text = "signin_with",
  beforeSubmit,
  fallback,
}: {
  next: string;
  text?: "signin_with" | "continue_with";
  /** Вызывается перед отправкой токена (например, поставить cookie «Привязать Google»). */
  beforeSubmit?: () => Promise<void>;
  fallback: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const nonceRef = useRef<string>("");
  const [state, setState] = useState<"loading" | "ready" | "busy" | "failed">(GOOGLE_CLIENT_ID ? "loading" : "failed");
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const beforeRef = useRef(beforeSubmit);
  useEffect(() => {
    beforeRef.current = beforeSubmit;
  }, [beforeSubmit]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let active = true;
    // Скрипт Google может быть заблокирован (расширения, сети) — тогда через 8 с показываем прежнюю кнопку.
    const timer = setTimeout(() => active && setState((s) => (s === "loading" ? "failed" : s)), 8000);

    (async () => {
      try {
        const [gis, nonce] = await Promise.all([loadGis(), makeNonce()]);
        if (!active || !ref.current) return;
        nonceRef.current = nonce.raw;
        gis.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: nonce.hashed,
          context: "signin",
          ux_mode: "popup",
          auto_select: false,
          itp_support: true,
          callback: async ({ credential }) => {
            setState("busy");
            setError(false);
            try {
              await beforeRef.current?.();
              const res = await fetch("/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential, nonce: nonceRef.current, next }),
              });
              const json = (await res.json().catch(() => null)) as { ok?: boolean; redirect?: string } | null;
              if (!res.ok || !json?.ok || !json.redirect) throw new Error("google sign-in");
              // Полная загрузка: шапка и кабинет читают новую сессию из cookie.
              window.location.assign(json.redirect);
            } catch {
              setError(true);
              setState("ready");
              setAttempt((a) => a + 1); // новое одноразовое число для следующей попытки
            }
          },
        });
        const width = Math.max(200, Math.min(400, Math.floor(ref.current.clientWidth || 320)));
        ref.current.innerHTML = "";
        gis.renderButton(ref.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text,
          logo_alignment: "center",
          locale: "ru",
          width,
        });
        setState("ready");
      } catch {
        if (active) setState("failed");
      }
    })();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [next, text, attempt]);

  if (state === "failed") return <>{fallback}</>;

  return (
    <div>
      <div className="relative">
        {/* Место под кнопку Google (44 px), чтобы страница не прыгала, пока она загружается. */}
        <div ref={ref} className={`flex min-h-11 w-full justify-center ${state === "busy" ? "pointer-events-none opacity-50" : ""}`} />
        {state === "loading" ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">{t.common.loading}</p>
        ) : null}
      </div>
      {state === "busy" ? <p className="mt-2 text-center text-sm text-muted">{t.common.loading}</p> : null}
      {error ? <p className="mt-2 text-sm text-danger">{t.auth.error}</p> : null}
    </div>
  );
}
