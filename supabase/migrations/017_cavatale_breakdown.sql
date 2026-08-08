-- Persist Cavatale score breakdown (axes + evidence enums) for UI auditability.
alter table public.wines
  add column if not exists cavatale_parts jsonb,
  add column if not exists cavatale_evidence jsonb;

alter table public.encounters
  add column if not exists cavatale_parts jsonb,
  add column if not exists cavatale_evidence jsonb;
