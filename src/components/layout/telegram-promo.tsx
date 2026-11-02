import { t } from "@/i18n/ru";
import { miniAppLink, TELEGRAM_BOT_USERNAME } from "@/lib/env";

// Промо-блок мини-приложения в подвале (решение 2 ноября 2026, раздел 10 ТЗ). Телефон-иллюстрация «заезжает»
// вверх на фон страницы над подвалом. Внутри самого Mini App блок не нужен — скрыт CSS (html[data-telegram="1"]).
const p = t.telegramPromo;

export function TelegramPromo() {
  return (
    <section aria-labelledby="tg-promo-title" className="tg-promo mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      <div className="relative isolate flow-root rounded-[2rem] bg-[linear-gradient(135deg,#2aabee_0%,#3a63e0_48%,#1e1b4b_100%)] text-white shadow-[0_24px_60px_-24px_rgba(30,27,75,0.55)]">
        {/* Мягкие световые пятна — внутри карточки */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[2rem]">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-32 right-1/3 h-80 w-80 rounded-full bg-[#ffc933]/25 blur-3xl" />
        </div>

        {/* Телефон: на телефоне и планшете — над текстом и выше карточки (низ растворяется); на широком экране (от 1280 px) — справа,
            выше верхнего края, низ уходит за нижний край карточки (высота телефона = высота карточки + выступ) */}
        <div
          aria-hidden
          className="pointer-events-none relative z-10 -mt-28 flex h-[22rem] justify-center [mask-image:linear-gradient(to_bottom,#000_78%,transparent)] xl:absolute xl:-top-36 xl:right-12 xl:bottom-0 xl:mt-0 xl:block xl:h-auto xl:w-[21rem] xl:[clip-path:inset(-20rem_-20rem_0_-20rem)] xl:[mask-image:none]"
        >
          <PhoneIllustration />
        </div>

        <div className="relative px-5 pb-8 sm:px-10 sm:pb-10 xl:max-w-[calc(100%-26rem)] xl:py-12 xl:pl-12">
          <p className="inline-flex whitespace-nowrap rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-white/25">
            {p.eyebrow}
          </p>
          <h2 id="tg-promo-title" className="mt-4 text-[1.75rem] font-extrabold leading-tight sm:text-4xl">
            {p.title}
          </h2>
          <p className="mt-3 max-w-xl text-white/85">{p.lead}</p>

          <ul className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {p.benefits.map((b) => (
              <li key={b.title} className="flex gap-3 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm">
                <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-xl">
                  {b.icon}
                </span>
                <span className="min-w-0">
                  <span className="block font-bold">{b.title}</span>
                  <span className="mt-0.5 block text-sm text-white/80">{b.text}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={miniAppLink()}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-13 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-highlight px-6 font-display text-lg font-extrabold text-primary shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#ffd54f]"
            >
              <span aria-hidden>✈️</span> {p.open}
            </a>
            <a
              href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-13 items-center justify-center whitespace-nowrap rounded-2xl bg-white/10 px-6 font-bold text-white ring-1 ring-white/40 transition hover:bg-white/20"
            >
              {p.bot} @{TELEGRAM_BOT_USERNAME}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// Рисованный экран мини-приложения (свой, без чужих логотипов).
function PhoneIllustration() {
  return (
    <div className="relative w-[15.5rem] shrink-0 xl:absolute xl:inset-x-0 xl:top-0 xl:-bottom-10 xl:w-auto">
      {/* Всплывающие сообщения бота */}
      <div className="absolute -left-6 top-44 z-10 w-40 rotate-[-4deg] rounded-2xl bg-white p-3 text-ink shadow-xl sm:-left-24 sm:w-48 xl:-left-14 xl:top-[54%]">
        <p className="text-xs font-bold text-[#229ed9]">🔔 Новая заявка</p>
        <p className="mt-1 text-xs leading-snug">Маникюр, завтра в 11:00</p>
        <div className="mt-2 flex gap-1.5">
          <span className="flex-1 rounded-lg bg-[#229ed9] py-1 text-center text-[0.8125rem] font-bold text-white">Принять</span>
          <span className="flex-1 rounded-lg bg-surface-alt py-1 text-center text-[0.8125rem] font-bold text-muted">Позже</span>
        </div>
      </div>
      <div className="absolute -right-4 top-16 z-10 rotate-[5deg] whitespace-nowrap rounded-full bg-highlight px-3 py-1.5 text-xs font-extrabold text-primary shadow-lg sm:-right-12 xl:-right-8 xl:top-24">
        🎁 −20% в избранном
      </div>

      {/* Корпус */}
      <div className="rounded-[2.6rem] bg-[#14122e] p-2.5 xl:h-full shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/20">
        <div className="relative flex flex-col overflow-hidden rounded-[2.1rem] bg-surface-alt text-ink xl:h-full">
          {/* Вырез */}
          <div className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-[#14122e]" />
          {/* Шапка Telegram */}
          <div className="bg-white px-4 pb-3 pt-9">
            <div className="flex items-center justify-between text-[0.8125rem]">
              <span className="font-bold text-[#229ed9]">✕ Закрыть</span>
              <span className="font-display font-extrabold text-primary">HBC</span>
              <span className="font-bold text-muted">•••</span>
            </div>
            <div className="mt-3 flex h-9 items-center gap-2 rounded-xl bg-surface-alt px-3 text-[0.8125rem] text-muted">
              <span aria-hidden>🔍</span> Маникюр в Адаре
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-hidden p-3">
            <div className="flex gap-1.5">
              {["💅 Красота", "🔧 Мастера", "🍕 Еда"].map((c) => (
                <span key={c} className="whitespace-nowrap rounded-full bg-white px-2 py-1 text-[0.75rem] font-bold shadow-sm">
                  {c}
                </span>
              ))}
            </div>
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="relative h-24 bg-[linear-gradient(135deg,#f9c5d1,#c7b8f5_60%,#8fb8f7)]">
                <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[0.75rem] font-bold text-success">
                  ✅ Проверено
                </span>
                <span className="absolute bottom-2 right-3 text-3xl">💅</span>
              </div>
              <div className="p-3">
                <p className="text-sm font-bold leading-tight">Студия маникюра</p>
                <p className="mt-1 text-[0.75rem] text-muted">⭐ 4,9 · Адар · Открыто</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-white p-2.5 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-lg">🔧</span>
              <span className="min-w-0">
                <span className="block text-[0.8125rem] font-bold leading-tight">Электрик</span>
                <span className="block text-[0.75rem] text-muted">⭐ 5,0 · выезд</span>
              </span>
              <span className="ml-auto text-lg text-highlight">❤️</span>
            </div>
            {[
              ["☕", "Кафе у моря", "⭐ 4,8 · Бат-Галим · доставка"],
              ["🩺", "Стоматолог", "⭐ 4,9 · Кармель · касса"],
              ["📚", "Репетитор по математике", "⭐ 5,0 · онлайн"],
              ["🚚", "Грузоперевозки", "⭐ 4,7 · по всему городу"],
              ["🐾", "Ветеринарная клиника", "⭐ 4,9 · Неве-Шаанан"],
            ].map(([icon, name, meta]) => (
              <div key={name} className="flex items-center gap-2 rounded-2xl bg-white p-2.5 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-lg">{icon}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.8125rem] font-bold leading-tight">{name}</span>
                  <span className="block truncate text-[0.75rem] text-muted">{meta}</span>
                </span>
              </div>
            ))}
          </div>
          {/* Нижняя кнопка Mini App */}
          <div className="px-3 pb-5 pt-1 xl:pb-14">
            <div className="rounded-xl bg-[#229ed9] py-2.5 text-center text-sm font-bold text-white">Оставить заявку</div>
          </div>
        </div>
      </div>
    </div>
  );
}
