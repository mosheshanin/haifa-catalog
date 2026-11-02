"use client";

import { useEffect, useRef } from "react";
import { TURNSTILE_SITE_KEY } from "@/lib/env";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Turnstile не загрузился"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

// Капча Cloudflare Turnstile (раздел 2 ТЗ). Пока ключ сайта не задан — ничего не показывает,
// а сервер проверяет только частоту отправки. Токен попадает в форму скрытым полем cf-turnstile-response.
export function Captcha() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !ref.current) return;
    let id: string | undefined;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        id = window.turnstile.render(ref.current, { sitekey: TURNSTILE_SITE_KEY, language: "ru", appearance: "interaction-only" });
      })
      .catch(console.error);
    return () => {
      cancelled = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, []);
  return (
    <>
      {TURNSTILE_SITE_KEY ? <div ref={ref} className="min-h-0" /> : null}
      {/* Ловушка для ботов: поле не видно людям */}
      <input type="text" name="website_url" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-px w-px opacity-0" />
    </>
  );
}
