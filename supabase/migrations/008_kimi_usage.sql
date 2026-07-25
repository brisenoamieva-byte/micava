-- Kimi / Moonshot token usage events (per-user metering)
-- Run in Supabase SQL Editor. Idempotent.

create table if not exists public.kimi_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  route text not null,
  model text not null default 'kimi-k2.6',
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  created_at timestamptz not null default now()
);

create index if not exists kimi_usage_events_user_id_created_at_idx
  on public.kimi_usage_events (user_id, created_at desc);

create index if not exists kimi_usage_events_created_at_idx
  on public.kimi_usage_events (created_at desc);

alter table public.kimi_usage_events enable row level security;

drop policy if exists "kimi_usage_select_own" on public.kimi_usage_events;
create policy "kimi_usage_select_own"
  on public.kimi_usage_events for select
  using (auth.uid() = user_id);

-- Server routes insert with the user's session (anon key + cookies).
-- Users can only attribute events to themselves.
drop policy if exists "kimi_usage_insert_own" on public.kimi_usage_events;
create policy "kimi_usage_insert_own"
  on public.kimi_usage_events for insert
  with check (auth.uid() = user_id);

-- No update/delete for clients — events are append-only.
