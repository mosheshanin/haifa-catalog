-- Функции-триггеры не должны вызываться через API.
-- is_admin() и is_active_user() остаются доступными: они нужны правилам доступа
-- и сообщают только о самом вызывающем пользователе.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.check_slug_namespace() from public, anon, authenticated;
revoke execute on function public.remember_old_slug() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
