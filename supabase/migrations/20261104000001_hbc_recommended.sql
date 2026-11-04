-- «HBC рекомендует» и пустые категории (решение заказчика 4 ноября 2026).
--
-- 1. listings.is_recommended — особый статус карточки. Ставит и снимает только администратор
--    (админка → карточка → «Действия»). В списке своей категории такие карточки всегда первые,
--    выделены фоном и занимают всю ширину колонки.
-- 2. search_listings отдаёт is_recommended и ставит такие карточки первыми, когда список ограничен категорией
--    (страница категории, подкатегории, «категория + район», фильтр «Категория», «Похожие»). При любой сортировке.
--    Тип результата меняется, поэтому функция пересоздаётся (drop + create в одной транзакции).
-- 3. category_listing_counts() — сколько опубликованных карточек прямо в каждой категории (примерные считаются:
--    они видны на сайте). Пустые категории и подкатегории не выводятся в списках сайта.

alter table public.listings add column if not exists is_recommended boolean not null default false;

comment on column public.listings.is_recommended is
  'Статус «HBC рекомендует»: первая в своей категории, выделена фоном, на всю ширину колонки. Ставит только администратор.';

-- Владелец, создающий черновик, не может сам поставить статус (как и «Проверено»).
alter policy listings_user_create_draft on public.listings
  with check (
    (select public.is_active_user())
    and status = 'draft'::public.listing_status
    and owner_id = (select auth.uid())
    and created_by = (select auth.uid())
    and plan = 'free'
    and features = '{}'::jsonb
    and not is_verified
    and not is_recommended
    and published_version_id is null
  );

drop function if exists public.search_listings(text, public.section, text, text, text, text[], boolean, text, text[], boolean, double precision, double precision, text, integer, integer);

