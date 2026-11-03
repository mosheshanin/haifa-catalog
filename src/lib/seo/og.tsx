import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Картинки для предпросмотра ссылок в Telegram и соцсетях (раздел 8 ТЗ): логотип, название, подпись и фото.
// Шрифты — assets/fonts: статичные начертания Manrope 800 и Onest 500 (из Google Fonts, OFL) с кириллицей и латиницей
// в одном файле WOFF (ImageResponse не читает WOFF2; с двумя файлами-подмножествами переносы строк считались неверно).
// Эмодзи сюда не ставим: без отдельного набора картинок они рисуются квадратиками.

export const OG_SIZE = { width: 1200, height: 630 };

const font = (name: string) => readFile(join(process.cwd(), "assets/fonts", name));

async function fonts() {
  const [manrope, onest] = await Promise.all([font("manrope-800.woff"), font("onest-500.woff")]);
  return [
    { name: "Manrope", data: manrope, weight: 800 as const, style: "normal" as const },
    { name: "Onest", data: onest, weight: 500 as const, style: "normal" as const },
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

// Слова — отдельными элементами с переносом: правила переноса Unicode не разрывают строку между «»» и «(»
// («Салон «Лаванда» (пример)» уходил под фото одной строкой).
function Words({ text, style }: { text: string; style: Record<string, string | number> }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", ...style }}>
      {words.map((w, i) => (
        <span key={i} style={{ marginRight: i < words.length - 1 ? "0.27em" : 0 }}>
          {w}
        </span>
      ))}
    </div>
  );
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export async function renderOg(o: { eyebrow?: string; title: string; subtitle?: string; photo?: string | null }) {
  const [f, mark] = await Promise.all([fonts(), logo()]);
  // Неразрывные пробелы из названий мешают переносу строки в картинке.
  const title = clip(o.title.replace(/\u00a0/g, " "), 70);
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#f4f4f2", fontFamily: "Onest" }}>
        {/* Ширина колонки задана явно: иначе длинное название уходит под фото, а не переносится */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: o.photo ? 640 : 1176, padding: "56px 60px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mark} width={170} height={72} alt="" style={{ borderRadius: 14 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {o.eyebrow ? <Words text={clip(o.eyebrow, 60)} style={{ fontSize: 30, color: "#7a5600" }} /> : null}
            <Words text={title} style={{ fontFamily: "Manrope", fontSize: o.photo ? (title.length > 30 ? 48 : 58) : title.length > 40 ? 56 : 68, lineHeight: 1.08, color: "#26262b" }} />
            {o.subtitle ? <Words text={clip(o.subtitle, o.photo ? 90 : 110)} style={{ fontSize: 30, lineHeight: 1.3, color: "#55555c" }} /> : null}
          </div>
          <div style={{ fontSize: 26, color: "#55555c" }}>HaifaBusinessClub · Хайфа</div>
        </div>
        {o.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={o.photo} width={560} height={630} alt="" style={{ objectFit: "cover" }} />
        ) : (
          <div style={{ display: "flex", width: 24, background: "#facc15" }} />
        )}
      </div>
    ),
    { ...OG_SIZE, fonts: f },
  );
}
