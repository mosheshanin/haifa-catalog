"use client";

import { useEffect, useRef } from "react";

// Фильтры применяются сразу (просьба заказчика 5 ноября 2026): любое изменение галочки или списка в форме
// отправляет её — страница обновляет результаты без кнопки «Показать». Кнопка остаётся для браузеров без JavaScript.
// Несколько быстрых нажатий подряд склеиваются в одну отправку.
export function AutoSubmit() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = (e: Event) => {
      const el = e.target as HTMLElement;
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return;
      clearTimeout(timer);
      timer = setTimeout(() => form.requestSubmit(), el instanceof HTMLSelectElement ? 0 : 350);
    };
    form.addEventListener("change", onChange);
    return () => {
      clearTimeout(timer);
      form.removeEventListener("change", onChange);
    };
  }, []);
  return <span ref={ref} hidden />;
}
