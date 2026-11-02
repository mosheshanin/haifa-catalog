"use client";

import { useRef } from "react";
import { Photo } from "@/components/ui/photo";

// Фото, которое открывается крупно по нажатию (сертификаты, портфолио, меню).
export function ZoomImage({
  src,
  alt,
  className = "aspect-[4/3] w-full",
  sizes = "(max-width: 640px) 50vw, 33vw",
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="group relative block w-full cursor-zoom-in overflow-hidden"
        aria-label={`Открыть крупно: ${alt}`}
      >
        <Photo src={src} alt={alt} className={className} sizes={sizes} />
        <span className="absolute right-2 bottom-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-bold text-white opacity-90" aria-hidden>
          🔍
        </span>
      </button>
      <dialog
        ref={ref}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="m-auto max-h-[92dvh] w-[min(92vw,960px)] overflow-hidden rounded-2xl bg-white p-0 backdrop:bg-black/70"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
          <p className="min-w-0 truncate text-sm font-bold">{alt}</p>
          <button type="button" onClick={() => ref.current?.close()} className="grid size-11 shrink-0 place-items-center rounded-full text-xl hover:bg-surface-alt" aria-label="Закрыть">
            ✕
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src.startsWith("https://images.unsplash.com/") ? `${src}?w=1600&q=80&auto=format` : src}
          alt={alt}
          loading="lazy"
          className="max-h-[calc(92dvh-3.5rem)] w-full object-contain"
        />
      </dialog>
    </>
  );
}
