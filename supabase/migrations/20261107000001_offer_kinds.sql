-- Вид спецпредложения (7 ноября 2026, src/lib/blocks/offers.ts): у пунктов блока «offers» появилось поле kind
-- (free / discount / price / gift / other) и oldPrice — обычная цена. Переводим старые пункты без kind:
--   скидка 100% → «Бесплатно», прежняя «Цена» становится обычной ценой (так её понимал владелец);
--   есть скидка → «Скидка»; есть только цена → «Специальная цена»; иначе → «Другое».
-- Поисковые поля listings не зависят от вида, refresh_listing_search не нужен.
-- Триггер «последняя правка» на время переноса выключен: иначе сдвинулся бы срок брошенных черновиков.

alter table public.listing_versions disable trigger listing_versions_touch_edit;

update public.listing_versions v
set data = jsonb_set(
  v.data,
  '{blocks}',
  (
    select jsonb_agg(
      case
        when b->>'type' = 'offers' and jsonb_typeof(b->'data'->'items') = 'array' then jsonb_set(
          b,
          '{data,items}',
          coalesce((
            select jsonb_agg(
              case
                when i ? 'kind' then i
                when (i->>'discountPercent')::numeric = 100 then
                  (i - 'price' - 'discountPercent')
                  || jsonb_build_object('kind', 'free')
                  || case when i ? 'price' then jsonb_build_object('oldPrice', i->'price') else '{}'::jsonb end
                when i ? 'discountPercent' then i || '{"kind": "discount"}'::jsonb
                when i ? 'price' then i || '{"kind": "price"}'::jsonb
                else i || '{"kind": "other"}'::jsonb
              end
              order by ord
            )
            from jsonb_array_elements(b->'data'->'items') with ordinality as x(i, ord)
          ), '[]'::jsonb)
        )
        else b
      end
      order by bo
    )
    from jsonb_array_elements(v.data->'blocks') with ordinality as y(b, bo)
  )
)
where exists (
  select 1
  from jsonb_array_elements(coalesce(v.data->'blocks', '[]'::jsonb)) b,
       jsonb_array_elements(case when jsonb_typeof(b->'data'->'items') = 'array' then b->'data'->'items' else '[]'::jsonb end) i
  where b->>'type' = 'offers' and not i ? 'kind'
);

alter table public.listing_versions enable trigger listing_versions_touch_edit;
