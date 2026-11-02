-- Этап 3: кабинет, модерация, отзывы, жалобы, заявки, статистика (разделы 2, 4, 5, 6 ТЗ).
-- Запись в новые таблицы идёт только с сервера (секретный ключ) после проверки прав, капчи и частоты:
-- иначе бот мог бы обойти капчу, обращаясь к базе напрямую публичным ключом.

-- ---------------------------------------------------------------
-- Отзывы
-- ---------------------------------------------------------------
create type public.review_status as enum ('pending', 'approved', 'rejected');

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  text text not null check (char_length(text) between 1 and 3000),
  author_name text not null check (char_length(author_name) between 1 and 80),
  status public.review_status not null default 'pending',
  reject_reason text,
  owner_reply text check (owner_reply is null or char_length(owner_reply) <= 2000),
  owner_reply_at timestamptz,
  moderated_by uuid references public.profiles (id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (listing_id, user_id)
);
create index reviews_listing_status_idx on public.reviews (listing_id, status, created_at desc);
create index reviews_pending_idx on public.reviews (created_at) where status = 'pending';
alter table public.reviews enable row level security;

create policy reviews_read on public.reviews for select to authenticated using (
  user_id = (select auth.uid())
  or (select public.is_admin())
  or (status = 'approved' and exists (
        select 1 from public.listings l where l.id = reviews.listing_id and l.owner_id = (select auth.uid())))
);

-- Рейтинг карточки = среднее по одобренным отзывам (у примерных карточек рейтинг вымышленный и не пересчитывается).
create or replace function public.refresh_listing_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing uuid := coalesce(new.listing_id, old.listing_id);
begin
  update public.listings l set
    rating_avg = (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.listing_id = v_listing and r.status = 'approved'),
    rating_count = (select count(*) from public.reviews r where r.listing_id = v_listing and r.status = 'approved')
  where l.id = v_listing and not l.is_demo;
  return null;
end;
$$;
revoke all on function public.refresh_listing_rating() from public, anon, authenticated;

create trigger reviews_rating after insert or update of status, rating or delete on public.reviews
  for each row execute function public.refresh_listing_rating();

-- ---------------------------------------------------------------
-- Жалобы: на карточку, на отзыв, запрос «исправить или удалить данные» (может отправить и гость)
-- ---------------------------------------------------------------
create type public.complaint_status as enum ('new', 'resolved', 'rejected');

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('listing', 'review', 'data_request')),
  listing_id uuid not null references public.listings (id) on delete cascade,
  review_id uuid references public.reviews (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 80),
  text text check (text is null or char_length(text) <= 2000),
  contact text check (contact is null or char_length(contact) <= 120),
  status public.complaint_status not null default 'new',
  decision text,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind <> 'review' or review_id is not null)
);
create index complaints_new_idx on public.complaints (created_at) where status = 'new';
alter table public.complaints enable row level security;

create policy complaints_read on public.complaints for select to authenticated using (
  user_id = (select auth.uid()) or (select public.is_admin())
);

