-- Примерная карточка салона: блок «Рейтинг на Google» для демонстрации бесплатной карты Google.
-- Ссылка ведёт на реальное место (Бахайские сады) только для показа, как выглядит блок; в редакторе её можно убрать.
do $$
declare
  v_listing uuid;
  v_data jsonb;
  v_version uuid;
begin
  select l.id, v.data into v_listing, v_data
  from public.listings l join public.listing_versions v on v.id = l.published_version_id
  where l.section = 'biznes' and l.slug = 'primer-salon-lavanda';
  if v_listing is null or v_data -> 'blocks' @> '[{"type": "google"}]' then
    return;
  end if;
  v_data := jsonb_set(v_data, '{blocks}', (v_data -> 'blocks') || jsonb_build_array(jsonb_build_object(
    'id', 'gg1', 'type', 'google',
    'data', jsonb_build_object(
      'url', 'https://www.google.com/maps/place/data=!4m7!3m6!1s0x151dbbb118e43129:0xb7789244a7bc5b96!8m2!3d32.811364!4d34.9852756!16zL20vMDV0ODNy!19sChIJKTHkGLG7HRURllu8p0SSeLc',
      'placeId', 'ChIJKTHkGLG7HRURllu8p0SSeLc',
      'cid', '13220477529715661718'))));
  insert into public.listing_versions (listing_id, status, data) values (v_listing, 'draft', v_data) returning id into v_version;
  perform public.publish_listing_version(v_version, 'Примерная карточка: блок «Рейтинг на Google»');
end $$;
