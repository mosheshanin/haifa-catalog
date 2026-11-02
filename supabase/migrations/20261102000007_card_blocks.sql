-- Этап 2: остальные блоки карточки (раздел 4 ТЗ).
-- 1) Короткая ссылка /k/<код> для QR-кода и «Поделиться».
-- 2) Поиск учитывает новые блоки (меню, расписание, команда, портфолио, мероприятия, вакансии, сертификаты).
-- 3) Спецпредложения после срока не считаются «есть спецпредложение» (раньше признак держался до переопубликации).
-- 4) «Открыто сейчас» учитывает исключения в часах работы (праздники, короткие дни).
-- 5) Примерные карточки: новые блоки в четырёх старых и пятая — детская студия с расписанием.

-- 1. Короткий код: 6 знаков без похожих символов (0/o, 1/l/i).
create or replace function public.gen_short_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('23456789abcdefghjkmnpqrstuvwxyz', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 6);
$$;

alter table public.listings add column if not exists short_code text;
update public.listings set short_code = public.gen_short_code() where short_code is null;
alter table public.listings alter column short_code set default public.gen_short_code();
alter table public.listings alter column short_code set not null;
create unique index if not exists listings_short_code_key on public.listings (short_code);
comment on column public.listings.short_code is 'Код короткой ссылки /k/<код> (QR-код карточки). Не меняется при переименовании.';

