-- Дополнительные услуги при добавлении карточки — в базу, чтобы их правил администратор (просьба заказчика
-- 5 ноября 2026): название, описание, стоимость; стоимость может быть «по запросу» (price = null).
-- Раньше список был в коде (src/lib/extra-services.ts). Заказы (service_orders.items) хранят копию названия
-- и цены на момент заказа, поэтому правка или удаление услуги старые заказы не меняет.
create table public.extra_services (
  code text primary key check (code ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and char_length(code) <= 40),
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 500),
  -- Цена в шекелях; null — «по запросу».
  price integer check (price is null or price between 0 and 1000000),
  icon text not null default 'star' check (char_length(icon) <= 40), -- 3D-иконка из public/icons/3d
  -- Услуги с одинаковой группой нельзя заказать вместе (два вида интервью).
  exclusive_group text check (exclusive_group is null or char_length(exclusive_group) <= 40),
  -- На каких шагах мастера предлагать (на последнем шаге видны все включённые услуги).
  offer_steps text[] not null default '{}' check (
    offer_steps <@ array['contacts', 'about', 'place', 'hours', 'services', 'photos', 'languages', 'features']
  ),
  -- Короткий текст предложения на шагах; пусто — берётся описание.
  step_text text check (step_text is null or char_length(step_text) <= 200),
  sort integer not null default 100,
  is_active boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.extra_services enable row level security;

create trigger extra_services_updated_at before update on public.extra_services
  for each row execute function public.set_updated_at();

-- Читают все (мастер добавления), скрытые — только администратор. Пишет сервер секретным клиентом
-- (saveExtraService в src/app/actions/admin.ts), поэтому политик на запись нет.
create policy extra_services_read on public.extra_services for select to anon, authenticated
  using (is_active or (select public.is_admin()));

insert into public.extra_services (code, title, description, price, icon, exclusive_group, offer_steps, step_text, sort) values
  ('description', 'Улучшить описание карточки',
   'Редактор HBC перепишет описание: понятно, живо и так, чтобы карточку находили в поиске.', 500, 'pencil', null,
   array['contacts', 'about', 'place', 'hours', 'services', 'photos', 'languages', 'features'],
   'Не хотите писать сами? Редактор HBC сделает описание за вас.', 10),
  ('photoshoot', 'Фотосессия',
   'Фотограф снимет вас, ваше место и работы. Лучшие кадры поставим в карточку.', 1500, 'camera', null,
   array['photos'], 'Нет хороших фото? Пришлём фотографа.', 20),
  ('interview', 'Интервью',
   'Интервью о вас и вашем деле с публикацией в карточке и на главной странице HBC.', 1500, 'mic', 'interview',
   array['about'], 'Расскажите о себе в интервью — опубликуем в карточке и на главной.', 30),
  ('interview_media', 'Интервью + пакет СМИ',
   'То же интервью в карточке и на главной, а также публикация в пакете СМИ.', 5000, 'megaphone', 'interview',
   '{}', null, 40),
  ('consult', 'Консультация Натальи Пигулевской',
   'Консультация по развитию бизнеса.', 1500, 'chat-bubble', null,
   array['services'], 'Подскажем, как выстроить цены и привлечь клиентов.', 50),
  ('subdomain_site', 'Отдельный сайт на поддомене HBC',
   'Свой небольшой сайт с адресом на домене проекта, на основе вашей карточки.', 2000, 'computer', null,
   array['contacts'], 'Нет своего сайта? Сделаем сайт на основе этой карточки.', 60)
on conflict (code) do nothing;

-- merge_profiles: в extra_services есть ссылка на пользователя (updated_by) — правило из CLAUDE.md.
-- Функция целиком из 20261103000002_service_orders.sql плюс одна строка.
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
  update public.service_orders set user_id = p_keep where user_id = p_remove;
  update public.service_orders set handled_by = p_keep where handled_by = p_remove;
  update public.extra_services set updated_by = p_keep where updated_by = p_remove;
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
