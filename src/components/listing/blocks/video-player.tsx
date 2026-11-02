"use client";

import { useState } from "react";
import type { VideoItem } from "@/lib/blocks/types";

// Видео без автозапуска (раздел 4 ТЗ): до нажатия показывается только обложка, плеер YouTube (режим без cookie)
// или Vimeo (без отслеживания) загружается по нажатию — поэтому не нужно согласие на cookie.
function embedUrl(v: VideoItem): string {
  return v.provider === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.videoId)}?autoplay=1&rel=0&hl=ru`
    : `https://player.vimeo.com/video/${encodeURIComponent(v.videoId)}?autoplay=1&dnt=1`;
}

function thumbUrl(v: VideoItem, vimeoThumbs: Record<string, string>): string | undefined {
  return v.provider === "youtube" ? `https://i.ytimg.com/vi/${encodeURIComponent(v.videoId)}/hqdefault.jpg` : vimeoThumbs[v.videoId];
}

function Player({ video, thumb }: { video: VideoItem; thumb?: string }) {
  const [playing, setPlaying] = useState(false);
  const label = video.title ?? "Видео";
  return (
    <figure className="min-w-0">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-ink/90">
        {playing ? (
          <iframe
            src={embedUrl(video)}
            title={label}
            className="absolute inset-0 size-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 grid place-items-center"
            aria-label={`Смотреть: ${label}`}
          >
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover opacity-90" />
            ) : (
              <span className="absolute inset-0 bg-gradient-to-br from-primary to-[#2aa5a0]" aria-hidden />
            )}
            <span className="relative grid size-16 place-items-center rounded-full bg-white/95 text-2xl text-primary shadow-lg transition group-hover:scale-110">
              ▶
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-2 text-sm text-muted">
        {video.provider === "youtube" ? "▶️ YouTube" : "🎬 Vimeo"}
        {video.title ? ` · ${video.title}` : ""}
      </figcaption>
    </figure>
  );
}

export function VideoList({ items, vimeoThumbs = {} }: { items: VideoItem[]; vimeoThumbs?: Record<string, string> }) {
  return (
    <div className={`grid gap-4 ${items.length > 1 ? "sm:grid-cols-2" : ""}`}>
      {items.map((v) => (
        <Player key={`${v.provider}-${v.videoId}`} video={v} thumb={thumbUrl(v, vimeoThumbs)} />
      ))}
    </div>
  );
}
