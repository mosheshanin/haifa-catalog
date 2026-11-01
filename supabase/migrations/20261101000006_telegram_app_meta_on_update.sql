-- Supabase сначала создаёт пользователя, а app_metadata (с telegram_id) записывает отдельным
-- обновлением. Поэтому переносим данные Telegram в профиль и при обновлении app_metadata.
-- app_metadata может менять только сервер (ключ service_role), пользователь — нет.

create or replace function public.handle_user_app_meta_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tg_id bigint := nullif(new.raw_app_meta_data ->> 'telegram_id', '')::bigint;
begin
  if v_tg_id is null then
    return new;
  end if;
  -- Не трогаем, если этот Telegram уже привязан к другому профилю (объединение делает сервер).
  if exists (select 1 from public.profiles p where p.telegram_id = v_tg_id and p.id <> new.id) then
    return new;
  end if;
  update public.profiles p set
    telegram_id = coalesce(p.telegram_id, v_tg_id),
    telegram_username = coalesce(p.telegram_username, new.raw_app_meta_data ->> 'telegram_username'),
    display_name = coalesce(p.display_name, new.raw_app_meta_data ->> 'telegram_name'),
    avatar_url = coalesce(p.avatar_url, new.raw_app_meta_data ->> 'telegram_photo')
  where p.id = new.id;
  return new;
end;
$$;

revoke execute on function public.handle_user_app_meta_update() from public, anon, authenticated;

create trigger on_auth_user_app_meta_updated
  after update of raw_app_meta_data on auth.users
  for each row
  when (new.raw_app_meta_data ->> 'telegram_id' is distinct from old.raw_app_meta_data ->> 'telegram_id')
  execute function public.handle_user_app_meta_update();

-- Профили, созданные до исправления.
update public.profiles p set
  telegram_id = (u.raw_app_meta_data ->> 'telegram_id')::bigint,
  telegram_username = coalesce(p.telegram_username, u.raw_app_meta_data ->> 'telegram_username'),
  display_name = coalesce(p.display_name, u.raw_app_meta_data ->> 'telegram_name'),
  avatar_url = coalesce(p.avatar_url, u.raw_app_meta_data ->> 'telegram_photo')
from auth.users u
where u.id = p.id
  and p.telegram_id is null
  and u.raw_app_meta_data ? 'telegram_id'
  and not exists (
    select 1 from public.profiles o where o.telegram_id = (u.raw_app_meta_data ->> 'telegram_id')::bigint
  );
