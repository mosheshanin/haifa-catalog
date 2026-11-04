"use client";

// Вырез в правом верхнем углу первого экрана (4 ноября 2026, по макету на холсте «Облако и знаки в углу»):
// цвет фона страницы поверх графитового блока, поэтому форма читается как вырез в нём. Около 80% времени это
// бесформенное облако, которое меняет форму, а раз в 10 секунд оно перетекает в один из знаков (₪ # ♥ + @ % ∞) и обратно.
//
// Как устроено:
// - Всё рисует один SVG без скриптов. Фильтр «гусь» (feGaussianBlur + порог по прозрачности) склеивает близкие круги
//   в одну плавную форму. «Стены» за правым и верхним краем блока сливаются с формой, поэтому она всегда растёт из края.
//   Стены отодвинуты от края на 2 единицы, иначе вдоль края видна светлая волосяная линия.
// - Размытие фильтра анимирует SMIL (<animate>): в переходе оно растёт, и форма «плавится», а не мигает. SMIL нельзя
//   выключить через CSS, поэтому паузой и «уменьшением движения» управляет эффект ниже (pauseAnimations/setCurrentTime).
// - Облако — три «ядра» и шесть «спутников», вращающихся вокруг оси; знаки — обводка круглыми концами (сердечко ещё и
//   закрашено: обводка закругляет его острый низ). Все координаты —
//   в «местных» единицах холста (знак шириной около 150); масштаб задаёт ширина слоя (.hc в globals.css), поэтому
//   на разных экранах форма та же, только крупнее или мельче.
// - Слой лежит над фоном блока и не обрезается его скруглённым углом (иначе по дуге угла остаётся серая линия:
//   краевые пиксели скругления накладываются дважды), поэтому блок не `overflow-hidden`, а свечение в нём — в своей обёртке.
// - Знаки — список SIGNS ниже; цикл и моменты перехода считаются из него (CYCLE, SIGN_START), а проценты кадров CSS
//   (hc-sign, hc-cloud) компонент выписывает в <style> сам, поэтому знак добавляется одной записью в SIGNS.
//   Первым должен стоять ₪: при «уменьшении движения» остаётся он.
// - Идёт, пока блок виден и вкладка активна. Кнопки паузы нет (заказчик убрал её 4 ноября 2026). При «уменьшении
//   движения» в системе — один неподвижный знак ₪.
// - Для скринридера слой скрыт (aria-hidden): он ничего не сообщает, это украшение.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion, useTabVisible } from "@/lib/use-motion";

// Знаки в порядке показа. dy выравнивает верх знака с верхом блока (местные единицы), sw — толщина обводки.
// Все знаки рисуются вокруг точки (111, 100) и тянутся от x ≈ 36 до ≈ 186 (последние ≈ 8 единиц уходят за правый край блока).
type Sign = { id: string; dy: number; sw: number; body: ReactNode };
const SIGNS: Sign[] = [
  {
    id: "shekel",
    dy: -16,
    sw: 28,
    body: <path d="M50 164V68A24 24 0 0 1 74 44H107.3A24 24 0 0 1 131.3 68V104M90.7 96V140A24 24 0 0 0 114.7 164H148A24 24 0 0 0 172 140V44" />,
  },
  { id: "hash", dy: -10, sw: 24, body: <path d="M92 36L76 164M146 36L130 164M48 74H174M48 126H174" /> },
  {
    // Сердечко рисуется контуром без толстой обводки (она бы забила ложбинку между долями); dy поднимает доли к верхнему
    // краю — выше ложбинка пропадает, ниже сердце отрывается от края
    id: "heart",
    dy: -12,
    sw: 6,
    body: <path className="hc-fill" d="M111 172C72 144 38 114 38 80C38 54 56 36 78 36C96 36 108 46 111 62C114 46 126 36 144 36C166 36 184 54 184 80C184 114 150 144 111 172Z" />,
  },
  {
    id: "plus",
    dy: -11,
    sw: 40,
    body: (
      <>
        <path d="M56 100H166M111 45V155" />
        <circle cx={111} cy={100} r={32} />
      </>
    ),
  },
  {
    id: "at",
    dy: -11,
    sw: 18,
    body: (
      <>
        <circle className="hc-ring" cx={111} cy={100} r={24} style={{ strokeWidth: 18 }} />
        <path d="M144 157.2A66 66 0 1 1 174.8 117.1C173 134 135 140 135 108V80" />
      </>
    ),
  },
  {
    id: "percent",
    dy: -10,
    sw: 24,
    body: (
      <>
        <circle className="hc-ring" cx={68} cy={56} r={21} />
        <circle className="hc-ring" cx={154} cy={144} r={21} />
        <path d="M151 38L71 162" />
      </>
    ),
  },
  {
    // Петля из 24-единичной клетки, повёрнутая и увеличенная до тех же ≈150 единиц в ширину; толщину задаёт её собственный strokeWidth
    id: "infinity",
    dy: -26,
    sw: 27,
    body: (
      <g transform="translate(106 100) rotate(-26) scale(7) translate(-12 -12)">
        <path strokeWidth={3.9} d="M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8" />
      </g>
    ),
  },
];

