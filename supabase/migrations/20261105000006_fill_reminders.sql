-- Еженедельный совет владельцу, как сделать карточку заметнее (решение заказчика 5 ноября 2026).
-- Ежедневный cron шлёт совет опубликованной карточке не раньше чем через 7 дней после публикации и не чаще раза
-- в 7 дней, пока заполненность ниже 75% («Сильная»), не больше 6 раз. Выключается настройкой уведомлений `tips`
-- (кнопка «Не напоминать» в сообщении или галочка в кабинете).
alter table public.listings
  add column if not exists fill_reminded_at timestamptz,
  add column if not exists fill_reminders_sent integer not null default 0;

comment on column public.listings.fill_reminded_at is 'Когда последний раз отправлен совет по заполненности (src/lib/telegram/fill.ts)';
comment on column public.listings.fill_reminders_sent is 'Сколько советов по заполненности отправлено (не больше 6)';
