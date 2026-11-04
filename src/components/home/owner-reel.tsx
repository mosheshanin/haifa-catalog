"use client";

// «Монтаж» в блоке для владельцев (4 ноября 2026): пять кадров сменяют друг друга шторками (снизу, кругом из центра,
// справа, кругом из угла, сверху), строки выезжают по словам, фигуры вырастают — как в заставке на странице cell-tec,
// но строго внутри карточки (сцена — обычный блок с overflow-hidden, не fixed).
//
// Как устроено:
// - Новый кадр рисуется поверх предыдущего и «открывается» шторкой (clip-path); предыдущий лежит под ним готовым
//   (класс reel-done: входные анимации мгновенно в конечном состоянии, бесконечные — фигуры — продолжают идти).
// - Время кадра — CSS-анимация полоски внизу (--reel-hold в globals.css); когда она закончилась (onAnimationEnd),
//   включается следующий кадр. Поэтому пауза и возобновление ровно продолжают отсчёт, таймеров в JS нет.
// - Идёт по кругу, пока сцена видна на экране (хотя бы на 20%); стоит на месте, если вкладка скрыта. Кнопки паузы нет
//   (заказчик убрал её 4 ноября 2026). Скорость задаёт --reel-speed в globals.css (с 4 ноября 2026 в 1,2 раза быстрее).
// - Логотипы (4 ноября 2026, по просьбе заказчика): в кадрах «из поисковых систем», «из соцсетей» и «из ответов нейросетей»
//   под строками — ряд белых круглых значков, которые по очереди выскакивают после слов. Файлы — public/brand/logos/*.svg
//   (цветные знаки из открытых наборов Simple Icons и Lobe Icons; знак у каждой компании свой, ничего не перерисовано), белый
//   круг — чтобы фирменные цвета читались на любом фоне кадра. Значки Facebook и Telegram сами круглые, у них подложки нет.
// - При «уменьшении движения» в системе — один неподвижный кадр. Сцена для скринридера скрыта (aria-hidden):
//   тот же смысл читается в заголовке и описании под ней.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion, useTabVisible } from "@/lib/use-motion";

type Brand = "google" | "bing" | "facebook" | "instagram" | "telegram" | "chatgpt" | "claude" | "gemini";
// Круглые знаки заполняют значок целиком, остальным нужны поля внутри белого круга
const ROUND_BRANDS: ReadonlySet<Brand> = new Set(["facebook", "telegram"]);
const logoSrc = (b: Brand) => `/brand/logos/${b}.svg`;

type Dir = "u" | "l" | "r" | "p"; // слово выезжает: снизу / слева / справа / «выскакивает» с поворотом
type Shape = "disc" | "ring" | "bands" | "pulse" | "dot";

type FrameStyle = {
  bg: string;
  fg: string;
  accent?: string; // цвет выделенной строки
  accentLine?: number;
  wipe: string; // класс шторки
  dirs: Dir[]; // направление выезда слов по строкам
  shape: Shape;
  logos?: Brand[]; // значки под строками
};

// Палитра сайта «графит и лимонный» (globals.css). Жёлтый как цвет текста — только на графитовых кадрах.
const FRAME_STYLES: FrameStyle[] = [
  { bg: "var(--color-accent)", fg: "var(--color-on-accent)", wipe: "reel-wipe-up", dirs: ["u", "u"], shape: "disc" },
  { bg: "var(--color-primary)", fg: "#ffffff", accent: "var(--color-accent)", accentLine: 1, wipe: "reel-wipe-circle", dirs: ["l", "r"], shape: "ring", logos: ["google", "bing"] },
  { bg: "var(--color-primary-soft)", fg: "var(--color-ink)", wipe: "reel-wipe-right", dirs: ["p"], shape: "bands", logos: ["facebook", "instagram", "telegram"] },
  { bg: "var(--color-accent-hover)", fg: "var(--color-on-accent)", wipe: "reel-wipe-corner", dirs: ["l", "r"], shape: "pulse", logos: ["chatgpt", "claude", "gemini"] },
  { bg: "var(--color-primary-hover)", fg: "#ffffff", accent: "var(--color-accent)", accentLine: 1, wipe: "reel-wipe-down", dirs: ["u", "p"], shape: "dot" },
];

