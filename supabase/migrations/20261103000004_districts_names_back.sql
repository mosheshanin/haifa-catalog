-- Заказчик 3 ноября 2026: у районов «Нижний город» и «Немецкая колония» оставить русские названия.
-- Ивритские варианты («Ир-Тахтит», «Мошава Германит») остаются в псевдонимах — по ним тоже находит.
update public.districts set name = 'Нижний город' where slug = 'ir-tahtit';
update public.districts set name = 'Немецкая колония' where slug = 'moshava-germanit';

do $$
declare r record;
begin
  for r in select id from public.listings loop
    perform public.refresh_listing_search(r.id);
  end loop;
end $$;
