-- Фильтры по категориям (вариант Б аудита, решение 2 ноября 2026, раздел 5 ТЗ):
-- 1) больничные кассы — отдельное поле блока «Особенности» (data.kupot), заполняется в listings.kupot;
-- 2) доставка/выезд/онлайн у бизнесов — поле data.formats того же блока; у специалистов — блок «Зона выезда»;
--    в listings.formats попадает объединение;
-- 3) «Выезд на дом», «Онлайн» и названия касс убраны из общего списка особенностей, старые отметки перенесены;
-- 4) category_filter_stats — сколько карточек раздела/категории подходят под каждый фильтр (пустые фильтры скрываются).

create or replace function public.refresh_listing_search(p_listing uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.listings%rowtype;
  v_data jsonb;
  v_block jsonb;
  v_cat public.categories%rowtype;
  v_parent_name text;
  v_district_ids bigint[] := '{}';
  v_district_names text := '';
  v_services text := '';
  v_description text := '';
  v_faq text := '';
  v_extra text := '';
  v_languages text[] := '{}';
  v_features text[] := '{}';
  v_formats text[] := '{}';
  v_kupot text[] := '{}';
  v_hours jsonb;
  v_lat double precision;
  v_lng double precision;
  v_has_offer boolean := false;
  v_offer_open boolean := false;
  v_offer_until date;
  v_item jsonb;
begin
  select * into v_listing from public.listings where id = p_listing;
  if not found or v_listing.published_version_id is null then
    return;
  end if;
  select data into v_data from public.listing_versions where id = v_listing.published_version_id;

  select * into v_cat from public.categories where id = nullif(v_data #>> '{header,categoryId}', '')::bigint;
  if v_cat.parent_id is not null then
    select name into v_parent_name from public.categories where id = v_cat.parent_id;
  end if;

  select coalesce(array_agg(d.id), '{}'), coalesce(string_agg(d.name || ' ' || array_to_string(d.aliases, ' '), ' '), '')
    into v_district_ids, v_district_names
  from public.districts d
  where d.slug in (select jsonb_array_elements_text(coalesce(v_data #> '{header,districtSlugs}', '[]'::jsonb)));

  for v_block in select * from jsonb_array_elements(coalesce(v_data -> 'blocks', '[]'::jsonb)) loop
    continue when coalesce((v_block ->> 'hidden')::boolean, false);
    case v_block ->> 'type'
      when 'description' then
        v_description := v_description || ' ' || coalesce(v_block #>> '{data,text}', '');
      when 'services' then
        select v_services || ' ' || coalesce(string_agg(
                 coalesce(g ->> 'title', '') || ' ' ||
                 (select coalesce(string_agg(coalesce(i ->> 'name', '') || ' ' || coalesce(i ->> 'description', ''), ' '), '')
                  from jsonb_array_elements(coalesce(g -> 'items', '[]'::jsonb)) i), ' '), '')
          into v_services
        from jsonb_array_elements(coalesce(v_block #> '{data,groups}', '[]'::jsonb)) g;
      when 'menu' then
        select v_services || ' ' || coalesce(string_agg(
                 coalesce(g ->> 'title', '') || ' ' ||
                 (select coalesce(string_agg(coalesce(i ->> 'name', '') || ' ' || coalesce(i ->> 'description', ''), ' '), '')
                  from jsonb_array_elements(coalesce(g -> 'items', '[]'::jsonb)) i), ' '), '')
          into v_services
        from jsonb_array_elements(coalesce(v_block #> '{data,sections}', '[]'::jsonb)) g;
      when 'schedule' then
        select v_services || ' ' || coalesce(string_agg(distinct coalesce(c ->> 'title', ''), ' '), '')
          into v_services
        from jsonb_array_elements(coalesce(v_block #> '{data,classes}', '[]'::jsonb)) c;
      when 'team' then
        select v_extra || ' ' || coalesce(string_agg(coalesce(m ->> 'name', '') || ' ' || coalesce(m ->> 'role', ''), ' '), '')
          into v_extra
        from jsonb_array_elements(coalesce(v_block #> '{data,members}', '[]'::jsonb)) m;
      when 'portfolio' then
        select v_extra || ' ' || coalesce(string_agg(coalesce(p ->> 'title', '') || ' ' || coalesce(p ->> 'description', ''), ' '), '')
          into v_extra
        from jsonb_array_elements(coalesce(v_block #> '{data,items}', '[]'::jsonb)) p;
      when 'events' then
        select v_extra || ' ' || coalesce(string_agg(coalesce(e ->> 'title', ''), ' '), '')
          into v_extra
        from jsonb_array_elements(coalesce(v_block #> '{data,items}', '[]'::jsonb)) e;
      when 'vacancies' then
        select v_extra || ' ' || coalesce(string_agg('вакансия ' || coalesce(j ->> 'title', ''), ' '), '')
          into v_extra
        from jsonb_array_elements(coalesce(v_block #> '{data,items}', '[]'::jsonb)) j;
      when 'certificates' then
        select v_extra || ' ' || coalesce(string_agg(coalesce(c ->> 'title', ''), ' '), '')
          into v_extra
        from jsonb_array_elements(coalesce(v_block #> '{data,items}', '[]'::jsonb)) c;
      when 'faq' then
        select v_faq || ' ' || coalesce(string_agg(coalesce(f ->> 'q', '') || ' ' || coalesce(f ->> 'a', ''), ' '), '')
          into v_faq
        from jsonb_array_elements(coalesce(v_block #> '{data,items}', '[]'::jsonb)) f;
      when 'languages' then
        select coalesce(array_agg(x), '{}') into v_languages
        from jsonb_array_elements_text(coalesce(v_block #> '{data,items}', '[]'::jsonb)) x;
      when 'features' then
        select coalesce(array_agg(x), '{}') into v_features
        from jsonb_array_elements_text(coalesce(v_block #> '{data,items}', '[]'::jsonb)) x;
        -- Больничные кассы — отдельное поле (только медицинские категории), доставка/выезд/онлайн у бизнесов — тоже здесь.
        select coalesce(array_agg(x), '{}') into v_kupot
        from jsonb_array_elements_text(coalesce(v_block #> '{data,kupot}', '[]'::jsonb)) x;
        select coalesce(array_agg(distinct x), '{}') into v_formats
        from (select unnest(v_formats) as x
              union select jsonb_array_elements_text(coalesce(v_block #> '{data,formats}', '[]'::jsonb))) s;
      when 'service_area' then
        select coalesce(array_agg(distinct x), '{}') into v_formats
        from (select unnest(v_formats) as x
              union select jsonb_array_elements_text(coalesce(v_block #> '{data,formats}', '[]'::jsonb))) s;
      when 'hours' then
        -- Неделя + исключения (праздники, короткие дни): их читает is_open_at.
        v_hours := coalesce(v_block #> '{data,week}', '{}'::jsonb)
                   || jsonb_build_object('exceptions', coalesce(v_block #> '{data,exceptions}', '[]'::jsonb));
      when 'address' then
        v_lat := nullif(v_block #>> '{data,lat}', '')::double precision;
        v_lng := nullif(v_block #>> '{data,lng}', '')::double precision;
      when 'offers' then
        for v_item in select * from jsonb_array_elements(coalesce(v_block #> '{data,items}', '[]'::jsonb)) loop
          if (v_item ->> 'validUntil') is null then
            v_has_offer := true;
            v_offer_open := true;
          elsif (v_item ->> 'validUntil')::date >= (now() at time zone 'Asia/Jerusalem')::date then
            v_has_offer := true;
            v_offer_until := greatest(coalesce(v_offer_until, (v_item ->> 'validUntil')::date), (v_item ->> 'validUntil')::date);
          end if;
        end loop;
      else
        null;
    end case;
  end loop;

  -- Есть бессрочное предложение — признак не истекает.
  if v_offer_open then
    v_offer_until := null;
  end if;

  update public.listings l set
    title = v_data #>> '{header,title}',
    summary = coalesce(v_data #>> '{header,profession}', v_data #>> '{header,slogan}'),
    cover_url = v_data #>> '{header,coverUrl}',
    category_id = v_cat.id,
    district_ids = v_district_ids,
    languages = v_languages,
    amenities = v_features,
    formats = v_formats,
    kupot = v_kupot,
    hours = v_hours,
    has_offer = v_has_offer,
    offer_until = v_offer_until,
    location = case when v_lat is not null and v_lng is not null
                    then extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography end,
    data_confirmed_at = coalesce(nullif(v_data ->> 'confirmedAt', '')::timestamptz, l.data_confirmed_at),
    search_text = public.norm_text(concat_ws(' ',
      v_data #>> '{header,title}', v_data #>> '{header,profession}', v_data #>> '{header,slogan}',
      v_cat.name, array_to_string(v_cat.aliases, ' '), v_parent_name,
      v_district_names, v_services, v_description, v_faq, v_extra,
      array_to_string(v_features || v_kupot, ' '), array_to_string(v_languages, ' '))),
    search_tsv =
      setweight(to_tsvector('russian', public.norm_text(concat_ws(' ', v_data #>> '{header,title}', v_data #>> '{header,profession}'))), 'A') ||
      setweight(to_tsvector('russian', public.norm_text(concat_ws(' ', v_cat.name, array_to_string(v_cat.aliases, ' '), v_parent_name, v_services))), 'B') ||
      setweight(to_tsvector('russian', public.norm_text(concat_ws(' ', v_data #>> '{header,slogan}', v_description, v_faq, v_extra, v_district_names))), 'C') ||
      setweight(to_tsvector('russian', public.norm_text(concat_ws(' ', array_to_string(v_features || v_kupot, ' '), array_to_string(v_languages, ' ')))), 'D')
  where l.id = p_listing;
end;
$$;

-- Перенос старых отметок из списка особенностей в новые поля (во всех версиях карточек).
-- Временная функция (pg_temp): исчезает сама после миграции.
create or replace function pg_temp.migrate_features_block(p_block jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when p_block ->> 'type' <> 'features' then p_block else
    jsonb_set(jsonb_set(jsonb_set(p_block,
      '{data,items}', coalesce((select jsonb_agg(x) from jsonb_array_elements_text(coalesce(p_block #> '{data,items}', '[]')) x
                                where x not in ('Выезд на дом', 'Онлайн', 'Клалит', 'Маккаби', 'Меухедет', 'Леумит')), '[]')),
      '{data,kupot}', coalesce(p_block #> '{data,kupot}', '[]') || coalesce((select jsonb_agg(x) from jsonb_array_elements_text(coalesce(p_block #> '{data,items}', '[]')) x
                                where x in ('Клалит', 'Маккаби', 'Меухедет', 'Леумит')), '[]')),
      '{data,formats}', coalesce(p_block #> '{data,formats}', '[]') || coalesce((select jsonb_agg(case x when 'Выезд на дом' then 'at_home' else 'online' end)
                                from jsonb_array_elements_text(coalesce(p_block #> '{data,items}', '[]')) x where x in ('Выезд на дом', 'Онлайн')), '[]'))
  end;
$$;

update public.listing_versions v
set data = jsonb_set(v.data, '{blocks}', (
  select coalesce(jsonb_agg(pg_temp.migrate_features_block(b) order by ord), '[]')
  from jsonb_array_elements(v.data -> 'blocks') with ordinality as t(b, ord)))
where exists (
  select 1 from jsonb_array_elements(coalesce(v.data -> 'blocks', '[]')) b
  where b ->> 'type' = 'features'
    and exists (select 1 from jsonb_array_elements_text(coalesce(b #> '{data,items}', '[]')) x
                where x in ('Выезд на дом', 'Онлайн', 'Клалит', 'Маккаби', 'Меухедет', 'Леумит')));

update public.site_settings
set value = coalesce((select jsonb_agg(x) from jsonb_array_elements_text(value) x
                      where x not in ('Выезд на дом', 'Онлайн', 'Клалит', 'Маккаби', 'Меухедет', 'Леумит')), '[]'),
    updated_at = now()
where key = 'amenities';

select public.refresh_listing_search(id) from public.listings where published_version_id is not null;

-- Сколько опубликованных карточек раздела (и категории с подкатегориями, если задана) подходят под каждый фильтр.
create or replace function public.category_filter_stats(p_section public.section, p_category_id bigint default null)
returns table (at_home integer, on_site integer, online integer, kupa integer, with_hours integer, with_offer integer)
language sql
stable
set search_path = ''
as $$
  select
    count(*) filter (where 'at_home' = any (l.formats))::integer,
    count(*) filter (where 'on_site' = any (l.formats))::integer,
    count(*) filter (where 'online' = any (l.formats))::integer,
    count(*) filter (where cardinality(l.kupot) > 0)::integer,
    count(*) filter (where l.hours is not null and l.hours <> '{"exceptions": []}'::jsonb)::integer,
    count(*) filter (where l.has_offer and (l.offer_until is null or l.offer_until >= (now() at time zone 'Asia/Jerusalem')::date))::integer
  from public.listings l
  where l.status = 'published'
    and l.section = p_section
    and (p_category_id is null or l.category_id in (
      select c.id from public.categories c where c.id = p_category_id or c.parent_id = p_category_id));
$$;

revoke all on function public.category_filter_stats(public.section, bigint) from public;
grant execute on function public.category_filter_stats(public.section, bigint) to anon, authenticated, service_role;
