/* eslint-disable @next/next/no-img-element */
// Фото с адаптивными размерами и отложенной загрузкой.
// Для Unsplash размер и формат (WebP/AVIF) подбирает их CDN, для своих фото на этапе 2
// подключим хранилище Supabase с переводом в WebP при загрузке (раздел 11 ТЗ).

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
  return (
    <img
      src={sized(src, 960)}
      srcSet={responsive ? WIDTHS.map((w) => `${sized(src, w)} ${w}w`).join(", ") : undefined}
      sizes={responsive ? sizes : undefined}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={`object-cover ${className}`}
    />
  );
}
