-- Сколько опубликованных карточек категории (вместе с подкатегориями) в каждом районе.
-- Страница категории показывает в свёрнутом списке «По районам» только районы с карточками (решение 2 ноября 2026).
create or replace function public.category_district_counts(p_category_id bigint)
returns table (district_id bigint, listings integer)
language sql
stable
set search_path = ''
as $$
  select d.id, count(*)::integer
  from public.listings l
  cross join lateral unnest(l.district_ids) as d(id)
  where l.status = 'published'
    and l.category_id in (
      select c.id from public.categories c where c.id = p_category_id or c.parent_id = p_category_id
    )
  group by d.id;
$$;

revoke all on function public.category_district_counts(bigint) from public;
grant execute on function public.category_district_counts(bigint) to anon, authenticated, service_role;
