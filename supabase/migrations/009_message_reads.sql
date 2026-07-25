-- Unread DM tracking: last_read_at per conversation member
-- Run in Supabase SQL Editor after 006_user_network.sql. Idempotent.

alter table public.conversation_members
  add column if not exists last_read_at timestamptz;

create index if not exists conversation_members_last_read_at_idx
  on public.conversation_members (user_id, last_read_at);

-- Mark current user's conversation as read (now)
create or replace function public.mark_conversation_read(conv_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_conversation_member(conv_id) then
    raise exception 'Not a conversation member';
  end if;

  update public.conversation_members
  set last_read_at = now()
  where conversation_id = conv_id
    and user_id = me;
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Unread counts for the current user (messages from others after last_read_at)
create or replace function public.my_unread_counts()
returns table (conversation_id uuid, unread_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.conversation_id,
    count(msg.id)::bigint as unread_count
  from public.conversation_members m
  left join public.messages msg
    on msg.conversation_id = m.conversation_id
   and msg.sender_id is distinct from auth.uid()
   and (m.last_read_at is null or msg.created_at > m.last_read_at)
  where m.user_id = auth.uid()
  group by m.conversation_id
  having count(msg.id) > 0;
$$;

revoke all on function public.my_unread_counts() from public;
grant execute on function public.my_unread_counts() to authenticated;
