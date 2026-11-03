-- Expose safe story / pairing fields on public cellars (still no prices or layout).
-- Idempotent — safe to re-run in Supabase SQL Editor.
-- Must drop view + function first: OUT row type cannot change via CREATE OR REPLACE.

drop view if exists public.public_wines;

drop function if exists public.public_wines_rows();

create function public.public_wines_rows()
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
  kimi_summary text,
  kimi_curiosity text,
  kimi_talk_hook text,
  kimi_pairings text,
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
    w.kimi_summary,
    w.kimi_curiosity,
    w.kimi_talk_hook,
    w.kimi_pairings,
    w.created_at,
    w.updated_at
  from public.wines w
  inner join public.profiles p on p.id = w.user_id
  where p.cava_public = true;
$$;

comment on function public.public_wines_rows() is
  'SECURITY DEFINER source for public_wines: cava_public owners only; stories OK, never price/layout.';

revoke all on function public.public_wines_rows() from public;
grant execute on function public.public_wines_rows() to anon, authenticated;

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
  kimi_summary,
  kimi_curiosity,
  kimi_talk_hook,
  kimi_pairings,
  created_at,
  updated_at
from public.public_wines_rows();

revoke all on public.public_wines from public;
grant select on public.public_wines to anon, authenticated;

comment on view public.public_wines is
  'SECURITY INVOKER view over public_wines_rows(). Public cava: wines, ratings, stories — no prices.';
