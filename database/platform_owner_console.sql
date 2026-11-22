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


-- Aggregations use the full database, never a paginated subset.
create or replace function public.platform_owner_stats()
returns jsonb language sql stable security invoker
set search_path=pg_catalog,public
as $fn$
  select jsonb_build_object(
    'tenants', (select count(*) from public.platform_schools),
    'onboarding', (select count(*) from public.platform_schools where status='onboarding'),
    'active', (select count(*) from public.platform_schools where status='active'),
    'paused', (select count(*) from public.platform_schools where status='paused'),
    'suspended', (select count(*) from public.platform_schools where status='suspended'),
    'archived', (select count(*) from public.platform_schools where status='archived'),
    'deletion_requested', (select count(*) from public.platform_schools where status='deletion_requested'),
    'ticketsOpen', (select count(*) from public.platform_tickets where status<>'resolved'),
    'billedRwf', (select coalesce(sum(amount_rwf),0) from public.platform_invoices where status<>'void'),
    'collectedRwf', (select coalesce(sum(amount_rwf),0) from public.platform_payments where status='settled'),
    'manualCollectedRwf', (select coalesce(sum(amount_rwf),0) from public.platform_manual_payments where state='recorded'),
    'monthlyExpectedRwf', (select coalesce(sum(monthly_fee_rwf),0) from public.platform_fee_terms),
    'pastDue', (select count(*) from public.platform_fee_terms where next_due_on < (now() at time zone 'Africa/Kigali')::date),
    'dueToday', (select count(*) from public.platform_fee_terms where next_due_on = (now() at time zone 'Africa/Kigali')::date)
  );
$fn$;

revoke all on function public.platform_owner_stats() from public, anon, authenticated;
grant execute on function public.platform_owner_stats() to service_role;


