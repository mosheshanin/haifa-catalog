-- Этап 1. Основа: профили и роли, справочники, карточки с версиями,
-- заявки на права владельца, журнал действий, одноразовые токены привязки Telegram.
-- Правила доступа (RLS) включены на всех таблицах.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------
-- Типы
-- ---------------------------------------------------------------
create type public.section as enum ('biznes', 'specialisty');
create type public.app_role as enum ('user', 'admin');
create type public.listing_status as enum ('draft', 'pending', 'published', 'rejected', 'archived');
create type public.version_status as enum ('draft', 'pending', 'approved', 'rejected', 'superseded');
create type public.claim_status as enum ('pending', 'approved', 'rejected');
create type public.district_kind as enum ('haifa', 'suburb');

-- ---------------------------------------------------------------
-- Общее: updated_at
-- ---------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- Профили и роли
-- ---------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  google_email extensions.citext unique,
  telegram_id bigint unique,
  telegram_username text,
  role public.app_role not null default 'user',
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Список email администраторов (вход в админку только через Google).
create table public.admin_emails (
  email extensions.citext primary key,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and not p.is_blocked
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and not p.is_blocked
  );
$$;

-- Профиль создаётся автоматически при появлении пользователя.
-- Telegram-идентификатор берём только из app_metadata: её задаёт сервер,
-- пользователь изменить её не может.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text := coalesce(new.raw_app_meta_data ->> 'provider', '');
  v_tg_id bigint := nullif(new.raw_app_meta_data ->> 'telegram_id', '')::bigint;
  v_name text := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    new.raw_app_meta_data ->> 'telegram_name'
  );
  v_avatar text := coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture',
    new.raw_app_meta_data ->> 'telegram_photo'
  );
  v_google_email text := case when v_provider = 'google' then new.email end;
  v_role public.app_role := 'user';