create function public.search_listings(
  p_q text default null,
  p_section public.section default null,
  p_category text default null,
  p_district text default null,
  p_language text default null,
  p_formats text[] default null,
  p_has_offer boolean default false,
  p_kupa text default null,
  p_features text[] default null,
  p_open_now boolean default false,
  p_lat double precision default null,
  p_lng double precision default null,
  p_sort text default 'relevance',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table(
  id uuid, section public.section, slug text, title text, summary text, cover_url text, category_id bigint,
  district_ids bigint[], languages text[], formats text[], has_offer boolean, rating_avg numeric, rating_count integer,
  hours jsonb, is_verified boolean, is_demo boolean, is_recommended boolean, distance_m double precision, rank real,
  detected_category text, detected_district text, total_count bigint
)
language plpgsql
stable
set search_path to ''
as $function$
declare
  v_q text := public.norm_text(trim(coalesce(p_q, '')));
  v_rest text;
  v_district_id bigint;
  v_district_slug text := p_district;
  v_category_ids bigint[];
  v_hit_ids bigint[];
  v_hit_slug text;
  v_cat_boost bigint[];
  v_detected_cat text;
  v_detected_dist text;
  v_words text[];
  v_tsq tsquery;
  v_part text;
  v_word text;
  v_alts text[];
  v_point extensions.geography;
begin
  v_rest := v_q;

  -- Район во фразе: «маникюр кирьят-бялик», «стоматолог в адаре»
  if v_rest <> '' and v_district_slug is null then
    select d.slug, a into v_district_slug, v_detected_dist
    from public.districts d,
         lateral unnest(array[public.norm_text(d.name)] || d.aliases) a
    where d.is_active and length(a) >= 3 and v_rest like '%' || a || '%'
    order by length(a) desc
    limit 1;
    if v_detected_dist is not null then
      v_rest := trim(regexp_replace(replace(v_rest, v_detected_dist, ' '), '(^|\s)(в|во|на|район[а-я]*)(\s|$)', ' ', 'g'));
      v_detected_dist := v_district_slug;
    end if;
  end if;

  if v_district_slug is not null then
    select d.id into v_district_id from public.districts d where d.slug = v_district_slug;
  end if;

  -- Категория во фразе. Одно слово может быть у нескольких категорий (подкатегория в обоих разделах,
  -- «нотариус» у бизнесов и специалистов) — берём все и поднимаем их карточки выше.
  -- Фильтр не ставим: карточки категории и так находятся по тексту (в search_tsv есть название и
  -- псевдонимы категории), а заодно находятся те, у кого это слово в услугах (салон делает маникюр).
  if v_rest <> '' and p_category is null then
    select a into v_detected_cat
    from public.categories c,
         lateral unnest(array[public.norm_text(c.name)] || c.aliases) a
    where c.is_active and (p_section is null or c.section = p_section) and length(a) >= 3
      and v_rest like '%' || a || '%'
    order by length(a) desc
    limit 1;

    if v_detected_cat is not null then
      select array_agg(c.id), (array_agg(c.slug order by c.parent_id is null, c.sort))[1]
        into v_hit_ids, v_hit_slug
      from public.categories c
      where c.is_active and (p_section is null or c.section = p_section)
        and v_detected_cat = any (array[public.norm_text(c.name)] || c.aliases);

      select array_agg(distinct x) into v_cat_boost from (
        select unnest(v_hit_ids) as x
        union select c.id from public.categories c where c.parent_id = any (v_hit_ids)
      ) t;

      -- Остаток короче 3 букв — окончание слова («стоматологи»): запрос целиком о категории,
      -- показываем пользователю, как поняли запрос
      v_detected_cat := case when length(trim(replace(v_rest, v_detected_cat, ''))) < 3 then v_hit_slug end;
    end if;
  end if;

  -- Категория из адреса или фильтра: она и её подкатегории, строго
  if p_category is not null then
    select array_agg(c.id) into v_category_ids
    from public.categories c
    where (c.slug = p_category and (p_section is null or c.section = p_section))
       or c.parent_id in (select c2.id from public.categories c2 where c2.slug = p_category and (p_section is null or c2.section = p_section));
  end if;

  -- Текстовый запрос: каждое слово с префиксом, синонимы через «или»
  if v_rest <> '' then
    v_words := regexp_split_to_array(regexp_replace(v_rest, '[^а-яa-z0-9\- ]', ' ', 'g'), '\s+');
    foreach v_word in array v_words loop
      continue when length(v_word) < 2;
      select coalesce(s.expands_to, '{}') into v_alts from public.search_synonyms s where s.term = v_word;
      v_alts := coalesce(v_alts, '{}');
      select string_agg(quote_literal(x) || ':*', ' | ')
        into v_part
      from (
        select distinct lexeme as x
        from unnest(array[v_word] || v_alts) w,
             lateral unnest(tsvector_to_array(to_tsvector('russian', w))) lexeme
      ) t;
      if v_part is null then
        continue;
      end if;
      v_tsq := case when v_tsq is null then to_tsquery('russian', '(' || v_part || ')')
                    else v_tsq && to_tsquery('russian', '(' || v_part || ')') end;
      v_alts := null;
    end loop;
  end if;

  if p_lat is not null and p_lng is not null then
    v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  end if;

  return query
  with base as (
    select l.*,
      case when v_point is not null and l.location is not null
           then extensions.st_distance(l.location, v_point) end as dist,
      (case when v_tsq is not null then ts_rank(l.search_tsv, v_tsq) else 0 end
       + case when v_rest <> '' then extensions.word_similarity(v_rest, l.search_text) * 0.5 else 0 end
       + case when v_cat_boost is not null and l.category_id = any (v_cat_boost) then 0.5 else 0 end
       + case when (l.has_offer and (l.offer_until is null or l.offer_until >= (now() at time zone 'Asia/Jerusalem')::date)) then 0.05 else 0 end)::real as rnk
    from public.listings l
    where l.status = 'published'
      and (p_section is null or l.section = p_section)
      and (v_category_ids is null or l.category_id = any (v_category_ids))
      and (v_district_id is null or v_district_id = any (l.district_ids))
      and (p_language is null or p_language = any (l.languages))
      and (p_formats is null or l.formats @> p_formats)
      and (not p_has_offer or (l.has_offer and (l.offer_until is null or l.offer_until >= (now() at time zone 'Asia/Jerusalem')::date)))
      and (p_kupa is null or p_kupa = any (l.kupot) or p_kupa = any (l.amenities))
      and (p_features is null or l.amenities @> p_features)
      and (not p_open_now or public.is_open_at(l.hours))
      and (
        v_rest = ''
        or (v_tsq is not null and l.search_tsv @@ v_tsq)
        or extensions.word_similarity(v_rest, l.search_text) > 0.45
      )
  )
  select b.id, b.section, b.slug, b.title, b.summary, b.cover_url, b.category_id, b.district_ids,
         b.languages, b.formats, (b.has_offer and (b.offer_until is null or b.offer_until >= (now() at time zone 'Asia/Jerusalem')::date)), b.rating_avg, b.rating_count, b.hours, b.is_verified, b.is_demo,
         b.is_recommended, b.dist, b.rnk, v_detected_cat, v_detected_dist, count(*) over ()
  from base b
  order by
    -- «HBC рекомендует» — всегда первые в своей категории, при любой сортировке
    case when v_category_ids is not null and b.is_recommended then 0 else 1 end,
    case when p_sort = 'distance' and b.dist is not null then b.dist end asc nulls last,
    case when p_sort = 'rating' then b.rating_avg end desc nulls last,
    case when p_sort = 'new' then b.published_at end desc nulls last,
    b.rnk desc,
    b.is_verified desc,
    b.published_at desc nulls last
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$function$;

grant execute on function public.search_listings(text, public.section, text, text, text, text[], boolean, text, text[], boolean, double precision, double precision, text, integer, integer) to anon, authenticated;

-- Сколько опубликованных карточек прямо в категории (без подкатегорий; сумму по категории верхнего уровня
-- считает сайт). Категорий без карточек в ответе нет.
create or replace function public.category_listing_counts()
returns table(category_id bigint, listings integer)
language sql
stable
set search_path to ''
as $function$
  select l.category_id, count(*)::integer
  from public.listings l
  where l.status = 'published' and l.category_id is not null
  group by l.category_id;
$function$;

grant execute on function public.category_listing_counts() to anon, authenticated;
