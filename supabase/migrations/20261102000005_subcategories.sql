-- Подкатегории (ТЗ, раздел 3; утверждены 1 ноября 2026), точное распознавание категорий в поиске,
-- координаты для карты.

-- ---------------------------------------------------------------
-- Подкатегории. Адрес: /<раздел>/<категория>/<подкатегория>. Слаг уникален в разделе
-- (не совпадает с категориями, карточками и районами — это проверяет триггер check_slug_namespace).
-- ---------------------------------------------------------------
insert into public.categories (section, parent_id, slug, name, icon, sort, aliases)
select v.section::public.section, p.id, v.slug, v.name, v.icon, v.sort, v.aliases
from (values
  ('biznes', 'eda', 'kafe-i-restorany', 'Кафе и рестораны', '☕', 10, array['кафе', 'ресторан', 'рестораны', 'пельмени', 'бизнес-ланч']),
  ('biznes', 'eda', 'pekarni', 'Пекарни и кондитерские', '🥐', 20, array['пекарня', 'выпечка', 'кондитерская', 'торты', 'торт на заказ']),
  ('biznes', 'eda', 'domashnyaya-eda', 'Домашняя еда и доставка', '🍲', 30, array['домашняя еда', 'доставка еды', 'готовая еда']),
  ('biznes', 'eda', 'bary', 'Бары', '🍺', 40, array['бар', 'паб']),
  ('biznes', 'eda', 'kejtering', 'Кейтеринг', '🍱', 50, array['кейтеринг', 'фуршет']),
  ('biznes', 'krasota', 'salony-krasoty', 'Салоны красоты', '💇', 10, array['салон красоты']),
  ('biznes', 'krasota', 'parikmaherskie', 'Парикмахерские и барбершопы', '💈', 20, array['парикмахерская', 'барбершоп', 'барбер', 'стрижка']),
  ('biznes', 'krasota', 'nogtevoy-servis', 'Ногтевой сервис', '💅', 30, array['маникюр', 'педикюр', 'ногти', 'гель-лак', 'ногтевая студия']),
  ('biznes', 'krasota', 'kosmetologiya', 'Косметология', '🧴', 40, array['косметолог', 'косметология', 'чистка лица']),
  ('biznes', 'krasota', 'brovi-i-resnitsy', 'Брови и ресницы', '✨', 50, array['брови', 'ресницы', 'ламинирование']),
  ('biznes', 'krasota', 'spa-i-massazh', 'СПА и массаж', '💆', 60, array['спа', 'массаж', 'массажный салон']),
  ('biznes', 'zdorovye', 'stomatologiya', 'Стоматология', '🦷', 10, array['стоматолог', 'стоматология', 'зубной', 'зубы', 'дантист']),
  ('biznes', 'zdorovye', 'chastnye-kliniki', 'Частные клиники', '🏥', 20, array['клиника', 'поликлиника', 'медицинский центр']),
  ('biznes', 'zdorovye', 'fizioterapiya', 'Физиотерапия и реабилитация', '🦴', 30, array['физиотерапия', 'физиотерапевт', 'реабилитация']),
  ('biznes', 'zdorovye', 'optika', 'Оптика', '👓', 40, array['оптика', 'очки', 'контактные линзы']),
  ('biznes', 'zdorovye', 'veterinariya', 'Ветеринария', '🐾', 50, array['ветеринар', 'ветклиника', 'ветеринария']),
  ('biznes', 'dom-i-remont', 'remont-i-otdelka', 'Ремонт и отделка', '🧱', 10, array['ремонт квартир', 'ремонт квартиры', 'отделка', 'плитка', 'кафель']),
  ('biznes', 'dom-i-remont', 'mebel-i-kuhni', 'Мебель и кухни', '🛋️', 20, array['мебель', 'кухни', 'кухня на заказ']),
  ('biznes', 'dom-i-remont', 'okna-dveri-zhalyuzi', 'Окна, двери, жалюзи', '🚪', 30, array['окна', 'двери', 'жалюзи', 'трисы']),
  ('biznes', 'dom-i-remont', 'konditsionery', 'Кондиционеры', '❄️', 40, array['кондиционер', 'кондиционеры', 'мазган']),
  ('biznes', 'dom-i-remont', 'uborka', 'Уборка', '🧹', 50, array['уборка', 'клининг']),
  ('biznes', 'avto', 'avtoservisy', 'Автосервисы и гаражи', '🔧', 10, array['автосервис', 'гараж', 'автомеханик']),
  ('biznes', 'avto', 'shinomontazh', 'Шиномонтаж', '🔩', 20, array['шиномонтаж', 'шины']),
  ('biznes', 'avto', 'avtomoyki', 'Автомойки', '🧽', 30, array['автомойка', 'мойка машин']),
  ('biznes', 'avto', 'avtoshkoly', 'Автошколы', '🚦', 40, array['автошкола', 'инструктор по вождению', 'уроки вождения']),
  ('biznes', 'avto', 'prokat-avto', 'Прокат авто', '🚙', 50, array['прокат авто', 'прокат машин', 'аренда авто', 'аренда машины']),
  ('biznes', 'obrazovanie', 'detskie-sady', 'Детские сады', '🧒', 10, array['детский сад', 'садик']),
  ('biznes', 'obrazovanie', 'kruzhki-i-studii', 'Кружки и студии', '🎨', 20, array['кружок', 'кружки', 'детская студия']),
  ('biznes', 'obrazovanie', 'yazykovye-kursy', 'Языковые курсы', '🗣️', 30, array['ульпан', 'курсы иврита', 'курсы английского']),
  ('biznes', 'obrazovanie', 'bagrut-psihometriya', 'Подготовка к багруту и психометрии', '📝', 40, array['багрут', 'психометрия', 'психометрический']),
  ('biznes', 'obrazovanie', 'sportivnye-sekcii', 'Спортивные секции', '⚽', 50, array['спортивная секция', 'секция', 'плавание', 'футбол', 'гимнастика']),
  ('biznes', 'obrazovanie', 'muzykalnye-shkoly', 'Музыкальные школы', '🎹', 60, array['музыкальная школа']),
  ('biznes', 'magaziny', 'russkie-produkty', 'Русские продукты', '🥫', 10, array['русский магазин', 'русские продукты', 'гастроном', 'продукты']),
  ('biznes', 'magaziny', 'odezhda-i-obuv', 'Одежда и обувь', '👗', 20, array['одежда', 'обувь']),
  ('biznes', 'magaziny', 'elektronika', 'Электроника', '📱', 30, array['электроника', 'бытовая техника', 'телефоны']),
  ('biznes', 'magaziny', 'knigi', 'Книги', '📚', 40, array['книги', 'книжный']),
  ('biznes', 'magaziny', 'cvety-i-podarki', 'Цветы и подарки', '💐', 50, array['цветы', 'букет', 'подарки']),
  ('biznes', 'yuridicheskie-uslugi', 'advokatskie-kontory', 'Адвокатские конторы', '⚖️', 10, array['адвокатская контора', 'юридическая фирма']),
  ('biznes', 'yuridicheskie-uslugi', 'buhgalteriya', 'Бухгалтерия и налоги', '🧮', 20, array['бухгалтерия', 'налоги']),
  ('biznes', 'yuridicheskie-uslugi', 'strahovanie', 'Страхование', '🛡️', 30, array['страхование', 'страховка', 'страховой агент']),
  ('biznes', 'yuridicheskie-uslugi', 'ipoteka', 'Ипотека и финансы', '🏦', 40, array['ипотека', 'машканта', 'кредит']),
  ('biznes', 'yuridicheskie-uslugi', 'notariusy', 'Нотариусы', '🖋️', 50, array['нотариус']),
  ('biznes', 'nedvizhimost', 'agentstva', 'Агентства', '🏢', 10, array['агентство недвижимости', 'риэлтор', 'риелтор', 'маклер']),
  ('biznes', 'nedvizhimost', 'arenda', 'Аренда', '🔑', 20, array['аренда квартир', 'аренда квартиры', 'снять квартиру', 'сдать квартиру']),
  ('biznes', 'nedvizhimost', 'pokupka-i-prodazha', 'Покупка и продажа', '🤝', 30, array['купить квартиру', 'продать квартиру']),
  ('biznes', 'nedvizhimost', 'upravlenie-nedvizhimostyu', 'Управление недвижимостью', '🗝️', 40, array['управление недвижимостью']),
  ('biznes', 'dosug', 'prazdniki', 'Праздники и мероприятия', '🎉', 10, array['праздник', 'день рождения', 'свадьба', 'мероприятие']),
  ('biznes', 'dosug', 'kvesty', 'Квесты и развлечения', '🧩', 20, array['квест', 'развлечения', 'батуты']),
  ('biznes', 'dosug', 'fitnes', 'Фитнес и спорт', '🏋️', 30, array['фитнес', 'спортзал', 'тренажерный зал', 'йога', 'пилатес']),
  ('biznes', 'dosug', 'kultura', 'Концерты и культура', '🎵', 40, array['концерт', 'театр', 'выставка']),
  ('biznes', 'turistam', 'ekskursii', 'Экскурсии', '🗺️', 10, array['экскурсия', 'экскурсии', 'гид']),
  ('biznes', 'turistam', 'transfery', 'Трансферы', '🚐', 20, array['трансфер', 'такси в аэропорт']),
  ('biznes', 'turistam', 'arenda-avto', 'Аренда авто', '🚗', 30, array['аренда авто', 'аренда машины', 'прокат авто']),
  ('biznes', 'turistam', 'zhilye-i-cimmery', 'Жильё и циммеры', '🏡', 40, array['циммер', 'гостиница', 'отель', 'хостел']),
  ('specialisty', 'vrachi-i-psihologi', 'psihologi', 'Психологи и психотерапевты', '🧠', 10, array['психолог', 'психотерапевт', 'психиатр']),
  ('specialisty', 'vrachi-i-psihologi', 'vrachi', 'Врачи частной практики', '🩺', 20, array['врач', 'доктор', 'терапевт']),
  ('specialisty', 'vrachi-i-psihologi', 'detskie-specialisty', 'Детские специалисты', '👶', 30, array['детский психолог', 'эрготерапевт', 'педиатр']),
  ('specialisty', 'vrachi-i-psihologi', 'massazhisty', 'Массажисты', '💆', 40, array['массажист', 'массаж']),
  ('specialisty', 'vrachi-i-psihologi', 'dietologi', 'Диетологи и нутрициологи', '🥗', 50, array['диетолог', 'нутрициолог']),
  ('specialisty', 'krasota', 'manikyur', 'Маникюр и педикюр', '💅', 10, array['маникюр', 'педикюр', 'ногти', 'гель-лак', 'мастер маникюра']),
  ('specialisty', 'krasota', 'brovi-i-resnitsy', 'Брови и ресницы', '✨', 20, array['брови', 'ресницы', 'наращивание ресниц', 'ламинирование']),
  ('specialisty', 'krasota', 'parikmahery', 'Парикмахеры', '💇', 30, array['парикмахер', 'стрижка', 'окрашивание']),
  ('specialisty', 'krasota', 'vizazhisty', 'Визажисты', '💄', 40, array['визажист', 'макияж']),
  ('specialisty', 'krasota', 'kosmetologi', 'Косметологи', '🧴', 50, array['косметолог', 'чистка лица']),
  ('specialisty', 'krasota', 'epilyaciya', 'Эпиляция', '🌸', 60, array['эпиляция', 'депиляция', 'шугаринг']),
  ('specialisty', 'repetitory', 'ivrit', 'Иврит', '🔤', 10, array['иврит', 'ульпан', 'репетитор иврита']),
  ('specialisty', 'repetitory', 'angliyskiy', 'Английский', '💬', 20, array['английский', 'репетитор английского']),
  ('specialisty', 'repetitory', 'matematika', 'Математика', '➗', 30, array['математика', 'физика']),
  ('specialisty', 'repetitory', 'bagrut-i-psihometriya', 'Багрут и психометрия', '📝', 40, array['багрут', 'психометрия']),
  ('specialisty', 'repetitory', 'logopedy', 'Логопеды', '🗣️', 50, array['логопед']),
  ('specialisty', 'repetitory', 'muzyka', 'Музыка', '🎸', 60, array['уроки музыки', 'фортепиано', 'гитара', 'вокал']),
  ('specialisty', 'yuristy-i-buhgaltery', 'yuristy', 'Юристы', '⚖️', 10, array['юрист', 'адвокат']),
  ('specialisty', 'yuristy-i-buhgaltery', 'buhgaltery', 'Бухгалтеры', '🧮', 20, array['бухгалтер']),
  ('specialisty', 'yuristy-i-buhgaltery', 'perevodchiki', 'Переводчики и заверение', '🌐', 30, array['переводчик', 'перевод документов', 'заверение']),
  ('specialisty', 'yuristy-i-buhgaltery', 'nalogovye-konsultanty', 'Налоговые консультанты', '💰', 40, array['налоговый консультант', 'возврат налогов', 'налоги']),
  ('specialisty', 'mastera', 'elektriki', 'Электрики', '💡', 10, array['электрик', 'электрика', 'проводка']),
  ('specialisty', 'mastera', 'santehniki', 'Сантехники', '🚿', 20, array['сантехник', 'сантехника', 'засор']),
  ('specialisty', 'mastera', 'konditsionery', 'Кондиционеры', '❄️', 30, array['кондиционер', 'кондиционеры', 'мазган']),
  ('specialisty', 'mastera', 'master-na-chas', 'Мастер на час', '🔨', 40, array['мастер на час', 'муж на час', 'мастер на все руки']),
  ('specialisty', 'mastera', 'remont-tehniki', 'Ремонт техники', '🔌', 50, array['ремонт техники', 'ремонт стиральной машины', 'ремонт холодильника']),
  ('specialisty', 'mastera', 'sborka-mebeli', 'Сборка мебели', '🧰', 60, array['сборка мебели', 'сборщик мебели']),
  ('specialisty', 'pereezdy', 'gruzoperevozki', 'Грузоперевозки', '🚚', 10, array['грузоперевозки', 'перевозка', 'перевезти']),
  ('specialisty', 'pereezdy', 'gruzchiki', 'Грузчики', '💪', 20, array['грузчики', 'грузчик']),
  ('specialisty', 'pereezdy', 'vyvoz-musora', 'Вывоз мусора', '🗑️', 30, array['вывоз мусора']),
  ('specialisty', 'nyani-i-sidelki', 'nyani', 'Няни', '🍼', 10, array['няня', 'бебиситтер']),
  ('specialisty', 'nyani-i-sidelki', 'sidelki', 'Сиделки', '🤝', 20, array['сиделка', 'уход за пожилыми', 'метапелет']),
  ('specialisty', 'nyani-i-sidelki', 'pomoshch-po-domu', 'Помощь по дому', '🏠', 30, array['домработница', 'помощница по дому']),
  ('specialisty', 'foto-video-vedushchie', 'fotografy', 'Фотографы', '📷', 10, array['фотограф', 'фотосессия']),
  ('specialisty', 'foto-video-vedushchie', 'videografy', 'Видеографы', '🎥', 20, array['видеограф', 'видеосъемка']),
  ('specialisty', 'foto-video-vedushchie', 'vedushchie', 'Ведущие', '🎤', 30, array['ведущий', 'тамада']),
  ('specialisty', 'foto-video-vedushchie', 'muzykanty-i-didzhei', 'Музыканты и диджеи', '🎧', 40, array['музыкант', 'диджей']),
  ('specialisty', 'foto-video-vedushchie', 'animatory', 'Аниматоры', '🎈', 50, array['аниматор', 'клоун']),
  ('specialisty', 'it-i-dizayn', 'sayty', 'Сайты и разработка', '🌐', 10, array['сайт', 'программист', 'разработка сайтов']),
  ('specialisty', 'it-i-dizayn', 'dizayn', 'Дизайн', '🎨', 20, array['дизайнер', 'дизайн', 'логотип']),
  ('specialisty', 'it-i-dizayn', 'kompyuternaya-pomoshch', 'Компьютерная помощь', '🖥️', 30, array['компьютерный мастер', 'ремонт компьютеров', 'ремонт компьютера']),
  ('specialisty', 'it-i-dizayn', 'reklama', 'Реклама и соцсети', '📣', 40, array['реклама', 'smm', 'таргет', 'соцсети']),
  ('specialisty', 'dokumenty-i-repatriaciya', 'oformlenie-dokumentov', 'Оформление документов', '📄', 10, array['документы', 'оформление документов', 'теудат']),
  ('specialisty', 'dokumenty-i-repatriaciya', 'soprovozhdenie', 'Сопровождение в учреждениях', '🏛️', 20, array['сопровождение', 'битуах леуми']),
  ('specialisty', 'dokumenty-i-repatriaciya', 'repatriaciya', 'Консультации по репатриации', '✈️', 30, array['репатриация', 'алия', 'министерство абсорбции'])
) as v(section, parent, slug, name, icon, sort, aliases)
join public.categories p on p.section = v.section::public.section and p.slug = v.parent and p.parent_id is null
on conflict (section, slug) do nothing;

