-- Исправление: поле listings.features уже занято (jsonb с включёнными платными функциями, этап 1).
-- Особенности заведения («Wi-Fi», «Оплата картой») храним в listings.amenities.
alter table public.listings add column if not exists amenities text[] not null default '{}';
create index if not exists listings_amenities_idx on public.listings using gin (amenities);

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
  v_languages text[] := '{}';
  v_features text[] := '{}';
  v_formats text[] := '{}';
  v_hours jsonb;
  v_lat double precision;
  v_lng double precision;
  v_has_offer boolean := false;
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
      when 'service_area' then
        select coalesce(array_agg(x), '{}') into v_formats
        from jsonb_array_elements_text(coalesce(v_block #> '{data,formats}', '[]'::jsonb)) x;
      when 'hours' then
        v_hours := v_block #> '{data,week}';
      when 'address' then
        v_lat := nullif(v_block #>> '{data,lat}', '')::double precision;
        v_lng := nullif(v_block #>> '{data,lng}', '')::double precision;
      when 'offers' then
        for v_item in select * from jsonb_array_elements(coalesce(v_block #> '{data,items}', '[]'::jsonb)) loop
          if (v_item ->> 'validUntil') is null or (v_item ->> 'validUntil')::date >= (now() at time zone 'Asia/Jerusalem')::date then
            v_has_offer := true;
            if (v_item ->> 'validUntil') is not null then
              v_offer_until := greatest(coalesce(v_offer_until, (v_item ->> 'validUntil')::date), (v_item ->> 'validUntil')::date);
            end if;
          end if;
        end loop;
      else
        null;
    end case;
  end loop;

  update public.listings l set
    title = v_data #>> '{header,title}',
    summary = coalesce(v_data #>> '{header,profession}', v_data #>> '{header,slogan}'),
    cover_url = v_data #>> '{header,coverUrl}',
    category_id = v_cat.id,
    district_ids = v_district_ids,
    languages = v_languages,
    amenities = v_features,
    formats = v_formats,
    hours = v_hours,
    has_offer = v_has_offer,
    offer_until = v_offer_until,
    location = case when v_lat is not null and v_lng is not null
                    then extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography end,
    data_confirmed_at = coalesce(nullif(v_data ->> 'confirmedAt', '')::timestamptz, l.data_confirmed_at),
    search_text = public.norm_text(concat_ws(' ',
      v_data #>> '{header,title}', v_data #>> '{header,profession}', v_data #>> '{header,slogan}',
      v_cat.name, array_to_string(v_cat.aliases, ' '), v_parent_name,
      v_district_names, v_services, v_description, v_faq,
      array_to_string(v_features, ' '), array_to_string(v_languages, ' '))),
    search_tsv =
      setweight(to_tsvector('russian', public.norm_text(concat_ws(' ', v_data #>> '{header,title}', v_data #>> '{header,profession}'))), 'A') ||
      setweight(to_tsvector('russian', public.norm_text(concat_ws(' ', v_cat.name, array_to_string(v_cat.aliases, ' '), v_parent_name, v_services))), 'B') ||
      setweight(to_tsvector('russian', public.norm_text(concat_ws(' ', v_data #>> '{header,slogan}', v_description, v_faq, v_district_names))), 'C') ||
      setweight(to_tsvector('russian', public.norm_text(concat_ws(' ', array_to_string(v_features, ' '), array_to_string(v_languages, ' ')))), 'D')
  where l.id = p_listing;
end;
$$;

create or replace function public.search_listings(
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
returns table (
  id uuid,
  section public.section,
  slug text,
  title text,
  summary text,
  cover_url text,
  category_id bigint,
  district_ids bigint[],
  languages text[],
  formats text[],
  has_offer boolean,
  rating_avg numeric,
  rating_count integer,
  hours jsonb,
  is_verified boolean,
  is_demo boolean,
  distance_m double precision,
  rank real,
  detected_category text,
  detected_district text,
  total_count bigint
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_q text := public.norm_text(trim(coalesce(p_q, '')));
  v_rest text;
  v_district_id bigint;
  v_district_slug text := p_district;
  v_category_ids bigint[];
  v_category_slug text := p_category;
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

  -- Категория во фразе: если запрос и есть название категории — фильтруем, иначе только поднимаем выше
  if v_rest <> '' and v_category_slug is null then
    select c.slug, a into v_category_slug, v_detected_cat
    from public.categories c,
         lateral unnest(array[public.norm_text(c.name)] || c.aliases) a
    where c.is_active and (p_section is null or c.section = p_section) and length(a) >= 3
      and v_rest like '%' || a || '%'
    order by length(a) desc
    limit 1;
    -- Остаток короче 3 букв — это окончание слова («стоматологи»): запрос целиком о категории
    if v_detected_cat is not null and length(trim(replace(v_rest, v_detected_cat, ''))) < 3 then
      v_rest := '';
      v_detected_cat := v_category_slug;
    else
      if v_detected_cat is not null then
        select array_agg(c.id) into v_cat_boost from public.categories c where c.slug = v_category_slug;
      end if;
      v_category_slug := null;
      v_detected_cat := null;
    end if;
  end if;

  if v_category_slug is not null then
    select array_agg(c.id) into v_category_ids
    from public.categories c
    where (c.slug = v_category_slug and (p_section is null or c.section = p_section))
       or c.parent_id in (select c2.id from public.categories c2 where c2.slug = v_category_slug and (p_section is null or c2.section = p_section));
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
       + case when l.has_offer then 0.05 else 0 end)::real as rnk
    from public.listings l
    where l.status = 'published'
      and (p_section is null or l.section = p_section)
      and (v_category_ids is null or l.category_id = any (v_category_ids))
      and (v_district_id is null or v_district_id = any (l.district_ids))
      and (p_language is null or p_language = any (l.languages))
      and (p_formats is null or l.formats @> p_formats)
      and (not p_has_offer or l.has_offer)
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
         b.languages, b.formats, b.has_offer, b.rating_avg, b.rating_count, b.hours, b.is_verified, b.is_demo,
         b.dist, b.rnk, v_detected_cat, v_detected_dist, count(*) over ()
  from base b
  order by
    case when p_sort = 'distance' and b.dist is not null then b.dist end asc nulls last,
    case when p_sort = 'rating' then b.rating_avg end desc nulls last,
    case when p_sort = 'new' then b.published_at end desc nulls last,
    b.rnk desc,
    b.is_verified desc,
    b.published_at desc nulls last
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$$;

grant execute on function public.search_listings(text, public.section, text, text, text, text[], boolean, text, text[], boolean, double precision, double precision, text, integer, integer) to anon, authenticated;
