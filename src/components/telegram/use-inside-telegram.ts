"use client";

import { useSyncExternalStore } from "react";

export function insideTelegram(): boolean {
  try {
    return (
      sessionStorage.getItem("hbc-tg") === "1" ||
      document.documentElement.dataset.telegram === "1" ||
      window.location.hash.includes("tgWebAppData")
    );
  } catch {
    return false;
  }
}

const noopSubscribe = () => () => {};

// true, если страница открыта внутри Telegram Mini App. На сервере всегда false.
export function useInsideTelegram(): boolean {
  return useSyncExternalStore(noopSubscribe, insideTelegram, () => false);
}

// Открыть адрес во внешнем браузере устройства (из Mini App), иначе — в этой же вкладке.
export function openExternal(url: string) {
  const wa = (window as unknown as { Telegram?: { WebApp?: { openLink?: (u: string) => void } } }).Telegram?.WebApp;
  if (wa?.openLink) {
    wa.openLink(url);
  } else {
    window.location.href = url;
  }
}
