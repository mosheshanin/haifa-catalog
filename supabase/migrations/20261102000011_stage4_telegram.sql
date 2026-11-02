-- Этап 4 (раздел 7 ТЗ): бот на grammY, заявки в Telegram с кнопками, канал, уведомления клиенту.

-- ---------------------------------------------------------------
-- Настройки бота и канала. Только администратор и сервер (в отличие от site_settings, не публичные).
-- Ключи: 'channel' {chatId, title, username, mode: instant|digest|off},
--        'channel_candidate' {chatId, title, username, addedByTelegramId, at} — бот добавлен в канал, ждёт подтверждения.
-- ---------------------------------------------------------------
create table if not exists public.bot_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.bot_settings enable row level security;
create policy bot_settings_admin on public.bot_settings for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------
-- Кто нажал «Старт» у бота и не заблокировал его. Пишет только сервер (вебхук).
-- Бот может написать человеку только после «Старт» (раздел 7).
-- ---------------------------------------------------------------
create table if not exists public.telegram_chats (
  telegram_id bigint primary key,
  username text,
  started_at timestamptz not null default now(),
  blocked_at timestamptz
);
alter table public.telegram_chats enable row level security;
create policy telegram_chats_own_read on public.telegram_chats for select to authenticated using (
  (select public.is_admin())
  or telegram_id = (select p.telegram_id from public.profiles p where p.id = (select auth.uid()))
);

-- ---------------------------------------------------------------
-- Посты канала: новая карточка или новое спецпредложение. queued — ждёт дайджеста или отправки.
-- ---------------------------------------------------------------
create table if not exists public.channel_posts (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  kind text not null check (kind in ('listing', 'offer')),
  item_key text not null default '',            -- для спецпредложения: <id блока>:<название>
  item_title text,
  instant_change_id bigint references public.instant_changes (id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'posted', 'deleted', 'failed', 'cancelled')),
  chat_id bigint,
  message_id bigint,
  error text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  unique (listing_id, kind, item_key)
);
create index if not exists channel_posts_queued_idx on public.channel_posts (created_at) where status = 'queued';
create index if not exists channel_posts_change_idx on public.channel_posts (instant_change_id);
alter table public.channel_posts enable row level security;
create policy channel_posts_admin_read on public.channel_posts for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------
-- Заявки: сообщение владельцу в Telegram (чтобы обновлять кнопки) и напоминание клиенту накануне.
-- ---------------------------------------------------------------
alter table public.requests
  add column if not exists tg_chat_id bigint,
  add column if not exists tg_message_id bigint,
  add column if not exists decided_at timestamptz,
  add column if not exists reminded_at timestamptz;
create index if not exists requests_reminder_idx on public.requests (desired_date)
  where status = 'accepted' and reminded_at is null and user_id is not null;

-- Новый пункт настроек уведомлений: ответы владельцев, решения по заявкам, акции в избранном.
alter table public.profiles alter column notify_prefs
  set default '{"requests": true, "reviews": true, "moderation": true, "updates": true}';
