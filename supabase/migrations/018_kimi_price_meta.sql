-- Persist reference-price provenance (source / confidence / notes / checked_at).
alter table public.wines
  add column if not exists kimi_price_source text,
  add column if not exists kimi_price_confidence text,
  add column if not exists kimi_price_notes text,
  add column if not exists kimi_price_checked_at timestamptz;
