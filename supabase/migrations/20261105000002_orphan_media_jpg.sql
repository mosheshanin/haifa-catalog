-- Копии фото из Safari сохраняются как .l.jpg / .s.jpg — уборка учитывает и их.
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
    and position(regexp_replace(o.name, '\.(l|s)\.(webp|jpg)$', '') in coalesce(refs.txt, '')) = 0
  order by o.created_at
  limit p_limit;
$$;

revoke all on function public.orphan_media(int, int) from public, anon, authenticated;
