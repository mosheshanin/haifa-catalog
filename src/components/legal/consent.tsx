"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GA_MEASUREMENT_ID, YM_COUNTER_ID } from "@/lib/env";

// Баннер cookie и Google Analytics 4 (раздел 9 ТЗ): GA загружается только после «Разрешить»; обязательные cookie
// (вход, защита форм) согласия не требуют. Выбор хранится в браузере; «Настройки cookie» в подвале открывают баннер снова.
// Пока GA_MEASUREMENT_ID пуст, баннер сам не появляется, а «Настройки cookie» сообщают, что аналитики нет.
// Яндекс Метрика (7 ноября 2026) — по тем же правилам: код счётчика заказчика, но загружается только после «Разрешить».

const ANALYTICS = Boolean(GA_MEASUREMENT_ID || YM_COUNTER_ID);

const KEY = "hbc-consent";
const OPEN_EVENT = "hbc-consent-open";
type Choice = "granted" | "denied";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    ym?: ((...args: unknown[]) => void) & { a?: unknown[]; l?: number };
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

// Код счётчика заказчика (7 ноября 2026), без изменений настроек; вставляется из браузера после согласия.
let ymLoaded = false; // согласие есть: шлём хиты и цели
let ymInited = false; // счётчик уже создан на этой странице (повторно не создаём)
function loadYm() {
  if (!YM_COUNTER_ID) return;
  ymLoaded = true;
  if (ymInited) return;
  ymInited = true;
  const src = `https://mc.yandex.ru/metrika/tag.js?id=${YM_COUNTER_ID}`;
  const w = window;
  w.ym =
    w.ym ||
    Object.assign(
      function ym() {
        // eslint-disable-next-line prefer-rest-params -- так требует tag.js
        (w.ym!.a = w.ym!.a || []).push(arguments);
      },
      { l: Date.now() },
    );
  if (![...document.scripts].some((x) => x.src === src)) {
    const k = document.createElement("script");
    k.async = true;
    k.src = src;
    document.head.appendChild(k);
  }
  w.ym(YM_COUNTER_ID, "init", {
    ssr: true,
    webvisor: true,
    clickmap: true,
    referrer: document.referrer,
    url: location.href,
    accurateTrackBounce: true,
    trackLinks: true,
  });
}

function loadAnalytics() {
  loadGa();
  loadYm();
}

function revokeAnalytics() {
  revokeGa();
  // Метрику уже загруженную со страницы не выгрузить: перестаём слать ей события и удаляем её cookie и записи.
  ymLoaded = false;
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0].trim();
    if (name.startsWith("_ym")) {
      document.cookie = `${name}=; Max-Age=0; path=/`;
      document.cookie = `${name}=; Max-Age=0; path=/; domain=.${location.hostname}`;
    }
  }
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("_ym")) localStorage.removeItem(k);
  } catch {
    // нет хранилища — нечего чистить
  }
}

// Цель Яндекс Метрики (идентификатор цели «JavaScript-событие»). Без согласия ничего не делает.
// Согласие уже дано раньше, а баннер ещё не успел загрузить счётчик (эффекты страницы идут раньше) — загружаем сами,
// чтобы «init» встал в очередь до цели.
export function ymGoal(name: string, params?: Record<string, string | number | undefined>) {
  if (typeof window === "undefined" || !YM_COUNTER_ID) return;
  if (!ymLoaded && readChoice() === "granted") loadYm();
  if (ymLoaded) window.ym?.(YM_COUNTER_ID, "reachGoal", name, params);
}

// Переходы внутри сайта без перезагрузки страницы (Next.js): Метрике нужен отдельный «хит» на каждый адрес.
// Первый просмотр считает сама инициализация. Рендерить внутри <Suspense> (useSearchParams).
// Заодно в кабинете, админке и профиле содержимое страницы скрыто от записи Вебвизора (класс ym-hide-content).
export function AnalyticsRouteHits() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const prev = useRef<string | null>(null);
  // Цель «add_click» — нажатие любой кнопки «Добавить бизнес или специалиста» (ссылки на /kabinet/novaya), 7 ноября 2026.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (a && a.origin === location.origin && a.pathname === "/kabinet/novaya") ymGoal("add_click");
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  useEffect(() => {
    const url = location.href;
    const main = document.getElementById("main");
    main?.classList.toggle("ym-hide-content", /^\/(kabinet|admin|profil)(\/|$)/.test(pathname));
    if (prev.current !== null && prev.current !== url && ymLoaded && YM_COUNTER_ID) {
      window.ym?.(YM_COUNTER_ID, "hit", url, { referer: prev.current, title: document.title });
    }
    prev.current = url;
  }, [pathname, search]);
  return null;
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
    if (v === "granted") loadAnalytics();
    else if (!v && ANALYTICS) setOpen(true);
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  if (!open) return null;

  const decide = (v: Choice) => {
    saveChoice(v);
    setChoice(v);
    setOpen(false);
    if (v === "granted") loadAnalytics();
    else revokeAnalytics();
  };

  return (
    <div role="dialog" aria-live="polite" aria-label="Настройки cookie" className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-lg">
        {ANALYTICS ? (
          <>
            <p className="text-sm leading-relaxed">
              🍪 Мы используем обязательные cookie для входа и защиты форм. С вашего разрешения подключим Google Analytics и Яндекс
              Метрику, чтобы понимать, какие разделы полезны и где посетителям неудобно. <Link href="/politika#cookie" className="font-semibold text-primary underline">Подробнее</Link>
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
