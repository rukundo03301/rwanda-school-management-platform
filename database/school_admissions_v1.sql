-- Module 3: admission applications, approved enrollment and verified families.
-- Sensitive child records: service_role-only server API + school-specific membership.
-- Migration AFTER platform_owner_console, school_onboarding, school_administration.
-- This is GitHub source, not a direct production database change.

create sequence if not exists public.school_admission_code_seq;
create sequence if not exists public.school_student_code_seq;
revoke all on sequence public.school_admission_code_seq from public,anon,authenticated;
revoke all on sequence public.school_student_code_seq from public,anon,authenticated;
grant usage,select on sequence public.school_admission_code_seq to service_role;
grant usage,select on sequence public.school_student_code_seq to service_role;

create table if not exists public.school_admissions_permissions (
  school_id uuid not null references public.platform_schools(id) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  role text not null default 'school_admin' check(role='school_admin'),
  permissions text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key(school_id,auth_user_id),
  foreign key(school_id,auth_user_id,role)
    references public.school_memberships(school_id,auth_user_id,role) on delete restrict,
  check(permissions <@ array['admissions.read','admissions.manage',
    'enrollments.manage','guardians.manage']::text[])
);

create table if not exists public.school_admission_applications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.platform_schools(id) on delete restrict,
  application_code text not null unique
    default ('APP-'||lpad(nextval('public.school_admission_code_seq'::regclass)::text,8,'0')),
  first_name text not null check(length(btrim(first_name)) between 1 and 90),
  last_name text not null check(length(btrim(last_name)) between 1 and 90),
  date_of_birth date,
  academic_year_id uuid not null,
  status text not null default 'submitted'
    check(status in ('submitted','under_review','admitted','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  unique(school_id,id),
  foreign key(school_id,academic_year_id)
    references public.school_academic_years(school_id,id) on delete restrict,
  check(date_of_birth is null or date_of_birth between date '1900-01-01'
    and date '2100-12-31')
);
create index if not exists school_applications_school_status_idx
  on public.school_admission_applications(school_id,status,submitted_at desc);

create table if not exists public.school_students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.platform_schools(id) on delete restrict,
  student_code text not null unique
    default ('STU-'||lpad(nextval('public.school_student_code_seq'::regclass)::text,8,'0')),
  first_name text not null check(length(btrim(first_name)) between 1 and 90),
  last_name text not null check(length(btrim(last_name)) between 1 and 90),
  date_of_birth date,
  source_application_id uuid not null,
  status text not null default 'active' check(status in ('active','inactive')),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  unique(school_id,id),
  unique(school_id,source_application_id),
  foreign key(school_id,source_application_id)
    references public.school_admission_applications(school_id,id) on delete restrict
);
create index if not exists school_students_school_idx on public.school_students(school_id,student_code);

-- Composite key includes academic_year_id to ensure class is of the SAME
-- academic year as the enrollment. No cross-campus/student record mixing.
alter table public.school_classes
  add constraint school_classes_scoped_year_ref unique(school_id,id,academic_year_id);

create table if not exists public.school_student_enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.platform_schools(id) on delete restrict,
  student_id uuid not null,
  academic_year_id uuid not null,
  class_id uuid not null,
  status text not null default 'active'
    check(status in ('active','withdrawn')),
  enrolled_at timestamptz not null default now(),
  enrolled_by uuid not null references auth.users(id) on delete restrict,
  unique(school_id,student_id,academic_year_id),
  unique(school_id,id),
  foreign key(school_id,student_id)
    references public.school_students(school_id,id) on delete restrict,
  foreign key(school_id,class_id,academic_year_id)
    references public.school_classes(school_id,id,academic_year_id) on delete restrict
);
create index if not exists school_enrollments_class_idx
  on public.school_student_enrollments(school_id,class_id,status);

