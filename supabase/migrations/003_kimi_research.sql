-- Kimi research fields on wines (run in Supabase SQL Editor)

alter table public.wines
  add column if not exists kimi_vivino double precision,
  add column if not exists kimi_price double precision,
  add column if not exists kimi_summary text,
  add column if not exists kimi_checked_at timestamptz,
  add column if not exists kimi_confidence text;
