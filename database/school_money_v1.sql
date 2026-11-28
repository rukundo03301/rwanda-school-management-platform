-- school_money_v1
--
-- School running costs, staff salaries and payroll approval, so the owner can see profit and loss.
-- Expenses: food, electricity and water, fuel and gas, vehicles, repairs, supplies, rent, phone and internet, other.
-- Salaries: each teacher or staff member has a monthly salary and a pay day set by the owner.
-- Payroll: a month's salaries are prepared, the owner approves them, then they are marked paid.
-- All tables are RLS-enabled with no anon or authenticated privileges: every read and write
-- goes through the school API, which checks the member's role and finance rights.

create table if not exists public.school_expenses (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 category text not null check (category in ('food','utilities','fuel','vehicles','maintenance','supplies','rent','communication','other')),
 title text not null check (length(btrim(title)) between 2 and 160),
 amount_rwf bigint not null check (amount_rwf between 1 and 1000000000000),
 spent_on date not null,
 paid_to text not null default '' check (length(paid_to)<=160),
 method text not null default 'cash' check (method in ('mtn_momo','airtel_money','bank_transfer','cash','other')),
 reference text not null default '' check (length(reference)<=120),
 notes text not null default '' check (length(notes)<=500),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 decided_by uuid references auth.users(id) on delete restrict,
 decided_at timestamptz,
 decision_note text not null default '' check (length(decision_note)<=300),
 created_at timestamptz not null default now()
);
create index if not exists school_expenses_school_idx on public.school_expenses(school_id,spent_on desc);
alter table public.school_expenses enable row level security;
revoke all on table public.school_expenses from public,anon,authenticated;
grant all on table public.school_expenses to service_role;

create table if not exists public.school_staff_pay (
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 auth_user_id uuid not null references auth.users(id) on delete restrict,
 job_title text not null default '' check (length(job_title)<=80),
 monthly_salary_rwf bigint not null check (monthly_salary_rwf between 0 and 10000000000),
 pay_day integer not null default 28 check (pay_day between 1 and 28),
 payment_method text not null default 'bank_transfer' check (payment_method in ('mtn_momo','airtel_money','bank_transfer','cash','other')),
 active boolean not null default true,
 updated_by uuid not null references auth.users(id) on delete restrict,
 updated_at timestamptz not null default now(),
 primary key (school_id,auth_user_id)
);
alter table public.school_staff_pay enable row level security;
revoke all on table public.school_staff_pay from public,anon,authenticated;
grant all on table public.school_staff_pay to service_role;

create table if not exists public.school_payroll_runs (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 status text not null default 'draft' check (status in ('draft','approved','paid','cancelled')),
 total_rwf bigint not null default 0 check (total_rwf>=0),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 approved_by uuid references auth.users(id) on delete restrict,
 approved_at timestamptz,
 paid_by uuid references auth.users(id) on delete restrict,
 paid_at timestamptz,
 unique (school_id,id)
);
create unique index if not exists school_payroll_runs_period_uidx on public.school_payroll_runs(school_id,period) where status<>'cancelled';
alter table public.school_payroll_runs enable row level security;
revoke all on table public.school_payroll_runs from public,anon,authenticated;
grant all on table public.school_payroll_runs to service_role;

create table if not exists public.school_payroll_lines (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null,
 run_id uuid not null,
 auth_user_id uuid not null references auth.users(id) on delete restrict,
 name text not null default '' check (length(name)<=160),
 job_title text not null default '' check (length(job_title)<=80),
 base_rwf bigint not null check (base_rwf>=0),
 bonus_rwf bigint not null default 0 check (bonus_rwf>=0),
 deductions_rwf bigint not null default 0 check (deductions_rwf>=0),
 net_rwf bigint not null check (net_rwf>=0),
 note text not null default '' check (length(note)<=300),
 unique (run_id,auth_user_id),
 foreign key (school_id,run_id) references public.school_payroll_runs(school_id,id) on delete cascade
);
alter table public.school_payroll_lines enable row level security;
revoke all on table public.school_payroll_lines from public,anon,authenticated;
grant all on table public.school_payroll_lines to service_role;

-- Register the new tenant tables with the purge manifest (read live, extended, never replaced from memory).
do $$
declare current_list text[]; merged text; want text[]:=array['school_expenses','school_staff_pay','school_payroll_runs','school_payroll_lines'];
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
