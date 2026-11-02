import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Картинки для предпросмотра ссылок в Telegram и соцсетях (раздел 8 ТЗ): логотип, название, подпись и фото.
// Шрифты — WOFF с кириллицей из assets/fonts (ImageResponse не читает WOFF2). Эмодзи сюда не ставим: без
// отдельного набора картинок они рисуются квадратиками.

export const OG_SIZE = { width: 1200, height: 630 };

const font = (name: string) => readFile(join(process.cwd(), "assets/fonts", name));

async function fonts() {
  const [mc, ml, oc, ol] = await Promise.all([
    font("manrope-cyrillic-800-normal.woff"),
    font("manrope-latin-800-normal.woff"),
    font("onest-cyrillic-500-normal.woff"),
    font("onest-latin-500-normal.woff"),
  ]);
  // Подмножества шрифта — разные семейства: в стиле перечисляем оба, латиница и знаки берутся из второго.
  return [
    { name: "Manrope", data: mc, weight: 800 as const, style: "normal" as const },
    { name: "ManropeLatin", data: ml, weight: 800 as const, style: "normal" as const },
    { name: "Onest", data: oc, weight: 500 as const, style: "normal" as const },
    { name: "OnestLatin", data: ol, weight: 500 as const, style: "normal" as const },
  ];
}

async function logo(): Promise<string> {
  const svg = await readFile(join(process.cwd(), "public/brand/hbc-lockup.svg"));
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}

// Фото владельцев хранятся в WebP, а ImageResponse его не читает — перекодируем в JPEG.
export async function photoForOg(src: string | undefined | null): Promise<string | null> {
  if (!src || !/^https:\/\//.test(src)) return null;
  const url = src.startsWith("https://images.unsplash.com/") ? `${src}?w=900&q=70&fm=jpg&fit=crop` : src;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const sharp = (await import("sharp")).default;
    const jpg = await sharp(Buffer.from(await res.arrayBuffer()))
      .rotate()
      .resize({ width: 560, height: 630, fit: "cover" })
      .jpeg({ quality: 78 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpg.toString("base64")}`;
  } catch (e) {
    console.warn("OG photo:", e);
    return null;
  }
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export async function renderOg(o: { eyebrow?: string; title: string; subtitle?: string; photo?: string | null }) {
  const [f, mark] = await Promise.all([fonts(), logo()]);
  const title = clip(o.title, 70);
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#f6f6fb", fontFamily: "OnestLatin, Onest" }}>
        {/* Ширина колонки задана явно: иначе длинное название уходит под фото, а не переносится */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: o.photo ? 640 : 1176, padding: "56px 60px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mark} width={170} height={72} alt="" style={{ borderRadius: 14 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {o.eyebrow ? <div style={{ fontSize: 30, color: "#c2410c" }}>{clip(o.eyebrow, 60)}</div> : null}
            <div style={{ fontFamily: "ManropeLatin, Manrope", fontSize: o.photo ? (title.length > 30 ? 48 : 58) : title.length > 40 ? 56 : 68, lineHeight: 1.08, color: "#1e1b4b" }}>{title}</div>
            {o.subtitle ? <div style={{ fontSize: 30, lineHeight: 1.3, color: "#4b4a6b" }}>{clip(o.subtitle, o.photo ? 90 : 110)}</div> : null}
          </div>
          <div style={{ fontSize: 26, color: "#4b4a6b" }}>HaifaBusinessClub · Хайфа</div>
        </div>
        {o.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={o.photo} width={560} height={630} alt="" style={{ objectFit: "cover" }} />
        ) : (
          <div style={{ display: "flex", width: 24, background: "#1e1b4b" }} />
        )}
      </div>
    ),
    { ...OG_SIZE, fonts: f },
  );
}
