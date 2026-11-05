-- Брошенные черновики (решение заказчика 5 ноября 2026): карточка в статусе «черновик» (ни разу не отправлена),
-- которую владелец не трогал 30 дней, удаляется. За 3 дня до удаления — напоминание в Telegram; удаление не раньше,
-- чем через 3 дня после напоминания (если ежедневная задача пропустила день, срок сдвигается, а не сокращается).
-- Черновики без владельца (созданные администратором) и опубликованные карточки не трогаем.
--
-- last_edit_at — время последней правки содержимого (версии карточки). Отдельно от updated_at: тот меняется при любом
-- обновлении строки, в том числе при отметке о напоминании, и срок бы никогда не наступал.

alter table public.listings add column if not exists last_edit_at timestamptz;
alter table public.listings add column if not exists draft_reminded_at timestamptz;
update public.listings set last_edit_at = updated_at where last_edit_at is null;

create or replace function public.touch_listing_last_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.listings set last_edit_at = now() where id = new.listing_id;
  return new;
end;
$$;

drop trigger if exists listing_versions_touch_edit on public.listing_versions;
create trigger listing_versions_touch_edit
  after insert or update of data on public.listing_versions
  for each row execute function public.touch_listing_last_edit();

-- Срок удаления черновика (для кабинета и напоминания).
create or replace function public.draft_expires_at(l public.listings)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select greatest(
    coalesce(l.last_edit_at, l.created_at) + interval '30 days',
    case when l.draft_reminded_at >= coalesce(l.last_edit_at, l.created_at) then l.draft_reminded_at + interval '3 days' end
  );
$$;

-- Напоминания: черновики без правок 27+ дней, о которых в этот период ещё не напоминали. Отметка ставится сразу,
-- поэтому повторный запуск задачи второе напоминание не пришлёт.
create or replace function public.claim_draft_reminders(p_limit int default 200)
returns table (id uuid, owner_id uuid, title text, expires_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select l.id
    from public.listings l
    where l.status = 'draft' and not l.is_demo and l.owner_id is not null
      and coalesce(l.last_edit_at, l.created_at) < now() - interval '27 days'
      and (l.draft_reminded_at is null or l.draft_reminded_at < coalesce(l.last_edit_at, l.created_at))
    limit p_limit
  )
  update public.listings l set draft_reminded_at = now()
  from due where l.id = due.id
  returning l.id, l.owner_id, l.title, public.draft_expires_at(l);
$$;

-- Удаление: 30 дней без правок и прошло 3 дня с напоминания об этом периоде. Возвращает удалённые — для сообщения.
create or replace function public.expire_drafts(p_limit int default 200)
returns table (id uuid, owner_id uuid, title text)
language sql
security definer
set search_path = ''
as $$
  with gone as (
    select l.id
    from public.listings l
    where l.status = 'draft' and not l.is_demo and l.owner_id is not null
      and coalesce(l.last_edit_at, l.created_at) < now() - interval '30 days'
      and l.draft_reminded_at >= coalesce(l.last_edit_at, l.created_at)
      and l.draft_reminded_at < now() - interval '3 days'
    limit p_limit
  )
  delete from public.listings l using gone where l.id = gone.id
  returning l.id, l.owner_id, l.title;
$$;

revoke all on function public.claim_draft_reminders(int) from public, anon, authenticated;
revoke all on function public.expire_drafts(int) from public, anon, authenticated;
revoke all on function public.touch_listing_last_edit() from public, anon, authenticated;
