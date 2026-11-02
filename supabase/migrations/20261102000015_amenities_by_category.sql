-- Фильтр «Особенности» со своим списком для каждой категории верхнего уровня (этап 5, вариант В аудита фильтров).
-- Общие отметки раздела — site_settings: amenities (бизнесы) и amenities_specialisty (специалисты).
-- Свои отметки категории — categories.amenities (подкатегории берут список родителя). Всё правится в админке.
-- Реальных карточек пока нет, поэтому стартовые списки составлены по примерам из ТЗ; пересмотреть после импорта.

alter table public.categories add column if not exists amenities text[] not null default '{}';

update public.categories c set amenities = v.list
from (values
  ('biznes', 'eda', array['Кошерно', 'Веганское меню', 'Без глютена', 'Детская зона', 'Терраса', 'Еда навынос', 'Бизнес-ланч']),
  ('biznes', 'krasota', array['Детские стрижки', 'Мужской зал', 'Подарочные сертификаты', 'Стерилизация инструментов', 'Работает вечером']),
  ('biznes', 'zdorovye', array['Приём детей', 'Приём без записи', 'Срочный приём', 'Работает вечером']),
  ('biznes', 'dom-i-remont', array['Гарантия на работы', 'Бесплатный замер', 'Бесплатная смета', 'Оплата в рассрочку']),
  ('biznes', 'avto', array['Ремонт в день обращения', 'Гарантия на работы', 'Эвакуатор', 'Подменный автомобиль', 'Подготовка к техосмотру']),
  ('biznes', 'obrazovanie', array['Пробное занятие', 'Индивидуальные занятия', 'Летний лагерь', 'Подвоз детей']),
  ('biznes', 'magaziny', array['Кошерно', 'Подарочная упаковка', 'Самовывоз', 'Обмен и возврат']),
  ('biznes', 'yuridicheskie-uslugi', array['Первая консультация бесплатно', 'Приём вечером', 'Фиксированная цена', 'Помощь репатриантам']),
  ('biznes', 'nedvizhimost', array['Без комиссии для арендатора', 'Помощь с ипотекой', 'Сопровождение сделки', 'Оценка недвижимости']),
  ('biznes', 'dosug', array['Детские праздники', 'Корпоративы', 'Кошерно', 'Скидки для групп']),
  ('biznes', 'turistam', array['Трансфер из аэропорта', 'Скидки для групп', 'Детские программы', 'Кошерно']),
  ('specialisty', 'vrachi-i-psihologi', array['Приём детей и подростков', 'Работа с парами', 'Приём вечером', 'Первая консультация бесплатно']),
  ('specialisty', 'krasota', array['Стерилизация инструментов', 'Работает вечером', 'Свадебные образы', 'Подарочные сертификаты']),
  ('specialisty', 'repetitory', array['Пробный урок бесплатно', 'Подготовка к багруту', 'Занятия в группе', 'Дети с особыми потребностями']),
  ('specialisty', 'yuristy-i-buhgaltery', array['Первая консультация бесплатно', 'Срочный перевод', 'Приём вечером', 'Фиксированная цена']),
  ('specialisty', 'mastera', array['Срочный вызов', 'Гарантия на работы', 'Работа в субботу', 'Свои материалы', 'Бесплатная оценка']),
  ('specialisty', 'pereezdy', array['Упаковка', 'Сборка мебели', 'Работа в субботу', 'Хранение вещей', 'Перевозка пианино']),
  ('specialisty', 'nyani-i-sidelki', array['Есть рекомендации', 'Курс первой помощи', 'Ночные смены', 'С проживанием']),
  ('specialisty', 'foto-video-vedushchie', array['Срочная обработка', 'Свадьбы', 'Детские праздники', 'Своя студия', 'Съёмка с дрона']),
  ('specialisty', 'it-i-dizayn', array['Поддержка после сдачи', 'Срочная помощь', 'Фиксированная цена']),
  ('specialisty', 'dokumenty-i-repatriaciya', array['Срочное оформление', 'Перевод документов', 'Первая консультация бесплатно'])
) as v(section, slug, list)
where c.section = v.section::public.section and c.slug = v.slug and c.parent_id is null;

-- Общие отметки раздела: «Детская зона» и «Кошерно» переехали в списки категорий (еда, магазины, досуг, туристам).
insert into public.site_settings (key, value, updated_at) values
  ('amenities', '["Оплата картой", "Оплата через Bit", "Wi-Fi", "Доступно для колясок", "Парковка"]', now()),
  ('amenities_specialisty', '["Оплата картой", "Оплата через Bit", "Выдаёт чек"]', now())
on conflict (key) do update set value = excluded.value, updated_at = now();

-- Сколько опубликованных карточек раздела (и категории с подкатегориями) отмечены каждой особенностью.
-- Фильтр показывает только отметки, которые что-то найдут.
create or replace function public.category_amenity_counts(p_section public.section, p_category_id bigint default null)
returns table (amenity text, n integer)
language sql
stable
set search_path = ''
as $$
  select a, count(*)::integer
  from public.listings l, unnest(l.amenities) as a
  where l.status = 'published'
    and l.section = p_section
    and (p_category_id is null or l.category_id in (
      select c.id from public.categories c where c.id = p_category_id or c.parent_id = p_category_id))
  group by a;
$$;

revoke all on function public.category_amenity_counts(public.section, bigint) from public;
grant execute on function public.category_amenity_counts(public.section, bigint) to anon, authenticated, service_role;
