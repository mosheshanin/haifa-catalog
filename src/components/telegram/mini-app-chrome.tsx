"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { haptic, onTelegramReady, supports, tg } from "@/components/telegram/webapp";

// Кнопка «Назад» Telegram (раздел 7): видна везде, кроме главной; ведёт на предыдущую страницу.
export function TelegramBackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => onTelegramReady(() => setReady(true)), []);

  useEffect(() => {
    const wa = tg();
    if (!ready || !wa?.BackButton || !supports(wa, "6.1")) return;
    const back = () => {
      haptic("select");
      if (window.history.length > 1) router.back();
      else router.push("/");
    };
    if (pathname === "/") {
      wa.BackButton.hide();
      return;
    }
    wa.BackButton.onClick(back);
    wa.BackButton.show();
    return () => wa.BackButton?.offClick(back);
  }, [ready, pathname, router]);

  return null;
}

// Нижняя кнопка Telegram «Оставить заявку» на карточке. Прячется, когда форма заявки уже на экране.
export function TelegramRequestButton({ targetId = "request" }: { targetId?: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => onTelegramReady(() => setReady(true)), []);

  useEffect(() => {
    const wa = tg();
    const mb = wa?.MainButton;
    const target = document.getElementById(targetId);
    if (!ready || !mb || !target) return;
    const go = () => {
      haptic("light");
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => target.querySelector<HTMLInputElement>("input:not([type=hidden]), textarea")?.focus({ preventScroll: true }), 500);
    };
    mb.setText("✍️ Оставить заявку");
    mb.setParams?.({ color: "#c2410c", text_color: "#ffffff" }); // --color-accent
    mb.onClick(go);
    mb.show(); // наблюдатель ниже спрячет кнопку, если форма уже на экране
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? mb.hide() : mb.show()), { threshold: 0.15 });
    io.observe(target);
    return () => {
      io.disconnect();
      mb.offClick(go);
      mb.hide();
    };
  }, [ready, targetId]);

  return null;
}

// «Добавить на главный экран» (Bot API 8.0): кнопка видна только в Telegram, если ярлыка ещё нет.
export function AddToHomeScreenButton() {
  const [show, setShow] = useState(false);
  useEffect(
    () =>
      onTelegramReady(() => {
        const wa = tg();
        if (!wa?.addToHomeScreen || !wa.checkHomeScreenStatus || !supports(wa, "8.0")) return;
        wa.checkHomeScreenStatus((status) => setShow(status === "missed" || status === "unknown"));
        const added = () => setShow(false);
        wa.onEvent?.("homeScreenAdded", added);
      }),
    [],
  );
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => {
        haptic("light");
        tg()?.addToHomeScreen?.();
      }}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-line bg-white px-4 text-sm font-bold text-ink hover:border-primary"
    >
      📌 Добавить каталог на главный экран
    </button>
  );
}
