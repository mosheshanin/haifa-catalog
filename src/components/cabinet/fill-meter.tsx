"use client";

// Шкала заполненности карточки, совет «следующий шаг» и окно «Как считается заполненность» (решение заказчика
// 5 ноября 2026: шкала + один следующий шаг; вариант «Где вас найдут» — внутри окна). Расчёт — src/lib/blocks/score.ts.
// Тон мягкий: без красного цвета и упрёков, всегда «ещё N — и…»; мест в выдаче не обещаем.

import { useRef, useState } from "react";
import { Icon3d } from "@/components/ui/icon-3d";
import { BLOCKS_FOR_FULL, BLOCK_POINTS, STRONG_AT, scoreChannels, type ListingScore, type ScoreItem } from "@/lib/blocks/score";
import { MIN_DESCRIPTION } from "@/lib/seo/indexable";

function Bar({ percent, ghost = 0, size = "md", marks = true }: { percent: number; ghost?: number; size?: "sm" | "md"; marks?: boolean }) {
  const h = size === "sm" ? "h-2" : "h-2.5";
  return (
    <div className={`relative ${h} rounded-full bg-[#ecebe5]`} aria-hidden>
      <div className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${percent}%` }} />
      {ghost > 0 ? (
        <div
          className="absolute inset-y-0 rounded-r-full bg-[repeating-linear-gradient(135deg,#fbe27a_0_4px,#fdf3c4_4px_8px)]"
          style={{ left: `${percent}%`, width: `${Math.min(ghost, 100 - percent)}%` }}
        />
      ) : null}
      {marks ? (
        <>
          <span className="absolute -top-[3px] left-1/2 h-[calc(100%+6px)] w-0.5 rounded bg-primary" />
          <span className="absolute -top-[3px] h-[calc(100%+6px)] w-0.5 rounded bg-[#b9b8b1]" style={{ left: `${STRONG_AT}%` }} />
        </>
      ) : null}
    </div>
  );
}

// Полная шкала (мастер, после отправки) или компактная строка (панель редактора, кабинет).
export function FillMeter({ score, gain = 0, compact = false, title = "Карточка заполнена" }: { score: ListingScore; gain?: number; compact?: boolean; title?: string }) {
  const [open, setOpen] = useState(false);
  const label = `${title}: ${score.percent}%. ${score.level.key === "start" ? "" : `${score.level.title}. `}${score.message}`;
  if (compact) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="w-12 shrink-0 font-display text-lg font-extrabold tabular-nums">{score.percent}%</span>
        <div className="grid min-w-0 flex-1 gap-1">
          <Bar percent={score.percent} size="sm" />
          <span className="text-xs leading-snug text-muted">
            {score.message}{" "}
            <button type="button" onClick={() => setOpen(true)} className="font-semibold text-primary underline">
              Как считается
            </button>
          </span>
        </div>
        <FillExplainer score={score} open={open} onClose={() => setOpen(false)} />
        <span className="sr-only" role="status">{label}</span>
      </div>
    );
  }
  return (
    <section className="grid gap-2.5 rounded-[var(--radius-card)] border border-line bg-white px-4 py-3.5" aria-label={label}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-bold">{title}</span>
        <span className="font-display text-2xl font-extrabold tabular-nums">{score.percent}%</span>
      </div>
      <Bar percent={score.percent} ghost={gain} />
      {/* Подписи у отметок: «Видна в поиске» кончается у своей отметки, «Сильная» начинается у своей — так они не
          наезжают друг на друга и на 320 px; 100% подписывать не нужно. */}
      <div className="relative h-4 text-xs text-muted" aria-hidden>
        <span className={`absolute right-1/2 mr-1.5 whitespace-nowrap ${score.baseMissing.length ? "" : "font-bold text-ink"}`}>Видна в поиске</span>
        <span className={`absolute ml-1.5 whitespace-nowrap ${score.level.key === "strong" || score.level.key === "full" ? "font-bold text-ink" : ""}`} style={{ left: `${STRONG_AT}%` }}>Сильная</span>
      </div>
      <p className="text-sm leading-snug text-muted">
        {score.message}{" "}
        <button type="button" onClick={() => setOpen(true)} className="font-semibold text-primary underline">
          Как считается
        </button>
      </p>
      <FillExplainer score={score} open={open} onClose={() => setOpen(false)} />
    </section>
  );
}

// Мягкая подсказка «зачем» (в мастере — под вопросом шага).
export function FillTip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl bg-primary-soft px-3.5 py-3 text-sm leading-relaxed">
      <Icon3d name="bulb" size={26} className="shrink-0" fallback="💡" />
      <span>{children}</span>
    </div>
  );
}

// Счётчик знаков описания до порога основы.
export function DescriptionCounter({ length }: { length: number }) {
  const n = Math.min(length, MIN_DESCRIPTION);
  return (
    <div className="grid gap-1.5" aria-live="polite">
      <div className="relative h-1.5 rounded-full bg-[#ecebe5]" aria-hidden>
        <div className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${(n / MIN_DESCRIPTION) * 100}%` }} />
      </div>
      <span className="text-sm leading-snug text-muted">
        {length >= MIN_DESCRIPTION ? (
          <b className="text-success">Описание засчитано: {length} знаков.</b>
        ) : (
          <>
            <b className="text-ink">{length} из {MIN_DESCRIPTION} знаков.</b> Ещё {MIN_DESCRIPTION - length} — и описание засчитается: <b className="text-accent-ink">+10%</b>
          </>
        )}
      </span>
    </div>
  );
}

