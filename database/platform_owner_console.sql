-- Rwanda Education Platform: PLATFORM OPERATOR console v1
-- GitHub-controlled SQL SOURCE. Convert to official Supabase CLI migration using
--   supabase migration new platform_owner_console
-- and place this contents in the CLI-generated file before approved deployment.
-- Do not execute via Supabase SQL editor. The repo is the source of truth.
-- Namespace 'platform_' keeps operator billing/tenants distinct from school data.
-- Public schema is NOT public access: RLS enabled and all anonymous/user privileges revoked.

create extension if not exists pgcrypto;
create sequence if not exists public.platform_company_number;
create sequence if not exists public.platform_school_number;

create table if not exists public.platform_companies (
  id uuid primary key default gen_random_uuid(),
  company_code text not null unique default (
    'RW-CMP-' || lpad(nextval('public.platform_company_number')::text, 6, '0')
  ),
  name text not null check (length(btrim(name)) between 2 and 120),
  created_at timestamptz not null default now()
);

create table if not exists public.platform_schools (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.platform_companies(id) on delete restrict,
  school_code text not null unique default (
    'RW-SCH-' || lpad(nextval('public.platform_school_number')::text, 6, '0')
  ),
  name text not null check (length(btrim(name)) between 2 and 120),
  owner_email text not null,
  status text not null default 'onboarding'
    check (status in ('onboarding','active','paused','suspended','archived','deletion_requested')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists platform_schools_company_idx on public.platform_schools(company_id);
create index if not exists platform_schools_status_idx on public.platform_schools(status);

create table if not exists public.platform_staff (
  auth_user_id uuid primary key references auth.users(id) on delete restrict,
  email text not null,
  role text not null check (role in ('operations','support','finance','observer')),
  permissions text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_staff_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  email text not null,
  reason text not null check (length(reason) between 10 and 500),
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  created_at timestamptz not null default now()
);

create table if not exists public.platform_tickets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.platform_schools(id) on delete restrict,
  title text not null check (length(title) between 1 and 160),
  description text not null,
  priority text not null default 'normal' check (priority in ('low','normal','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','resolved')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists platform_tickets_school_idx on public.platform_tickets(school_id);
create index if not exists platform_tickets_status_idx on public.platform_tickets(status);

create table if not exists public.platform_payment_methods (
  id uuid primary key default gen_random_uuid(),
  label text not null check (length(label) between 1 and 80),
  type text not null check (type in ('mobile_money','bank','card','other')),
  enabled boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  check (not is_default or enabled)
);
create unique index if not exists platform_payment_one_default_idx
  on public.platform_payment_methods (is_default) where is_default;

create table if not exists public.platform_invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.platform_schools(id) on delete restrict,
  amount_rwf bigint not null check (amount_rwf >= 0),
  status text not null default 'draft' check (status in ('draft','open','paid','void')),
  due_date date,
  created_at timestamptz not null default now()
);
create index if not exists platform_invoices_school_idx on public.platform_invoices(school_id);

create table if not exists public.platform_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.platform_invoices(id) on delete restrict,
  amount_rwf bigint not null check (amount_rwf > 0),
  status text not null default 'pending' check (status in ('pending','settled','failed','refunded')),
  provider text not null,
  external_reference text unique,
  created_at timestamptz not null default now()
);
create index if not exists platform_payments_invoice_idx on public.platform_payments(invoice_id);

create table if not exists public.platform_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  event text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists platform_audit_created_idx on public.platform_audit(created_at desc);

-- For this phase, the app accesses protected platform_* tables through the
-- authenticated server API only. No direct SELECT/INSERT/UPDATE/DELETE from
-- browser or anonymous clients. Service key NEVER leaves server runtime.
do $$
declare tbl text;
begin
 foreach tbl in array array[
   'platform_companies','platform_schools','platform_staff',
   'platform_staff_requests','platform_tickets','platform_payment_methods',
   'platform_invoices','platform_payments','platform_audit'
 ] loop
   execute format('alter table public.%I enable row level security', tbl);
   execute format('revoke all on table public.%I from public, anon, authenticated',tbl);
   execute format('grant all on table public.%I to service_role',tbl);
 end loop;
end $$;
revoke all on sequence public.platform_company_number from public, anon, authenticated;
revoke all on sequence public.platform_school_number from public, anon, authenticated;
grant usage, select on sequence public.platform_company_number to service_role;
grant usage, select on sequence public.platform_school_number to service_role;

-- Transactional school registration; generates BOTH IDs without user input.
create or replace function public.platform_register_school(
  p_company_name text, p_school_name text, p_owner_email text, p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public
as $$
declare
  c public.platform_companies%rowtype;
  s public.platform_schools%rowtype;
begin
  if length(btrim(p_company_name)) not between 2 and 120
     or length(btrim(p_school_name)) not between 2 and 120
     or p_owner_email is null or position('@' in p_owner_email) < 2 then
    raise exception 'Invalid school registration fields';
  end if;
  insert into public.platform_companies(name) values (btrim(p_company_name)) returning * into c;
  insert into public.platform_schools(company_id,name,owner_email)
    values(c.id,btrim(p_school_name),lower(btrim(p_owner_email))) returning * into s;
  insert into public.platform_audit(actor_id,event,resource_id,metadata)
    values(p_actor,'tenant.created',s.id,jsonb_build_object(
      'company_id',c.id,'company_code',c.company_code,'school_code',s.school_code));
  return jsonb_build_object('company_id',c.id,'company_code',c.company_code,
    'school_id',s.id,'school_code',s.school_code,'status',s.status);
end;
$$;

-- Lifecycle changes are always checked again inside the DB transaction.
create or replace function public.platform_change_school_state(
  p_school_id uuid,p_target text,p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public
as $$
declare
  old_status text;
begin
  if length(btrim(coalesce(p_reason,''))) < 8 then raise exception 'Reason is required'; end if;
  select status into old_status from public.platform_schools where id=p_school_id for update;
  if old_status is null then raise exception 'School not found'; end if;
  if not (
     (old_status='onboarding' and p_target in ('active','paused','suspended','deletion_requested'))
  or (old_status='active' and p_target in ('paused','suspended','archived','deletion_requested'))
  or (old_status='paused' and p_target in ('active','suspended','archived','deletion_requested'))
  or (old_status='suspended' and p_target in ('paused','archived','deletion_requested'))
  or (old_status='archived' and p_target in ('active','deletion_requested'))
  or (old_status='deletion_requested' and p_target in ('paused','archived'))
  ) then raise exception 'Invalid tenant lifecycle transition'; end if;
  update public.platform_schools set status=p_target,updated_at=now() where id=p_school_id;
  insert into public.platform_audit(actor_id,event,resource_id,metadata)
    values(p_actor,'tenant.state_changed',p_school_id,jsonb_build_object(
      'from',old_status,'to',p_target,'reason',p_reason));
  return jsonb_build_object('school_id',p_school_id,'from',old_status,'to',p_target);
end;
$$;

-- Owner-approved staff access uses the immutable auth user UUID, never just an email.
create or replace function public.platform_approve_staff_request(
  p_request_id uuid,p_role text,p_permissions text[],p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public
as $$
declare r public.platform_staff_requests%rowtype;
begin
  if p_role not in ('operations','support','finance','observer') then raise exception 'Invalid role'; end if;
  select * into r from public.platform_staff_requests where id=p_request_id for update;
  if not found or r.status <> 'pending' then raise exception 'No pending request'; end if;
  insert into public.platform_staff(auth_user_id,email,role,permissions,active)
    values(r.auth_user_id,r.email,p_role,p_permissions,true)
    on conflict(auth_user_id) do update set email=excluded.email,role=excluded.role,
      permissions=excluded.permissions,active=true;
  update public.platform_staff_requests set status='approved' where id=p_request_id;
  insert into public.platform_audit(actor_id,event,resource_id,metadata)
    values(p_actor,'staff.approved',r.auth_user_id,jsonb_build_object(
      'role',p_role,'permissions',p_permissions));
  return jsonb_build_object('auth_user_id',r.auth_user_id,'role',p_role);
end;
$$;

create or replace function public.platform_disable_staff(
  p_staff_id uuid,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public
as $$
begin
  update public.platform_staff set active=false where auth_user_id=p_staff_id and active=true;
  if not found then raise exception 'Active staff member not found'; end if;
  insert into public.platform_audit(actor_id,event,resource_id,metadata)
    values(p_actor,'staff.disabled',p_staff_id,'{}');
  return jsonb_build_object('auth_user_id',p_staff_id,'active',false);
end;
$$;

-- Platform method configuration is NOT a payment gateway integration.
create or replace function public.platform_configure_payment_method(
  p_method_id uuid,p_set_default boolean,p_enabled boolean,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public
as $$
declare m public.platform_payment_methods%rowtype;
begin
  -- Serialize default changes to avoid two simultaneous default selections.
  lock table public.platform_payment_methods in share row exclusive mode;
  select * into m from public.platform_payment_methods where id=p_method_id;
  if not found then raise exception 'Payment method not found'; end if;
  if p_set_default then
    update public.platform_payment_methods set is_default=false where is_default=true;
    update public.platform_payment_methods set is_default=true,enabled=true where id=p_method_id;
  else
    update public.platform_payment_methods
      set enabled=p_enabled,is_default=(case when p_enabled then is_default else false end)
      where id=p_method_id;
  end if;
  insert into public.platform_audit(actor_id,event,resource_id,metadata)
    values(p_actor,'billing.method_updated',p_method_id,jsonb_build_object(
      'set_default',p_set_default,'enabled',p_enabled));
  return jsonb_build_object('method_id',p_method_id,'updated',true);
end;
$$;

-- PostgREST only exposes these RPCs to the server's service role.
revoke all on function public.platform_register_school(text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.platform_change_school_state(uuid,text,text,uuid) from public, anon, authenticated;
revoke all on function public.platform_approve_staff_request(uuid,text,text[],uuid) from public, anon, authenticated;
revoke all on function public.platform_disable_staff(uuid,uuid) from public, anon, authenticated;
revoke all on function public.platform_configure_payment_method(uuid,boolean,boolean,uuid) from public, anon, authenticated;

grant execute on function public.platform_register_school(text,text,text,uuid) to service_role;
grant execute on function public.platform_change_school_state(uuid,text,text,uuid) to service_role;
grant execute on function public.platform_approve_staff_request(uuid,text,text[],uuid) to service_role;
grant execute on function public.platform_disable_staff(uuid,uuid) to service_role;
grant execute on function public.platform_configure_payment_method(uuid,boolean,boolean,uuid) to service_role;

-- There are intentionally no authenticated/anon RLS policies for platform_*.
-- School tenant identities, child privacy, program data and payment provider webhooks
-- must be separately specified and tested in later modules.
