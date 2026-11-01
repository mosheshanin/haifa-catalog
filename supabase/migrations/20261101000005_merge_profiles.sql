-- Объединение двух профилей одного человека (раздел 7 ТЗ, «Объединение профилей»).
-- p_keep остаётся, p_remove переносится в него; сам пользователь p_remove затем
-- удаляется сервером через Auth API. Вызывать может только сервер (service_role).
-- ВАЖНО: при добавлении новых таблиц с user_id (избранное, отзывы, заявки) — дописать их сюда.

create or replace function public.merge_profiles(p_keep uuid, p_remove uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remove public.profiles%rowtype;
begin
  if p_keep = p_remove then
    return;
  end if;

  select * into v_remove from public.profiles where id = p_remove for update;
  if not found then
    return;
  end if;
  perform 1 from public.profiles where id = p_keep for update;
  if not found then
    raise exception 'merge_profiles: профиль % не найден', p_keep;
  end if;

  update public.listings set owner_id = p_keep where owner_id = p_remove;
  update public.listings set created_by = p_keep where created_by = p_remove;
  update public.listing_versions set created_by = p_keep where created_by = p_remove;
  update public.listing_versions set reviewed_by = p_keep where reviewed_by = p_remove;

  -- Заявки на права: дубль «на проверке» по той же карточке удаляем.
  delete from public.ownership_claims c
  where c.user_id = p_remove and c.status = 'pending'
    and exists (
      select 1 from public.ownership_claims k
      where k.user_id = p_keep and k.listing_id = c.listing_id and k.status = 'pending'
    );
  update public.ownership_claims set user_id = p_keep where user_id = p_remove;
  update public.ownership_claims set decided_by = p_keep where decided_by = p_remove;

  update public.audit_log set actor_id = p_keep where actor_id = p_remove;
  update public.admin_emails set added_by = p_keep where added_by = p_remove;
  update public.link_tokens set used_at = coalesce(used_at, now()) where user_id = p_remove;

  -- Уникальные поля освобождаем перед переносом.
  update public.profiles set telegram_id = null, google_email = null where id = p_remove;

  update public.profiles k set
    telegram_id = coalesce(k.telegram_id, v_remove.telegram_id),
    telegram_username = coalesce(k.telegram_username, v_remove.telegram_username),
    google_email = coalesce(k.google_email, v_remove.google_email),
    display_name = coalesce(k.display_name, v_remove.display_name),
    avatar_url = coalesce(k.avatar_url, v_remove.avatar_url),
    is_blocked = k.is_blocked or v_remove.is_blocked
  where k.id = p_keep;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (p_keep, 'profile.merged', 'profile', p_keep::text, jsonb_build_object('merged_from', p_remove));
end;
$$;

revoke all on function public.merge_profiles(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_profiles(uuid, uuid) to service_role;
grant execute on function public.sync_google_identity(uuid, text) to service_role;
