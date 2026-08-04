-- Fix Security Advisor: public.public_wines was SECURITY DEFINER (bypasses RLS).
-- Keep the same product behavior (safe columns only, cava_public owners, no prices)
-- by elevating privileges in a SECURITY DEFINER function, then exposing a
-- SECURITY INVOKER view that selects from it.
-- Idempotent — safe to re-run in Supabase SQL Editor.

create or replace function public.public_wines_rows()
returns table (
  id text,
  user_id uuid,
  country text,
  region text,
  type text,
  winery text,
  name text,
  aging text,
  grape text,
  vintage integer,
  vivino double precision,
  cavatale_rating double precision,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
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
$$;

comment on function public.public_wines_rows() is
  'SECURITY DEFINER source for public_wines: cava_public owners only, never price/layout.';

revoke all on function public.public_wines_rows() from public;
grant execute on function public.public_wines_rows() to anon, authenticated;

drop view if exists public.public_wines;
create view public.public_wines
with (security_invoker = on)
as
select
  id,
  user_id,
  country,
  region,
  type,
  winery,
  name,
  aging,
  grape,
  vintage,
  vivino,
  cavatale_rating,
  created_at,
  updated_at
from public.public_wines_rows();

revoke all on public.public_wines from public;
grant select on public.public_wines to anon, authenticated;

comment on view public.public_wines is
  'SECURITY INVOKER view over public_wines_rows(). Safe public cava surface; no prices.';
