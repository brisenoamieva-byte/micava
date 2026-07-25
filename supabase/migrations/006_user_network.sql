-- User network (opt-in directory) + 1:1 DMs
-- Run in Supabase SQL Editor after base schema.
-- Then: Database → Publications → supabase_realtime → enable `messages`
-- (and optionally `conversations`).

-- ── Profiles: network fields ───────────────────────────────────────────────

alter table public.profiles
  add column if not exists network_visible boolean not null default false;

alter table public.profiles
  add column if not exists country text;

alter table public.profiles
  add column if not exists city text;

alter table public.profiles
  add column if not exists bio text;

alter table public.profiles
  add column if not exists network_updated_at timestamptz;

create index if not exists profiles_network_visible_idx
  on public.profiles (network_visible)
  where network_visible = true;

create index if not exists profiles_network_place_idx
  on public.profiles (country, city)
  where network_visible = true;

-- Others can read only opt-in profiles (own still via profiles_select_own)
drop policy if exists "profiles_select_network_visible" on public.profiles;
create policy "profiles_select_network_visible"
  on public.profiles for select
  using (network_visible = true);

-- ── Conversations ──────────────────────────────────────────────────────────

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

alter table public.conversations enable row level security;

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_members_user_id_idx
  on public.conversation_members (user_id);

alter table public.conversation_members enable row level security;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_created_at_idx
  on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;

-- Helper: is current user a member?
create or replace function public.is_conversation_member(conv_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members m
    where m.conversation_id = conv_id
      and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to authenticated;

-- Conversations: members only
drop policy if exists "conversations_select_member" on public.conversations;
create policy "conversations_select_member"
  on public.conversations for select
  using (public.is_conversation_member(id));

drop policy if exists "conversations_update_member" on public.conversations;
create policy "conversations_update_member"
  on public.conversations for update
  using (public.is_conversation_member(id))
  with check (public.is_conversation_member(id));

-- Members table
drop policy if exists "conversation_members_select_own" on public.conversation_members;
create policy "conversation_members_select_own"
  on public.conversation_members for select
  using (
    user_id = auth.uid()
    or public.is_conversation_member(conversation_id)
  );

-- Messages
drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member"
  on public.messages for select
  using (public.is_conversation_member(conversation_id));

drop policy if exists "messages_insert_member" on public.messages;
create policy "messages_insert_member"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and public.is_conversation_member(conversation_id)
  );

-- Get or create a 1:1 DM between auth.uid() and other_user_id
create or replace function public.get_or_create_dm(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  existing_id uuid;
  new_id uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if other_user_id is null or other_user_id = me then
    raise exception 'Invalid other user';
  end if;

  -- Only allow DMs with users who opted into the network (or yourself is blocked above)
  if not exists (
    select 1 from public.profiles p
    where p.id = other_user_id and p.network_visible = true
  ) then
    raise exception 'User is not on the network';
  end if;

  select c.id into existing_id
  from public.conversations c
  where exists (
      select 1 from public.conversation_members m1
      where m1.conversation_id = c.id and m1.user_id = me
    )
    and exists (
      select 1 from public.conversation_members m2
      where m2.conversation_id = c.id and m2.user_id = other_user_id
    )
    and (
      select count(*) from public.conversation_members m
      where m.conversation_id = c.id
    ) = 2
  limit 1;

  if existing_id is not null then
    return existing_id;
  end if;

  insert into public.conversations default values
  returning id into new_id;

  insert into public.conversation_members (conversation_id, user_id)
  values (new_id, me), (new_id, other_user_id);

  return new_id;
end;
$$;

revoke all on function public.get_or_create_dm(uuid) from public;
grant execute on function public.get_or_create_dm(uuid) to authenticated;

-- Keep last_message_at fresh
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists on_message_inserted on public.messages;
create trigger on_message_inserted
  after insert on public.messages
  for each row execute function public.touch_conversation_on_message();

-- Realtime (ignore errors if already added)
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
