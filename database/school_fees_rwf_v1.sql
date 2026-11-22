-- Module 7: school-specific RWF fees and manually verified collections.
-- EIGHTH isolated migration; do not apply to live APEX.
-- Parent-provided payment references are claims, never settlement evidence.
-- All sensitive tables are server-only with RLS and revoked browser grants.
create sequence public.school_fee_invoice_number_seq;
create sequence public.school_fee_receipt_number_seq;
revoke all on sequence public.school_fee_invoice_number_seq from public,anon,authenticated;
revoke all on sequence public.school_fee_receipt_number_seq from public,anon,authenticated;
grant usage,select on sequence public.school_fee_invoice_number_seq to service_role;
grant usage,select on sequence public.school_fee_receipt_number_seq to service_role;

create table public.school_finance_permissions(
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 auth_user_id uuid not null references auth.users(id) on delete restrict,
 role text not null check(role in ('school_admin','staff')),
 permissions text[] not null default '{}'::text[]
  check(permissions <@ array[
   'fees.manage','invoices.issue','payments.record',
   'payments.approve','finance.read']::text[]),
 updated_by uuid not null references auth.users(id) on delete restrict,
 updated_at timestamptz not null default now(),
 primary key(school_id,auth_user_id),
 foreign key(school_id,auth_user_id,role)
  references public.school_memberships(school_id,auth_user_id,role) on delete restrict
);

create table public.school_fee_catalog(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 academic_year_id uuid not null,
 class_id uuid,
 term_label text not null default '' check(length(term_label)<=50),
 category text not null check(category in
  ('tuition','registration','boarding','transport','meals','examination','other')),
 label text not null check(length(btrim(label)) between 3 and 120),
 amount_rwf bigint not null check(amount_rwf between 1 and 1000000000000),
 due_on date not null,
 status text not null default 'active' check(status in ('active','inactive')),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(school_id,id),
 unique(school_id,id,academic_year_id),
 foreign key(school_id,academic_year_id)
  references public.school_academic_years(school_id,id) on delete restrict,
 foreign key(school_id,class_id,academic_year_id)
  references public.school_classes(school_id,id,academic_year_id) on delete restrict
);
create index school_fee_catalog_year_idx on public.school_fee_catalog(school_id,academic_year_id,status);

create table public.school_fee_invoices(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 invoice_number text not null unique default
  ('RW-INV-'||lpad(nextval('public.school_fee_invoice_number_seq'::regclass)::text,9,'0')),
 fee_id uuid not null,
 academic_year_id uuid not null,
 class_id uuid not null,
 student_id uuid not null,
 category text not null,
 description text not null,
 term_label text not null default '',
 amount_rwf bigint not null check(amount_rwf between 1 and 1000000000000),
 due_on date not null,
 currency text not null default 'RWF' check(currency='RWF'),
 status text not null default 'issued' check(status in ('issued','cancelled')),
 issued_at timestamptz not null default now(),
 issued_by uuid not null references auth.users(id) on delete restrict,
 cancelled_at timestamptz,
 cancelled_by uuid references auth.users(id) on delete restrict,
 cancellation_reason text,
 unique(school_id,id),
 unique(school_id,student_id,fee_id),
 foreign key(school_id,fee_id,academic_year_id)
  references public.school_fee_catalog(school_id,id,academic_year_id) on delete restrict,
 foreign key(school_id,student_id,academic_year_id)
  references public.school_student_enrollments(school_id,student_id,academic_year_id) on delete restrict,
 foreign key(school_id,class_id,academic_year_id)
  references public.school_classes(school_id,id,academic_year_id) on delete restrict,
 check((status='issued' and cancelled_at is null and cancelled_by is null)
  or (status='cancelled' and cancelled_at is not null and cancelled_by is not null
   and length(btrim(cancellation_reason))>=8))
);
create index school_fee_invoices_student_idx
 on public.school_fee_invoices(school_id,student_id,issued_at desc);
create index school_fee_invoices_due_idx
 on public.school_fee_invoices(school_id,status,due_on);

