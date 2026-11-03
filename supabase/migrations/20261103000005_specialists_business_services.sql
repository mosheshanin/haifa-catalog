-- «Услуги для бизнеса» у специалистов (заказчик 3 ноября 2026: такие услуги предлагают и частные специалисты).
-- Подкатегории не повторяют уже существующие: сайты, дизайн, реклама и соцсети — в «IT и дизайн»,
-- бухгалтеры, юристы и переводчики — в «Юристы, бухгалтеры, переводчики».
insert into public.categories (section, parent_id, slug, name, icon, icon_3d, sort, schema_type, aliases)
values ('specialisty', null, 'uslugi-dlya-biznesa', 'Услуги для бизнеса', '💼', 'chart', 110, 'ProfessionalService',
        array['для бизнеса', 'бизнес услуги', 'b2b', 'фрилансер', 'аутсорсинг'])
on conflict do nothing;

insert into public.categories (section, parent_id, slug, name, icon, icon_3d, sort, aliases)
select 'specialisty', p.id, v.slug, v.name, v.icon, v.icon_3d, v.sort, v.aliases
from (values
  ('biznes-konsultanty', 'Бизнес-консультанты и коучи', '📈', 'target', 10, array['бизнес-консультант', 'бизнес коуч', 'консультант', 'стратегия']),
  ('marketologi', 'Маркетологи', '📣', 'megaphone', 20, array['маркетолог', 'маркетинг', 'продвижение', 'стратегия продвижения']),
  ('kopiraitery', 'Копирайтеры и редакторы', '✏️', 'pencil', 30, array['копирайтер', 'тексты', 'редактор', 'контент']),
  ('virtualnye-assistenty', 'Виртуальные ассистенты', '🗓', 'calender', 40, array['ассистент', 'секретарь', 'помощник руководителя', 'администрирование']),
  ('hr-i-podbor', 'HR и подбор персонала', '🤝', 'boy', 50, array['hr', 'рекрутер', 'подбор персонала', 'кадры']),
  ('prodazhi', 'Продажи и работа с клиентами', '💰', 'money', 60, array['менеджер по продажам', 'продажи', 'лидогенерация', 'колл-центр']),
  ('biznes-trenery', 'Бизнес-тренеры', '🎓', 'medal', 70, array['бизнес-тренер', 'тренинги', 'обучение персонала', 'семинары'])
) as v(slug, name, icon, icon_3d, sort, aliases)
join public.categories p on p.section = 'specialisty' and p.slug = 'uslugi-dlya-biznesa' and p.parent_id is null
on conflict do nothing;
