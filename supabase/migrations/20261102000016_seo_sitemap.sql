-- Этап 5, SEO (раздел 8 ТЗ).
-- 1) listing_is_complete — карточка заполнена достаточно для индексации (решение 2 ноября 2026, раздел 14):
--    обложка, описание от 100 знаков, телефон или мессенджер, адрес или зона выезда.
--    То же правило в коде — isListingComplete (src/lib/seo/indexable.ts); менять оба места вместе.
-- 2) sitemap_entries — адреса для sitemap.xml: заполненные карточки (без примеров), категории,
--    подкатегории с карточками, «категория + район» от 3 карточек. Примерные карточки (is_demo) не считаются.

create or replace function public.listing_is_complete(p_data jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    coalesce(p_data #>> '{header,coverUrl}', '') <> ''
    and exists (
      select 1 from jsonb_array_elements(coalesce(p_data -> 'blocks', '[]')) b
      where b ->> 'type' = 'description' and not coalesce((b ->> 'hidden')::boolean, false)
        and char_length(btrim(coalesce(b #>> '{data,text}', ''))) >= 100)
    and (coalesce(p_data #>> '{contacts,phone}', '') <> ''
         or coalesce(p_data #>> '{contacts,whatsapp}', '') <> ''
         or coalesce(p_data #>> '{contacts,telegram}', '') <> '')
    and exists (
      select 1 from jsonb_array_elements(coalesce(p_data -> 'blocks', '[]')) b
      where not coalesce((b ->> 'hidden')::boolean, false)
        and ((b ->> 'type' = 'address' and coalesce(b #>> '{data,address}', '') <> '')
             or (b ->> 'type' = 'service_area' and jsonb_array_length(coalesce(b #> '{data,districtSlugs}', '[]')) > 0)));
$$;

create or replace function public.sitemap_entries()
returns table (section public.section, path text, lastmod timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with pub as (
    select l.* from public.listings l
    where l.status = 'published' and not l.is_demo
  ),
  cat_counts as (
    select c.id, c.section, c.slug, c.parent_id, count(r.id) as n, max(r.updated_at) as lastmod
    from public.categories c
    left join pub r on r.category_id = c.id
    where c.is_active
    group by c.id
  )
  -- Карточки
  select r.section, '/' || r.section || '/' || r.slug, r.updated_at
  from pub r
  join public.listing_versions v on v.id = r.published_version_id
  where public.listing_is_complete(v.data)
  union all
  -- Категории верхнего уровня (у них есть текст страницы) — всегда
  select c.section, '/' || c.section || '/' || c.slug,
         greatest(c.lastmod, (select max(k.lastmod) from cat_counts k where k.parent_id = c.id))
  from cat_counts c
  where c.parent_id is null
  union all
  -- Подкатегории — только с карточками
  select s.section, '/' || s.section || '/' || p.slug || '/' || s.slug, s.lastmod
  from cat_counts s
  join public.categories p on p.id = s.parent_id
  where s.n > 0
  union all
  -- «Категория + район» — от 3 карточек (как правило индексации страницы)
  select t.section, '/' || t.section || '/' || t.slug || '/' || d.slug, max(r.updated_at)
  from public.categories t
  join pub r on r.category_id in (select c.id from public.categories c where c.id = t.id or c.parent_id = t.id)
  cross join lateral unnest(r.district_ids) as rd(id)
  join public.districts d on d.id = rd.id and d.is_active
  where t.parent_id is null and t.is_active
  group by t.section, t.slug, d.slug
  having count(*) >= 3;
$$;

revoke all on function public.sitemap_entries() from public;
grant execute on function public.sitemap_entries() to anon, authenticated, service_role;