-- Owner-controlled granular staff permissions. Only the server's service_role
-- may invoke this function. The HTTP API checks the verified owner and AAL2.
create or replace function public.platform_update_staff_permissions(
  p_staff_id uuid,p_role text,p_permissions text[],p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public
as $$
declare old_record public.platform_staff%rowtype;
begin
  if p_staff_id=p_actor then raise exception 'Self-grants are not allowed'; end if;
  if p_role not in ('operations','support','finance','observer') then
    raise exception 'Unsupported staff role';
  end if;
  if length(btrim(coalesce(p_reason,'')))<8 then raise exception 'Audit reason required'; end if;
  if p_permissions is null
     or array_position(p_permissions,null) is not null
     or exists (
       select 1 from unnest(p_permissions) p
       where p <> all(array[
         'tenants.read','tenants.create','tenants.lifecycle',
         'tickets.read','tickets.manage','billing.read',
         'billing.methods','billing.record','tenants.brand','staff.read','staff.manage','audit.read'
       ])
     ) then raise exception 'Invalid permission selection'; end if;
  select * into old_record from public.platform_staff
    where auth_user_id=p_staff_id for update;
  if not found or not old_record.active then raise exception 'Active staff account not found'; end if;
  update public.platform_staff
    set role=p_role,permissions=p_permissions
    where auth_user_id=p_staff_id;
  insert into public.platform_audit(actor_id,event,resource_id,metadata)
    values(p_actor,'staff.permissions_changed',p_staff_id,
      jsonb_build_object('previous_role',old_record.role,
        'previous_permissions',old_record.permissions,'role',p_role,
        'permissions',p_permissions,'reason',p_reason));
  return jsonb_build_object('staff_id',p_staff_id,'role',p_role);
end;
$$;
revoke all on function public.platform_update_staff_permissions(uuid,text,text[],text,uuid)
  from public, anon, authenticated;
grant execute on function public.platform_update_staff_permissions(uuid,text,text[],text,uuid)
  to service_role;


-- Owner-only, human-managed monthly terms. These are NOT a subscription checkout,
-- payment processor, or anything shown to schools, teachers, students, parents.
create table if not exists public.platform_fee_terms (
  school_id uuid primary key references public.platform_schools(id) on delete restrict,
  monthly_fee_rwf bigint not null check (monthly_fee_rwf >= 0),
  next_due_on date,
  last_paid_on date,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create index if not exists platform_fee_terms_due_idx on public.platform_fee_terms(next_due_on);

create table if not exists public.platform_manual_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.platform_schools(id) on delete restrict,
  paid_on date not null,
  amount_rwf bigint not null check(amount_rwf > 0),
  method text not null check(method in ('mobile_money','bank_transfer','cash','other')),
  reference text,
  notes text,
  state text not null default 'recorded' check(state in ('recorded','voided')),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  voided_by uuid references auth.users(id) on delete restrict,
  voided_at timestamptz,
  void_reason text
);
create index if not exists platform_manual_payments_school_idx on public.platform_manual_payments(school_id,paid_on desc);

create table if not exists public.platform_school_sites (
  school_id uuid primary key references public.platform_schools(id) on delete restrict,
  tagline text not null default '',
  about_text text not null default '',
  announcement text not null default '',
  logo_url text,
  hero_url text,
  primary_color text not null default '#204a78',
  contact_email text,
  contact_phone text,
  is_published boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Restrict all new platform tables to the trusted server-side role only.
do $$
declare t text;
begin
 foreach t in array array['platform_fee_terms','platform_manual_payments','platform_school_sites'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from public,anon,authenticated',t);
  execute format('grant all on table public.%I to service_role',t);
 end loop;
end $$;

-- Payment record and derived next date are atomic. Do not call for real gateway receipts.
create or replace function public.platform_record_monthly_payment(
  p_school_id uuid, p_paid_on date, p_amount_rwf bigint,
  p_method text,p_reference text,p_notes text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public
as $$
declare
  terms public.platform_fee_terms%rowtype;
  payment_id uuid;
  computed_due date;
begin
  if p_method not in ('mobile_money','bank_transfer','cash','other') then raise exception 'Unrecognized payment method'; end if;
  if p_paid_on is null or p_paid_on > (now() at time zone 'Africa/Kigali')::date then raise exception 'Invalid or future payment date'; end if;
  if length(coalesce(p_reference,''))>120 or length(coalesce(p_notes,''))>500 then raise exception 'Payment notes too long'; end if;
  select * into terms from public.platform_fee_terms where school_id=p_school_id for update;
  if not found or terms.monthly_fee_rwf <= 0 then raise exception 'Set a monthly fee before marking paid'; end if;
  if p_amount_rwf is null or p_amount_rwf < terms.monthly_fee_rwf then
    raise exception 'Payment is below required monthly amount; do not mark a partial as fully paid';
  end if;
  if terms.last_paid_on is not null and p_paid_on <= terms.last_paid_on then
    raise exception 'Payment date must be after last recorded paid date';
  end if;
  computed_due := (p_paid_on + interval '1 month')::date;
  insert into public.platform_manual_payments(
    school_id,paid_on,amount_rwf,method,reference,notes,recorded_by)
    values(p_school_id,p_paid_on,p_amount_rwf,p_method,p_reference,p_notes,p_actor)
    returning id into payment_id;
  update public.platform_fee_terms
    set last_paid_on=p_paid_on,next_due_on=computed_due,updated_at=now(),updated_by=p_actor
    where school_id=p_school_id;
  insert into public.platform_audit(actor_id,event,resource_id,metadata)
    values(p_actor,'fee.manual_payment_recorded',p_school_id,jsonb_build_object(
      'manual_payment_id',payment_id,'paid_on',p_paid_on,
      'next_due',computed_due,'amount_rwf',p_amount_rwf,'method',p_method));
  return jsonb_build_object('payment_id',payment_id,'next_due_on',computed_due);
end;
$$;

create or replace function public.platform_set_monthly_terms(
  p_school_id uuid,p_amount_rwf bigint,p_first_due_on date,p_actor uuid
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public
as $$
declare terms public.platform_fee_terms%rowtype;
begin
 if p_amount_rwf is null or p_amount_rwf<0 then raise exception 'Invalid monthly RWF amount'; end if;
 if p_first_due_on is null then raise exception 'Initial due date is required'; end if;
 if not exists(select 1 from public.platform_schools where id=p_school_id) then raise exception 'School not found'; end if;
 select * into terms from public.platform_fee_terms where school_id=p_school_id for update;
 if found and terms.last_paid_on is not null then
   -- Changing fee amount may not silently reset next due or erase payment history.
   update public.platform_fee_terms set monthly_fee_rwf=p_amount_rwf,
     updated_by=p_actor,updated_at=now() where school_id=p_school_id;
 else
   insert into public.platform_fee_terms(school_id,monthly_fee_rwf,next_due_on,updated_by)
      values(p_school_id,p_amount_rwf,p_first_due_on,p_actor)
      on conflict(school_id) do update set monthly_fee_rwf=excluded.monthly_fee_rwf,
      next_due_on=excluded.next_due_on,updated_by=p_actor,updated_at=now();
 end if;
 insert into public.platform_audit(actor_id,event,resource_id,metadata)
   values(p_actor,'fee.terms_updated',p_school_id,
     jsonb_build_object('monthly_fee_rwf',p_amount_rwf,'requested_first_due_on',p_first_due_on));
 return jsonb_build_object('school_id',p_school_id,'amount_rwf',p_amount_rwf);
end;
$$;

-- Corrections remain auditable: void the mistaken record and restore the previous
-- non-voided payment's next_due_on; never delete payment history.
create or replace function public.platform_void_manual_payment(
 p_payment_id uuid,p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public
as $$
declare
 receipt public.platform_manual_payments%rowtype;
 prev_paid date;
 next_due date;
begin
 if length(btrim(coalesce(p_reason,'')))<8 then raise exception 'Correction reason required'; end if;
 select * into receipt from public.platform_manual_payments where id=p_payment_id for update;
 if not found or receipt.state <> 'recorded' then raise exception 'Recorded payment not found'; end if;
 perform 1 from public.platform_fee_terms where school_id=receipt.school_id for update;
 update public.platform_manual_payments set state='voided',voided_by=p_actor,voided_at=now(),
   void_reason=p_reason where id=p_payment_id;
 select max(paid_on) into prev_paid from public.platform_manual_payments
  where school_id=receipt.school_id and state='recorded';
 next_due := case when prev_paid is null then null else (prev_paid+interval '1 month')::date end;
 update public.platform_fee_terms set last_paid_on=prev_paid,next_due_on=next_due,
  updated_at=now(),updated_by=p_actor where school_id=receipt.school_id;
 insert into public.platform_audit(actor_id,event,resource_id,metadata)
   values(p_actor,'fee.manual_payment_voided',receipt.school_id,
    jsonb_build_object('payment_id',receipt.id,'reason',p_reason,'recomputed_due',next_due));
 return jsonb_build_object('payment_id',receipt.id,'next_due_on',next_due);
end;
$$;

revoke all on function public.platform_record_monthly_payment(uuid,date,bigint,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.platform_set_monthly_terms(uuid,bigint,date,uuid) from public,anon,authenticated;
revoke all on function public.platform_void_manual_payment(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.platform_record_monthly_payment(uuid,date,bigint,text,text,text,uuid) to service_role;
grant execute on function public.platform_set_monthly_terms(uuid,bigint,date,uuid) to service_role;
grant execute on function public.platform_void_manual_payment(uuid,text,uuid) to service_role;


-- Create an additional school under an existing company ID without duplicating
-- the parent company. Only an authorized platform operator API may invoke.
create or replace function public.platform_add_school_to_company(
  p_company_id uuid,p_school_name text,p_owner_email text,p_actor uuid
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public
as $$
declare c public.platform_companies%rowtype;
        s public.platform_schools%rowtype;
begin
 if length(btrim(coalesce(p_school_name,''))) not between 2 and 120 then raise exception 'Invalid school name'; end if;
 if position('@' in coalesce(p_owner_email,''))<2 then raise exception 'Invalid owner email'; end if;
 select * into c from public.platform_companies where id=p_company_id;
 if not found then raise exception 'Company not found'; end if;
 insert into public.platform_schools(company_id,name,owner_email)
   values(c.id,btrim(p_school_name),lower(btrim(p_owner_email))) returning * into s;
 insert into public.platform_audit(actor_id,event,resource_id,metadata)
   values(p_actor,'tenant.school_added_to_company',s.id,jsonb_build_object('company_id',c.id,'company_code',c.company_code));
 return jsonb_build_object('company_id',c.id,'company_code',c.company_code,'school_id',s.id,'school_code',s.school_code);
end;
$$;
revoke all on function public.platform_add_school_to_company(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.platform_add_school_to_company(uuid,text,text,uuid) to service_role;


-- Only school-approved marketing images belong here. No student documents.
-- Every upload goes through a verified, privileged server route, which strips
-- EXIF and normalizes images to WebP before publishing.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('school-branding','school-branding',true,5242880,array['image/webp'])
 on conflict(id) do update set public=true,file_size_limit=5242880,
   allowed_mime_types=array['image/webp'];
-- No browser/anon INSERT/UPDATE/DELETE policy: uploads are server-only.
