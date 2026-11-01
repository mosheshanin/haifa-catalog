-- Сравнение email администраторов без учёта регистра.
-- Внутри функций с пустым search_path оператор citext не находится,
-- поэтому сравниваем явно через lower().

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text := coalesce(new.raw_app_meta_data ->> 'provider', '');
  v_tg_id bigint := nullif(new.raw_app_meta_data ->> 'telegram_id', '')::bigint;
  v_name text := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    new.raw_app_meta_data ->> 'telegram_name'
  );
  v_avatar text := coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture',
    new.raw_app_meta_data ->> 'telegram_photo'
  );
  v_google_email text := case when v_provider = 'google' then lower(new.email) end;
  v_role public.app_role := 'user';
begin
  if v_google_email is not null
     and exists (select 1 from public.admin_emails a where lower(a.email::text) = v_google_email) then
    v_role := 'admin';
  end if;

  insert into public.profiles (id, display_name, avatar_url, google_email, telegram_id, telegram_username, role)
  values (
    new.id,
    v_name,
    v_avatar,
    v_google_email,
    v_tg_id,
    new.raw_app_meta_data ->> 'telegram_username',
    v_role
  );
  return new;
end;
$$;

create or replace function public.sync_google_identity(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p
  set google_email = lower(p_email),
      role = case
        when exists (select 1 from public.admin_emails a where lower(a.email::text) = lower(p_email)) then 'admin'::public.app_role
        else p.role
      end
  where p.id = p_user_id;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.sync_google_identity(uuid, text) from public, anon, authenticated;
