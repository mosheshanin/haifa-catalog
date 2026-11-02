-- Свежесть данных карточки (раздел 8 ТЗ, п. «Свежесть»; решение 2 ноября 2026, раздел 14):
-- через 180 дней без подтверждения владельцу приходит напоминание в Telegram с кнопкой «Всё верно»;
-- не чаще раза в 30 дней. Подтверждение без правок — confirm_listing_data.

alter table public.listings add column if not exists freshness_reminded_at timestamptz;

-- «Всё верно»: дата подтверждения на сегодня (по Израилю) в карточке и в опубликованной версии (её показывает страница).
create or replace function public.confirm_listing_data(p_listing uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today text := to_char((now() at time zone 'Asia/Jerusalem')::date, 'YYYY-MM-DD');
begin
  update public.listing_versions v
  set data = jsonb_set(v.data, '{confirmedAt}', to_jsonb(v_today))
  from public.listings l
  where l.id = p_listing and v.id = l.published_version_id;

  update public.listings
  set data_confirmed_at = now(), freshness_reminded_at = null
  where id = p_listing;
end;
$$;

revoke all on function public.confirm_listing_data(uuid) from public, anon, authenticated;
grant execute on function public.confirm_listing_data(uuid) to service_role;

-- Кому пора напомнить: опубликованные карточки с владельцем, данные не подтверждались 180 дней,
-- напоминания не было 30 дней. Примерные карточки не трогаем.
create or replace function public.stale_listings(p_limit integer default 200)
returns table (id uuid, owner_id uuid, title text, section public.section, slug text, confirmed_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.owner_id, l.title, l.section, l.slug, coalesce(l.data_confirmed_at, l.published_at, l.created_at)
  from public.listings l
  where l.status = 'published' and not l.is_demo and l.owner_id is not null
    and coalesce(l.data_confirmed_at, l.published_at, l.created_at) < now() - interval '180 days'
    and (l.freshness_reminded_at is null or l.freshness_reminded_at < now() - interval '30 days')
  order by 6
  limit p_limit;
$$;

revoke all on function public.stale_listings(integer) from public, anon, authenticated;
grant execute on function public.stale_listings(integer) to service_role;
