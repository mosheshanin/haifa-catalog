-- Заказы дополнительных услуг на последнем шаге добавления карточки (решение заказчика 3 ноября 2026):
-- улучшить описание, фотосессия, интервью, консультация, сайт на поддомене. Заказ = заявка администратору,
-- оплата обсуждается отдельно (онлайн-оплаты нет). Записи — только с сервера секретным клиентом
-- (orderExtras в src/app/actions/cabinet.ts), поэтому политик на вставку нет.
create type public.service_order_status as enum ('new', 'in_progress', 'done', 'cancelled');

create table public.service_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  -- [{ "code": "photoshoot", "title": "Фотосессия", "price": 1500 }] — цена на момент заказа
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 10),
  total integer not null check (total >= 0),
  comment text check (comment is null or char_length(comment) <= 1000),
  status public.service_order_status not null default 'new',
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  handled_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index service_orders_created_idx on public.service_orders (created_at desc);
create index service_orders_listing_idx on public.service_orders (listing_id);
create index service_orders_user_idx on public.service_orders (user_id);
alter table public.service_orders enable row level security;

create trigger service_orders_updated_at before update on public.service_orders
  for each row execute function public.set_updated_at();

create policy service_orders_read on public.service_orders for select to authenticated using (
  user_id = (select auth.uid()) or (select public.is_admin())
);

-- merge_profiles дополнена таблицей service_orders (правило из CLAUDE.md: каждая таблица со ссылкой на пользователя).
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
