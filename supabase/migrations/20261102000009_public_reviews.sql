-- Одобренные отзывы карточки для публичной страницы: только безопасные поля (без id пользователя).
create or replace function public.listing_reviews(p_listing uuid)
returns table (id uuid, rating smallint, text text, author_name text, owner_reply text, owner_reply_at timestamptz, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.rating, r.text, r.author_name, r.owner_reply, r.owner_reply_at, r.created_at
  from public.reviews r
  join public.listings l on l.id = r.listing_id and l.status = 'published'
  where r.listing_id = p_listing and r.status = 'approved'
  order by r.created_at desc
  limit 100;
$$;
revoke all on function public.listing_reviews(uuid) from public;
grant execute on function public.listing_reviews(uuid) to anon, authenticated;
