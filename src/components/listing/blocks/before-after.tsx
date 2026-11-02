"use client";

import { useState } from "react";
import { Photo } from "@/components/ui/photo";

// Слайдер сравнения «до и после» (раздел 4 ТЗ): фото «после» открывается поверх «до» по ползунку.
// Ползунок — обычный input range, поэтому работает пальцем, мышью и с клавиатуры (стрелки).
export function BeforeAfterSlider({ beforeUrl, afterUrl, caption }: { beforeUrl?: string; afterUrl?: string; caption?: string }) {
  const [pos, setPos] = useState(50);
  if (!beforeUrl || !afterUrl) return null;
  return (
    <figure className="min-w-0">
      <div className="relative aspect-[4/3] select-none overflow-hidden rounded-2xl border border-line bg-surface-alt">
        <Photo src={beforeUrl} alt={`До: ${caption ?? ""}`} className="absolute inset-0 size-full" sizes="(max-width: 768px) 100vw, 720px" />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
          <Photo src={afterUrl} alt={`После: ${caption ?? ""}`} className="absolute inset-0 size-full" sizes="(max-width: 768px) 100vw, 720px" />
        </div>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.15)]" style={{ left: `${pos}%` }} aria-hidden>
          <span className="absolute top-1/2 left-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-sm font-extrabold text-primary shadow-md">
            ⇆
          </span>
        </div>
        <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white">До</span>
        <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white">После</span>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Сравнить фото до и после"
          className="absolute inset-0 size-full cursor-ew-resize opacity-0"
        />
      </div>
      {caption ? <figcaption className="mt-2 text-sm text-muted">{caption}</figcaption> : null}
    </figure>
  );
}
