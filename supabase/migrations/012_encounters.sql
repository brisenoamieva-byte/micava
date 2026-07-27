-- Encuentros / Bitácora: wine stories tasted at the table without cellar inventory.
-- Idempotent — safe to re-run in Supabase SQL Editor.

create table if not exists public.encounters (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  wine_id text null,
  name text not null,
  winery text not null default '',
  country text not null default '',
  region text not null default '',
  type text not null default '',
  grape text not null default '',
  aging text not null default '',
  vintage integer null,
  cavatale_rating numeric null,
  kimi_summary text null,
  kimi_curiosity text null,
  kimi_talk_hook text null,
  kimi_pairings text null,
  kimi_checked_at timestamptz null,
  kimi_confidence text null,
  note text null,
  place text null,
  primary key (user_id, id)
);

create index if not exists encounters_user_at_idx
  on public.encounters (user_id, at desc);

alter table public.encounters enable row level security;

drop policy if exists "encounters_select_own" on public.encounters;
create policy "encounters_select_own"
  on public.encounters for select
  using (auth.uid() = user_id);

drop policy if exists "encounters_insert_own" on public.encounters;
create policy "encounters_insert_own"
  on public.encounters for insert
  with check (auth.uid() = user_id);

drop policy if exists "encounters_update_own" on public.encounters;
create policy "encounters_update_own"
  on public.encounters for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "encounters_delete_own" on public.encounters;
create policy "encounters_delete_own"
  on public.encounters for delete
  using (auth.uid() = user_id);

comment on table public.encounters is
  'Personal bitácora of wine encounters (story + memory) outside cellar inventory.';
