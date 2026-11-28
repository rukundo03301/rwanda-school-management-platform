-- Leave and purchase requests raised by staff and decided by the school owner or principal.
-- Tenant scoped by school_id and reached only through the server API (service role).
create table if not exists public.school_staff_requests(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete cascade,
 requester_id uuid not null,
 kind text not null check(kind in ('leave','purchase')),
 title text not null check(char_length(title) between 4 and 140),
 details text not null default '' check(char_length(details)<=1000),
 start_on date,
 end_on date,
 amount_rwf numeric(14,0) check(amount_rwf is null or amount_rwf>=0),
 status text not null default 'pending' check(status in ('pending','approved','declined','cancelled')),
 decided_by uuid,
 decided_at timestamptz,
 decision_note text check(decision_note is null or char_length(decision_note)<=500),
 created_at timestamptz not null default now(),
 check(kind<>'leave' or (start_on is not null and end_on is not null and end_on>=start_on)),
 check(kind<>'purchase' or amount_rwf is not null)
);
create index if not exists school_staff_requests_school_idx
 on public.school_staff_requests(school_id,status,created_at desc);
create index if not exists school_staff_requests_requester_idx
 on public.school_staff_requests(school_id,requester_id,created_at desc);

alter table public.school_staff_requests enable row level security;
revoke all on table public.school_staff_requests from public,anon,authenticated;
grant all on table public.school_staff_requests to service_role;

do $$
declare current_list text[];
        merged text;
begin
 current_list:=public.platform_tenant_scope_manifest();
 if not ('school_staff_requests'=any(current_list)) then
  select 'select array['||string_agg(quote_literal(t),',' order by t)||']::text[]'
  into merged
  from unnest(current_list||array['school_staff_requests']) as t;
  execute 'create or replace function public.platform_tenant_scope_manifest() '||
   'returns text[] language sql immutable security invoker '||
   'set search_path=pg_catalog,public as '||quote_literal(merged);
 end if;
end $$;
revoke all on function public.platform_tenant_scope_manifest() from public,anon,authenticated;
grant execute on function public.platform_tenant_scope_manifest() to service_role;
