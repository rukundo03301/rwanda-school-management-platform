-- Platform Owner dashboard data: where a school is, what level it teaches, which plan it is on,
-- the platform plans themselves, and platform announcements to schools. Additive and idempotent.
-- These are platform-level records, not tenant records, so they are not in the purge manifest.

alter table public.platform_schools
  add column if not exists province text,
  add column if not exists district text,
  add column if not exists education_level text,
  add column if not exists plan_code text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='platform_schools_province_chk') then
    alter table public.platform_schools add constraint platform_schools_province_chk
      check (province is null or province in ('kigali','northern','southern','eastern','western'));
  end if;
  if not exists (select 1 from pg_constraint where conname='platform_schools_level_chk') then
    alter table public.platform_schools add constraint platform_schools_level_chk
      check (education_level is null or education_level in ('nursery','primary','secondary','college'));
  end if;
  if not exists (select 1 from pg_constraint where conname='platform_schools_district_chk') then
    alter table public.platform_schools add constraint platform_schools_district_chk
      check (district is null or length(btrim(district)) between 2 and 60);
  end if;
end $$;

create table if not exists public.platform_plans (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name text not null check (length(btrim(name)) between 2 and 60),
  monthly_fee_rwf bigint check (monthly_fee_rwf is null or monthly_fee_rwf between 0 and 1000000000),
  description text not null default '' check (length(description) <= 400),
  sort_order int not null default 100,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.platform_plans(code,name,sort_order) values
  ('basic','Basic Plan',10),('standard','Standard Plan',20),('premium','Premium Plan',30)
on conflict (code) do nothing;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='platform_schools_plan_fk') then
    alter table public.platform_schools add constraint platform_schools_plan_fk
      foreign key (plan_code) references public.platform_plans(code) on update cascade on delete restrict;
  end if;
end $$;

create table if not exists public.platform_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 3 and 120),
  body text not null check (length(btrim(body)) between 3 and 2000),
  audience text not null default 'school_owners' check (audience in ('school_owners','all_members')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_on date,
  active boolean not null default true
);
create index if not exists platform_announcements_active_idx
  on public.platform_announcements(active, created_at desc);

alter table public.platform_plans enable row level security;
alter table public.platform_announcements enable row level security;
revoke all on public.platform_plans from public, anon, authenticated;
revoke all on public.platform_announcements from public, anon, authenticated;
grant select, insert, update on public.platform_plans to service_role;
grant select, insert, update on public.platform_announcements to service_role;
