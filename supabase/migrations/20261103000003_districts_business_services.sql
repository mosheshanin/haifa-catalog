-- 1. Названия районов Хайфы так, как их называют жители (просьба заказчика 3 ноября 2026: «Мерказ Кармель», а не
--    «Центр Кармеля»). Адреса (slug) не меняются — на них ссылаются карточки. Прежние названия остаются в псевдонимах,
--    поэтому поиск находит и по ним. «Рамот-Ремез» был записан неверно: район называется Рамат-Ремез (רמת רמז).
update public.districts d set name = v.name, aliases = (select array(select distinct x from unnest(d.aliases || v.extra) x))
from (values
  ('hadar', 'Адар', array['хадар ха-кармель', 'хадар а-кармель', 'адар']),
  ('merkaz-hacarmel', 'Мерказ Кармель', array['мерказ кармель', 'мерказ а-кармель', 'мерказ ха-кармель', 'центр кармеля']),
  ('ir-tahtit', 'Ир-Тахтит', array['ир-тахтит', 'нижний город']),
  ('ramot-remez', 'Рамат-Ремез', array['рамат ремез', 'рамат-ремез', 'рамот ремез']),
  ('moshava-germanit', 'Мошава Германит', array['мошава германит', 'немецкая колония', 'германская колония'])
) as v(slug, name, extra)
where d.slug = v.slug;

-- Названия районов входят в поисковый текст карточек — пересчитываем его.
do $$
declare r record;
begin
  for r in select id from public.listings loop
    perform public.refresh_listing_search(r.id);
  end loop;
end $$;

-- 2. Новая категория «Услуги для бизнеса» в разделе «Бизнесы» (просьба заказчика 3 ноября 2026) с подкатегориями.
insert into public.categories (section, parent_id, slug, name, icon, icon_3d, sort, schema_type, aliases)
values ('biznes', null, 'uslugi-dlya-biznesa', 'Услуги для бизнеса', '💼', 'chart', 120, 'ProfessionalService',
        array['для бизнеса', 'бизнес услуги', 'b2b', 'аутсорсинг', 'для компаний'])
on conflict do nothing;

insert into public.categories (section, parent_id, slug, name, icon, icon_3d, sort, aliases)
select 'biznes', p.id, v.slug, v.name, v.icon, v.icon_3d, v.sort, v.aliases
from (values
  ('marketing-i-reklama', 'Маркетинг и реклама', '📣', 'megaphone', 10, array['маркетинг', 'реклама', 'smm', 'продвижение', 'таргет']),
  ('it-kompanii', 'IT-компании и веб-студии', '💻', 'computer', 20, array['веб-студия', 'разработка сайтов', 'it компания', 'программирование']),
  ('poligrafiya', 'Полиграфия и печать', '🖨', 'file', 30, array['типография', 'печать', 'визитки', 'баннеры', 'полиграфия']),
  ('konsalting', 'Консалтинг', '📈', 'target', 40, array['консалтинг', 'бизнес-консультант', 'стратегия', 'управленческий учёт']),
  ('podbor-personala', 'Подбор персонала', '🤝', 'boy', 50, array['кадровое агентство', 'рекрутинг', 'hr', 'подбор сотрудников']),
  ('kovorkingi-i-ofisy', 'Коворкинги и офисы', '🔑', 'key', 60, array['коворкинг', 'аренда офиса', 'офис', 'переговорная']),
  ('kurery-i-dostavka', 'Курьеры и доставка', '📦', 'rocket', 70, array['курьер', 'доставка документов', 'логистика', 'экспресс-доставка'])
) as v(slug, name, icon, icon_3d, sort, aliases)
join public.categories p on p.section = 'biznes' and p.slug = 'uslugi-dlya-biznesa' and p.parent_id is null
on conflict do nothing;