function Shapes({ kind }: { kind: Shape }) {
  switch (kind) {
    case "disc":
      return <span className="reel-sh reel-sh-disc" />;
    case "ring":
      return (
        <>
          <span className="reel-sh reel-sh-ring" />
          <span className="reel-sh reel-sh-ring-disc" />
        </>
      );
    case "bands":
      return (
        <>
          <span className="reel-sh reel-sh-band reel-sh-band-a" />
          <span className="reel-sh reel-sh-band reel-sh-band-b" />
        </>
      );
    case "pulse":
      return (
        <>
          <span className="reel-sh reel-sh-pulse" style={{ animationDelay: "0s" }} />
          <span className="reel-sh reel-sh-pulse" style={{ animationDelay: "calc(1.1s / var(--reel-speed))" }} />
          <span className="reel-sh reel-sh-pulse" style={{ animationDelay: "calc(2.2s / var(--reel-speed))" }} />
        </>
      );
    case "dot":
      return (
        <>
          <span className="reel-sh reel-sh-dot-ring" />
          <span className="reel-sh reel-sh-dot" />
        </>
      );
  }
}

function Frame({ style, lines, done }: { style: FrameStyle; lines: readonly string[]; done: boolean }) {
  const n = Math.max(...lines.map((l) => l.length));
  return (
    <div className={`reel-layer ${style.wipe}${done ? " reel-done" : ""}`} style={{ "--bg": style.bg, "--fg": style.fg, "--n": n } as CSSProperties}>
      <Shapes kind={style.shape} />
      <div className="reel-body">
        <div className="reel-text">
          {lines.map((line, i) => (
            <span key={i} className="reel-ln">
              <span
                className={`reel-lw reel-in reel-d-${style.dirs[i] ?? "u"}`}
                style={{ "--t": `${0.3 + i * 0.18}s`, color: style.accent && style.accentLine === i ? style.accent : undefined } as CSSProperties}
              >
                {line}
              </span>
            </span>
          ))}
        </div>
        {style.logos ? (
          <div className="reel-logos">
            {style.logos.map((b, i) => (
              <span key={b} className={`reel-logo reel-in${ROUND_BRANDS.has(b) ? " reel-logo-round" : ""}`} style={{ "--k": i } as CSSProperties}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoSrc(b)} alt="" width={24} height={24} decoding="async" draggable={false} />
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function OwnerReel({ frames, summary }: { frames: readonly (readonly string[])[]; summary: readonly string[] }) {
  const total = Math.min(frames.length, FRAME_STYLES.length);
  const rootRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ cur: number; prev: number | null }>({ cur: 0, prev: null });
  const [inView, setInView] = useState(false);
  const reduced = useReducedMotion();
  const tabVisible = useTabVisible();

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  // Файлы значков маленькие, но кадр должен показать их сразу, а не после загрузки: подгружаем при первом появлении сцены
  const preloaded = useRef(false);
  useEffect(() => {
    if (!inView || preloaded.current) return;
    preloaded.current = true;
    for (const f of FRAME_STYLES) for (const b of f.logos ?? []) new Image().src = logoSrc(b);
  }, [inView]);

  const next = useCallback(() => setPos((p) => ({ cur: (p.cur + 1) % total, prev: p.cur })), [total]);

  if (total === 0) return null;

  if (reduced) {
    return (
      <div className="reel @container relative isolate h-52 overflow-hidden bg-primary sm:h-80" data-run="1" aria-hidden="true">
        <Frame style={{ ...FRAME_STYLES[0], wipe: "" }} lines={summary} done />
      </div>
    );
  }

  const run = inView && tabVisible;
  const { cur, prev } = pos;

  // Сама сцена: всё внутри обрезается по её краям (overflow-hidden + isolate), наружу ничего не выходит
  return (
    <div ref={rootRef} className="reel @container relative isolate h-52 overflow-hidden bg-primary sm:h-80" data-run={run ? "1" : "0"} aria-hidden="true">
      {prev !== null && prev !== cur ? <Frame key={prev} style={FRAME_STYLES[prev]} lines={frames[prev]} done /> : null}
      <Frame key={cur} style={FRAME_STYLES[cur]} lines={frames[cur]} done={false} />
      <span key={`prog-${cur}`} className="reel-prog" style={{ background: FRAME_STYLES[cur].fg }} onAnimationEnd={next} />
    </div>
  );
}
