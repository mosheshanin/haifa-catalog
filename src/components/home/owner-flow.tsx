"use client";

// Сцена в блоке для владельцев внизу главной (4 ноября 2026, вариант В холста https://claude.ai/artifact/J7tE2d1byZUSgbWWMp4c2v):
// светлая карточка специалиста на графитовом фоне; из правого и верхнего края блока, как облако в первом экране,
// отрываются капли с логотипами Google, Bing, Facebook, Instagram, Telegram, ChatGPT, Claude и Gemini, текут к карточке
// и вливаются в неё, а счётчик заявок на карточке растёт.
//
// Как устроено:
// - Один SVG с тем же фильтром «гусь», что у выреза (размытие + порог по прозрачности): капли, «стены» за краями и
//   сама карточка — круги и прямоугольник цвета фона страницы, поэтому капля сначала растёт из края, потом отрывается
//   и сливается с карточкой. Логотипы лежат поверх фильтра и движутся по тем же кадрам, что их капли.
// - Сцена прижата к правому верхнему углу блока, чтобы «стены» совпадали с его краями (иначе капли выходят из
//   пустоты). На компьютере она занимает правую половину блока, на телефоне стоит над текстом.
// - Содержимое карточки (фото, имя, рейтинг, заявки) — обычная разметка поверх SVG в процентах от сцены;
//   размер текста — от ширины сцены (cqw).
// - Счётчик растёт, когда очередная капля вливается в карточку: невидимые «часы» — CSS-анимация с периодом между
//   каплями, по её animationiteration. Часы встают на паузу вместе со сценой, поэтому счёт не убегает.
// - Идёт, пока блок виден и вкладка активна. При «уменьшить движение» — неподвижная карточка без капель.
// - Для скринридера сцена скрыта (aria-hidden): это иллюстрация, смысл несёт заголовок и текст рядом.

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion, useTabVisible } from "@/lib/use-motion";

type Brand = "google" | "bing" | "facebook" | "instagram" | "telegram" | "chatgpt" | "claude" | "gemini";
// Круглые знаки рисуются во весь кружок, остальные — на белой подложке
const ROUND: ReadonlySet<Brand> = new Set(["facebook", "telegram"]);

// Сцена в местных единицах: правый край блока — x = 420, верх — y = 0.
const SW = 420;
const SH = 300;
const CARD = { x: 112, y: 70, w: 228, h: 164, r: 24 };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Капли: старт за «стеной» (справа x > 422 или сверху y < −2), точка отрыва у края.
const DROPS: Array<{ logo: Brand; from: [number, number]; bud: [number, number] }> = [
  { logo: "google", from: [452, 64], bud: [394, 64] },
  { logo: "facebook", from: [318, -44], bud: [318, 26] },
  { logo: "chatgpt", from: [452, 196], bud: [394, 200] },
  { logo: "instagram", from: [214, -44], bud: [220, 26] },
  { logo: "bing", from: [452, 130], bud: [394, 128] },
  { logo: "claude", from: [392, -44], bud: [392, 24] },
  { logo: "telegram", from: [452, 262], bud: [394, 262] },
  { logo: "gemini", from: [268, -44], bud: [270, 26] },
];
const DUR = 12; // путь одной капли, с
const STEP = DUR / DROPS.length; // капли идут друг за другом через 1,5 с
const MERGE = 0.62; // доля пути, когда капля вливается в карточку
// «Часы» счётчика: конец итерации совпадает с моментом слияния очередной капли
const CLOCK_DELAY = ((DUR * MERGE) % STEP) - STEP;

const pt = (x: number, y: number, s: number) => `translate(${x}px,${y}px) scale(${s})`;
// Капля из правого края вливается в правый край карточки, из верхнего — в верхний: логотипы не пролетают над текстом
// карточки и гаснут ещё снаружи.
const KEYFRAMES = DROPS.map((d, i) => {
  const [fx, fy] = d.from;
  const [bx, by] = d.bud;
  const fromRight = fx > SW;
  const right = CARD.x + CARD.w;
  const near = fromRight ? [right + 30, clamp(by, CARD.y + 34, CARD.y + CARD.h - 34)] : [clamp(bx, CARD.x + 40, right - 40), CARD.y - 30];
  const merge = fromRight ? [right - 28, near[1]] : [near[0], CARD.y + 28];
  const mid = [(bx + near[0]) / 2, (by + near[1]) / 2];
  // 0–18% капля выходит из стены, 18–34% отрывается, 34–52% подходит к карточке, 52–62% вливается
  return (
    `@keyframes owf-d${i}{0%{transform:${pt(fx, fy, 0.6)}}18%{transform:${pt(bx, by, 1)}}34%{transform:${pt(mid[0], mid[1], 1)}}` +
    `52%{transform:${pt(near[0], near[1], 0.9)}}${MERGE * 100}%,100%{transform:${pt(merge[0], merge[1], 0.2)}}}` +
    `@keyframes owf-l${i}{0%{transform:${pt(fx, fy, 0.6)};opacity:0}12%{opacity:1}18%{transform:${pt(bx, by, 1)}}` +
    `34%{transform:${pt(mid[0], mid[1], 1)}}44%{opacity:1}52%{transform:${pt(near[0], near[1], 0.9)};opacity:0}100%{transform:${pt(near[0], near[1], 0.5)};opacity:0}}`
  );
}).join("");