create table public.school_fee_payments(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 invoice_id uuid not null,
 amount_rwf bigint not null check(amount_rwf between 1 and 1000000000000),
 currency text not null default 'RWF' check(currency='RWF'),
 method text not null check(method in
  ('mtn_momo','airtel_money','bank_transfer','cash','other')),
 reference text not null check(length(btrim(reference)) between 4 and 120),
 paid_on date not null,
 source text not null check(source in ('guardian_claim','school_operator')),
 payer_note text not null default '' check(length(payer_note)<=500),
 status text not null default 'pending' check(status in
  ('pending','posted','rejected','reversed')),
 proposed_by uuid not null references auth.users(id) on delete restrict,
 proposed_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id) on delete restrict,
 reviewed_at timestamptz,
 review_evidence text,
 review_note text,
 reversed_by uuid references auth.users(id) on delete restrict,
 reversed_at timestamptz,
 reversal_reason text,
 unique(school_id,id),
 unique(school_id,method,reference),
 foreign key(school_id,invoice_id)
  references public.school_fee_invoices(school_id,id) on delete restrict,
 check((status='pending' and reviewed_at is null and reviewed_by is null)
  or (status='rejected' and reviewed_at is not null and reviewed_by is not null
   and length(btrim(review_note))>=8)
  or (status='posted' and reviewed_at is not null and reviewed_by is not null
   and review_evidence in ('provider_statement','bank_statement','cash_count','other')
   and length(btrim(review_note))>=15 and reversed_at is null)
  or (status='reversed' and reviewed_at is not null and reviewed_by is not null
   and reversed_at is not null and reversed_by is not null
   and length(btrim(reversal_reason))>=8))
);
create index school_fee_payments_invoice_idx
 on public.school_fee_payments(school_id,invoice_id,status);
create index school_fee_payments_pending_idx
 on public.school_fee_payments(school_id,status,proposed_at desc);

create table public.school_fee_receipts(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 receipt_number text not null unique default
  ('RW-RCT-'||lpad(nextval('public.school_fee_receipt_number_seq'::regclass)::text,9,'0')),
 payment_id uuid not null,
 invoice_id uuid not null,
 amount_rwf bigint not null check(amount_rwf between 1 and 1000000000000),
 currency text not null default 'RWF' check(currency='RWF'),
 issued_at timestamptz not null default now(),
 issued_by uuid not null references auth.users(id) on delete restrict,
 status text not null default 'active' check(status in ('active','voided')),
 voided_at timestamptz,
 unique(school_id,id),
 unique(school_id,payment_id),
 foreign key(school_id,payment_id)
  references public.school_fee_payments(school_id,id) on delete restrict,
 foreign key(school_id,invoice_id)
  references public.school_fee_invoices(school_id,id) on delete restrict,
 check((status='active' and voided_at is null)
  or (status='voided' and voided_at is not null))
);
create index school_fee_receipts_invoice_idx
 on public.school_fee_receipts(school_id,invoice_id,issued_at desc);

create table public.school_fee_credits(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 invoice_id uuid not null,
 amount_rwf bigint not null check(amount_rwf between 1 and 1000000000000),
 reason text not null check(length(btrim(reason)) between 8 and 500),
 approved_by uuid not null references auth.users(id) on delete restrict,
 approved_at timestamptz not null default now(),
 unique(school_id,id),
 foreign key(school_id,invoice_id)
  references public.school_fee_invoices(school_id,id) on delete restrict
);
create index school_fee_credits_invoice_idx on public.school_fee_credits(school_id,invoice_id);