create table if not exists public.school_guardian_invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.platform_schools(id) on delete restrict,
  student_id uuid not null,
  email text not null check(email=lower(btrim(email)) and length(email) between 5 and 254),
  relationship text not null check(relationship in ('parent','legal_guardian')),
  verification_attested boolean not null default false check(verification_attested=true),
  status text not null default 'pending'
    check(status in ('pending','claimed','revoked')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  invited_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '14 days'),
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id) on delete restrict,
  unique(school_id,student_id,email),
  foreign key(school_id,student_id)
    references public.school_students(school_id,id) on delete restrict
);
create index if not exists school_guardian_invite_email_idx
  on public.school_guardian_invitations(school_id,email,status);

create table if not exists public.school_guardian_links (
  school_id uuid not null references public.platform_schools(id) on delete restrict,
  student_id uuid not null,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  relationship text not null check(relationship in ('parent','legal_guardian')),
  active boolean not null default true,
  verified_by uuid not null references auth.users(id) on delete restrict,
  verified_at timestamptz not null default now(),
  primary key(school_id,student_id,auth_user_id),
  foreign key(school_id,student_id)
    references public.school_students(school_id,id) on delete restrict
);
create index if not exists school_guardian_links_user_idx
  on public.school_guardian_links(auth_user_id,school_id,active);

