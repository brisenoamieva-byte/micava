-- Multi-mueble / multi-cellar (run in SQL Editor after base schema)

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

-- Link wines to a furniture unit
alter table public.wines
  add column if not exists cellar_id uuid references public.cellars (id) on delete set null;

create index if not exists wines_cellar_id_idx on public.wines (cellar_id);

-- Default cellar for every new user
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

-- Backfill: one Principal per existing user, assign slotted wines
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
