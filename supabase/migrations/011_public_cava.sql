-- Public cava opt-in: share wines (no prices) with the Red directory.
-- Chat / DM tables from 006+009 are left in place (UI removed separately).
-- Idempotent — safe to re-run in Supabase SQL Editor.

-- ── Profiles: cava_public ──────────────────────────────────────────────────

alter table public.profiles
  add column if not exists cava_public boolean not null default false;

create index if not exists profiles_cava_public_idx
  on public.profiles (cava_public)
  where cava_public = true;

-- Directory / browse: allow reading profiles that opted into network OR public cava
drop policy if exists "profiles_select_network_visible" on public.profiles;
create policy "profiles_select_network_visible"
  on public.profiles for select
  using (network_visible = true or cava_public = true);

-- ── Safe wine surface (NO price / kimi_price / slot / map / labels) ─────────
-- security_invoker=false → view owner bypasses wines RLS; definition still
-- filters to cava_public owners and only exposes non-sensitive columns.
-- Do NOT add a wines SELECT policy for other users — that would leak price.

drop view if exists public.public_wines;
create view public.public_wines
with (security_invoker = false)
as
select
  w.id,
  w.user_id,
  w.country,
  w.region,
  w.type,
  w.winery,
  w.name,
  w.aging,
  w.grape,
  w.vintage,
  w.vivino,
  w.cavatale_rating,
  w.created_at,
  w.updated_at
from public.wines w
inner join public.profiles p on p.id = w.user_id
where p.cava_public = true;

revoke all on public.public_wines from public;
revoke all on public.public_wines from anon;
grant select on public.public_wines to authenticated;

comment on view public.public_wines is
  'Read-only wines for users with cava_public=true. Never includes price or cellar layout.';

-- Bottle counts for directory cards (avoids N+1 from the client)
create or replace function public.public_cava_bottle_counts(owner_ids uuid[])
returns table (user_id uuid, bottle_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select w.user_id, count(*)::bigint as bottle_count
  from public.wines w
  inner join public.profiles p on p.id = w.user_id
  where p.cava_public = true
    and w.user_id = any (owner_ids)
  group by w.user_id;
$$;

revoke all on function public.public_cava_bottle_counts(uuid[]) from public;
grant execute on function public.public_cava_bottle_counts(uuid[]) to authenticated;