create table public.school_finance_audit(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 event text not null check(length(event) between 3 and 100),
 resource_id uuid,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index school_finance_audit_school_idx
 on public.school_finance_audit(school_id,created_at desc);

do $$
declare n text;
begin
 foreach n in array array[
  'school_finance_permissions','school_fee_catalog','school_fee_invoices',
  'school_fee_payments','school_fee_receipts','school_fee_credits',
  'school_finance_audit'
 ] loop
  execute format('alter table public.%I enable row level security',n);
  execute format('revoke all on table public.%I from public,anon,authenticated',n);
  execute format('grant all on table public.%I to service_role',n);
 end loop;
end $$;

create or replace function public.school_finance_has(
 p_school uuid,p_user uuid,p_permission text
) returns boolean language sql stable security invoker
set search_path=pg_catalog,public as $$
 select exists(
  select 1 from public.platform_schools s
  join public.school_memberships m on m.school_id=s.id
   and m.auth_user_id=p_user and m.active
  where s.id=p_school and s.status='active'
   and (m.role='school_owner' or
    (m.role in ('school_admin','staff') and exists(
      select 1 from public.school_finance_permissions g
      where g.school_id=s.id and g.auth_user_id=p_user
       and p_permission=any(g.permissions)
    )))
 )
$$;

create or replace function public.school_finance_is_owner(
 p_school uuid,p_user uuid
) returns boolean language sql stable security invoker
set search_path=pg_catalog,public as $$
 select exists(select 1 from public.platform_schools s
 join public.school_memberships m on m.school_id=s.id
 where s.id=p_school and s.status='active' and m.role='school_owner'
  and m.auth_user_id=p_user and m.active)
$$;

create or replace function public.school_finance_parent_link(
 p_school uuid,p_user uuid,p_student uuid
) returns boolean language sql stable security invoker
set search_path=pg_catalog,public as $$
 select exists(select 1 from public.platform_schools s
 join public.school_memberships m on m.school_id=s.id and m.role='parent'
  and m.auth_user_id=p_user and m.active
 join public.school_guardian_links g on g.school_id=s.id
  and g.auth_user_id=p_user and g.student_id=p_student and g.active
 join public.school_students st on st.school_id=s.id and st.id=p_student
  and st.status='active'
 where s.id=p_school and s.status='active')
$$;

create or replace function public.school_finance_remaining(
 p_school uuid,p_invoice uuid
) returns bigint language sql stable security invoker
set search_path=pg_catalog,public as $$
 select greatest(0, i.amount_rwf-
   coalesce((select sum(p.amount_rwf) from public.school_fee_payments p
     where p.school_id=i.school_id and p.invoice_id=i.id and p.status='posted'),0)-
   coalesce((select sum(c.amount_rwf) from public.school_fee_credits c
     where c.school_id=i.school_id and c.invoice_id=i.id),0)
 )::bigint
 from public.school_fee_invoices i
 where i.school_id=p_school and i.id=p_invoice and i.status='issued'
$$;

create or replace function public.school_finance_set_permissions(
 p_school uuid,p_target uuid,p_permissions text[],p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare m_role text;
        before_permissions text[];
begin
 if not public.school_finance_is_owner(p_school,p_actor)
 then raise exception 'Only this school owner can delegate finance rights'; end if;
 if p_permissions is null or not (p_permissions <@ array[
  'fees.manage','invoices.issue','payments.record','payments.approve','finance.read']::text[])
 then raise exception 'Unknown finance permission'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 8 and 500
 then raise exception 'Explain why this access is changing'; end if;
 select m.role into m_role from public.school_memberships m
 where m.school_id=p_school and m.auth_user_id=p_target
  and m.role in ('school_admin','staff') and m.active
 order by case when m.role='school_admin' then 0 else 1 end limit 1;
 if not found then raise exception 'Select an approved local administrator or staff member'; end if;
 select permissions into before_permissions from public.school_finance_permissions
 where school_id=p_school and auth_user_id=p_target for update;
 insert into public.school_finance_permissions(
  school_id,auth_user_id,role,permissions,updated_by)
 values(p_school,p_target,m_role,p_permissions,p_actor)
 on conflict(school_id,auth_user_id) do update
 set role=excluded.role,permissions=excluded.permissions,
 updated_by=p_actor,updated_at=now();
 insert into public.school_finance_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school,p_actor,'finance.permissions_changed',p_target,jsonb_build_object(
  'previous',coalesce(before_permissions,'{}'::text[]),
  'new',p_permissions,'reason',p_reason));
 return jsonb_build_object('saved',true);
end;
$$;

create or replace function public.school_fee_create_catalog(
 p_school uuid,p_year uuid,p_class uuid,p_category text,p_label text,
 p_term text,p_amount bigint,p_due date,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare yr public.school_academic_years%rowtype;
        new_id uuid;
begin
 if not public.school_finance_has(p_school,p_actor,'fees.manage')
 then raise exception 'Fee management permission required'; end if;
 select * into yr from public.school_academic_years
 where school_id=p_school and id=p_year and status='current';
 if not found then raise exception 'Configure the current academic year first'; end if;
 if p_class is not null and not exists(select 1 from public.school_classes
  where school_id=p_school and id=p_class and academic_year_id=p_year and status='active')
 then raise exception 'Fee class must be active in this academic year'; end if;
 if p_category not in ('tuition','registration','boarding','transport','meals','examination','other')
  or length(btrim(coalesce(p_label,''))) not between 3 and 120
  or length(coalesce(p_term,''))>50 or p_amount not between 1 and 1000000000000
  or p_due<yr.starts_on or p_due>yr.ends_on+180
 then raise exception 'Invalid fee description, amount or school-year due date'; end if;
 insert into public.school_fee_catalog(school_id,academic_year_id,class_id,
  category,label,term_label,amount_rwf,due_on,created_by)
 values(p_school,p_year,p_class,p_category,btrim(p_label),btrim(coalesce(p_term,'')),
  p_amount,p_due,p_actor) returning id into new_id;
 insert into public.school_finance_audit(school_id,actor_id,event,resource_id)
 values(p_school,p_actor,'fee.catalog_created',new_id);
 return jsonb_build_object('id',new_id,'currency','RWF');
end;
$$;

create or replace function public.school_fee_disable_catalog(
 p_school uuid,p_fee uuid,p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
begin
 if not public.school_finance_has(p_school,p_actor,'fees.manage')
 then raise exception 'Fee management permission required'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 8 and 500
 then raise exception 'Explain why this fee is being deactivated'; end if;
 update public.school_fee_catalog set status='inactive'
 where school_id=p_school and id=p_fee and status='active';
 if not found then raise exception 'Active fee not found'; end if;
 insert into public.school_finance_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school,p_actor,'fee.catalog_disabled',p_fee,jsonb_build_object('reason',p_reason));
 return jsonb_build_object('disabled',true);
end;
$$;

create or replace function public.school_fee_issue_invoice(
 p_school uuid,p_fee uuid,p_student uuid,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare fee public.school_fee_catalog%rowtype;
        enrolled public.school_student_enrollments%rowtype;
        invoice_id uuid;
        invoice_no text;
begin
 if not public.school_finance_has(p_school,p_actor,'invoices.issue')
 then raise exception 'Invoice issuance permission required'; end if;
 select * into fee from public.school_fee_catalog
 where school_id=p_school and id=p_fee and status='active' for share;
 if not found then raise exception 'Active fee not found'; end if;
 if not exists(select 1 from public.school_academic_years
  where school_id=p_school and id=fee.academic_year_id and status='current')
 then raise exception 'Fee must belong to the current academic year'; end if;
 select * into enrolled from public.school_student_enrollments
 where school_id=p_school and student_id=p_student
  and academic_year_id=fee.academic_year_id and status='active';
 if not found or (fee.class_id is not null and fee.class_id<>enrolled.class_id)
 then raise exception 'Student does not qualify for this fee'; end if;
 if not exists(select 1 from public.school_students
  where school_id=p_school and id=p_student and status='active')
 then raise exception 'The student account is not active'; end if;
 if exists(select 1 from public.school_fee_invoices
  where school_id=p_school and student_id=p_student and fee_id=p_fee)
 then raise exception 'An invoice already exists for this student and fee'; end if;
 insert into public.school_fee_invoices(school_id,fee_id,academic_year_id,
  class_id,student_id,category,description,term_label,
  amount_rwf,due_on,issued_by)
 values(p_school,fee.id,fee.academic_year_id,enrolled.class_id,p_student,
  fee.category,fee.label,fee.term_label,fee.amount_rwf,fee.due_on,p_actor)
 returning id,invoice_number into invoice_id,invoice_no;
 insert into public.school_finance_audit(school_id,actor_id,event,resource_id,
  metadata)
 values(p_school,p_actor,'invoice.issued',invoice_id,
  jsonb_build_object('number',invoice_no,'amount_rwf',fee.amount_rwf));
 return jsonb_build_object('id',invoice_id,'number',invoice_no,'currency','RWF');
end;
$$;

create or replace function public.school_fee_issue_class_invoices(
 p_school uuid,p_fee uuid,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare fee public.school_fee_catalog%rowtype;
        issued_count bigint;
begin
 if not public.school_finance_has(p_school,p_actor,'invoices.issue')
 then raise exception 'Invoice issuance permission required'; end if;
 select * into fee from public.school_fee_catalog
 where school_id=p_school and id=p_fee and status='active' for share;
 if not found then raise exception 'Active fee not found'; end if;
 if not exists(select 1 from public.school_academic_years
  where school_id=p_school and id=fee.academic_year_id and status='current')
 then raise exception 'Fees may only be issued for the current academic year'; end if;
 with eligible as(
  select e.student_id,e.class_id from public.school_student_enrollments e
  join public.school_students st on st.school_id=e.school_id and st.id=e.student_id
   and st.status='active'
  join public.school_classes c on c.school_id=e.school_id and c.id=e.class_id
   and c.academic_year_id=e.academic_year_id and c.status='active'
  where e.school_id=p_school and e.academic_year_id=fee.academic_year_id
   and e.status='active' and (fee.class_id is null or e.class_id=fee.class_id)
 ), inserted as(
  insert into public.school_fee_invoices(school_id,fee_id,academic_year_id,
   class_id,student_id,category,description,term_label,amount_rwf,due_on,issued_by)
  select p_school,fee.id,fee.academic_year_id,e.class_id,e.student_id,
    fee.category,fee.label,fee.term_label,fee.amount_rwf,fee.due_on,p_actor
  from eligible e
  on conflict(school_id,student_id,fee_id) do nothing
  returning id
 )
 select count(*) into issued_count from inserted;
 insert into public.school_finance_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school,p_actor,'invoice.batch_issued',fee.id,
  jsonb_build_object('issued_count',issued_count,'fee_label',fee.label));
 return jsonb_build_object('issued_count',issued_count,'currency','RWF');
end;
$$;

create or replace function public.school_fee_submit_payment(
 p_school uuid,p_invoice uuid,p_amount bigint,p_method text,
 p_reference text,p_paid date,p_note text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare inv public.school_fee_invoices%rowtype;
        user_source text;
        pay_id uuid;
begin
 select * into inv from public.school_fee_invoices
 where school_id=p_school and id=p_invoice and status='issued' for share;
 if not found then raise exception 'Issued school invoice not found'; end if;
 if public.school_finance_has(p_school,p_actor,'payments.record') then
  user_source:='school_operator';
 elsif public.school_finance_parent_link(p_school,p_actor,inv.student_id) then
  user_source:='guardian_claim';
 else raise exception 'Only authorized school cashier or linked guardian can report a payment';
 end if;
 if p_amount not between 1 and inv.amount_rwf
  or p_method not in ('mtn_momo','airtel_money','bank_transfer','cash','other')
  or length(btrim(coalesce(p_reference,''))) not between 4 and 120
  or length(coalesce(p_note,''))>500
  or p_paid is null or p_paid>(now() at time zone 'Africa/Kigali')::date
  or p_paid < (now() at time zone 'Africa/Kigali')::date-365
 then raise exception 'Invalid amount, method, reference or payment date'; end if;
 if user_source='guardian_claim' and p_method in ('cash','other')
 then raise exception 'Guardian can only report an electronic or bank transfer reference'; end if;
 if user_source='guardian_claim' and (select count(*)
  from public.school_fee_payments where school_id=p_school
   and proposed_by=p_actor and proposed_at>now()-interval '1 hour')>=5
 then raise exception 'Too many payment claims; contact the school'; end if;
 insert into public.school_fee_payments(school_id,invoice_id,amount_rwf,
  method,reference,paid_on,source,payer_note,proposed_by)
 values(p_school,p_invoice,p_amount,p_method,btrim(p_reference),p_paid,
  user_source,coalesce(p_note,''),p_actor)
 on conflict(school_id,method,reference) do nothing returning id into pay_id;
 if pay_id is null
 then raise exception 'Payment reference already exists in this school for this method'; end if;
 insert into public.school_finance_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school,p_actor,'payment.reported',pay_id,
  jsonb_build_object('source',user_source,'method',p_method,
   'amount_rwf',p_amount));
 return jsonb_build_object('id',pay_id,'status','pending',
  'confirmed',false,'currency','RWF');
end;
$$;

create or replace function public.school_fee_post_payment(
 p_school uuid,p_payment uuid,p_evidence text,p_review text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare payment public.school_fee_payments%rowtype;
        inv public.school_fee_invoices%rowtype;
        available bigint;
        receipt_id uuid;
        receipt_no text;
begin
 if not public.school_finance_has(p_school,p_actor,'payments.approve')
 then raise exception 'Payment review privilege required'; end if;
 if p_evidence not in ('provider_statement','bank_statement','cash_count','other')
   or length(btrim(coalesce(p_review,''))) not between 15 and 500
 then raise exception 'An independent evidence type and detailed review note are required'; end if;
 select * into payment from public.school_fee_payments
 where school_id=p_school and id=p_payment and status='pending' for update;
 if not found then raise exception 'Pending payment not found'; end if;
 if payment.proposed_by=p_actor
 then raise exception 'The person submitting a payment cannot approve their own claim'; end if;
 select * into inv from public.school_fee_invoices
 where school_id=p_school and id=payment.invoice_id and status='issued' for update;
 if not found then raise exception 'Invoice is not open'; end if;
 available:=public.school_finance_remaining(p_school,inv.id);
 if payment.amount_rwf>available
 then raise exception 'Payment exceeds invoice balance; resolve overpayment separately'; end if;
 update public.school_fee_payments set status='posted',reviewed_by=p_actor,
  reviewed_at=now(),review_evidence=p_evidence,review_note=btrim(p_review)
 where school_id=p_school and id=p_payment;
 insert into public.school_fee_receipts(school_id,payment_id,invoice_id,
  amount_rwf,issued_by)
 values(p_school,p_payment,inv.id,payment.amount_rwf,p_actor)
 returning id,receipt_number into receipt_id,receipt_no;
 insert into public.school_finance_audit(school_id,actor_id,event,resource_id,
  metadata)
 values(p_school,p_actor,'payment.approved',p_payment,
  jsonb_build_object('receipt_id',receipt_id,'amount_rwf',payment.amount_rwf,
   'evidence_type',p_evidence));
 return jsonb_build_object('posted',true,'receipt_id',receipt_id,
  'receipt_number',receipt_no,'currency','RWF');
end;
$$;

create or replace function public.school_fee_reject_payment(
 p_school uuid,p_payment uuid,p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
begin
 if not public.school_finance_has(p_school,p_actor,'payments.approve')
 then raise exception 'Payment review privilege required'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 8 and 500
 then raise exception 'Explain the rejection'; end if;
 update public.school_fee_payments set status='rejected',
  reviewed_at=now(),reviewed_by=p_actor,review_note=btrim(p_reason)
 where school_id=p_school and id=p_payment and status='pending';
 if not found then raise exception 'Pending payment not found'; end if;
 insert into public.school_finance_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school,p_actor,'payment.rejected',p_payment,
  jsonb_build_object('reason',p_reason));
 return jsonb_build_object('rejected',true);
end;
$$;

create or replace function public.school_fee_reverse_payment(
 p_school uuid,p_payment uuid,p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare pay public.school_fee_payments%rowtype;
begin
 if not public.school_finance_is_owner(p_school,p_actor)
 then raise exception 'Only school owner can reverse posted collections'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 12 and 500
 then raise exception 'Record a full audit reason for this reversal'; end if;
 select * into pay from public.school_fee_payments
 where school_id=p_school and id=p_payment and status='posted' for update;
 if not found then raise exception 'Posted payment not found'; end if;
 perform 1 from public.school_fee_invoices
 where school_id=p_school and id=pay.invoice_id for update;
 update public.school_fee_payments set status='reversed',reversed_at=now(),
  reversed_by=p_actor,reversal_reason=btrim(p_reason)
 where school_id=p_school and id=p_payment;
 update public.school_fee_receipts set status='voided',voided_at=now()
 where school_id=p_school and payment_id=p_payment and status='active';
 if not found then raise exception 'The original receipt must exist before reversal'; end if;
 insert into public.school_finance_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school,p_actor,'payment.reversed',p_payment,
  jsonb_build_object('reason',p_reason,'refund_executed',false));
 return jsonb_build_object('reversed',true,'external_refund_executed',false);
end;
$$;

create or replace function public.school_fee_approve_credit(
 p_school uuid,p_invoice uuid,p_amount bigint,p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare inv public.school_fee_invoices%rowtype;
        remaining bigint;
        credit_id uuid;
begin
 if not public.school_finance_is_owner(p_school,p_actor)
 then raise exception 'Only school owner may approve fee waivers or credits'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 12 and 500
 then raise exception 'Describe the fee waiver'; end if;
 select * into inv from public.school_fee_invoices where
  school_id=p_school and id=p_invoice and status='issued' for update;
 if not found then raise exception 'Issued invoice not found'; end if;
 remaining:=public.school_finance_remaining(p_school,p_invoice);
 if p_amount is null or p_amount<=0 or p_amount>remaining
 then raise exception 'Credit exceeds the unpaid balance'; end if;
 insert into public.school_fee_credits(
  school_id,invoice_id,amount_rwf,reason,approved_by)
 values(p_school,p_invoice,p_amount,btrim(p_reason),p_actor)
 returning id into credit_id;
 insert into public.school_finance_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school,p_actor,'invoice.credit_approved',credit_id,
  jsonb_build_object('invoice_id',p_invoice,'amount_rwf',p_amount,'reason',p_reason));
 return jsonb_build_object('id',credit_id,'approved',true,'currency','RWF');
end;
$$;

create or replace function public.school_fee_cancel_invoice(
 p_school uuid,p_invoice uuid,p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare inv public.school_fee_invoices%rowtype;
begin
 if not public.school_finance_is_owner(p_school,p_actor)
 then raise exception 'Only school owner may cancel a school invoice'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 12 and 500
 then raise exception 'Explain this cancellation'; end if;
 select * into inv from public.school_fee_invoices where
  school_id=p_school and id=p_invoice and status='issued' for update;
 if not found then raise exception 'Issued invoice not found'; end if;
 if exists(select 1 from public.school_fee_payments
  where school_id=p_school and invoice_id=p_invoice and status in ('pending','posted'))
  or exists(select 1 from public.school_fee_credits
   where school_id=p_school and invoice_id=p_invoice)
 then raise exception 'Resolve existing payments and credits before cancellation'; end if;
 update public.school_fee_invoices set status='cancelled',
  cancelled_at=now(),cancelled_by=p_actor,cancellation_reason=btrim(p_reason)
 where school_id=p_school and id=p_invoice;
 insert into public.school_finance_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school,p_actor,'invoice.cancelled',p_invoice,jsonb_build_object('reason',p_reason));
 return jsonb_build_object('cancelled',true);
end;
$$;

create or replace function public.school_finance_summary(
 p_school uuid,p_actor uuid
) returns jsonb language plpgsql stable security invoker
set search_path=pg_catalog,public as $$
declare gross bigint;
        total_paid bigint;
        total_credit bigint;
        balance bigint;
        overdue bigint;
        invoice_count bigint;
        pending_count bigint;
        current_day date;
begin
 if not public.school_finance_has(p_school,p_actor,'finance.read')
 then raise exception 'Finance reporting permission required'; end if;
 current_day:=(now() at time zone 'Africa/Kigali')::date;
 with paid as(
  select invoice_id,sum(amount_rwf)::bigint amount
  from public.school_fee_payments where school_id=p_school and status='posted'
  group by invoice_id
 ), credits as(
  select invoice_id,sum(amount_rwf)::bigint amount
  from public.school_fee_credits where school_id=p_school group by invoice_id
 ), balances as(
  select i.id,i.amount_rwf,i.due_on,
    coalesce(p.amount,0) as paid,coalesce(c.amount,0) as credit,
    greatest(0,i.amount_rwf-coalesce(p.amount,0)-coalesce(c.amount,0)) as remaining
  from public.school_fee_invoices i
  left join paid p on p.invoice_id=i.id
  left join credits c on c.invoice_id=i.id
  where i.school_id=p_school and i.status='issued'
 )
 select coalesce(sum(amount_rwf),0),coalesce(sum(paid),0),
  coalesce(sum(credit),0),coalesce(sum(remaining),0),
  coalesce(sum(remaining) filter(where due_on<current_day),0),
  count(*) into gross,total_paid,total_credit,balance,overdue,invoice_count
 from balances;
 select count(*) into pending_count from public.school_fee_payments
 where school_id=p_school and status='pending';
 return jsonb_build_object('currency','RWF','invoiced_rwf',gross::text,
  'collected_rwf',total_paid::text,'waived_rwf',total_credit::text,
  'outstanding_rwf',balance::text,'overdue_rwf',overdue::text,
  'issued_invoices',invoice_count,'pending_claims',pending_count,
  'as_of',current_day);
end;
$$;

revoke all on function public.school_finance_has(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.school_finance_is_owner(uuid,uuid) from public,anon,authenticated;
revoke all on function public.school_finance_parent_link(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.school_finance_remaining(uuid,uuid) from public,anon,authenticated;
revoke all on function public.school_finance_set_permissions(uuid,uuid,text[],text,uuid) from public,anon,authenticated;
revoke all on function public.school_fee_create_catalog(uuid,uuid,uuid,text,text,text,bigint,date,uuid) from public,anon,authenticated;
revoke all on function public.school_fee_disable_catalog(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.school_fee_issue_invoice(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.school_fee_issue_class_invoices(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.school_fee_submit_payment(uuid,uuid,bigint,text,text,date,text,uuid) from public,anon,authenticated;
revoke all on function public.school_fee_post_payment(uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.school_fee_reject_payment(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.school_fee_reverse_payment(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.school_fee_approve_credit(uuid,uuid,bigint,text,uuid) from public,anon,authenticated;
revoke all on function public.school_fee_cancel_invoice(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.school_finance_summary(uuid,uuid) from public,anon,authenticated;
grant execute on function public.school_finance_has(uuid,uuid,text) to service_role;
grant execute on function public.school_finance_is_owner(uuid,uuid) to service_role;
grant execute on function public.school_finance_parent_link(uuid,uuid,uuid) to service_role;
grant execute on function public.school_finance_remaining(uuid,uuid) to service_role;
grant execute on function public.school_finance_set_permissions(uuid,uuid,text[],text,uuid) to service_role;
grant execute on function public.school_fee_create_catalog(uuid,uuid,uuid,text,text,text,bigint,date,uuid) to service_role;
grant execute on function public.school_fee_disable_catalog(uuid,uuid,text,uuid) to service_role;
grant execute on function public.school_fee_issue_invoice(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.school_fee_issue_class_invoices(uuid,uuid,uuid) to service_role;
grant execute on function public.school_fee_submit_payment(uuid,uuid,bigint,text,text,date,text,uuid) to service_role;
grant execute on function public.school_fee_post_payment(uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.school_fee_reject_payment(uuid,uuid,text,uuid) to service_role;
grant execute on function public.school_fee_reverse_payment(uuid,uuid,text,uuid) to service_role;
grant execute on function public.school_fee_approve_credit(uuid,uuid,bigint,text,uuid) to service_role;
grant execute on function public.school_fee_cancel_invoice(uuid,uuid,text,uuid) to service_role;
grant execute on function public.school_finance_summary(uuid,uuid) to service_role;