// Один совет за раз: «Другой совет» листает по кругу, «Не сейчас» прячет до перезагрузки страницы.
export function NextStepCard({ score, onAction, actionLabel = "Сделать" }: { score: ListingScore; onAction: (item: ScoreItem) => void; actionLabel?: string }) {
  const [shift, setShift] = useState(0);
  const [hidden, setHidden] = useState(false);
  if (hidden || !score.next.length) return null;
  const item = score.next[shift % score.next.length];
  const progress = item.need && item.have ? ` Сейчас ${item.have} из ${item.need}.` : "";
  return (
    <section className="grid gap-3 rounded-[var(--radius-card)] border-2 border-accent bg-white p-4 shadow-[0_6px_18px_rgba(38,38,43,0.08)] sm:p-5" aria-label="Следующий шаг">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-muted">Следующий шаг</span>
        <span className="whitespace-nowrap rounded-full bg-accent px-2.5 py-0.5 text-sm font-extrabold text-on-accent">+{item.points}%</span>
      </div>
      <h2 className="text-lg font-extrabold leading-snug">{item.action}</h2>
      {item.why ? (
        <p className="text-sm leading-relaxed text-muted">
          {item.why}
          {progress}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onAction(item)} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-accent px-5 font-bold text-on-accent hover:bg-accent-hover">
          {actionLabel}
        </button>
        {score.next.length > 1 ? (
          <button type="button" onClick={() => setShift(shift + 1)} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-line bg-white px-4 font-bold hover:border-primary">
            Другой совет
          </button>
        ) : null}
      </div>
      <button type="button" onClick={() => setHidden(true)} className="min-h-11 justify-self-center text-sm font-semibold text-muted underline">
        Не сейчас
      </button>
    </section>
  );
}

// Окно с объяснением: зачем заполнять, уровни, «где вас найдут» (вариант В), что засчитывается, без обещаний.
export function FillExplainer({ score, open, onClose }: { score: ListingScore; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const setRef = (el: HTMLDialogElement | null) => {
    ref.current = el;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  };
  const channels = scoreChannels(score);
  return (
    <dialog
      ref={setRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="fill-explainer-title"
      className="m-0 mt-auto max-h-[92vh] w-full max-w-none overflow-y-auto rounded-t-[28px] bg-white p-0 text-ink backdrop:bg-[rgba(29,29,31,0.55)] sm:m-auto sm:max-w-lg sm:rounded-[28px]"
    >
      <div className="grid gap-4 px-5 pb-5 pt-3 sm:px-6">
        <span className="h-1 w-10 justify-self-center rounded bg-[#d6d5cf] sm:hidden" aria-hidden />
        {/* autoFocus: иначе браузер ставит фокус на «Понятно» внизу и открывает окно прокрученным до конца */}
        <h2 id="fill-explainer-title" tabIndex={-1} autoFocus className="text-xl font-extrabold leading-snug outline-none">Зачем заполнять карточку полностью</h2>
        <p className="leading-relaxed">
          Люди ищут мастеров в Google и всё чаще спрашивают нейросети — ChatGPT, Gemini, Claude. И те и другие отвечают по тому, что написано на сайтах. Чем подробнее карточка, тем чаще она подходит под вопрос клиента.
        </p>

        <ul className="grid gap-2.5">
          <li className="flex items-start gap-3">
            <span className="w-14 shrink-0 rounded-xl bg-primary-soft py-1.5 text-center font-display font-extrabold">50%</span>
            <span className="leading-snug"><b>Видна в поиске.</b> Обложка, описание от {MIN_DESCRIPTION} знаков, телефон или мессенджер, адрес или районы. Без этого поисковики карточку не показывают.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-14 shrink-0 rounded-xl bg-[#fdf0b3] py-1.5 text-center font-display font-extrabold">{STRONG_AT}%</span>
            <span className="leading-snug"><b>Сильная.</b> Плюс {Math.round((STRONG_AT - 50) / BLOCK_POINTS)} блоков — например, услуги с ценами, часы, фото, вопросы и ответы.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-14 shrink-0 rounded-xl bg-accent py-1.5 text-center font-display font-extrabold text-on-accent">100%</span>
            <span className="leading-snug"><b>Полная.</b> Основа и {BLOCKS_FOR_FULL} любых блоков, которые подходят вашему делу.</span>
          </li>
        </ul>

        <div className="grid gap-3">
          <h3 className="font-extrabold">Где вас найдут · сейчас {score.percent}%</h3>
          {channels.map((c) =>
            c.items.length ? (
              <section key={c.key} className="grid gap-2 rounded-2xl border border-line p-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span>
                    <b>{c.title}</b> <span className="text-sm text-muted">· {c.sub}</span>
                  </span>
                  <span className="whitespace-nowrap text-sm font-bold text-muted">
                    {c.items.filter((i) => i.done).length} из {c.items.length}
                  </span>
                </div>
                <Bar percent={(c.items.filter((i) => i.done).length / c.items.length) * 100} size="sm" marks={false} />
                <ul className="grid gap-1 text-sm">
                  {c.items.map((i) => (
                    <li key={i.key} className="flex items-baseline gap-2">
                      <span aria-hidden className={`font-extrabold ${i.done ? "text-success" : "text-[#b9b8b1]"}`}>{i.done ? "✓" : "○"}</span>
                      <span className={i.done ? "" : "text-muted"}>
                        {i.title}
                        {!i.done && i.need && i.have ? ` · ${i.have} из ${i.need}` : ""}
                        <span className="sr-only">{i.done ? " — есть" : " — пока нет"}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null,
          )}
        </div>

        <div className="grid gap-1.5 rounded-2xl bg-surface-alt p-3.5">
          <h3 className="font-bold">Что засчитывается</h3>
          <p className="text-sm leading-relaxed text-[#3a3a40]">
            Блок засчитывается, когда в нём есть содержимое: услуги — от 3, фото в галерее — от 5, вопросы — от 3. Скрытые блоки не считаются. Закончилась акция или прошло мероприятие — процент немного снизится, пока не добавите новое.
          </p>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          Место в выдаче решают сами Google и нейросети, обещать его не может никто. Но полная карточка даёт им больше поводов показать именно вас.
        </p>
        <button type="button" onClick={onClose} className="min-h-12 rounded-2xl bg-accent font-bold text-on-accent hover:bg-accent-hover">
          Понятно
        </button>
      </div>
    </dialog>
  );
}