update public.categories c set aliases = v.aliases
from (values
  ('biznes', 'eda', array['еда', 'поесть']),
  ('biznes', 'krasota', array['красота', 'бьюти']),
  ('biznes', 'zdorovye', array['здоровье', 'медицина']),
  ('biznes', 'dom-i-remont', array['ремонт', 'стройматериалы']),
  ('biznes', 'avto', array['авто', 'машина', 'машины', 'автомобиль']),
  ('biznes', 'obrazovanie', array['детский центр', 'курсы', 'школа', 'образование']),
  ('biznes', 'magaziny', array['магазин']),
  ('biznes', 'yuridicheskie-uslugi', array['юридические услуги', 'финансы']),
  ('biznes', 'nedvizhimost', array['недвижимость', 'квартира']),
  ('biznes', 'dosug', array['досуг', 'отдых']),
  ('biznes', 'turistam', array['туристам', 'туризм']),
  ('specialisty', 'vrachi-i-psihologi', array['частная практика']),
  ('specialisty', 'krasota', array['мастер красоты', 'бьюти мастер']),
  ('specialisty', 'repetitory', array['репетитор', 'учитель', 'уроки']),
  ('specialisty', 'yuristy-i-buhgaltery', array['нотариус']),
  ('specialisty', 'mastera', array['мастер', 'ремонт']),
  ('specialisty', 'pereezdy', array['переезд', 'переезды']),
  ('specialisty', 'nyani-i-sidelki', array['уход']),
  ('specialisty', 'foto-video-vedushchie', array['праздник', 'свадьба']),
  ('specialisty', 'it-i-dizayn', array['компьютер']),
  ('specialisty', 'dokumenty-i-repatriaciya', array['бюрократия'])
) as v(section, slug, aliases)
where c.section = v.section::public.section and c.slug = v.slug and c.parent_id is null;

