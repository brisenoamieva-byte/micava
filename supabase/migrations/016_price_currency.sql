-- Price currency for ficha + Kimi/reference estimate (ISO 4217).
-- Apply in Supabase SQL Editor if not auto-migrated. Idempotent.
-- App degrades to MXN when columns are missing or null.

alter table public.wines
  add column if not exists price_currency text default 'MXN';

alter table public.wines
  add column if not exists kimi_price_currency text;

comment on column public.wines.price_currency is
  'ISO 4217 currency for wines.price; default MXN when null.';
comment on column public.wines.kimi_price_currency is
  'ISO 4217 currency for wines.kimi_price reference estimate.';