begin
  if v_google_email is not null
     and exists (select 1 from public.admin_emails a where a.email = v_google_email::extensions.citext) then
    v_role := 'admin';
  end if;

  insert into public.profiles (id, display_name, avatar_url, google_email, telegram_id, telegram_username, role)
  values (
    new.id,
    v_name,
    v_avatar,
    v_google_email,
    v_tg_id,
    new.raw_app_meta_data ->> 'telegram_username',
    v_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Если к существующему профилю позже привязали Google (вход через Google тем же пользователем),
-- сервер вызывает эту функцию, чтобы обновить email и роль администратора.
create or replace function public.sync_google_identity(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p
  set google_email = p_email::extensions.citext,
      role = case
        when exists (select 1 from public.admin_emails a where a.email = p_email::extensions.citext) then 'admin'::public.app_role
        else p.role
      end
  where p.id = p_user_id;
end;
$$;

revoke all on function public.sync_google_identity(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------
-- Справочники: категории и районы
-- ---------------------------------------------------------------
create table public.categories (
  id bigint generated always as identity primary key,
  section public.section not null,
  parent_id bigint references public.categories (id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  sort integer not null default 0,
  is_active boolean not null default true,
  schema_type text,
  seo_title text,
  seo_description text,
  seo_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section, slug)
);

create index categories_parent_idx on public.categories (parent_id);

create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create table public.districts (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  kind public.district_kind not null default 'haifa',
  sort integer not null default 0,
  is_active boolean not null default true,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger districts_updated_at before update on public.districts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- Карточки и их версии
-- ---------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  section public.section not null,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status public.listing_status not null default 'draft',
  owner_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  plan text not null default 'free',
  features jsonb not null default '{}'::jsonb,
  is_verified boolean not null default false,
  -- Поля для списков и поиска, копируются из опубликованной версии
  title text,
  category_id bigint references public.categories (id) on delete set null,
  district_ids bigint[] not null default '{}',
  location extensions.geography(point, 4326),
  published_version_id uuid,
  published_at timestamptz,
  data_confirmed_at timestamptz,
  publish_to_channel boolean not null default true,
  linked_listing_id uuid references public.listings (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section, slug)
);

create index listings_status_idx on public.listings (status);
create index listings_owner_idx on public.listings (owner_id);
create index listings_category_idx on public.listings (category_id);
create index listings_districts_idx on public.listings using gin (district_ids);
create index listings_location_idx on public.listings using gist (location);

create trigger listings_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

-- Версия карточки: шапка и блоки в виде структурированных данных.
-- Новый тип блока добавляется кодом, схема базы не меняется.
create table public.listing_versions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  status public.version_status not null default 'draft',
  data jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_comment text
);

create index listing_versions_listing_idx on public.listing_versions (listing_id, created_at desc);
create index listing_versions_status_idx on public.listing_versions (status);

alter table public.listings
  add constraint listings_published_version_fk
  foreign key (published_version_id) references public.listing_versions (id) on delete set null;

-- Адреса карточек и категорий одного раздела не должны совпадать:
-- /biznes/krasota (категория) и /biznes/nazvanie (карточка) живут на одном уровне.
-- Подкатегории и районы делят второй уровень: /biznes/krasota/hadar.
create or replace function public.check_slug_namespace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'listings' then
    if exists (select 1 from public.categories c where c.section = new.section and c.slug = new.slug) then
      raise exception 'Адрес "%" уже занят категорией', new.slug using errcode = '23505';
    end if;
  elsif tg_table_name = 'categories' then
    if exists (select 1 from public.listings l where l.section = new.section and l.slug = new.slug) then
      raise exception 'Адрес "%" уже занят карточкой', new.slug using errcode = '23505';
    end if;
    if exists (select 1 from public.districts d where d.slug = new.slug) then
      raise exception 'Адрес "%" уже занят районом', new.slug using errcode = '23505';
    end if;
  elsif tg_table_name = 'districts' then
    if exists (select 1 from public.categories c where c.slug = new.slug) then
      raise exception 'Адрес "%" уже занят категорией', new.slug using errcode = '23505';
    end if;
  end if;
  return new;
end;
$$;

create trigger listings_slug_ns before insert or update of slug, section on public.listings
  for each row execute function public.check_slug_namespace();
create trigger categories_slug_ns before insert or update of slug, section on public.categories
  for each row execute function public.check_slug_namespace();
create trigger districts_slug_ns before insert or update of slug on public.districts
  for each row execute function public.check_slug_namespace();

-- Старые адреса карточек: при смене названия старый адрес перенаправляет на новый (301).
create table public.listing_slug_history (
  section public.section not null,
  slug text not null,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (section, slug)
);

create or replace function public.remember_old_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.slug is distinct from new.slug or old.section is distinct from new.section then
    insert into public.listing_slug_history (section, slug, listing_id)
    values (old.section, old.slug, old.id)
    on conflict (section, slug) do update set listing_id = excluded.listing_id, created_at = now();
  end if;
  return new;
end;
$$;

create trigger listings_remember_slug after update of slug, section on public.listings
  for each row execute function public.remember_old_slug();

-- ---------------------------------------------------------------
-- Заявки на права владельца
-- ---------------------------------------------------------------
create table public.ownership_claims (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  contact text not null,
  message text,
  status public.claim_status not null default 'pending',
  admin_comment text,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index ownership_claims_status_idx on public.ownership_claims (status, created_at);
create unique index ownership_claims_one_pending
  on public.ownership_claims (listing_id, user_id) where status = 'pending';

-- ---------------------------------------------------------------
-- Журнал действий
-- ---------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);
create index audit_log_created_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------
-- Одноразовые токены: «Открыть в Telegram» и привязка Google к Telegram-профилю.
-- Доступны только серверу (ключ service_role), правила для пользователей не создаются.
-- ---------------------------------------------------------------
create table public.link_tokens (
  token_hash text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  purpose text not null check (purpose in ('link_telegram', 'link_google')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index link_tokens_expires_idx on public.link_tokens (expires_at);

-- ---------------------------------------------------------------
-- Правила доступа (RLS)
-- ---------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.admin_emails enable row level security;
alter table public.categories enable row level security;
alter table public.districts enable row level security;
alter table public.listings enable row level security;
alter table public.listing_versions enable row level security;
alter table public.listing_slug_history enable row level security;
alter table public.ownership_claims enable row level security;
alter table public.audit_log enable row level security;
alter table public.link_tokens enable row level security;

-- Профили: свой профиль видит владелец, все — администратор.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

-- Пользователь меняет только своё отображаемое имя; роль и блокировку — только администратор.
revoke update on public.profiles from authenticated, anon;
grant update (display_name) on public.profiles to authenticated;

create policy profiles_update_own_name on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and (select public.is_active_user()))
  with check (id = (select auth.uid()));

-- Роль и блокировку меняет только администратор через эту функцию
-- (права на столбцы role и is_blocked у обычных пользователей нет).
create or replace function public.admin_set_user_access(p_user_id uuid, p_role public.app_role, p_blocked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Недостаточно прав' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() and (p_role <> 'admin' or p_blocked) then
    raise exception 'Нельзя снять права администратора с самого себя' using errcode = '42501';
  end if;
  update public.profiles set role = p_role, is_blocked = p_blocked where id = p_user_id;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'user.access_changed', 'profile', p_user_id::text,
          jsonb_build_object('role', p_role, 'blocked', p_blocked));
end;
$$;

revoke all on function public.admin_set_user_access(uuid, public.app_role, boolean) from public, anon;
grant execute on function public.admin_set_user_access(uuid, public.app_role, boolean) to authenticated;

-- Список администраторов: только администраторы.
create policy admin_emails_admin_all on public.admin_emails
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Справочники: активные записи видят все, правит администратор.
create policy categories_public_read on public.categories
  for select to anon, authenticated
  using (is_active or (select public.is_admin()));
create policy categories_admin_write on public.categories
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy districts_public_read on public.districts
  for select to anon, authenticated
  using (is_active or (select public.is_admin()));
create policy districts_admin_write on public.districts
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Карточки: опубликованные видят все; свои — владелец; все — администратор.
create policy listings_public_read on public.listings
  for select to anon, authenticated
  using (
    status = 'published'
    or owner_id = (select auth.uid())
    or (select public.is_admin())
  );

-- Пользователь может создать карточку-черновик, которой сам владеет («Добавить бизнес или специалиста»).
create policy listings_user_create_draft on public.listings
  for insert to authenticated
  with check (
    (select public.is_active_user())
    and status = 'draft'
    and owner_id = (select auth.uid())
    and created_by = (select auth.uid())
    and plan = 'free'
    and features = '{}'::jsonb
    and not is_verified
    and published_version_id is null
  );

-- Статусы, тарифы и публикацию меняет администратор (или сервер после проверки).
create policy listings_admin_write on public.listings
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Версии: опубликованную видят все, свои — владелец карточки, все — администратор.
create policy listing_versions_read on public.listing_versions
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id
        and (
          (l.status = 'published' and l.published_version_id = listing_versions.id)
          or l.owner_id = (select auth.uid())
        )
    )
    or (select public.is_admin())
  );

-- Владелец создаёт черновики и отправляет их на проверку, но не может их одобрить.
create policy listing_versions_owner_insert on public.listing_versions
  for insert to authenticated
  with check (
    (select public.is_active_user())
    and created_by = (select auth.uid())
    and status in ('draft', 'pending')
    and reviewed_by is null
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.owner_id = (select auth.uid())
    )
  );

create policy listing_versions_owner_update on public.listing_versions
  for update to authenticated
  using (
    (select public.is_active_user())
    and status in ('draft', 'pending')
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.owner_id = (select auth.uid())
    )
  )
  with check (
    status in ('draft', 'pending')
    and reviewed_by is null
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.owner_id = (select auth.uid())
    )
  );

create policy listing_versions_admin_all on public.listing_versions
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Старые адреса нужны для перенаправлений на публичных страницах.
create policy slug_history_public_read on public.listing_slug_history
  for select to anon, authenticated
  using (true);
create policy slug_history_admin_write on public.listing_slug_history
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Заявки на права: пользователь подаёт и видит свои, администратор решает.
create policy claims_user_insert on public.ownership_claims
  for insert to authenticated
  with check (
    (select public.is_active_user())
    and user_id = (select auth.uid())
    and status = 'pending'
    and decided_by is null
  );
create policy claims_read on public.ownership_claims
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy claims_admin_update on public.ownership_claims
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Журнал: читает администратор; пишет сервер.
create policy audit_admin_read on public.audit_log
  for select to authenticated
  using ((select public.is_admin()));

-- link_tokens: политик нет — только сервер с ключом service_role.
