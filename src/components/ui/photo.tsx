/* eslint-disable @next/next/no-img-element */
import { mediaSmall } from "@/lib/blocks/links";

// Фото с адаптивными размерами и отложенной загрузкой.
// Для Unsplash размер и формат подбирает их CDN. Свои фото при загрузке сохраняются в двух копиях WebP
// (640 и 1600 px, решение 5 ноября 2026): браузер сам берёт маленькую для превью и большую для крупного показа.

const WIDTHS = [320, 480, 640, 960, 1280];

function sized(src: string, w: number): string {
  if (src.startsWith("https://images.unsplash.com/")) {
    return `${src}?w=${w}&q=70&auto=format&fit=crop`;
  }
  return src;
}

export function Photo({
  src,
  alt,
  className = "",
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const responsive = src.startsWith("https://images.unsplash.com/");
  const small = mediaSmall(src);
  const srcSet = responsive ? WIDTHS.map((w) => `${sized(src, w)} ${w}w`).join(", ") : small ? `${small} 640w, ${src} 1600w` : undefined;
  return (
    <img
      src={sized(src, 960)}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={`object-cover ${className}`}
    />
  );
}
