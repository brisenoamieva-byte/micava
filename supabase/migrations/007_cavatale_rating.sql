-- Cavatale proprietary rating (Kimi research), distinct from Vivino
alter table public.wines
  add column if not exists cavatale_rating double precision;
