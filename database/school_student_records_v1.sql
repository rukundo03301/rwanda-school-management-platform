-- school_student_records_v1
--
-- 1. Student checklist: the school lists what every pupil must bring or buy (uniform, student card,
--    exam papers, reams of paper...) and the office ticks each item per pupil.
-- 2. Payroll checks: every salary line is checked by a person before the owner can approve the month.
-- All tables are RLS-enabled with no anon or authenticated privileges: every read and write
-- goes through the school API, which checks the member's role.

create table if not exists public.school_requirement_items (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 name text not null check (length(btrim(name)) between 2 and 120),
 category text not null default 'other' check (category in ('uniform','card','materials','exam','fees','other')),
 price_rwf bigint check (price_rwf is null or price_rwf between 0 and 100000000),
 level_band text not null default 'all' check (level_band in ('all','nursery','primary','secondary','tvet','university')),
 active boolean not null default true,
 position integer not null default 0,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique (school_id,id)
);
alter table public.school_requirement_items drop constraint if exists school_requirement_items_level_band_check;
alter table public.school_requirement_items add constraint school_requirement_items_level_band_check check (level_band in ('all','nursery','primary','secondary','tvet','university'));
create index if not exists school_requirement_items_school_idx on public.school_requirement_items(school_id,active,position);
alter table public.school_requirement_items enable row level security;
revoke all on table public.school_requirement_items from public,anon,authenticated;
grant all on table public.school_requirement_items to service_role;

create table if not exists public.school_student_requirements (
 school_id uuid not null,
 student_id uuid not null references public.school_students(id) on delete cascade,
 item_id uuid not null,
 status text not null check (status in ('done','missing','waived')),
 note text not null default '' check (length(note)<=300),
 updated_by uuid not null references auth.users(id) on delete restrict,
 updated_at timestamptz not null default now(),
 primary key (student_id,item_id),
 foreign key (school_id,item_id) references public.school_requirement_items(school_id,id) on delete cascade
);
create index if not exists school_student_requirements_school_idx on public.school_student_requirements(school_id,item_id);
alter table public.school_student_requirements enable row level security;
revoke all on table public.school_student_requirements from public,anon,authenticated;
grant all on table public.school_student_requirements to service_role;

alter table public.school_payroll_lines add column if not exists checked_by uuid references auth.users(id) on delete restrict;
alter table public.school_payroll_lines add column if not exists checked_at timestamptz;

-- Register the new tenant tables with the purge manifest (read live, extended, never replaced from memory).
do $$
declare current_list text[]; merged text; want text[]:=array['school_requirement_items','school_student_requirements'];
begin
 current_list:=public.platform_tenant_scope_manifest();
 if not (want<@current_list) then
  select 'select array['||string_agg(quote_literal(t),',' order by t)||']::text[]' into merged
  from (select distinct t from unnest(current_list||want) as t) u;
  execute 'create or replace function public.platform_tenant_scope_manifest() '||
   'returns text[] language sql immutable security invoker set search_path=pg_catalog,public as '||quote_literal(merged);
 end if;
end $$;
revoke all on function public.platform_tenant_scope_manifest() from public,anon,authenticated;
grant execute on function public.platform_tenant_scope_manifest() to service_role;
