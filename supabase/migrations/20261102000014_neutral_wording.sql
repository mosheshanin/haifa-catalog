-- Позиционирование без акцента на русском языке (решение 2 ноября 2026, раздел 14 ТЗ): часть аудитории — из Украины.
-- 1) «Магазины и русские продукты» → «Магазины и продукты», «Русские продукты» → «Восточноевропейские продукты»
--    (новый адрес подкатегории; старые слова остаются в псевдонимах — по ним ищут).
-- 2) Значок «Говорят по-русски» больше не используется: убираем его из шапок карточек во всех версиях.

update public.categories
set name = 'Магазины и продукты',
    aliases = (select array_agg(distinct a) from unnest(aliases || array['магазин', 'продукты', 'русские продукты', 'гастроном']) a)
where section = 'biznes' and slug = 'magaziny' and parent_id is null;

update public.categories
set name = 'Восточноевропейские продукты',
    slug = 'vostochnoevropejskie-produkty',
    aliases = (select array_agg(distinct a) from unnest(aliases || array['русский магазин', 'русские продукты', 'украинские продукты',
                                                                          'восточноевропейские продукты', 'гастроном', 'деликатесы', 'продукты']) a)
where section = 'biznes' and slug = 'russkie-produkty';

update public.listing_versions v
set data = jsonb_set(v.data, '{header,badges}',
  coalesce((select jsonb_agg(b) from jsonb_array_elements(v.data #> '{header,badges}') b where b <> '"russian_speaking"'::jsonb), '[]'::jsonb))
where v.data #> '{header,badges}' ? 'russian_speaking';

-- Название и псевдонимы категории попадают в поиск карточек — пересчитываем (см. CLAUDE.md).
select public.refresh_listing_search(l.id)
from public.listings l
where l.published_version_id is not null
  and l.category_id in (select c.id from public.categories c where c.section = 'biznes'
                        and (c.slug = 'magaziny' or c.parent_id = (select id from public.categories where section = 'biznes' and slug = 'magaziny' and parent_id is null)));
