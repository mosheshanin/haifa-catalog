"use client";

import { useEffect, useRef, useState } from "react";
import { TURNSTILE_SITE_KEY } from "@/lib/env";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
  getResponse: (id: string) => string | undefined;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Turnstile не загрузился"));
    document.head.appendChild(s);
  }).catch((e) => {
    scriptPromise = null;
    throw e;
  });
  return scriptPromise;
}

type Status = "checking" | "interactive" | "ok" | "error";

const HINTS: Record<Exclude<Status, "ok">, string> = {
  checking: "Секунду, идёт проверка «не робот»… Нажмите кнопку ещё раз через пару секунд.",
  interactive: "Отметьте галочку «Подтвердите, что вы человек» над кнопкой — и отправьте ещё раз.",
  error: "Проверка «не робот» не загрузилась. Обновите страницу и попробуйте ещё раз.",
};

// Капча Cloudflare Turnstile (раздел 2 ТЗ). Обычно проходит незаметно; если Cloudflare сомневается, над кнопкой
// появляется галочка «Подтвердите, что вы человек». Пока проверка не пройдена, форма не отправляется и под
// окошком видна подсказка. Токен попадает в форму скрытым полем cf-turnstile-response; он одноразовый, поэтому
// после каждой отправки виджет сбрасывается и получает новый. Без ключа сайта сервер проверяет только частоту.
export function Captcha() {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("checking");
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!TURNSTILE_SITE_KEY || !el) return;
    let id: string | undefined;
    let cancelled = false;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    const statusRef = { current: "checking" as Status };
    const set = (s: Status) => {
      statusRef.current = s;
      setStatus(s);
      if (s === "ok") setHint(null);
    };

    loadTurnstile()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        id = window.turnstile.render(el, {
          sitekey: TURNSTILE_SITE_KEY,
          language: "ru",
          appearance: "interaction-only",
          size: "flexible",
          callback: () => set("ok"),
          "before-interactive-callback": () => set("interactive"),
          "expired-callback": () => set("checking"),
          "timeout-callback": () => set("interactive"),
          "error-callback": () => {
            set("error");
            return true;
          },
        });
      })
      .catch(() => !cancelled && set("error"));

    // Не отпускаем форму без токена: показываем, что сделать. Слушатель на самой форме срабатывает раньше React.
    const form = el.closest("form");
    const onSubmit = (e: SubmitEvent) => {
      const token = id && window.turnstile ? window.turnstile.getResponse(id) : undefined;
      if (!token) {
        e.preventDefault();
        e.stopPropagation();
        const s = statusRef.current;
        setHint(HINTS[s === "ok" ? "checking" : s]);
        return;
      }
      // Токен одноразовый: если сервер вернёт ошибку (например, не заполнено поле), для повтора нужен новый.
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        if (id && window.turnstile) {
          window.turnstile.reset(id);
          set("checking");
        }
      }, 1500);
    };
    form?.addEventListener("submit", onSubmit, true);

    return () => {
      cancelled = true;
      clearTimeout(resetTimer);
      form?.removeEventListener("submit", onSubmit, true);
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, []);

  return (
    <>
      {TURNSTILE_SITE_KEY ? (
        <div>
          <div ref={ref} className="min-h-0 [&_iframe]:max-w-full" />
          {hint && status !== "ok" ? (
            <p role="alert" className="mt-1 text-sm font-semibold text-danger">
              {status === "interactive" ? HINTS.interactive : hint}
            </p>
          ) : null}
        </div>
      ) : null}
      {/* Ловушка для ботов: поле не видно людям */}
      <input type="text" name="website_url" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-px w-px opacity-0" />
    </>
  );
}
