-- Как люди называют районы и категории в запросах, и синонимы поиска.
-- Всё редактируется в админке (этап 3). Значения — в нижнем регистре, «ё» заменено на «е».

update public.districts d set aliases = v.aliases
from (values
  ('hadar', array['адар', 'хадар', 'hadar']),
  ('ahuza', array['ахуза', 'ahuza']),
  ('merkaz-hacarmel', array['центр кармеля', 'мерказ', 'кармель центр', 'merkaz']),
  ('neve-shaanan', array['неве шаанан', 'неве-шанан', 'неве шанан']),
  ('ir-tahtit', array['нижний город', 'ир тахтит', 'даунтаун']),
  ('bat-galim', array['бат галим']),
  ('carmelia', array['кармелия']),
  ('ramot-remez', array['рамот', 'рамот ремез']),
  ('romema', array['ромема']),
  ('denya', array['дения']),
  ('kiryat-eliezer', array['кирьят элиэзер']),
  ('kiryat-haim', array['кирьят хаим', 'кирьят-хаим']),
  ('kiryat-shmuel', array['кирьят шмуэль']),
  ('neve-david', array['неве давид']),
  ('halisa', array['халиса']),
  ('wadi-nisnas', array['вади ниснас']),
  ('moshava-germanit', array['немецкая колония', 'мошава германит']),
  ('kiryat-ata', array['кирьят ата']),
  ('kiryat-bialik', array['кирьят бялик', 'бялик']),
  ('kiryat-motzkin', array['кирьят моцкин', 'моцкин', 'мозкин']),
  ('kiryat-yam', array['кирьят ям']),
  ('tirat-carmel', array['тират кармель', 'тират-кармель']),
  ('nesher', array['нешер']),
  ('kiryat-tivon', array['кирьят тивон', 'тивон'])
) as v(slug, aliases)
where d.slug = v.slug;

update public.categories c set aliases = v.aliases
from (values
  ('biznes', 'eda', array['кафе', 'ресторан', 'пельмени', 'выпечка', 'пекарня', 'торты', 'доставка еды']),
  ('biznes', 'krasota', array['салон красоты', 'парикмахерская', 'барбершоп', 'косметолог', 'спа']),
  ('biznes', 'zdorovye', array['клиника', 'стоматология', 'стоматолог', 'зубной', 'поликлиника', 'физиотерапия']),
  ('biznes', 'dom-i-remont', array['ремонт квартир', 'мебель', 'стройматериалы', 'окна', 'двери']),
  ('biznes', 'avto', array['автосервис', 'гараж', 'шиномонтаж', 'автомойка', 'автошкола']),
  ('biznes', 'obrazovanie', array['детский центр', 'кружок', 'курсы', 'школа', 'детский сад', 'садик']),
  ('biznes', 'magaziny', array['магазин', 'русский магазин', 'продукты', 'гастроном']),
  ('biznes', 'yuridicheskie-uslugi', array['юридическая фирма', 'адвокатская контора', 'страхование', 'бухгалтерия']),
  ('biznes', 'nedvizhimost', array['риэлтор', 'агентство недвижимости', 'квартира', 'аренда квартир']),
  ('biznes', 'dosug', array['развлечения', 'праздник', 'концерт', 'квест']),
  ('biznes', 'turistam', array['экскурсия', 'экскурсии', 'трансфер', 'аренда авто', 'гид']),
  ('specialisty', 'vrachi-i-psihologi', array['врач', 'доктор', 'психолог', 'психотерапевт', 'терапевт']),
  ('specialisty', 'krasota', array['маникюр', 'педикюр', 'ногти', 'мастер маникюра', 'наращивание', 'брови', 'ресницы', 'визажист', 'парикмахер']),
  ('specialisty', 'repetitory', array['репетитор', 'логопед', 'учитель', 'уроки']),
  ('specialisty', 'yuristy-i-buhgaltery', array['юрист', 'адвокат', 'бухгалтер', 'переводчик', 'нотариус']),
  ('specialisty', 'mastera', array['электрик', 'сантехник', 'мастер на час', 'муж на час', 'кондиционер', 'мазган', 'мастер на все руки']),
  ('specialisty', 'pereezdy', array['переезд', 'грузчики', 'грузоперевозки', 'перевозка']),
  ('specialisty', 'nyani-i-sidelki', array['няня', 'сиделка', 'уход за пожилыми', 'бебиситтер']),
  ('specialisty', 'foto-video-vedushchie', array['фотограф', 'видеограф', 'ведущий', 'тамада', 'музыкант', 'диджей']),
  ('specialisty', 'it-i-dizayn', array['программист', 'сайт', 'дизайнер', 'компьютерный мастер']),
  ('specialisty', 'dokumenty-i-repatriaciya', array['документы', 'репатриация', 'теудат', 'министерство абсорбции', 'алия'])
) as v(section, slug, aliases)
where c.section = v.section::public.section and c.slug = v.slug;

insert into public.search_synonyms (term, expands_to) values
  ('ногти', array['маникюр', 'педикюр']),
  ('маникюр', array['ногти']),
  ('зубной', array['стоматолог']),
  ('зубы', array['стоматолог']),
  ('доктор', array['врач']),
  ('врач', array['доктор']),
  ('адвокат', array['юрист']),
  ('юрист', array['адвокат']),
  ('психотерапевт', array['психолог']),
  ('мазган', array['кондиционер']),
  ('кондиционер', array['мазган']),
  ('садик', array['детский сад']),
  ('стрижка', array['парикмахер']),
  ('парикмахерская', array['парикмахер']),
  ('ресторан', array['кафе']),
  ('кафе', array['ресторан']),
  ('переезд', array['грузоперевозки', 'грузчики']),
  ('электрика', array['электрик']),
  ('проводка', array['электрик']),
  ('пельмени', array['вареники'])
on conflict (term) do update set expands_to = excluded.expands_to;
