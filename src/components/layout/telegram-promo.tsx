import { t } from "@/i18n/ru";
import { miniAppLink } from "@/lib/env";

// Промо-блок мини-приложения в подвале (решения 2 ноября 2026, раздел 10 ТЗ). Телефон-иллюстрация «заезжает»
// вверх на фон страницы над подвалом. Внутри самого Mini App блок не нужен — скрыт CSS (html[data-telegram="1"]).
// На экране телефона — главная страница каталога в том виде, как она открывается в Telegram.
const p = t.telegramPromo;

export function TelegramPromo() {
  return (
    <section aria-labelledby="tg-promo-title" className="tg-promo mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      <div className="relative isolate flow-root rounded-[2rem] bg-[linear-gradient(135deg,#2aabee_0%,#3a63e0_48%,#1e1b4b_100%)] text-white shadow-[0_24px_60px_-24px_rgba(30,27,75,0.55)] xl:min-h-[31rem]">
        {/* Мягкие световые пятна — внутри карточки */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[2rem]">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-32 right-1/3 h-80 w-80 rounded-full bg-[#ffc933]/25 blur-3xl" />
        </div>

        {/* Телефон. До 1280 px — над текстом, видна верхняя часть экрана (18rem), низ растворяется.
            От 1280 px — справа целиком, в настоящих пропорциях (9:19,5): ширина 15rem = высота 32,5rem,
            выступает над карточкой на 4rem; карточка не ниже 31rem, поэтому телефон помещается полностью. */}
        <div
          aria-hidden
          className="pointer-events-none relative z-10 -mt-24 flex h-[18rem] justify-center overflow-hidden [mask-image:linear-gradient(to_bottom,#000_72%,transparent)] xl:absolute xl:-top-16 xl:right-16 xl:mt-0 xl:block xl:h-auto xl:w-[15rem] xl:overflow-visible xl:[mask-image:none]"
        >
          <PhoneIllustration />
        </div>

        <div className="relative px-5 pb-8 pt-2 sm:px-10 sm:pb-10 xl:max-w-[calc(100%-22rem)] xl:py-14 xl:pl-12">
          <h2 id="tg-promo-title" className="text-[1.75rem] font-extrabold leading-tight sm:text-4xl">
            {p.title}
          </h2>
          <p className="mt-3 max-w-xl text-white/85">{p.lead}</p>

          <ul className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:gap-x-8">
            {p.benefits.map((b) => (
              <li key={b.title} className="flex gap-3 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm xl:bg-transparent xl:p-0 xl:ring-0 xl:backdrop-blur-none">
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

          <div className="mt-8 flex flex-col sm:flex-row">
            <a
              href={miniAppLink()}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-13 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-highlight px-6 font-display text-lg font-extrabold text-primary shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#ffd54f]"
            >
              <span aria-hidden>✈️</span> {p.open}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// Рисованный экран мини-приложения (свой, без чужих логотипов): шапка Telegram, шапка сайта,
// тёмный блок с поиском и список категорий — как на главной странице.
function PhoneIllustration() {
  return (
    <div className="relative w-[15rem] shrink-0 xl:aspect-[9/19.5] xl:w-full">
      <div className="absolute -right-5 top-28 z-10 rotate-[5deg] whitespace-nowrap rounded-full bg-highlight px-3 py-1.5 text-xs font-extrabold text-primary shadow-lg sm:-right-14 xl:-right-10 xl:top-[58%]">
        🎁 −20% в избранном
      </div>

      {/* Корпус */}
      <div className="rounded-[2.4rem] bg-[#14122e] p-2 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/20 xl:h-full">
        <div className="relative flex h-[33rem] flex-col overflow-hidden rounded-[2rem] bg-surface-alt text-ink xl:h-full">
          {/* Вырез камеры */}
          <div className="absolute left-1/2 top-2 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-[#14122e]" />

          {/* Шапка Telegram */}
          <div className="flex items-center justify-between bg-white px-3 pb-2 pt-8 text-[0.6875rem]">
            <span className="font-bold text-[#1677a8]">✕ Закрыть</span>
            <span className="font-bold">HBC</span>
            <span className="font-bold text-muted">•••</span>
          </div>

          {/* Шапка сайта */}
          <div className="border-b border-line bg-white px-3 pb-2 pt-1.5">
            <div className="flex items-center gap-1.5">
              <span className="rounded-md bg-primary px-1.5 py-0.5 font-display text-[0.75rem] font-extrabold text-white">HBC</span>
              <span className="ml-auto text-[0.8125rem]">🔎</span>
              <span className="text-[0.8125rem]">❤️</span>
              <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[0.5625rem] font-bold text-white">А</span>
            </div>
            <div className="mt-1.5 flex gap-1">
              <span className="whitespace-nowrap rounded-full bg-primary-soft px-1.5 py-0.5 text-[0.5625rem] font-bold text-primary">🏢 Бизнесы</span>
              <span className="whitespace-nowrap rounded-full bg-primary-soft px-1.5 py-0.5 text-[0.5625rem] font-bold text-primary">👷 Специалисты</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2.5 overflow-hidden p-2.5">
            {/* Главный блок с поиском */}
            <div className="rounded-2xl bg-primary px-3 py-3.5 text-white">
              <p className="text-[0.5625rem] font-extrabold text-highlight">HaifaBusinessClub</p>
              <p className="mt-1 font-display text-[0.8125rem] font-extrabold leading-tight">Сообщество проверенных бизнесов и специалистов Хайфы</p>
              <div className="mt-2.5 flex items-center gap-1 rounded-full bg-white p-0.5 pl-2 text-[0.5625rem] text-muted">
                <span>🔍 Что ищете?</span>
                <span className="ml-auto rounded-full bg-accent px-2 py-1 font-bold text-white">Найти</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {["💅 Маникюр", "🦷 Стоматолог", "💡 Электрик"].map((c) => (
                  <span key={c} className="whitespace-nowrap rounded-full bg-white/15 px-1.5 py-0.5 text-[0.5625rem] font-bold">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            {/* Категории */}
            <p className="px-0.5 font-display text-[0.8125rem] font-extrabold">🏢 Бизнесы</p>
            {[
              ["🍽️", "Еда и напитки"],
              ["💅", "Красота и уход"],
              ["🩺", "Здоровье и клиники"],
              ["🛠️", "Дом и ремонт"],
              ["🚗", "Авто"],
            ].map(([icon, name]) => (
              <div key={name} className="flex items-center gap-2 rounded-xl border border-line bg-white p-1.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-[0.8125rem]">{icon}</span>
                <span className="min-w-0 flex-1 truncate text-[0.6875rem] font-bold">{name}</span>
                <span className="pr-1 text-[0.6875rem] text-muted">→</span>
              </div>
            ))}
          </div>
          {/* Полоска «домой» */}
          <div className="flex justify-center bg-surface-alt pb-1.5 pt-1">
            <span className="h-1 w-20 rounded-full bg-ink/30" />
          </div>
        </div>
      </div>
    </div>
  );
}