// Длительность цикла и моменты, когда облако переходит в знак (секунды от начала цикла): знак каждые 10 секунд.
const SLOT = 10;
const FIRST = 5.5;
const CYCLE = SIGNS.length * SLOT;
const SIGN_START = SIGNS.map((_, i) => FIRST + i * SLOT);

// Кадры CSS в процентах цикла. Знак: секунда на появление, секунда держится, секунда на уход. Облако гаснет на те же
// секунды (кадры симметричны: сумма прозрачностей остаётся 1, пока растёт размытие).
const pct = (t: number) => `${+((t / CYCLE) * 100).toFixed(4)}%`;
const KEYFRAMES_CSS =
  `@keyframes hc-sign{0%{opacity:0;transform:scale(.92)}${pct(1)}{opacity:1;transform:scale(1)}${pct(2)}{opacity:1;transform:scale(1)}${pct(3)}{opacity:0;transform:scale(.92)}100%{opacity:0;transform:scale(.92)}}` +
  `@keyframes hc-cloud{0%,${pct(SIGN_START[0])}{opacity:1}` +
  SIGN_START.map((s, i) => `${pct(s + 1)},${pct(s + 2)}{opacity:0}${pct(s + 3)},${i === SIGN_START.length - 1 ? "100%" : pct(SIGN_START[i + 1])}{opacity:1}`).join("") +
  `}`;

// Размытие фильтра: обычное и повышенное в переходе (в местных единицах; 4,2 ед. ≈ 11 px при ширине слоя 463 px).
const SIGMA_LOW = 4.2;
const SIGMA_HIGH = 8.5;
// Для каждого знака: начало перехода, пик, конец — размытие растёт на секунду до смены кадра и спадает через секунду
const SIGMA_FRAMES: [number, number][] = SIGN_START.flatMap((s) => [
  [s, SIGMA_LOW],
  [s + 0.5, SIGMA_HIGH],
  [s + 1, SIGMA_LOW],
  [s + 2, SIGMA_LOW],
  [s + 2.5, SIGMA_HIGH],
  [s + 3, SIGMA_LOW],
]);
const SIGMA_TIMES = [0, ...SIGMA_FRAMES.map(([t]) => t), CYCLE];
const SIGMA_VALUES = [SIGMA_LOW, ...SIGMA_FRAMES.map(([, v]) => v), SIGMA_LOW];

// Ядра облака: центр, радиус, смещение/масштаб «блуждания», длительность и сдвиг начала.
const CORES = [
  { cx: 172, cy: 46, r: 46, dx: 10, dy: 8, a: 1.1, b: 0.9, d: 9.3, delay: -1 },
  { cx: 156, cy: 98, r: 46, dx: 14, dy: 12, a: 1.16, b: 0.84, d: 11.1, delay: -4 },
  { cx: 166, cy: 148, r: 42, dx: 10, dy: -12, a: 1.14, b: 0.86, d: 10.3, delay: -2 },
];
// Спутники: ось вращения, радиус орбиты R и круга r, период, направление, пределы «дыхания» и его длительность.
// Условие, чтобы спутник не отрывался одиноким кружком: R − r ≤ (ось по x) − (левый край ядер, ≈ 110).
const ORBS = [
  { px: 133, py: 72, R: 52, r: 28, T: 17, rev: false, p0: 0.85, p1: 1.3, pd: 6.1, delay: -3 },
  { px: 129, py: 126, R: 50, r: 30, T: 23, rev: true, p0: 0.8, p1: 1.25, pd: 7.3, delay: -8 },
  { px: 127, py: 100, R: 46, r: 28, T: 13, rev: false, p0: 0.8, p1: 1.3, pd: 5.3, delay: -5 },
  { px: 135, py: 100, R: 52, r: 26, T: 29, rev: true, p0: 0.85, p1: 1.4, pd: 8.9, delay: -11 },
  { px: 135, py: 60, R: 48, r: 26, T: 19, rev: true, p0: 0.8, p1: 1.35, pd: 6.7, delay: -2 },
  { px: 133, py: 140, R: 52, r: 28, T: 31, rev: false, p0: 0.85, p1: 1.3, pd: 7.9, delay: -14 },
];