create table if not exists public.school_admissions_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.platform_schools(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  event text not null check(length(event) between 3 and 120),
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists school_admissions_audit_school_idx
  on public.school_admissions_audit(school_id,created_at desc);

do $$
declare tbl text;
begin
 foreach tbl in array array[
  'school_admissions_permissions','school_admission_applications',
  'school_students','school_student_enrollments','school_guardian_invitations',
  'school_guardian_links','school_admissions_audit'
 ] loop
   execute format('alter table public.%I enable row level security',tbl);
   execute format('revoke all on table public.%I from public,anon,authenticated',tbl);
   execute format('grant all on table public.%I to service_role',tbl);
 end loop;
end $$;

-- Each security-invoker RPC re-verifies school status and caller membership.
-- The Next.js server verifies an Auth JWT and passes the verified immutable UUID.
create or replace function public.school_admissions_actor_allowed(
 p_school_id uuid,p_actor uuid,p_permission text
) returns boolean language sql stable security invoker
set search_path=pg_catalog,public as $$
 select exists(select 1 from public.platform_schools s
  where s.id=p_school_id and s.status='active')
 and (
  exists(select 1 from public.school_memberships m
   where m.school_id=p_school_id and m.auth_user_id=p_actor
     and m.role='school_owner' and m.active=true)
  or exists(select 1 from public.school_memberships m
    join public.school_admissions_permissions p
      on p.school_id=m.school_id and p.auth_user_id=m.auth_user_id
    where m.school_id=p_school_id and m.auth_user_id=p_actor
      and m.role='school_admin' and m.active=true
      and (p_permission=any(p.permissions)
        or (p_permission='admissions.read' and 'admissions.manage'=any(p.permissions))))
 );
$$;

create or replace function public.school_set_admissions_permissions(
 p_school_id uuid,p_target uuid,p_permissions text[],p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare old_perms text[];
begin
 if p_target=p_actor then raise exception 'Cannot change your own permission'; end if;
 if length(btrim(coalesce(p_reason,'')))<8 then raise exception 'Reason required'; end if;
 if p_permissions is null or not (p_permissions <@ array[
  'admissions.read','admissions.manage','enrollments.manage','guardians.manage'
 ]::text[]) then raise exception 'Unsupported permission'; end if;
 if not exists(select 1 from public.school_memberships m
   join public.platform_schools s on s.id=m.school_id
   where m.school_id=p_school_id and m.auth_user_id=p_actor
     and m.role='school_owner' and m.active and s.status='active')
 then raise exception 'School owner required'; end if;
 if not exists(select 1 from public.school_memberships where school_id=p_school_id
    and auth_user_id=p_target and role='school_admin' and active)
 then raise exception 'Target is not an active school administrator'; end if;
 select permissions into old_perms from public.school_admissions_permissions
   where school_id=p_school_id and auth_user_id=p_target for update;
 insert into public.school_admissions_permissions(school_id,auth_user_id,permissions,updated_by)
 values(p_school_id,p_target,p_permissions,p_actor)
 on conflict(school_id,auth_user_id) do update set permissions=excluded.permissions,
   updated_by=p_actor,updated_at=now();
 insert into public.school_admissions_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school_id,p_actor,'admissions.permissions_updated',p_target,
  jsonb_build_object('old',coalesce(old_perms,'{}'::text[]),
   'new',p_permissions,'reason',p_reason));
 return jsonb_build_object('updated',true,'user_id',p_target);
end;
$$;

-- Status changes are intentional: accept creates student + enrollment
-- atomically; rejection creates no student. Never trust an arbitrary class UUID.
-- New applications are school-created in V1. Public child-data signup stays disabled
-- until we have verified family identity, consent and privacy notice handling.
create or replace function public.school_submit_admission(
 p_school_id uuid,p_first text,p_last text,p_dob date,p_year_id uuid,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare new_row public.school_admission_applications%rowtype;
begin
 if not public.school_admissions_actor_allowed(p_school_id,p_actor,'admissions.manage')
  then raise exception 'Admissions management permission required'; end if;
 if length(btrim(coalesce(p_first,''))) not between 1 and 90
    or length(btrim(coalesce(p_last,''))) not between 1 and 90
  then raise exception 'Student name is invalid'; end if;
 if p_dob is not null and (p_dob>current_date or p_dob<date '1900-01-01')
  then raise exception 'Student birth date invalid'; end if;
 if not exists(select 1 from public.school_academic_years
   where school_id=p_school_id and id=p_year_id and status<>'closed')
  then raise exception 'Choose an active or planned year of this school'; end if;
 insert into public.school_admission_applications(
  school_id,first_name,last_name,date_of_birth,academic_year_id,created_by)
 values(p_school_id,btrim(p_first),btrim(p_last),p_dob,p_year_id,p_actor)
 returning * into new_row;
 insert into public.school_admissions_audit(school_id,actor_id,event,resource_id)
 values(p_school_id,p_actor,'application.submitted',new_row.id);
 return jsonb_build_object('id',new_row.id,'application_code',new_row.application_code,
  'status','submitted');
end;
$$;

create or replace function public.school_review_admission(
 p_school_id uuid,p_application_id uuid,p_class_id uuid,
 p_decision text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare application_row public.school_admission_applications%rowtype;
        class_row public.school_classes%rowtype;
        current_count integer;
        new_student public.school_students%rowtype;
begin
 if not public.school_admissions_actor_allowed(p_school_id,p_actor,'admissions.manage')
  or (p_decision='admit' and not public.school_admissions_actor_allowed(
    p_school_id,p_actor,'enrollments.manage'))
 then raise exception 'Admission management permission required'; end if;
 if p_decision not in ('admit','reject','under_review') then
   raise exception 'Invalid admission decision'; end if;
 select * into application_row from public.school_admission_applications
   where school_id=p_school_id and id=p_application_id for update;
 if not found or application_row.status not in ('submitted','under_review')
   then raise exception 'Application is no longer reviewable'; end if;
 if p_decision='under_review' then
   update public.school_admission_applications set status='under_review',
     reviewed_by=p_actor,reviewed_at=now()
   where id=application_row.id;
   insert into public.school_admissions_audit(school_id,actor_id,event,resource_id)
    values(p_school_id,p_actor,'application.review_started',p_application_id);
   return jsonb_build_object('status','under_review','application_id',p_application_id);
 end if;
 if p_decision='reject' then
   update public.school_admission_applications
     set status='rejected',reviewed_by=p_actor,reviewed_at=now()
     where id=application_row.id;
   insert into public.school_admissions_audit(school_id,actor_id,event,resource_id)
    values(p_school_id,p_actor,'application.rejected',p_application_id);
   return jsonb_build_object('status','rejected','application_id',p_application_id);
 end if;
 -- Capacity check serializes acceptance for a class to avoid overbooking.
 select * into class_row from public.school_classes
   where school_id=p_school_id and id=p_class_id
   and academic_year_id=application_row.academic_year_id
   and status='active' for update;
 if not found then raise exception 'Select a class in the same academic year and school'; end if;
 if class_row.capacity is not null then
   select count(*) into current_count from public.school_student_enrollments
    where school_id=p_school_id and class_id=p_class_id and status='active';
   if current_count>=class_row.capacity then raise exception 'Class is already at capacity'; end if;
 end if;
 insert into public.school_students(school_id,first_name,last_name,date_of_birth,
   source_application_id,created_by)
 values(p_school_id,application_row.first_name,application_row.last_name,
   application_row.date_of_birth,application_row.id,p_actor)
 returning * into new_student;
 insert into public.school_student_enrollments(
  school_id,student_id,academic_year_id,class_id,enrolled_by)
 values(p_school_id,new_student.id,application_row.academic_year_id,p_class_id,p_actor);
 update public.school_admission_applications set
   status='admitted',reviewed_by=p_actor,reviewed_at=now()
 where id=application_row.id;
 insert into public.school_admissions_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school_id,p_actor,'application.admitted',application_row.id,
  jsonb_build_object('student_id',new_student.id,'class_id',class_row.id));
 return jsonb_build_object('status','admitted','application_id',application_row.id,
   'student_id',new_student.id,'student_code',new_student.student_code);
end;
$$;

create or replace function public.school_invite_guardian(
 p_school_id uuid,p_student_id uuid,p_email text,p_relationship text,
 p_attested boolean,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare normalized_email text; inv_id uuid;
begin
 if not public.school_admissions_actor_allowed(p_school_id,p_actor,'guardians.manage')
   then raise exception 'Guardian management not allowed'; end if;
 if p_attested is distinct from true then
   raise exception 'A staff member must confirm they verified the real guardian relationship'; end if;
 if p_relationship not in ('parent','legal_guardian')
   then raise exception 'Invalid family relationship'; end if;
 normalized_email:=lower(btrim(coalesce(p_email,'')));
 if normalized_email not like '%_@_%._%' or length(normalized_email)>254
   then raise exception 'Invalid email'; end if;
 if not exists(select 1 from public.school_students where
    school_id=p_school_id and id=p_student_id and status='active')
 then raise exception 'Student does not exist in this school'; end if;
 if exists(select 1 from public.school_guardian_invitations
   where school_id=p_school_id and student_id=p_student_id
    and email=normalized_email and status='claimed')
 then raise exception 'This guardian invitation is already claimed'; end if;
 insert into public.school_guardian_invitations(
   school_id,student_id,email,relationship,verification_attested,invited_by)
 values(p_school_id,p_student_id,normalized_email,p_relationship,true,p_actor)
 on conflict(school_id,student_id,email) do update set
   relationship=excluded.relationship,verification_attested=true,
   status='pending',invited_by=p_actor,invited_at=now(),
   expires_at=now()+interval '14 days',claimed_by=null,claimed_at=null
 returning id into inv_id;
 insert into public.school_admissions_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school_id,p_actor,'guardian.invitation_created',p_student_id,
  jsonb_build_object('invitation_id',inv_id,'relationship',p_relationship,
   'verified_offline',true));
 return jsonb_build_object('invitation_id',inv_id,'student_id',p_student_id);
end;
$$;

-- Guardian sees no child identity until both the school verifies relationship
-- and the matching confirmed-email recipient explicitly claims the invitation.
create or replace function public.school_claim_guardian_invitation(
 p_school_id uuid,p_student_id uuid,p_auth_user_id uuid,p_verified_email text
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare inv public.school_guardian_invitations%rowtype;
begin
 if not exists(select 1 from public.platform_schools
   where id=p_school_id and status='active') then raise exception 'School unavailable'; end if;
 if not exists(select 1 from auth.users where id=p_auth_user_id
    and lower(email)=lower(btrim(p_verified_email))
    and email_confirmed_at is not null)
 then raise exception 'Confirmed matching account required'; end if;
 select * into inv from public.school_guardian_invitations
   where school_id=p_school_id and student_id=p_student_id
     and email=lower(btrim(p_verified_email)) for update;
 if not found or inv.status<>'pending' or not inv.verification_attested or inv.expires_at<=now()
 then raise exception 'No current verified guardian invitation'; end if;
 if not exists(select 1 from public.school_students where id=inv.student_id
   and school_id=p_school_id and status='active') then raise exception 'Student unavailable'; end if;
 insert into public.school_guardian_links(
   school_id,student_id,auth_user_id,relationship,active,verified_by)
 values(p_school_id,p_student_id,p_auth_user_id,inv.relationship,true,inv.invited_by)
 on conflict(school_id,student_id,auth_user_id) do update set
   active=true,relationship=excluded.relationship,
   verified_by=excluded.verified_by,verified_at=now();
 insert into public.school_memberships(school_id,auth_user_id,role,active)
 values(p_school_id,p_auth_user_id,'parent',true)
 on conflict(school_id,auth_user_id,role) do update set active=true;
 update public.school_guardian_invitations
   set status='claimed',claimed_by=p_auth_user_id,claimed_at=now()
 where id=inv.id;
 insert into public.school_admissions_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school_id,p_auth_user_id,'guardian.invitation_claimed',inv.student_id,
  jsonb_build_object('invitation_id',inv.id));
 return jsonb_build_object('claimed',true,'student_id',inv.student_id,'role','parent');
end;
$$;

create or replace function public.school_revoke_guardian(
 p_school_id uuid,p_student_id uuid,p_guardian_user_id uuid,
 p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare guardian_email text;
begin
 if not public.school_admissions_actor_allowed(p_school_id,p_actor,'guardians.manage')
   then raise exception 'Guardian management permission required'; end if;
 if length(btrim(coalesce(p_reason,'')))<8 then raise exception 'Revoke reason required'; end if;
 update public.school_guardian_links set active=false
   where school_id=p_school_id and student_id=p_student_id
     and auth_user_id=p_guardian_user_id and active;
 if not found then raise exception 'Verified guardian link not found'; end if;
 select lower(email) into guardian_email from auth.users where id=p_guardian_user_id;
 update public.school_guardian_invitations set status='revoked'
   where school_id=p_school_id and student_id=p_student_id
     and email=guardian_email;
 if not exists(select 1 from public.school_guardian_links where
   school_id=p_school_id and auth_user_id=p_guardian_user_id and active)
 then
   update public.school_memberships set active=false
     where school_id=p_school_id and auth_user_id=p_guardian_user_id and role='parent';
 end if;
 insert into public.school_admissions_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school_id,p_actor,'guardian.link_revoked',p_student_id,
   jsonb_build_object('guardian_user_id',p_guardian_user_id,'reason',p_reason));
 return jsonb_build_object('revoked',true);
end;
$$;

revoke all on function public.school_admissions_actor_allowed(uuid,uuid,text)
  from public,anon,authenticated;
revoke all on function public.school_set_admissions_permissions(uuid,uuid,text[],text,uuid)
  from public,anon,authenticated;
revoke all on function public.school_submit_admission(uuid,text,text,date,uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.school_review_admission(uuid,uuid,uuid,text,uuid)
  from public,anon,authenticated;
revoke all on function public.school_invite_guardian(uuid,uuid,text,text,boolean,uuid)
  from public,anon,authenticated;
revoke all on function public.school_claim_guardian_invitation(uuid,uuid,uuid,text)
  from public,anon,authenticated;
revoke all on function public.school_revoke_guardian(uuid,uuid,uuid,text,uuid)
  from public,anon,authenticated;
grant execute on function public.school_admissions_actor_allowed(uuid,uuid,text)
  to service_role;
grant execute on function public.school_set_admissions_permissions(uuid,uuid,text[],text,uuid)
  to service_role;
grant execute on function public.school_submit_admission(uuid,text,text,date,uuid,uuid)
  to service_role;
grant execute on function public.school_review_admission(uuid,uuid,uuid,text,uuid)
  to service_role;
grant execute on function public.school_invite_guardian(uuid,uuid,text,text,boolean,uuid)
  to service_role;
grant execute on function public.school_claim_guardian_invitation(uuid,uuid,uuid,text)
  to service_role;
grant execute on function public.school_revoke_guardian(uuid,uuid,uuid,text,uuid)
  to service_role;
