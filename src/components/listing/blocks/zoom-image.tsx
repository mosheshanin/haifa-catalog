"use client";

import { useEffect, useRef, useState } from "react";
import { Photo } from "@/components/ui/photo";

// Фото, которое открывается крупно по нажатию (галерея, сертификаты, портфолио, меню, новости).
// Просмотр — на весь экран: фото вписывается целиком (object-contain в рамке, которая занимает всё место под шапкой),
// поэтому ни высокое, ни широкое фото не обрезается. Если передан group — листание стрелками, клавишами ← → и свайпом.

type Item = { src: string; alt: string };

const full = (src: string) => (src.startsWith("https://images.unsplash.com/") ? `${src}?w=1600&q=80&auto=format` : src);

export function ZoomImage({
  src,
  alt,
  className = "aspect-[4/3] w-full",
  sizes = "(max-width: 640px) 50vw, 33vw",
  group,
  index = 0,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  group?: Item[];
  index?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const items = group?.length ? group : [{ src, alt }];
  const [current, setCurrent] = useState(index);
  const touchX = useRef<number | null>(null);
  const item = items[Math.min(current, items.length - 1)];
  const many = items.length > 1;
  const go = (d: number) => setCurrent((c) => (c + d + items.length) % items.length);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !many) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setCurrent((c) => (c + 1) % items.length);
      if (e.key === "ArrowLeft") setCurrent((c) => (c - 1 + items.length) % items.length);
    };
    dialog.addEventListener("keydown", onKey);
    return () => dialog.removeEventListener("keydown", onKey);
  }, [many, items.length]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setCurrent(index);
          ref.current?.showModal();
        }}
        className="group relative block w-full cursor-zoom-in overflow-hidden"
        aria-label={`Открыть крупно: ${alt}`}
      >
        <Photo src={src} alt={alt} className={className} sizes={sizes} />
        <span className="absolute right-2 bottom-2 whitespace-nowrap rounded-full bg-black/55 px-2 py-0.5 text-xs font-bold text-white opacity-90" aria-hidden>
          🔍
        </span>
      </button>
      <dialog
        ref={ref}
        aria-label={item.alt}
        onClick={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.close === "1") ref.current?.close();
        }}
        className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none border-0 bg-black/90 p-0 text-white backdrop:bg-black/60 open:flex open:flex-col"
      >
        <div className="flex shrink-0 items-center gap-3 px-3 pt-[env(safe-area-inset-top)]">
          <p className="min-w-0 flex-1 truncate py-3 text-sm font-bold">
            {item.alt}
            {many ? <span className="ml-2 font-normal text-white/70">{current + 1} / {items.length}</span> : null}
          </p>
          <button type="button" onClick={() => ref.current?.close()} className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-xl hover:bg-white/20" aria-label="Закрыть">
            ✕
          </button>
        </div>
        {/* Рамка занимает всё оставшееся место; фото вписывается в неё целиком. Нажатие мимо фото закрывает просмотр. */}
        <div
          data-close="1"
          className="relative flex min-h-0 flex-1 items-center justify-center p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (!many || touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={item.src} src={full(item.src)} alt={item.alt} className="block max-h-full max-w-full object-contain" />
          {many ? (
            <>
              <button type="button" onClick={() => go(-1)} className="absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-xl hover:bg-black/70" aria-label="Предыдущее фото">
                ‹
              </button>
              <button type="button" onClick={() => go(1)} className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-xl hover:bg-black/70" aria-label="Следующее фото">
                ›
              </button>
            </>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
