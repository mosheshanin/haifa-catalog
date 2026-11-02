"use client";

// Доступ к SDK Telegram Mini App (telegram-web-app.js грузит MiniAppBridge только внутри Telegram).
// Все методы необязательны: старые версии Telegram их не знают, в обычном браузере SDK нет.

type BottomButton = {
  setText: (t: string) => BottomButton;
  show: () => BottomButton;
  hide: () => BottomButton;
  onClick: (cb: () => void) => BottomButton;
  offClick: (cb: () => void) => BottomButton;
  setParams?: (p: { color?: string; text_color?: string; has_shine_effect?: boolean }) => BottomButton;
};

export type TgWebApp = {
  version?: string;
  isVersionAtLeast?: (v: string) => boolean;
  MainButton?: BottomButton;
  BackButton?: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void };
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
  openTelegramLink?: (url: string) => void;
  addToHomeScreen?: () => void;
  checkHomeScreenStatus?: (cb: (status: "unsupported" | "unknown" | "added" | "missed") => void) => void;
  onEvent?: (event: string, cb: (...args: unknown[]) => void) => void;
  offEvent?: (event: string, cb: (...args: unknown[]) => void) => void;
  setBottomBarColor?: (color: string) => void;
};

export function tg(): TgWebApp | null {
  if (typeof window === "undefined") return null;
  if (document.documentElement.dataset.telegram !== "1") return null;
  return ((window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp as TgWebApp | undefined) ?? null;
}

export function supports(wa: TgWebApp, version: string): boolean {
  try {
    return Boolean(wa.isVersionAtLeast?.(version));
  } catch {
    return false;
  }
}

// Тактильный отклик (Bot API 6.1+). Вне Telegram ничего не делает.
export function haptic(kind: "light" | "success" | "error" | "select") {
  const wa = tg();
  if (!wa?.HapticFeedback || !supports(wa, "6.1")) return;
  try {
    if (kind === "light") wa.HapticFeedback.impactOccurred("light");
    else if (kind === "select") wa.HapticFeedback.selectionChanged();
    else wa.HapticFeedback.notificationOccurred(kind);
  } catch {
    // старый клиент
  }
}

// SDK готов: MiniAppBridge ставит data-telegram="1" после загрузки скрипта и шлёт событие.
export function onTelegramReady(cb: () => void): () => void {
  if (tg()) {
    cb();
    return () => {};
  }
  const handler = () => cb();
  window.addEventListener("hbc-telegram-ready", handler);
  return () => window.removeEventListener("hbc-telegram-ready", handler);
}
