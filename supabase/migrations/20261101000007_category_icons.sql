-- Иконка категории (эмодзи). Редактируется в админке вместе с остальными полями категории.
alter table public.categories add column if not exists icon text;

update public.categories c set icon = v.icon
from (values
  ('biznes', 'eda', '🍽️'),
  ('biznes', 'krasota', '💅'),
  ('biznes', 'zdorovye', '🩺'),
  ('biznes', 'dom-i-remont', '🛠️'),
  ('biznes', 'avto', '🚗'),
  ('biznes', 'obrazovanie', '🎓'),
  ('biznes', 'magaziny', '🛒'),
  ('biznes', 'yuridicheskie-uslugi', '⚖️'),
  ('biznes', 'nedvizhimost', '🏠'),
  ('biznes', 'dosug', '🎭'),
  ('biznes', 'turistam', '🧳'),
  ('specialisty', 'vrachi-i-psihologi', '👩‍⚕️'),
  ('specialisty', 'krasota', '💄'),
  ('specialisty', 'repetitory', '📚'),
  ('specialisty', 'yuristy-i-buhgaltery', '📑'),
  ('specialisty', 'mastera', '🔧'),
  ('specialisty', 'pereezdy', '🚚'),
  ('specialisty', 'nyani-i-sidelki', '🧸'),
  ('specialisty', 'foto-video-vedushchie', '📸'),
  ('specialisty', 'it-i-dizayn', '💻'),
  ('specialisty', 'dokumenty-i-repatriaciya', '🛂')
) as v(section, slug, icon)
where c.section = v.section::public.section and c.slug = v.slug;