-- 2–3. Поисковые поля карточки.
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
      when 'service_area' then
        select coalesce(array_agg(x), '{}') into v_formats
        from jsonb_array_elements_text(coalesce(v_block #> '{data,formats}', '[]'::jsonb)) x;
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
      array_to_string(v_features, ' '), array_to_string(v_languages, ' '))),
    search_tsv =
      setweight(to_tsvector('russian', public.norm_text(concat_ws(' ', v_data #>> '{header,title}', v_data #>> '{header,profession}'))), 'A') ||
      setweight(to_tsvector('russian', public.norm_text(concat_ws(' ', v_cat.name, array_to_string(v_cat.aliases, ' '), v_parent_name, v_services))), 'B') ||
      setweight(to_tsvector('russian', public.norm_text(concat_ws(' ', v_data #>> '{header,slogan}', v_description, v_faq, v_extra, v_district_names))), 'C') ||
      setweight(to_tsvector('russian', public.norm_text(concat_ws(' ', array_to_string(v_features, ' '), array_to_string(v_languages, ' ')))), 'D')
  where l.id = p_listing;
end;
$$;

-- 4. «Открыто сейчас» с исключениями: исключение на сегодняшнюю дату важнее обычного дня недели.
create or replace function public.is_open_at(p_hours jsonb, p_at timestamp with time zone default now())
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_local timestamp := p_at at time zone 'Asia/Jerusalem';
  v_date text := to_char(p_at at time zone 'Asia/Jerusalem', 'YYYY-MM-DD');
  v_day text := (array['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from v_local)::int + 1];
  v_prev text := (array['sat','sun','mon','tue','wed','thu','fri'])[extract(dow from v_local)::int + 1];
  v_min int := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;
  v_exc jsonb;
  v_int jsonb;
  v_open int;
  v_close int;
begin
  if p_hours is null then
    return false;
  end if;

  if jsonb_typeof(p_hours -> 'exceptions') = 'array' then
    select e into v_exc from jsonb_array_elements(p_hours -> 'exceptions') e where e ->> 'date' = v_date limit 1;
  end if;
  if v_exc is not null then
    if coalesce((v_exc ->> 'closed')::boolean, false) then
      return false;
    end if;
    for v_int in select * from jsonb_array_elements(coalesce(v_exc -> 'intervals', '[]'::jsonb)) loop
      v_open := split_part(v_int ->> 'open', ':', 1)::int * 60 + split_part(v_int ->> 'open', ':', 2)::int;
      v_close := split_part(v_int ->> 'close', ':', 1)::int * 60 + split_part(v_int ->> 'close', ':', 2)::int;
      if (v_close > v_open and v_min >= v_open and v_min < v_close) or (v_close <= v_open and v_min >= v_open) then
        return true;
      end if;
    end loop;
    return false;
  end if;

  for v_int in select * from jsonb_array_elements(coalesce(p_hours -> v_day, '[]'::jsonb)) loop
    v_open := split_part(v_int ->> 'open', ':', 1)::int * 60 + split_part(v_int ->> 'open', ':', 2)::int;
    v_close := split_part(v_int ->> 'close', ':', 1)::int * 60 + split_part(v_int ->> 'close', ':', 2)::int;
    if (v_close > v_open and v_min >= v_open and v_min < v_close) or (v_close <= v_open and v_min >= v_open) then
      return true;
    end if;
  end loop;
  for v_int in select * from jsonb_array_elements(coalesce(p_hours -> v_prev, '[]'::jsonb)) loop
    v_open := split_part(v_int ->> 'open', ':', 1)::int * 60 + split_part(v_int ->> 'open', ':', 2)::int;
    v_close := split_part(v_int ->> 'close', ':', 1)::int * 60 + split_part(v_int ->> 'close', ':', 2)::int;
    if v_close <= v_open and v_min < v_close then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

-- 3. Поиск: «есть спецпредложение» только пока не прошёл срок (offer_until).
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

-- 5. Примерные карточки (is_demo): новая версия для существующих и новая карточка студии.
-- Все названия, телефоны, люди и отзывы вымышлены; страницы примеров закрыты от индексации.
do $demo$
declare
  v_demo jsonb;
  v_listing uuid;
  v_version uuid;
  v_cat bigint;
  v_data jsonb;
begin
  for v_demo in select * from jsonb_array_elements('[{"slug": "primer-salon-lavanda", "section": "biznes", "categorySlug": "salony-krasoty", "rating": 4.9, "reviews": 38, "verified": true, "data": {"section": "biznes", "header": {"title": "Салон «Лаванда» (пример)", "slogan": "Маникюр, брови и уход за кожей в центре Хадара", "coverUrl": "https://images.unsplash.com/photo-1600948836101-f9ffda59d250", "logoUrl": "https://images.unsplash.com/photo-1499002238440-d264edd596ec", "districtSlugs": ["hadar"], "badges": ["verified", "russian_speaking"]}, "contacts": {"phone": "+972500000001", "whatsapp": "+972500000001", "telegram": "example_lavanda", "instagram": "example.lavanda"}, "confirmedAt": "2026-11-02", "blocks": [{"id": "d1", "type": "description", "data": {"text": "Небольшой салон с тремя мастерами. Работаем с 2015 года, говорим по-русски, на иврите и английском. Используем стерильные инструменты и одноразовые пилки."}}, {"id": "o1", "type": "offers", "data": {"items": [{"title": "Маникюр с покрытием по будням до 12:00", "discountPercent": 15, "validUntil": "2026-11-30", "promoCode": "UTRO"}]}}, {"id": "s1", "type": "services", "data": {"groups": [{"title": "Ногти", "items": [{"name": "Маникюр с покрытием гель-лак", "price": 150, "durationMin": 90}, {"name": "Педикюр", "price": 180, "priceFrom": true, "durationMin": 75}, {"name": "Снятие покрытия", "price": 40, "durationMin": 20}]}, {"title": "Брови и ресницы", "items": [{"name": "Коррекция и окрашивание бровей", "price": 120, "durationMin": 45}, {"name": "Ламинирование ресниц", "price": 200, "durationMin": 60}]}]}}, {"id": "t1", "type": "team", "data": {"members": [{"name": "Ольга", "role": "Мастер маникюра и педикюра", "photoUrl": "https://images.unsplash.com/photo-1494790108377-be9c29b29330", "bio": "9 лет опыта, укрепление и дизайн", "bookable": true}, {"name": "Марина", "role": "Бровист и лэшмейкер", "photoUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb", "bio": "Ламинирование ресниц и бровей", "bookable": true}, {"name": "Светлана", "role": "Администратор", "photoUrl": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2"}]}}, {"id": "v1", "type": "video", "data": {"items": [{"provider": "youtube", "videoId": "LqjhM49SUWY", "title": "Покрытие гель-лаком пошагово"}]}}, {"id": "g1", "type": "gallery", "data": {"photos": [{"url": "https://images.unsplash.com/photo-1632345031435-8727f6897d53", "caption": "Маникюр в салоне"}, {"url": "https://images.unsplash.com/photo-1619607146034-5a05296c8f9a", "caption": "Палитра гель-лаков"}, {"url": "https://images.unsplash.com/photo-1604654894610-df63bc536371", "caption": "Дизайн «черепаха»"}]}}, {"id": "b1", "type": "before_after", "data": {"pairs": [{"beforeUrl": "https://images.unsplash.com/photo-1610992015762-45dca7fa3a85", "afterUrl": "https://images.unsplash.com/photo-1604654894610-df63bc536371", "caption": "Укрепление ногтей гелем и дизайн"}]}}, {"id": "h1", "type": "hours", "data": {"week": {"sun": [{"open": "09:00", "close": "19:00"}], "mon": [{"open": "09:00", "close": "19:00"}], "tue": [{"open": "09:00", "close": "19:00"}], "wed": [{"open": "09:00", "close": "19:00"}], "thu": [{"open": "09:00", "close": "20:00"}], "fri": [{"open": "08:30", "close": "13:30"}]}, "exceptions": [{"date": "2026-10-25", "closed": true, "note": "прошедший день — на сайте не показывается"}, {"date": "2026-11-11", "intervals": [{"open": "09:00", "close": "14:00"}], "note": "Короткий день: учёба мастеров"}, {"date": "2026-12-01", "closed": true, "note": "Санитарный день"}], "note": "В субботу закрыто"}}, {"id": "a1", "type": "address", "data": {"address": "ул. Герцль, 10, Хайфа (пример)", "howToGet": "5 минут пешком от остановки «Герцль»", "parking": "Платная парковка во дворе", "lat": 32.8156, "lng": 34.9984}}, {"id": "e1", "type": "events", "data": {"items": [{"title": "Открытый день в салоне", "start": "2026-10-20T10:00", "end": "2026-10-20T14:00", "description": "Прошедшее событие — на сайте не показывается."}, {"title": "Мастер-класс «Уход за руками зимой»", "start": "2026-11-22T18:00", "end": "2026-11-22T19:30", "place": "Салон «Лаванда», ул. Герцль, 10 (пример)", "description": "Расскажем, как защитить кожу рук от холода и сухого воздуха, покажем домашний уход. Чай и сладости — от нас.", "photoUrl": "https://images.unsplash.com/photo-1528605248644-14dd04022da1", "price": 0, "registerUrl": "https://wa.me/972500000001?text=Хочу%20на%20мастер-класс%2022%20ноября"}]}}, {"id": "n1", "type": "news", "data": {"posts": [{"date": "2026-10-30", "text": "Пришла новая коллекция гель-лаков «осень — зима»: 24 оттенка, от молочного до глубокого бордо.", "photoUrl": "https://images.unsplash.com/photo-1519014816548-bf5fe059798b"}, {"date": "2026-10-15", "text": "Мы обновили зал: новые кресла для педикюра и отдельная комната для бровей.", "photoUrl": "https://images.unsplash.com/photo-1560066984-138dadb4c035"}, {"date": "2026-09-28", "text": "Марина прошла курс по ламинированию ресниц — запись уже открыта."}, {"date": "2026-09-01", "text": "С сентября работаем по пятницам с 08:30."}]}}, {"id": "j1", "type": "vacancies", "data": {"items": [{"title": "Мастер маникюра", "terms": "5 дней в неделю, полная или частичная занятость; процент от услуг", "requirements": "Опыт от года, аккуратность, базовый иврит", "contact": "WhatsApp 050-000-0001, Светлана", "postedAt": "2026-10-28"}, {"title": "Администратор (закрыта)", "terms": "Вакансия старше 30 дней — на сайте не показывается", "postedAt": "2026-09-01"}]}}, {"id": "f1", "type": "faq", "data": {"items": [{"q": "Нужно ли записываться заранее?", "a": "Лучше за 1–2 дня. Свободные окна бывают и в день обращения — напишите в WhatsApp."}, {"q": "Есть ли парковка?", "a": "Да, платная парковка во дворе здания."}]}}, {"id": "fe1", "type": "features", "data": {"items": ["Оплата картой", "Оплата через Bit", "Wi-Fi", "Доступно для колясок"]}}, {"id": "l1", "type": "languages", "data": {"items": ["Русский", "Иврит", "Английский"]}}, {"id": "r1", "type": "request", "data": {"enabled": true, "withTime": true}}]}}, {"slug": "primer-kafe-samovar", "section": "biznes", "categorySlug": "kafe-i-restorany", "rating": 4.6, "reviews": 112, "verified": false, "data": {"section": "biznes", "header": {"title": "Кафе «Самовар» (пример)", "slogan": "Домашняя кухня, пельмени и выпечка", "coverUrl": "https://images.unsplash.com/photo-1521017432531-fbd92d768814", "logoUrl": "https://images.unsplash.com/photo-1544787219-7f47ccb76574", "districtSlugs": ["merkaz-hacarmel"], "badges": ["russian_speaking"]}, "contacts": {"phone": "+972500000002", "whatsapp": "+972500000002", "website": "https://example.com"}, "confirmedAt": "2026-11-02", "blocks": [{"id": "d2", "type": "description", "data": {"text": "Уютное кафе с русской и европейской кухней. Бизнес-ланч по будням, торты на заказ."}}, {"id": "o2", "type": "offers", "data": {"items": [{"title": "Бизнес-ланч: суп, горячее и чай", "price": 49, "description": "По будням с 12:00 до 16:00", "validUntil": "2026-12-31"}, {"title": "Скидка 20% на торты (закончилась)", "discountPercent": 20, "validUntil": "2026-10-31"}]}}, {"id": "m2", "type": "menu", "data": {"sections": [{"title": "Супы", "items": [{"name": "Борщ со сметаной и пампушкой", "description": "Говядина, свёкла, чесночная пампушка", "price": 38, "photoUrl": "https://images.unsplash.com/photo-1547592166-23ac45744acd"}, {"name": "Тыквенный крем-суп", "description": "С гренками и семечками", "price": 34, "photoUrl": "https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a", "tags": ["veg"]}]}, {"title": "Горячее", "items": [{"name": "Пельмени домашние", "description": "Говядина и свинина, 15 штук, сметана", "price": 46, "photoUrl": "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb"}, {"name": "Жареные пирожки с картошкой", "description": "4 штуки, с аджикой", "price": 32, "photoUrl": "https://images.unsplash.com/photo-1563245372-f21724e3856d", "tags": ["veg", "spicy"]}, {"name": "Блины с мясом", "description": "3 блина, сметана", "price": 39}]}, {"title": "Десерты", "items": [{"name": "Шоколадный торт «Прага»", "price": 29, "photoUrl": "https://images.unsplash.com/photo-1578985545062-69928b1d9587", "tags": ["veg"]}, {"name": "Бисквит с малиной", "price": 31, "photoUrl": "https://images.unsplash.com/photo-1565958011703-44f9829ba187", "tags": ["veg"]}, {"name": "Блины со сметаной и вареньем", "price": 26, "photoUrl": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445", "tags": ["veg"]}]}, {"title": "Напитки", "items": [{"name": "Чай из самовара", "description": "Чайник на двоих, с вареньем", "price": 18, "tags": ["veg"]}, {"name": "Капучино", "price": 13, "photoUrl": "https://images.unsplash.com/photo-1509042239860-f550ce710b93", "tags": ["veg"]}]}], "files": [{"title": "Меню целиком (PDF)", "url": "/demo/menu-samovar.pdf", "kind": "pdf"}]}}, {"id": "g2", "type": "gallery", "data": {"photos": [{"url": "https://images.unsplash.com/photo-1788603378122-1c3708b1a26a", "caption": "Вареники с луком и сметаной"}, {"url": "https://images.unsplash.com/photo-1511081692775-05d0f180a065", "caption": "Зал"}]}}, {"id": "h2", "type": "hours", "data": {"week": {"sun": [{"open": "09:00", "close": "19:00"}], "mon": [{"open": "09:00", "close": "19:00"}], "tue": [{"open": "09:00", "close": "19:00"}], "wed": [{"open": "09:00", "close": "19:00"}], "thu": [{"open": "09:00", "close": "20:00"}], "fri": [{"open": "08:30", "close": "13:30"}], "sat": [{"open": "19:00", "close": "23:00"}]}, "exceptions": [{"date": "2026-11-20", "closed": true, "note": "Санитарный день"}]}}, {"id": "a2", "type": "address", "data": {"address": "Шдерот ха-Наси, 120, Хайфа (пример)", "lat": 32.8034, "lng": 34.9886}}, {"id": "e2", "type": "events", "data": {"items": [{"title": "Вечер романсов под гитару", "start": "2026-11-27T19:30", "end": "2026-11-27T22:00", "place": "Кафе «Самовар», Шдерот ха-Наси, 120 (пример)", "description": "Живая музыка, романсы и песни бардов. Столики лучше бронировать заранее.", "photoUrl": "https://images.unsplash.com/photo-1511795409834-ef04bbd61622", "price": 40, "registerUrl": "https://wa.me/972500000002?text=Хочу%20забронировать%20столик%20на%2027%20ноября"}]}}, {"id": "n2", "type": "news", "data": {"posts": [{"date": "2026-10-29", "text": "Запустили бизнес-ланч: суп, горячее и чай за 49 ₪ по будням.", "photoUrl": "https://images.unsplash.com/photo-1606787366850-de6330128bfc"}, {"date": "2026-10-10", "text": "Принимаем заказы на торты к праздникам — за 3 дня, в WhatsApp.", "photoUrl": "https://images.unsplash.com/photo-1565958011703-44f9829ba187"}]}}, {"id": "j2", "type": "vacancies", "data": {"items": [{"title": "Официант на вечерние смены", "terms": "3–4 вечера в неделю, почасовая оплата и чаевые", "requirements": "Русский и иврит; опыт приветствуется, но не обязателен", "contact": "WhatsApp 050-000-0002", "postedAt": "2026-10-20", "validUntil": "2026-12-15"}]}}, {"id": "fe2", "type": "features", "data": {"items": ["Оплата картой", "Детская зона", "Wi-Fi"]}}, {"id": "l2", "type": "languages", "data": {"items": ["Русский", "Иврит"]}}]}}, {"slug": "primer-anna-manikyur", "section": "specialisty", "categorySlug": "manikyur", "rating": 5, "reviews": 21, "verified": false, "data": {"section": "specialisty", "header": {"title": "Анна К. (пример)", "profession": "Мастер маникюра на дому", "coverUrl": "https://images.unsplash.com/photo-1772322586754-34c9e6f5be6f", "districtSlugs": ["kiryat-bialik", "kiryat-motzkin", "kiryat-yam"], "badges": ["russian_speaking"]}, "contacts": {"phone": "+972500000003", "whatsapp": "+972500000003", "telegram": "example_anna"}, "confirmedAt": "2026-11-02", "blocks": [{"id": "d3", "type": "description", "data": {"text": "Опыт 8 лет. Приезжаю со своим оборудованием и стерилизатором. Работаю по записи."}}, {"id": "sa3", "type": "service_area", "data": {"districtSlugs": ["kiryat-bialik", "kiryat-motzkin", "kiryat-yam"], "formats": ["at_home", "on_site"]}}, {"id": "s3", "type": "services", "data": {"groups": [{"title": "Услуги", "items": [{"name": "Маникюр с покрытием", "price": 130, "durationMin": 90}, {"name": "Наращивание", "price": 220, "priceFrom": true}]}]}}, {"id": "p3", "type": "portfolio", "data": {"items": [{"title": "Мраморный дизайн", "description": "Гель-лак, ручная роспись под мрамор на всех пальцах.", "photos": ["https://images.unsplash.com/photo-1772322586785-3a34772cbc61", "https://images.unsplash.com/photo-1607779097040-26e80aa78e66"], "price": 160, "priceFrom": true, "duration": "2 часа"}, {"title": "Нюдовое покрытие с укреплением", "description": "Укрепление гелем тонких ногтей, оттенок «молочный беж».", "photos": ["https://images.unsplash.com/photo-1519014816548-bf5fe059798b"], "price": 140, "duration": "1,5 часа"}, {"title": "Омбре", "description": "Плавный переход двух оттенков, глянцевый топ.", "photos": ["https://images.unsplash.com/photo-1772322586702-73125782bd99"], "price": 150}]}}, {"id": "c3", "type": "certificates", "data": {"items": [{"title": "Диплом мастера ногтевого сервиса", "issuer": "Учебный центр (пример)", "year": 2018, "imageUrl": "https://images.unsplash.com/photo-1589330694653-ded6df03f754"}, {"title": "Курс стерилизации инструментов", "issuer": "Курс повышения квалификации (пример)", "year": 2023, "imageUrl": "https://images.unsplash.com/photo-1586281380349-632531db7ed4"}]}}, {"id": "g3", "type": "gallery", "data": {"photos": [{"url": "https://images.unsplash.com/photo-1772322586785-3a34772cbc61", "caption": "Мраморный дизайн"}, {"url": "https://images.unsplash.com/photo-1772322586702-73125782bd99", "caption": "Омбре"}]}}, {"id": "o3", "type": "offers", "data": {"items": [{"title": "Первый визит", "discountPercent": 10}]}}, {"id": "l3", "type": "languages", "data": {"items": ["Русский", "Иврит"]}}, {"id": "r3", "type": "request", "data": {"enabled": true, "withTime": true}}]}}, {"slug": "primer-elektrik-boris", "section": "specialisty", "categorySlug": "elektriki", "rating": 4.8, "reviews": 54, "verified": true, "data": {"section": "specialisty", "header": {"title": "Борис М. (пример)", "profession": "Электрик с лицензией", "coverUrl": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e", "districtSlugs": ["hadar", "ahuza", "neve-shaanan", "carmelia"], "badges": ["verified", "russian_speaking", "documents_checked"]}, "contacts": {"phone": "+972500000004", "whatsapp": "+972500000004"}, "confirmedAt": "2026-11-02", "blocks": [{"id": "d4", "type": "description", "data": {"text": "Проводка, щитки, розетки, подключение бытовой техники. Лицензия электрика, гарантия на работу."}}, {"id": "sa4", "type": "service_area", "data": {"districtSlugs": ["hadar", "ahuza", "neve-shaanan", "carmelia"], "formats": ["at_home"]}}, {"id": "s4", "type": "services", "data": {"groups": [{"title": "Работы", "items": [{"name": "Вызов и диагностика", "price": 250}, {"name": "Замена розетки", "price": 120, "priceFrom": true}]}]}}, {"id": "p4", "type": "portfolio", "data": {"items": [{"title": "Замена щитка в квартире на Хадаре", "description": "Старый щиток с пробками заменили на автоматы и УЗО, подписали все линии.", "photos": ["https://images.unsplash.com/photo-1621905251918-48416bd8575a", "https://images.unsplash.com/photo-1621905252507-b35492cc74b4"], "price": 2800, "priceFrom": true, "duration": "1 день"}, {"title": "Освещение на кухне", "description": "Подвесные светильники над столом и подсветка рабочей зоны.", "photos": ["https://images.unsplash.com/photo-1565814329452-e1efa11c5b89"], "duration": "4 часа"}]}}, {"id": "c4", "type": "certificates", "data": {"items": [{"title": "Лицензия электрика (пример)", "issuer": "Министерство труда Израиля", "year": 2016, "imageUrl": "https://images.unsplash.com/photo-1450101499163-c8848c66ca85"}, {"title": "Страхование ответственности (пример)", "year": 2026, "imageUrl": "https://images.unsplash.com/photo-1554224155-6726b3ff858f"}]}}, {"id": "g4", "type": "gallery", "data": {"photos": [{"url": "https://images.unsplash.com/photo-1758101755915-462eddc23f57", "caption": "Проверка щитка"}, {"url": "https://images.unsplash.com/photo-1660330589693-99889d60181e", "caption": "Монтаж автоматов"}]}}, {"id": "l4", "type": "languages", "data": {"items": ["Русский", "Иврит", "Английский"]}}]}}, {"slug": "primer-studiya-raduga", "section": "biznes", "categorySlug": "kruzhki-i-studii", "rating": 4.9, "reviews": 17, "verified": false, "data": {"section": "biznes", "header": {"title": "Детская студия «Радуга» (пример)", "slogan": "Рисование, танцы и подготовка к школе для детей 3–12 лет", "coverUrl": "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c", "logoUrl": "https://images.unsplash.com/photo-1513364776144-60967b0f800f", "districtSlugs": ["neve-shaanan"], "badges": ["russian_speaking"]}, "contacts": {"phone": "+972500000005", "whatsapp": "+972500000005", "telegram": "example_raduga", "instagram": "example.raduga"}, "confirmedAt": "2026-11-02", "blocks": [{"id": "d5", "type": "description", "data": {"text": "Студия для детей от 3 до 12 лет: рисование, лепка, хореография и подготовка к школе. Занятия на русском, в группах до 8 детей. Первое занятие — бесплатно."}}, {"id": "sc5", "type": "schedule", "data": {"classes": [{"day": "sun", "start": "16:00", "end": "16:45", "title": "Рисование для малышей", "age": "3–5 лет", "teacher": "Елена", "price": 280, "priceNote": "в месяц"}, {"day": "sun", "start": "17:00", "end": "18:00", "title": "Живопись и графика", "age": "6–9 лет", "teacher": "Елена", "price": 320, "priceNote": "в месяц"}, {"day": "mon", "start": "16:30", "end": "17:30", "title": "Детская хореография", "age": "4–6 лет", "teacher": "Ирина", "price": 300, "priceNote": "в месяц"}, {"day": "mon", "start": "17:45", "end": "19:00", "title": "Современный танец", "age": "7–12 лет", "teacher": "Ирина", "price": 340, "priceNote": "в месяц"}, {"day": "tue", "start": "16:00", "end": "17:00", "title": "Подготовка к школе: иврит и математика", "age": "5–6 лет", "teacher": "Наталья", "price": 360, "priceNote": "в месяц"}, {"day": "wed", "start": "16:00", "end": "16:45", "title": "Рисование для малышей", "age": "3–5 лет", "teacher": "Елена", "price": 280, "priceNote": "в месяц"}, {"day": "wed", "start": "17:00", "end": "18:00", "title": "Лепка и керамика", "age": "6–10 лет", "teacher": "Елена", "price": 300, "priceNote": "в месяц"}, {"day": "thu", "start": "16:30", "end": "17:30", "title": "Детская хореография", "age": "4–6 лет", "teacher": "Ирина", "price": 300, "priceNote": "в месяц"}, {"day": "fri", "start": "10:00", "end": "11:00", "title": "Семейная творческая мастерская", "age": "дети с родителями", "teacher": "Елена", "price": 60, "priceNote": "за занятие"}], "note": "Цена «в месяц» — за 4 занятия. Пробное занятие бесплатно, группы до 8 детей."}}, {"id": "t5", "type": "team", "data": {"members": [{"name": "Елена", "role": "Художник-педагог", "photoUrl": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80", "bio": "Рисование, живопись, керамика", "bookable": true}, {"name": "Ирина", "role": "Хореограф", "photoUrl": "https://images.unsplash.com/photo-1517841905240-472988babdf9", "bio": "Хореография и современный танец", "bookable": true}, {"name": "Наталья", "role": "Педагог начальных классов", "photoUrl": "https://images.unsplash.com/photo-1580489944761-15a19d654956", "bio": "Подготовка к школе на иврите", "bookable": true}]}}, {"id": "v5", "type": "video", "data": {"items": [{"provider": "youtube", "videoId": "Ny4pezuKyos", "title": "Как проходят занятия по рисованию"}]}}, {"id": "e5", "type": "events", "data": {"items": [{"title": "Мастер-класс «Рисуем осень»", "start": "2026-11-08T10:00", "end": "2026-11-08T11:30", "place": "Студия «Радуга» (пример)", "description": "Для детей 5–10 лет, все материалы дадим. Родители могут остаться.", "photoUrl": "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b", "price": 50, "registerUrl": "https://wa.me/972500000005?text=Хочу%20на%20мастер-класс%208%20ноября"}, {"title": "Открытый урок по хореографии", "start": "2026-11-15T17:00", "end": "2026-11-15T18:00", "place": "Студия «Радуга» (пример)", "description": "Покажем, как проходят занятия в группе 4–6 лет. Вход свободный.", "photoUrl": "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea", "price": 0}, {"title": "Выставка детских рисунков", "start": "2026-12-20T11:00", "end": "2026-12-20T14:00", "place": "Студия «Радуга» (пример)", "description": "Работы учеников за полугодие и чаепитие для семей.", "photoUrl": "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4", "price": 0}]}}, {"id": "s5", "type": "services", "data": {"groups": [{"title": "Абонементы", "items": [{"name": "Разовое занятие", "price": 90, "durationMin": 60}, {"name": "Абонемент на месяц (4 занятия)", "price": 280, "priceFrom": true}, {"name": "Индивидуальное занятие", "price": 150, "durationMin": 45}]}]}}, {"id": "g5", "type": "gallery", "data": {"photos": [{"url": "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9", "caption": "Занятие по рисованию"}, {"url": "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4", "caption": "Работы учеников"}, {"url": "https://images.unsplash.com/photo-1513364776144-60967b0f800f", "caption": "Наши краски"}]}}, {"id": "n5", "type": "news", "data": {"posts": [{"date": "2026-10-25", "text": "Набираем новую группу по современному танцу для детей 9–12 лет, старт — 1 декабря.", "photoUrl": "https://images.unsplash.com/photo-1547153760-18fc86324498"}, {"date": "2026-10-05", "text": "Наши ученики заняли второе место на городском конкурсе детского рисунка!", "photoUrl": "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9"}]}}, {"id": "j5", "type": "vacancies", "data": {"items": [{"title": "Педагог по рисованию (2 дня в неделю)", "terms": "Вторник и четверг, 15:30–19:00", "requirements": "Опыт работы с детьми, русский язык", "contact": "WhatsApp 050-000-0005", "postedAt": "2026-10-30"}]}}, {"id": "c5", "type": "certificates", "data": {"items": [{"title": "Разрешение на работу кружков (пример)", "issuer": "Муниципалитет Хайфы", "year": 2025, "imageUrl": "https://images.unsplash.com/photo-1606326608606-aa0b62935f2b"}]}}, {"id": "h5", "type": "hours", "data": {"week": {"sun": [{"open": "15:30", "close": "19:30"}], "mon": [{"open": "15:30", "close": "19:30"}], "tue": [{"open": "15:30", "close": "19:30"}], "wed": [{"open": "15:30", "close": "19:30"}], "thu": [{"open": "15:30", "close": "19:30"}], "fri": [{"open": "09:30", "close": "13:00"}]}, "note": "Утром — по записи для групп детских садов"}}, {"id": "a5", "type": "address", "data": {"address": "ул. Ха-Ганим, 5, Хайфа (пример)", "howToGet": "Автобусы 19 и 31, остановка рядом", "parking": "Бесплатная парковка на улице", "lat": 32.7843, "lng": 35.0136}}, {"id": "f5", "type": "faq", "data": {"items": [{"q": "Можно прийти на пробное занятие?", "a": "Да, первое занятие бесплатно. Напишите в WhatsApp, подберём группу по возрасту."}, {"q": "Нужно ли покупать материалы?", "a": "Нет, краски, глина и бумага входят в стоимость."}]}}, {"id": "fe5", "type": "features", "data": {"items": ["Оплата картой", "Оплата через Bit", "Доступно для колясок"]}}, {"id": "l5", "type": "languages", "data": {"items": ["Русский", "Иврит"]}}, {"id": "r5", "type": "request", "data": {"enabled": true, "withTime": true}}]}}]'::jsonb) loop
    select id into v_cat from public.categories
    where section = (v_demo ->> 'section')::public.section and slug = v_demo ->> 'categorySlug';
    if v_cat is null then
      raise exception 'Нет категории % в разделе %', v_demo ->> 'categorySlug', v_demo ->> 'section';
    end if;
    v_data := jsonb_set(v_demo -> 'data', '{header,categoryId}', to_jsonb(v_cat));

    insert into public.listings (section, slug, status, is_demo, is_verified, rating_avg, rating_count)
    values ((v_demo ->> 'section')::public.section, v_demo ->> 'slug', 'draft', true,
            (v_demo ->> 'verified')::boolean, (v_demo ->> 'rating')::numeric, (v_demo ->> 'reviews')::int)
    on conflict (section, slug) do update set is_demo = true
    returning id into v_listing;

    insert into public.listing_versions (listing_id, status, data)
    values (v_listing, 'pending', v_data)
    returning id into v_version;

    perform public.publish_listing_version(v_version, 'Примерная карточка: блоки этапа 2');
  end loop;
end $demo$;

-- Остальные опубликованные карточки: пересчитать поля по новым правилам.
select public.refresh_listing_search(id) from public.listings where status = 'published' and not is_demo;
