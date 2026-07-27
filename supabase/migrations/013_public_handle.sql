-- Public handle for Red discovery: @handle → /u/[handle]
-- Idempotent — safe to re-run in Supabase SQL Editor.
-- Does NOT expose email. Only cava_public profiles are discoverable via handle.

-- ── Column ─────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists public_handle text;

-- Format: 3–24 chars, lowercase letters/digits, underscore/hyphen in the middle
do $$
begin
  alter table public.profiles
    drop constraint if exists profiles_public_handle_format;
  alter table public.profiles
    add constraint profiles_public_handle_format
    check (
      public_handle is null
      or (
        char_length(public_handle) between 3 and 24
        and public_handle = lower(public_handle)
        and public_handle ~ '^[a-z0-9][a-z0-9_-]{1,22}[a-z0-9]$'
      )
    );
exception
  when others then
    raise notice 'profiles_public_handle_format: %', sqlerrm;
end $$;

-- Case-insensitive uniqueness (nulls allowed)
drop index if exists profiles_public_handle_lower_uidx;
create unique index profiles_public_handle_lower_uidx
  on public.profiles (lower(public_handle))
  where public_handle is not null;

create index if not exists profiles_public_handle_cava_idx
  on public.profiles (public_handle)
  where cava_public = true and public_handle is not null;

comment on column public.profiles.public_handle is
  'User-chosen public @handle for /u/[handle]. Unique, lowercase. Only useful when cava_public.';

-- ── Availability check (no profile leakage) ────────────────────────────────

create or replace function public.is_public_handle_available(desired text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized text;
begin
  if desired is null then
    return false;
  end if;
  normalized := lower(trim(both from desired));
  if left(normalized, 1) = '@' then
    normalized := substring(normalized from 2);
  end if;
  if normalized = '' then
    return false;
  end if;
  return not exists (
    select 1
    from public.profiles p
    where p.public_handle is not null
      and lower(p.public_handle) = normalized
      and p.id is distinct from auth.uid()
  );
end;
$$;

revoke all on function public.is_public_handle_available(text) from public;
grant execute on function public.is_public_handle_available(text) to authenticated;

-- ── Shareable public cava: allow anon read of safe wine surface ─────────────
-- View already filters to cava_public owners and excludes price/layout.
-- Profiles with cava_public are already selectable via existing RLS policy.

grant select on public.public_wines to anon;
grant execute on function public.public_cava_bottle_counts(uuid[]) to anon;
