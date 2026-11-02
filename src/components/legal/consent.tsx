"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GA_MEASUREMENT_ID } from "@/lib/env";

// Баннер cookie и Google Analytics 4 (раздел 9 ТЗ): GA загружается только после «Разрешить»; обязательные cookie
// (вход, защита форм) согласия не требуют. Выбор хранится в браузере; «Настройки cookie» в подвале открывают баннер снова.
// Пока GA_MEASUREMENT_ID пуст, баннер сам не появляется, а «Настройки cookie» сообщают, что аналитики нет.

const KEY = "hbc-consent";
const OPEN_EVENT = "hbc-consent-open";
type Choice = "granted" | "denied";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function readChoice(): Choice | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as { v?: Choice } | null;
    return v?.v === "granted" || v?.v === "denied" ? v.v : null;
  } catch {
    return null;
  }
}

function saveChoice(v: Choice) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v, at: new Date().toISOString() }));
  } catch {
    // Браузер без хранилища: спросим снова в следующий раз.
  }
}

let loaded = false;
function loadGa() {
  if (loaded || !GA_MEASUREMENT_ID) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params -- так требует gtag.js
    window.dataLayer!.push(arguments);
  };
  window.gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, { allow_google_signals: false });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  document.head.appendChild(s);
}

function revokeGa() {
  window.gtag?.("consent", "update", { analytics_storage: "denied" });
  // Удаляем cookie Google Analytics (_ga, _ga_XXXX) на этом домене.
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0].trim();
    if (name.startsWith("_ga")) {
      document.cookie = `${name}=; Max-Age=0; path=/`;
      document.cookie = `${name}=; Max-Age=0; path=/; domain=.${location.hostname}`;
    }
  }
}

// Событие для Google Analytics (заявка, звонок, поиск). Без согласия ничего не делает.
export function gaEvent(name: string, params: Record<string, string | number | undefined> = {}) {
  if (typeof window !== "undefined" && loaded) window.gtag?.("event", name, params);
}

export function ConsentBanner() {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    const v = readChoice();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- выбор хранится только в браузере
    setChoice(v);
    if (v === "granted") loadGa();
    else if (!v && GA_MEASUREMENT_ID) setOpen(true);
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  if (!open) return null;

  const decide = (v: Choice) => {
    saveChoice(v);
    setChoice(v);
    setOpen(false);
    if (v === "granted") loadGa();
    else revokeGa();
  };

  return (
    <div role="dialog" aria-live="polite" aria-label="Настройки cookie" className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-lg">
        {GA_MEASUREMENT_ID ? (
          <>
            <p className="text-sm leading-relaxed">
              🍪 Мы используем обязательные cookie для входа и защиты форм. С вашего разрешения подключим Google Analytics, чтобы
              понимать, какие разделы полезны. <Link href="/politika#cookie" className="font-semibold text-primary underline">Подробнее</Link>
              {choice ? <span className="text-muted"> Сейчас: {choice === "granted" ? "аналитика разрешена" : "только обязательные"}.</span> : null}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => decide("granted")} className="min-h-11 flex-1 rounded-2xl bg-primary px-4 font-bold text-white hover:bg-primary-hover sm:flex-none">
                Разрешить
              </button>
              <button type="button" onClick={() => decide("denied")} className="min-h-11 flex-1 rounded-2xl border border-line bg-white px-4 font-bold hover:border-primary sm:flex-none">
                Только обязательные
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed">
              🍪 Сейчас сайт использует только обязательные cookie — для входа и защиты форм. Аналитика не подключена.{" "}
              <Link href="/politika#cookie" className="font-semibold text-primary underline">Подробнее</Link>
            </p>
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 w-fit rounded-2xl border border-line bg-white px-4 font-bold hover:border-primary">
              Понятно
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function CookieSettingsLink({ className = "font-semibold text-primary underline", label = "настройки cookie" }: { className?: string; label?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} className={className}>
      {label}
    </button>
  );
}
