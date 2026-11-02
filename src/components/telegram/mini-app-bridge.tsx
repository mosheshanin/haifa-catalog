"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type TelegramWebApp = {
  initData: string;
  initDataUnsafe?: { start_param?: string };
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  // Bot API 7.7+: не закрывать приложение свайпом вниз (нужно, пока пользователь двигает карту)
  disableVerticalSwipes?: () => void;
  enableVerticalSwipes?: () => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const SCRIPT_SRC = "https://telegram.org/js/telegram-web-app.js";

function launchedInTelegram(): boolean {
  try {
    return (
      window.location.hash.includes("tgWebAppData") ||
      sessionStorage.getItem("__telegram__initParams") !== null ||
      sessionStorage.getItem("hbc-tg") === "1"
    );
  } catch {
    return false;
  }
}

function loadScript(): Promise<void> {
  if (window.Telegram?.WebApp) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("telegram-web-app.js не загрузился"));
    document.head.appendChild(s);
  });
}

/**
 * Страницы сайта определяют, что открыты внутри Telegram, подключают SDK Mini App
 * и автоматически входят по аккаунту Telegram (раздел 7 ТЗ). В обычном браузере ничего не делает
 * и ничего не загружает.
 */
export function MiniAppBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!launchedInTelegram()) return;
    let cancelled = false;

    (async () => {
      try {
        sessionStorage.setItem("hbc-tg", "1");
        await loadScript();
        const wa = window.Telegram?.WebApp;
        if (!wa || cancelled) return;
        wa.ready();
        wa.expand();
        wa.setHeaderColor?.("#ffffff");
        wa.setBackgroundColor?.("#f4fbfb");
        wa.setBottomBarColor?.("#ffffff");
        document.documentElement.dataset.telegram = "1";
        // Кнопки Telegram («Назад», «Оставить заявку», ярлык) ждут этого события.
        window.dispatchEvent(new Event("hbc-telegram-ready"));

        // Ссылка «Открыть в Telegram» с карточки: t.me/<бот>?startapp=b_<slug> (бизнес) или s_<slug> (специалист).
        // Mini App открывается на главной — переходим на карточку один раз за сессию.
        const start = wa.initDataUnsafe?.start_param ?? "";
        if (/^[bs]_[a-z0-9-]{1,120}$/.test(start) && sessionStorage.getItem("hbc-tg-start") !== start) {
          sessionStorage.setItem("hbc-tg-start", start);
          if (window.location.pathname === "/") {
            router.replace(`/${start[0] === "b" ? "biznes" : "specialisty"}/${start.slice(2)}`);
          }
        }

        if (!wa.initData || sessionStorage.getItem("hbc-tg-auth") === "1") return;
        const res = await fetch("/api/auth/telegram/miniapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: wa.initData }),
        });
        if (res.ok && !cancelled) {
          sessionStorage.setItem("hbc-tg-auth", "1");
          const body = (await res.json()) as { linked?: boolean };
          if (body.linked) {
            router.push("/profil?linked=telegram");
          } else {
            router.refresh();
          }
          window.dispatchEvent(new Event("hbc-auth-changed"));
        }
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
