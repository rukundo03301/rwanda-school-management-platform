-- Saved platform reports: a snapshot of the report numbers at the time it was saved, so the
-- owner can download it again later as Excel or Word, or delete it. Platform-level, no school rows.
create table if not exists public.platform_reports (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 3 and 120),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  payload jsonb not null check (pg_column_size(payload) <= 200000)
);
create index if not exists platform_reports_created_idx on public.platform_reports(created_at desc);
alter table public.platform_reports enable row level security;
revoke all on public.platform_reports from public, anon, authenticated;
grant select, insert, delete on public.platform_reports to service_role;