const START_LEADS = 12;

type CardText = { name: string; role: string; rating: string; services: string; district: string; photo: string; leads: string };

export function OwnerFlow({ card }: { card: CardText }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [leads, setLeads] = useState(START_LEADS);
  const [bump, setBump] = useState(false);
  const reduced = useReducedMotion();
  const tabVisible = useTabVisible();
  const run = inView && tabVisible && !reduced;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!bump) return;
    const t = setTimeout(() => setBump(false), 260);
    return () => clearTimeout(t);
  }, [bump]);

  const onMerge = () => {
    setLeads((n) => (n >= 99 ? START_LEADS : n + 1));
    setBump(true);
  };

  return (
    <div ref={rootRef} className="owf" data-run={run ? "1" : "0"} data-reduced={reduced ? "1" : "0"} aria-hidden="true">
      <style>{KEYFRAMES}</style>
      <svg className="owf-svg" viewBox={`0 0 ${SW} ${SH}`} focusable="false">
        <defs>
          <filter id="owf-goo" filterUnits="userSpaceOnUse" x={-20} y={-70} width={SW + 90} height={SH + 140} colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation={7} />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8.3" />
          </filter>
        </defs>
        <g filter="url(#owf-goo)" className="owf-shape">
          {/* «Стены» за правым и верхним краем блока: капли растут из них */}
          <rect x={SW + 2} y={-70} width={40} height={SH + 140} />
          <rect x={-20} y={-70} width={SW + 90} height={68} />
          <rect x={CARD.x} y={CARD.y} width={CARD.w} height={CARD.h} rx={CARD.r} />
          {DROPS.map((d, i) => (
            <g key={d.logo} className="owf-drop" style={{ animationName: `owf-d${i}`, animationDuration: `${DUR}s`, animationDelay: `${i * STEP - DUR}s` }}>
              <circle r={25} />
            </g>
          ))}
        </g>
        {DROPS.map((d, i) => {
          const round = ROUND.has(d.logo);
          const s = round ? 34 : 22;
          return (
            <g key={d.logo} className="owf-logo" style={{ animationName: `owf-l${i}`, animationDuration: `${DUR}s`, animationDelay: `${i * STEP - DUR}s` }}>
              <circle r={17} fill="#ffffff" />
              <image href={`/brand/logos/${d.logo}.svg`} x={-s / 2} y={-s / 2} width={s} height={s} />
            </g>
          );
        })}
      </svg>

      {/* Карточка специалиста: фото, имя, профессия, рейтинг, услуги с ценами, заявки и район */}
      <div
        className="owf-card"
        style={{ left: `${(CARD.x / SW) * 100}%`, top: `${(CARD.y / SH) * 100}%`, width: `${(CARD.w / SW) * 100}%`, height: `${(CARD.h / SH) * 100}%` } as CSSProperties}
      >
        <div className="owf-head">
          <img src={card.photo} alt="" className="owf-ava" loading="lazy" decoding="async" />
          <div className="owf-who">
            <p className="owf-name">{card.name}</p>
            <p className="owf-role">{card.role}</p>
            <p className="owf-meta">
              <span className="owf-star">★</span> {card.rating}
            </p>
          </div>
        </div>
        <p className="owf-services">{card.services}</p>
        <div className="owf-foot">
          <p className={`owf-leads${bump ? " owf-bump" : ""}`}>
            {card.leads}: <b>{leads}</b>
          </p>
          <p className="owf-district">{card.district}</p>
        </div>
      </div>

      {/* «Часы» счётчика: конец каждой итерации = очередная капля влилась в карточку */}
      <span className="owf-clock" style={{ animationDuration: `${STEP}s`, animationDelay: `${CLOCK_DELAY}s` }} onAnimationIteration={onMerge} />
    </div>
  );
}
