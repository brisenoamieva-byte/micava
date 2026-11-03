-- What the owner paid for the bottle (vs ficha/market reference price).
alter table public.wines
  add column if not exists purchase_price numeric;
