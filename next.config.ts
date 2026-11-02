import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "kqzrnjjeyppkmqtwnspo.supabase.co";

const nextConfig: NextConfig = {
  // Кэширование страниц и данных ('use cache'). Карточки и категории отдаются готовым HTML.
  cacheComponents: true,
  // Частичная предзагрузка выключена: неизвестный адрес карточки должен честно отвечать 404,
  // а не «оболочкой» с подгрузкой (важно для поисковиков).
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Картинки предпросмотра (opengraph-image) читают шрифты и логотип с диска — включаем их в серверные функции.
  outputFileTracingIncludes: {
    "/**/opengraph-image": ["./assets/fonts/*.woff", "./public/brand/hbc-lockup.svg"],
    "/opengraph-image": ["./assets/fonts/*.woff", "./public/brand/hbc-lockup.svg"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "t.me", pathname: "/i/userpic/**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          // X-Frame-Options не ставим: Telegram Web открывает Mini App во фрейме.
        ],
      },
    ];
  },
};

export default nextConfig;
