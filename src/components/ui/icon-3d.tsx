/* eslint-disable @next/next/no-img-element */
import { icon3dSrc, isIcon3d } from "@/lib/icons-3d";

// 3D-иконка из public/icons/3d. Декоративная: подпись всегда рядом текстом, поэтому alt="".
// Если имени нет в наборе — показывает запасное эмодзи (fallback), иначе ничего.
export function Icon3d({
  name,
  size,
  fallback,
  className = "",
  priority = false,
}: {
  name: string | null | undefined;
  size: number;
  fallback?: string | null;
  className?: string;
  priority?: boolean;
}) {
  if (!isIcon3d(name)) {
    return fallback ? (
      <span aria-hidden className={className} style={{ fontSize: Math.round(size * 0.8), lineHeight: 1 }}>
        {fallback}
      </span>
    ) : null;
  }
  return (
    <img
      src={icon3dSrc(name)}
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={`shrink-0 select-none object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
