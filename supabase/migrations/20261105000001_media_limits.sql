-- Ограничения загрузок (решение заказчика 5 ноября 2026, раздел 4 ТЗ).
-- 1) Фото (bucket media): WebP, JPEG, PNG до 3 МБ. Браузер сам переводит фото в WebP (1600 и 640 px), JPEG/PNG
--    принимаются как запасной вариант, если браузер не смог сжать фото.
-- 2) PDF меню — отдельный bucket docs, до 10 МБ, только PDF. Старые PDF в media остаются рабочими.
-- 3) Квота на пользователя (оба bucket): до 600 файлов (300 фото: у каждого две копии), до 150 МБ, до 120 файлов в час.
--    Администраторов квота не касается. Проверка — в правиле вставки, через функцию с правами владельца
--    (иначе подзапрос к storage.objects внутри правила storage.objects уходит в рекурсию).
-- 4) orphan_media: файлы старше p_days дней, которых нет ни в одной версии карточки (опубликованной, черновике,
--    на проверке, старой) — ежедневная задача удаляет их через Storage API (прямое удаление строк не стирает файл).

update storage.buckets
set file_size_limit = 3145728, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png']
where id = 'media';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('docs', 'docs', true, 10485760, array['application/pdf'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.media_quota_ok(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) < 600
    and coalesce(sum((o.metadata ->> 'size')::bigint), 0) < 150 * 1024 * 1024
    and count(*) filter (where o.created_at > now() - interval '1 hour') < 120
  from storage.objects o
  where o.bucket_id in ('media', 'docs')
    and (storage.foldername(o.name))[1] = 'u'
    and (storage.foldername(o.name))[2] = p_uid::text;
$$;

revoke all on function public.media_quota_ok(uuid) from public, anon;
grant execute on function public.media_quota_ok(uuid) to authenticated;

drop policy if exists media_user_insert on storage.objects;
create policy media_user_insert on storage.objects for insert to authenticated with check (
  bucket_id in ('media', 'docs')
  and (storage.foldername(name))[1] = 'u'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and ((select public.is_admin()) or public.media_quota_ok((select auth.uid())))
);

drop policy if exists media_user_delete on storage.objects;
create policy media_user_delete on storage.objects for delete to authenticated using (
  bucket_id in ('media', 'docs')
  and (storage.foldername(name))[1] = 'u'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

drop policy if exists media_admin_all on storage.objects;
create policy media_admin_all on storage.objects for all to authenticated
  using (bucket_id in ('media', 'docs') and (select public.is_admin()))
  with check (bucket_id in ('media', 'docs') and (select public.is_admin()));

-- Ненужные файлы: ключ — имя без суффикса копии (.l.webp / .s.webp), чтобы маленькая копия жила, пока жива большая.
create or replace function public.orphan_media(p_days int default 7, p_limit int default 500)
returns table (bucket_id text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  with refs as (
    select concat_ws(' ',
      (select string_agg(v.data::text, ' ') from public.listing_versions v),
      (select string_agg(l.cover_url, ' ') from public.listings l where l.cover_url is not null)
    ) as txt
  )
  select o.bucket_id, o.name
  from storage.objects o, refs
  where o.bucket_id in ('media', 'docs')
    and split_part(o.name, '/', 1) in ('u', 'import')
    and o.created_at < now() - make_interval(days => p_days)
    and position(regexp_replace(o.name, '\.(l|s)\.webp$', '') in coalesce(refs.txt, '')) = 0
  order by o.created_at
  limit p_limit;
$$;

revoke all on function public.orphan_media(int, int) from public, anon, authenticated;
