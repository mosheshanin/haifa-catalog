"use client";

import { useState, type ReactNode } from "react";

// На телефоне показываем первые плитки и кнопку «Показать ещё» (решение 2 ноября 2026). Все ссылки остаются в разметке
// для поисковиков: остальные плитки скрыты только оформлением (класс у пунктов списка, см. CategoryGrid).
export function ShowMore({ children, hiddenCount }: { children: ReactNode; hiddenCount: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="group" data-open={open ? "true" : "false"}>
      {children}
      {hiddenCount > 0 && !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl border border-line bg-white px-5 font-bold text-primary hover:border-primary sm:hidden"
        >
          Показать ещё
        </button>
      ) : null}
    </div>
  );
}
