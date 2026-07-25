-- Owner dispute/feedback note for story revision (not ground truth).
-- Run in Supabase SQL Editor; idempotent.

alter table public.wines
  add column if not exists kimi_user_note text;
