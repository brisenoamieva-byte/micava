-- AI food pairings from discovery research (run in Supabase SQL Editor)

alter table public.wines
  add column if not exists kimi_pairings text;