-- Примерные карточки переносим в подкатегории
do $$
declare
  r record;
begin
  for r in
    select l.id, l.published_version_id, c.id as cat_id
    from public.listings l
    join (values
      ('specialisty', 'primer-anna-manikyur', 'manikyur'),
      ('specialisty', 'primer-elektrik-boris', 'elektriki'),
      ('biznes', 'primer-kafe-samovar', 'kafe-i-restorany'),
      ('biznes', 'primer-salon-lavanda', 'salony-krasoty')
    ) as v(section, listing, category) on l.section = v.section::public.section and l.slug = v.listing
    join public.categories c on c.section = l.section and c.slug = v.category
    where l.is_demo
  loop
    update public.listing_versions
      set data = jsonb_set(data, '{header,categoryId}', to_jsonb(r.cat_id))
      where id = r.published_version_id;
    perform public.refresh_listing_search(r.id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------
-- Поиск: распознанная подкатегория включает «общие» карточки родительской категории
-- ---------------------------------------------------------------
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
  -- «нотариус» у бизнесов и специалистов) — берём все. Если запрос и есть категория — фильтруем,
  -- иначе только поднимаем такие карточки выше.
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

      -- найденные категории и их подкатегории
      select array_agg(distinct x) into v_cat_boost from (
        select unnest(v_hit_ids) as x
        union select c.id from public.categories c where c.parent_id = any (v_hit_ids)
      ) t;

      -- Остаток короче 3 букв — это окончание слова («стоматологи»): запрос целиком о категории
      if length(trim(replace(v_rest, v_detected_cat, ''))) < 3 then
        v_rest := '';
        -- плюс «общие» карточки родителя, у которых подкатегория не выбрана
        select array_agg(distinct x) into v_category_ids from (
          select unnest(v_cat_boost) as x
          union select c.parent_id from public.categories c where c.id = any (v_hit_ids) and c.parent_id is not null
        ) t;
        v_cat_boost := null;
        v_detected_cat := v_hit_slug;
      else
        v_detected_cat := null;
      end if;
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

-- ---------------------------------------------------------------
-- Координаты опубликованных карточек для карты (до 200 за раз)
-- ---------------------------------------------------------------
create or replace function public.listing_points(p_ids uuid[])
returns table (id uuid, lat double precision, lng double precision)
language sql
stable
set search_path = ''
as $$
  select l.id,
         extensions.st_y(l.location::extensions.geometry),
         extensions.st_x(l.location::extensions.geometry)
  from public.listings l
  where cardinality(p_ids) <= 200
    and l.id = any (p_ids)
    and l.status = 'published'
    and l.location is not null;
$$;

revoke all on function public.listing_points(uuid[]) from public;
grant execute on function public.listing_points(uuid[]) to anon, authenticated, service_role;