-- ---------------------------------------------------------------
-- Заявки посетителей (раздел 5). Владелец меняет статус и заметку; в Telegram уходят на этапе 4.
-- ---------------------------------------------------------------
create type public.request_status as enum ('new', 'accepted', 'rejected');

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  contact text not null check (char_length(contact) between 3 and 120),
  service text check (service is null or char_length(service) <= 200),
  master text check (master is null or char_length(master) <= 80),
  desired_date date,
  desired_time text check (desired_time is null or desired_time ~ '^\d{2}:\d{2}$'),
  comment text check (comment is null or char_length(comment) <= 1000),
  status public.request_status not null default 'new',
  owner_note text check (owner_note is null or char_length(owner_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index requests_listing_idx on public.requests (listing_id, created_at desc);
create index requests_user_idx on public.requests (user_id, created_at desc);
alter table public.requests enable row level security;

create trigger requests_updated_at before update on public.requests
  for each row execute function public.set_updated_at();

create policy requests_read on public.requests for select to authenticated using (
  user_id = (select auth.uid())
  or (select public.is_admin())
  or exists (select 1 from public.listings l where l.id = requests.listing_id and l.owner_id = (select auth.uid()))
);
revoke update on public.requests from authenticated, anon;
grant update (status, owner_note) on public.requests to authenticated;
create policy requests_owner_update on public.requests for update to authenticated
  using ((select public.is_active_user())
         and exists (select 1 from public.listings l where l.id = requests.listing_id and l.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.listings l where l.id = requests.listing_id and l.owner_id = (select auth.uid())));

-- ---------------------------------------------------------------
-- Статистика карточки: собственный счётчик без cookie (раздел 6), по дням
-- ---------------------------------------------------------------
create table public.listing_stats (
  listing_id uuid not null references public.listings (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('view', 'phone', 'whatsapp', 'telegram', 'route', 'website', 'share', 'request', 'favorite')),
  count integer not null default 0,
  primary key (listing_id, day, kind)
);
alter table public.listing_stats enable row level security;
create policy listing_stats_read on public.listing_stats for select to authenticated using (
  (select public.is_admin())
  or exists (select 1 from public.listings l where l.id = listing_stats.listing_id and l.owner_id = (select auth.uid()))
);

create or replace function public.track_listing_event(p_listing uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_kind not in ('view', 'phone', 'whatsapp', 'telegram', 'route', 'website', 'share', 'favorite') then
    return;
  end if;
  insert into public.listing_stats (listing_id, day, kind, count)
  select l.id, (now() at time zone 'Asia/Jerusalem')::date, p_kind, 1
  from public.listings l where l.id = p_listing and l.status = 'published'
  on conflict (listing_id, day, kind) do update set count = public.listing_stats.count + 1;
end;
$$;
revoke all on function public.track_listing_event(uuid, text) from public;
grant execute on function public.track_listing_event(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------
-- Журнал правок, опубликованных без проверки (раздел 2): «было — стало» и кнопка «Снять»
-- ---------------------------------------------------------------
create table public.instant_changes (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  version_id uuid references public.listing_versions (id) on delete set null,
  block_key text not null,           -- 'order', 'review_reply:<id>' или id блока
  block_type text not null,
  before jsonb,
  after jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  reverted_at timestamptz,
  reverted_by uuid references public.profiles (id) on delete set null,
  revert_reason text
);
create index instant_changes_listing_idx on public.instant_changes (listing_id, created_at desc);
create index instant_changes_open_idx on public.instant_changes (created_at desc) where reverted_at is null;
alter table public.instant_changes enable row level security;
create policy instant_changes_read on public.instant_changes for select to authenticated using (
  (select public.is_admin())
  or exists (select 1 from public.listings l where l.id = instant_changes.listing_id and l.owner_id = (select auth.uid()))
);

-- Версии: какие блоки ждут проверки и решения по отдельным блокам.
alter table public.listing_versions
  add column if not exists moderated_keys text[] not null default '{}',
  add column if not exists block_decisions jsonb not null default '{}';
comment on column public.listing_versions.moderated_keys is 'Ключи блоков, которые ждут проверки: header, contacts или id блока';
comment on column public.listing_versions.block_decisions is 'Решения модератора по блокам: {"<ключ>": {"ok": false, "reason": "..."}}';

-- ---------------------------------------------------------------
-- Настройки сайта, которые правятся в админке
-- ---------------------------------------------------------------
create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
create policy site_settings_public_read on public.site_settings for select to anon, authenticated using (true);
create policy site_settings_admin_write on public.site_settings for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

insert into public.site_settings (key, value) values
  ('review_rules', '{"minLength": 20, "forbidLinks": true, "forbidPhones": true}'),
  ('amenities', '["Оплата картой", "Оплата через Bit", "Wi-Fi", "Доступно для колясок", "Детская зона", "Кошерно", "Парковка", "Выезд на дом", "Онлайн", "Клалит", "Маккаби", "Меухедет", "Леумит"]'),
  ('languages', '["Русский", "Иврит", "Английский", "Арабский", "Украинский", "Французский", "Амхарский"]')
on conflict (key) do nothing;

-- Настройки уведомлений пользователя (этап 4 расширит).
alter table public.profiles add column if not exists notify_prefs jsonb not null default '{"requests": true, "reviews": true, "moderation": true}';
grant update (notify_prefs) on public.profiles to authenticated;

-- ---------------------------------------------------------------
-- Ограничение частоты отправки форм (вызывает только сервер)
-- ---------------------------------------------------------------
create table public.rate_events (
  key text not null,
  created_at timestamptz not null default now()
);
create index rate_events_key_idx on public.rate_events (key, created_at desc);
alter table public.rate_events enable row level security;

create or replace function public.rate_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.rate_events where created_at < now() - interval '1 day';
  select count(*) into v_count from public.rate_events
  where key = p_key and created_at > now() - make_interval(secs => p_window_seconds);
  if v_count >= p_limit then
    return false;
  end if;
  insert into public.rate_events (key) values (p_key);
  return true;
end;
$$;
revoke all on function public.rate_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_hit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------
-- Хранилище фото и файлов: bucket media, публичное чтение.
-- Пользователь пишет только в свою папку u/<id>/, администратор — куда угодно.
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/webp', 'image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy media_user_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = 'u'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (select public.is_active_user())
);
create policy media_user_delete on storage.objects for delete to authenticated using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = 'u'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);
create policy media_admin_all on storage.objects for all to authenticated
  using (bucket_id = 'media' and (select public.is_admin()))
  with check (bucket_id = 'media' and (select public.is_admin()));

-- ---------------------------------------------------------------
-- Объединение профилей: новые таблицы со ссылкой на пользователя (см. CLAUDE.md)
-- ---------------------------------------------------------------
create or replace function public.merge_profiles(p_keep uuid, p_remove uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remove public.profiles%rowtype;
begin
  if p_keep = p_remove then
    return;
  end if;

  select * into v_remove from public.profiles where id = p_remove for update;
  if not found then
    return;
  end if;
  perform 1 from public.profiles where id = p_keep for update;
  if not found then
    raise exception 'merge_profiles: профиль % не найден', p_keep;
  end if;

  update public.listings set owner_id = p_keep where owner_id = p_remove;
  update public.listings set created_by = p_keep where created_by = p_remove;
  update public.listing_versions set created_by = p_keep where created_by = p_remove;
  update public.listing_versions set reviewed_by = p_keep where reviewed_by = p_remove;

  delete from public.ownership_claims c
  where c.user_id = p_remove and c.status = 'pending'
    and exists (
      select 1 from public.ownership_claims k
      where k.user_id = p_keep and k.listing_id = c.listing_id and k.status = 'pending'
    );
  update public.ownership_claims set user_id = p_keep where user_id = p_remove;
  update public.ownership_claims set decided_by = p_keep where decided_by = p_remove;

  insert into public.favorites (user_id, listing_id, created_at)
  select p_keep, f.listing_id, f.created_at from public.favorites f where f.user_id = p_remove
  on conflict (user_id, listing_id) do nothing;
  delete from public.favorites where user_id = p_remove;

  -- Один отзыв на карточку от пользователя: при совпадении остаётся отзыв основного профиля.
  delete from public.reviews r
  where r.user_id = p_remove
    and exists (select 1 from public.reviews k where k.user_id = p_keep and k.listing_id = r.listing_id);
  update public.reviews set user_id = p_keep where user_id = p_remove;
  update public.reviews set moderated_by = p_keep where moderated_by = p_remove;
  update public.complaints set user_id = p_keep where user_id = p_remove;
  update public.complaints set decided_by = p_keep where decided_by = p_remove;
  update public.requests set user_id = p_keep where user_id = p_remove;
  update public.instant_changes set created_by = p_keep where created_by = p_remove;
  update public.instant_changes set reverted_by = p_keep where reverted_by = p_remove;
  update public.site_settings set updated_by = p_keep where updated_by = p_remove;

  update public.audit_log set actor_id = p_keep where actor_id = p_remove;
  update public.admin_emails set added_by = p_keep where added_by = p_remove;
  update public.link_tokens set used_at = coalesce(used_at, now()) where user_id = p_remove;

  update public.profiles set telegram_id = null, google_email = null where id = p_remove;

  update public.profiles k set
    telegram_id = coalesce(k.telegram_id, v_remove.telegram_id),
    telegram_username = coalesce(k.telegram_username, v_remove.telegram_username),
    google_email = coalesce(k.google_email, v_remove.google_email),
    display_name = coalesce(k.display_name, v_remove.display_name),
    avatar_url = coalesce(k.avatar_url, v_remove.avatar_url),
    is_blocked = k.is_blocked or v_remove.is_blocked
  where k.id = p_keep;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (p_keep, 'profile.merged', 'profile', p_keep::text, jsonb_build_object('merged_from', p_remove));
end;
$$;
revoke all on function public.merge_profiles(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_profiles(uuid, uuid) to service_role;

-- Поиск по тексту блока «Рейтинг на Google» не нужен; новый блок refresh_listing_search пропускает (ветка else).