// Размеры холста в местных единицах. Правый край блока — x = 178; верх блока — y = 19,4 (содержимое сдвинуто вверх на TOP).
const W = 178;
const H = 215.4;
const TOP = 19.4;
const WALL = 2; // отступ «стен» от края блока

export function HeroCutout() {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [inView, setInView] = useState(true);
  const reduced = useReducedMotion();
  const tabVisible = useTabVisible();
  const run = inView && tabVisible && !reduced;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Часы SMIL и CSS-анимаций запускаются в разное время (SVG — при разборе, CSS — при первой отрисовке), а переход
  // облака в знак держится на их совпадении: при монтировании подгоняем CSS-часы под SMIL. Паузой управляем вместе.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (reduced) {
      svg.pauseAnimations();
      svg.setCurrentTime(0);
      return;
    }
    const t = svg.getCurrentTime() * 1000;
    for (const a of svg.getAnimations({ subtree: true })) a.currentTime = t;
    if (run) svg.unpauseAnimations();
    else svg.pauseAnimations();
  }, [run, reduced]);

  return (
    <>
      <style>{KEYFRAMES_CSS}</style>
      <div ref={rootRef} className="hc" data-run={run ? "1" : "0"} style={{ "--hc-cycle": `${CYCLE}s` } as CSSProperties} aria-hidden="true">
        <svg ref={svgRef} className="hc-stage" viewBox={`0 0 ${W} ${H}`} focusable="false">
          <defs>
            {/* Область фильтра шире холста: «стены» за краями должны попасть в размытие */}
            <filter id="hc-goo" filterUnits="userSpaceOnUse" x={-5} y={-15} width={W + 22} height={H + 30} colorInterpolationFilters="sRGB">
              <feGaussianBlur in="SourceGraphic" stdDeviation={SIGMA_LOW}>
                <animate
                  attributeName="stdDeviation"
                  dur={`${CYCLE}s`}
                  repeatCount="indefinite"
                  calcMode="linear"
                  values={SIGMA_VALUES.join(";")}
                  keyTimes={SIGMA_TIMES.map((t) => +(t / CYCLE).toFixed(4)).join(";")}
                />
              </feGaussianBlur>
              {/* Порог чуть ниже половины: форма «липкая», стены сливаются с ней */}
              <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8.3" />
              {/* Второй проход убирает мелкие точки и щели, которые остаются при переходах */}
              <feGaussianBlur stdDeviation={1.2} />
              <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 16 -6.1" />
            </filter>
          </defs>
          <g filter="url(#hc-goo)">
            {/* «Стены» за правым и верхним краем блока */}
            <rect x={W + WALL} y={-60} width={15} height={H + 80} />
            <rect x={-60} y={-60} width={W + 80} height={60 - WALL} />
            <g transform={`translate(0 ${-TOP})`}>
              <g className="hc-cloud">
                {CORES.map((c, i) => (
                  <circle
                    key={i}
                    className="hc-core"
                    cx={c.cx}
                    cy={c.cy}
                    r={c.r}
                    style={{ "--dx": c.dx, "--dy": c.dy, "--a": c.a, "--b": c.b, "--d": `${c.d}s`, animationDelay: `${c.delay}s` } as CSSProperties}
                  />
                ))}
                {ORBS.map((o, i) => (
                  <g
                    key={i}
                    className="hc-orb"
                    style={{ transformOrigin: `${o.px}px ${o.py}px`, animationDuration: `${o.T}s`, animationDelay: `${o.delay}s`, animationDirection: o.rev ? "reverse" : "normal" }}
                  >
                    <circle
                      className="hc-pu"
                      cx={o.px + o.R}
                      cy={o.py}
                      r={o.r}
                      style={{ "--p0": o.p0, "--p1": o.p1, animationDuration: `${o.pd}s`, animationDelay: `${o.delay}s` } as CSSProperties}
                    />
                  </g>
                ))}
              </g>
              {SIGNS.map((sign, i) => (
                <g key={sign.id} transform={`translate(0 ${sign.dy})`}>
                  <g className={i === 0 ? "hc-sign hc-sign-0" : "hc-sign"} style={{ animationDelay: `${SIGN_START[i]}s`, strokeWidth: sign.sw }}>
                    {sign.body}
                  </g>
                </g>
              ))}
            </g>
          </g>
        </svg>
      </div>
    </>
  );
}
