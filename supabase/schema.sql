-- Mi Cava: per-user cellars (run in Supabase SQL Editor)

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  bottle_pledge boolean not null default false,
  network_visible boolean not null default false,
  country text,
  city text,
  bio text,
  network_updated_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_select_network_visible"
  on public.profiles for select
  using (network_visible = true);

-- See supabase/migrations/006_user_network.sql for conversations, messages, RLS, and Realtime.
-- See supabase/migrations/009_message_reads.sql for last_read_at / unread DM badges.

-- Furniture units (muebles) — before wines.cellar_id and signup trigger
create table if not exists public.cellars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Principal',
  cols integer not null default 12 check (cols >= 1 and cols <= 24),
  rows text[] not null default array['A','B','C','D','E','F'],
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists cellars_user_id_idx on public.cellars (user_id, sort_order);

alter table public.cellars enable row level security;

drop policy if exists "cellars_select_own" on public.cellars;
create policy "cellars_select_own"
  on public.cellars for select
  using (auth.uid() = user_id);

drop policy if exists "cellars_insert_own" on public.cellars;
create policy "cellars_insert_own"
  on public.cellars for insert
  with check (auth.uid() = user_id);

drop policy if exists "cellars_update_own" on public.cellars;
create policy "cellars_update_own"
  on public.cellars for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "cellars_delete_own" on public.cellars;
create policy "cellars_delete_own"
  on public.cellars for delete
  using (auth.uid() = user_id);

-- Auto-create profile + default Principal on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, bottle_pledge)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    coalesce((new.raw_user_meta_data->>'bottle_pledge')::boolean, false)
  );

  insert into public.cellars (user_id, name, cols, rows, sort_order)
  values (
    new.id,
    'Principal',
    12,
    array['A','B','C','D','E','F'],
    0
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Wines
create table if not exists public.wines (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  slot text,
  col integer,
  row text,
  country text not null default '',
  region text not null default '',
  type text not null default 'Tinto',
  winery text not null default '',
  name text not null default '',
  aging text not null default '',
  grape text not null default '',
  vintage integer,
  vivino double precision,
  cavatale_rating double precision,
  price double precision,
  external_rating double precision,
  rating_source text,
  last_checked_at timestamptz,
  match_confidence text,
  kimi_vivino double precision,
  kimi_price double precision,
  kimi_summary text,
  kimi_checked_at timestamptz,
  kimi_confidence text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists wines_user_id_idx on public.wines (user_id);

alter table public.wines enable row level security;

drop policy if exists "wines_select_own" on public.wines;
create policy "wines_select_own"
  on public.wines for select
  using (auth.uid() = user_id);

drop policy if exists "wines_insert_own" on public.wines;
create policy "wines_insert_own"
  on public.wines for insert
  with check (auth.uid() = user_id);

drop policy if exists "wines_update_own" on public.wines;
create policy "wines_update_own"
  on public.wines for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "wines_delete_own" on public.wines;
create policy "wines_delete_own"
  on public.wines for delete
  using (auth.uid() = user_id);

alter table public.wines
  add column if not exists cellar_id uuid references public.cellars (id) on delete set null;

alter table public.wines
  add column if not exists kimi_vivino double precision,
  add column if not exists kimi_price double precision,
  add column if not exists kimi_summary text,
  add column if not exists kimi_checked_at timestamptz,
  add column if not exists kimi_confidence text,
  add column if not exists label_image_url text,
  add column if not exists kimi_curiosity text,
  add column if not exists kimi_talk_hook text,
  add column if not exists cavatale_rating double precision;

create index if not exists wines_cellar_id_idx on public.wines (cellar_id);

-- Private bucket for scanned labels (path: {user_id}/{wine_id}.jpg)
insert into storage.buckets (id, name, public)
values ('wine-labels', 'wine-labels', false)
on conflict (id) do nothing;

drop policy if exists "wine_labels_select_own" on storage.objects;
create policy "wine_labels_select_own"
  on storage.objects for select
  using (
    bucket_id = 'wine-labels'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "wine_labels_insert_own" on storage.objects;
create policy "wine_labels_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'wine-labels'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "wine_labels_update_own" on storage.objects;
create policy "wine_labels_update_own"
  on storage.objects for update
  using (
    bucket_id = 'wine-labels'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'wine-labels'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "wine_labels_delete_own" on storage.objects;
create policy "wine_labels_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'wine-labels'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- History
create table if not exists public.cellar_history (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  action text not null check (action in ('opened', 'gifted', 'removed')),
  wine jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists cellar_history_user_at_idx
  on public.cellar_history (user_id, at desc);

alter table public.cellar_history enable row level security;

drop policy if exists "history_select_own" on public.cellar_history;
create policy "history_select_own"
  on public.cellar_history for select
  using (auth.uid() = user_id);

drop policy if exists "history_insert_own" on public.cellar_history;
create policy "history_insert_own"
  on public.cellar_history for insert
  with check (auth.uid() = user_id);

drop policy if exists "history_delete_own" on public.cellar_history;
create policy "history_delete_own"
  on public.cellar_history for delete
  using (auth.uid() = user_id);

-- Backfill for accounts created before multi-mueble
insert into public.cellars (user_id, name, cols, rows, sort_order)
select u.id, 'Principal', 12, array['A','B','C','D','E','F'], 0
from auth.users u
where not exists (
  select 1 from public.cellars c where c.user_id = u.id
);

update public.wines w
set cellar_id = c.id
from public.cellars c
where c.user_id = w.user_id
  and c.sort_order = 0
  and w.cellar_id is null
  and w.slot is not null
  and w.slot <> 'abajo';
