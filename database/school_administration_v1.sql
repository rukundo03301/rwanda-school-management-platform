-- Module 2: School Administration and Academic Structure
-- GitHub-first SQL source. Apply AFTER platform_owner_console.sql and school_onboarding_v1.sql.
-- Do not execute directly against APEX. No student/guardian/grade/fee data in this module.

create table if not exists public.school_admin_permissions (
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 auth_user_id uuid not null references auth.users(id) on delete restrict,
 role text not null default 'school_admin' check (role='school_admin'),
 permissions text[] not null default '{}'::text[],
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 primary key(school_id,auth_user_id),
 foreign key(school_id,auth_user_id,role)
   references public.school_memberships(school_id,auth_user_id,role) on delete restrict,
 check (permissions <@ array[
   'people.read','people.invite','people.manage',
   'academics.read','academics.manage','audit.read'
 ]::text[])
);
create index if not exists school_admin_permissions_user_idx on public.school_admin_permissions(auth_user_id);

create table if not exists public.school_role_invites (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 email text not null,
 role text not null check(role in ('school_admin','teacher','staff')),
 permissions text[] not null default '{}'::text[],
 status text not null default 'pending'
   check(status in ('pending','claimed','revoked')),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '14 days'),
 claimed_by uuid references auth.users(id) on delete restrict,
 claimed_at timestamptz,
 unique(school_id,email,role),
 check(email=lower(btrim(email)) and length(email) between 5 and 254),
 check(permissions <@ array[
   'people.read','people.invite','people.manage',
   'academics.read','academics.manage','audit.read'
 ]::text[]),
 check((role='school_admin') or cardinality(permissions)=0)
);
create index if not exists school_role_invites_school_status_idx
  on public.school_role_invites(school_id,status,expires_at);

create table if not exists public.school_academic_years (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 name text not null check(length(btrim(name)) between 3 and 40),
 starts_on date not null,
 ends_on date not null,
 status text not null default 'planned' check(status in ('planned','current','closed')),
 created_at timestamptz not null default now(),
 created_by uuid references auth.users(id) on delete set null,
 unique(school_id,name),
 unique(school_id,id),
 check(ends_on>=starts_on)
);
create unique index if not exists school_one_current_year_idx
 on public.school_academic_years(school_id) where status='current';

create table if not exists public.school_classes (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 academic_year_id uuid not null,
 name text not null check(length(btrim(name)) between 1 and 100),
 level text not null check(length(btrim(level)) between 1 and 100),
 section text not null default '' check(length(section)<=50),
 capacity integer check(capacity is null or capacity between 1 and 2000),
 status text not null default 'active' check(status in ('active','inactive')),
 created_at timestamptz not null default now(),
 created_by uuid references auth.users(id) on delete set null,
 unique(school_id,academic_year_id,name,section),
 unique(school_id,id),
 foreign key(school_id,academic_year_id)
   references public.school_academic_years(school_id,id) on delete restrict
);
create index if not exists school_classes_year_idx
 on public.school_classes(school_id,academic_year_id);

create table if not exists public.school_subjects (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 code text not null check(length(btrim(code)) between 2 and 20),
 name text not null check(length(btrim(name)) between 2 and 100),
 created_at timestamptz not null default now(),
 created_by uuid references auth.users(id) on delete set null,
 unique(school_id,code),
 unique(school_id,id)
);

create table if not exists public.school_class_subjects (
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 class_id uuid not null,
 subject_id uuid not null,
 created_at timestamptz not null default now(),
 created_by uuid references auth.users(id) on delete set null,
 primary key(school_id,class_id,subject_id),
 foreign key(school_id,class_id)
   references public.school_classes(school_id,id) on delete restrict,
 foreign key(school_id,subject_id)
   references public.school_subjects(school_id,id) on delete restrict
);

create table if not exists public.school_admin_audit (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 event text not null check(length(event) between 3 and 120),
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists school_admin_audit_school_date_idx
 on public.school_admin_audit(school_id,created_at desc);

do $$
declare t text;
begin
 foreach t in array array[
   'school_admin_permissions','school_role_invites','school_academic_years',
   'school_classes','school_subjects','school_class_subjects','school_admin_audit'
 ] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on table public.%I from public,anon,authenticated',t);
   execute format('grant all on table public.%I to service_role',t);
 end loop;
end $$;

-- Private server role only. These SQL functions re-check school membership
-- in the same DB transaction, and reject permission changes by lesser roles.
create or replace function public.school_invite_member(
 p_school_id uuid,p_email text,p_role text,p_permissions text[],p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare is_owner boolean;
        may_invite boolean;
        normalized_email text;
        invite_id uuid;
begin
 if p_role not in ('school_admin','teacher','staff') then
   raise exception 'Unsupported invitation role';
 end if;
 if p_school_id is null or p_actor is null then raise exception 'Missing school or actor'; end if;
 normalized_email:=lower(btrim(coalesce(p_email,'')));
 if normalized_email not like '%_@_%._%' or length(normalized_email)>254 then
   raise exception 'Invalid email';
 end if;
 if p_permissions is null or not (p_permissions <@ array[
   'people.read','people.invite','people.manage','academics.read','academics.manage','audit.read'
 ]::text[]) then raise exception 'Unrecognized permission'; end if;
 if p_role<>'school_admin' and cardinality(p_permissions)>0 then
   raise exception 'Only administrator permissions are configurable in this module';
 end if;
 if not exists(select 1 from public.platform_schools
   where id=p_school_id and status='active') then raise exception 'School is not active'; end if;
 select exists(select 1 from public.school_memberships
   where school_id=p_school_id and auth_user_id=p_actor and role='school_owner' and active)
   into is_owner;
 select exists(select 1 from public.school_memberships m
   join public.school_admin_permissions perms on perms.school_id=m.school_id
     and perms.auth_user_id=m.auth_user_id
   where m.school_id=p_school_id and m.auth_user_id=p_actor
     and m.role='school_admin' and m.active
     and 'people.invite'=any(perms.permissions))
   into may_invite;
 if not is_owner and not may_invite then raise exception 'Not authorized to invite staff'; end if;
 if p_role='school_admin' and not is_owner then raise exception 'Only school owner may invite administrators'; end if;
 if exists(select 1 from public.school_role_invites
   where school_id=p_school_id and email=normalized_email and role=p_role and status='claimed')
 then raise exception 'An invitation is already claimed'; end if;
 insert into public.school_role_invites(
   school_id,email,role,permissions,created_by,created_at,expires_at,status,claimed_by,claimed_at)
 values(p_school_id,normalized_email,p_role,p_permissions,p_actor,now(),now()+interval '14 days','pending',null,null)
 on conflict(school_id,email,role) do update set
  permissions=excluded.permissions,created_by=excluded.created_by,
  created_at=now(),expires_at=excluded.expires_at,status='pending',claimed_by=null,claimed_at=null
 returning id into invite_id;
 insert into public.school_admin_audit(school_id,actor_id,event,metadata)
  values(p_school_id,p_actor,'member.invitation_created',
    jsonb_build_object('invite_id',invite_id,'role',p_role,'email',normalized_email));
 return jsonb_build_object('invite_id',invite_id,'role',p_role,
   'expires_on',(now()+interval '14 days')::date);
end;
$$;

create or replace function public.school_claim_member_invite(
 p_school_id uuid,p_auth_user_id uuid,p_verified_email text,p_role text
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare inv public.school_role_invites%rowtype;
begin
 if p_role not in ('school_admin','teacher','staff') or p_auth_user_id is null then
   raise exception 'Invalid invitation request';
 end if;
 if not exists(select 1 from public.platform_schools where id=p_school_id and status='active')
   then raise exception 'School unavailable'; end if;
 if not exists(select 1 from auth.users where id=p_auth_user_id
     and lower(email)=lower(btrim(p_verified_email)) and email_confirmed_at is not null)
   then raise exception 'Email identity is not verified'; end if;
 select * into inv from public.school_role_invites
  where school_id=p_school_id and email=lower(btrim(p_verified_email))
    and role=p_role for update;
 if not found or inv.status<>'pending' or inv.expires_at<=now() then
   raise exception 'No valid pending invitation';
 end if;
 insert into public.school_memberships(school_id,auth_user_id,role,active)
  values(p_school_id,p_auth_user_id,p_role,true)
  on conflict(school_id,auth_user_id,role) do update set active=true;
 if p_role='school_admin' then
   insert into public.school_admin_permissions(
    school_id,auth_user_id,role,permissions,updated_by)
   values(p_school_id,p_auth_user_id,'school_admin',inv.permissions,inv.created_by)
   on conflict(school_id,auth_user_id) do update set
     permissions=excluded.permissions,updated_by=excluded.updated_by,updated_at=now();
 end if;
 update public.school_role_invites set status='claimed',claimed_at=now(),claimed_by=p_auth_user_id
   where id=inv.id;
 insert into public.school_admin_audit(school_id,actor_id,event,metadata)
   values(p_school_id,p_auth_user_id,'member.invitation_claimed',
     jsonb_build_object('role',p_role,'invite_id',inv.id));
 return jsonb_build_object('school_id',p_school_id,'role',p_role,'claimed',true);
end;
$$;

create or replace function public.school_set_admin_permissions(
 p_school_id uuid,p_target uuid,p_permissions text[],p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare before_perms text[];
begin
 if p_actor=p_target then raise exception 'Cannot change your own permissions'; end if;
 if length(btrim(coalesce(p_reason,'')))<8 then raise exception 'Reason required'; end if;
 if p_permissions is null or not (p_permissions <@ array[
   'people.read','people.invite','people.manage','academics.read','academics.manage','audit.read'
 ]::text[]) then raise exception 'Unsupported permissions'; end if;
 if not exists(select 1 from public.platform_schools where id=p_school_id and status='active')
    then raise exception 'School is not active'; end if;
 if not exists(select 1 from public.school_memberships where school_id=p_school_id
   and auth_user_id=p_actor and role='school_owner' and active)
   then raise exception 'Only the school owner may update admin permissions'; end if;
 if not exists(select 1 from public.school_memberships where school_id=p_school_id
   and auth_user_id=p_target and role='school_admin' and active)
   then raise exception 'Target is not an active administrator'; end if;
 select permissions into before_perms from public.school_admin_permissions
    where school_id=p_school_id and auth_user_id=p_target for update;
 insert into public.school_admin_permissions(school_id,auth_user_id,permissions,updated_by)
    values(p_school_id,p_target,p_permissions,p_actor)
    on conflict(school_id,auth_user_id) do update set
      permissions=excluded.permissions,updated_by=p_actor,updated_at=now();
 insert into public.school_admin_audit(school_id,actor_id,event,metadata)
   values(p_school_id,p_actor,'admin.permissions_changed',
     jsonb_build_object('target_user',p_target,'before',coalesce(before_perms,'{}'::text[]),
       'after',p_permissions,'reason',p_reason));
 return jsonb_build_object('target_user',p_target,'updated',true);
end;
$$;

create or replace function public.school_revoke_member(
 p_school_id uuid,p_target uuid,p_role text,p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare is_owner boolean;
        may_manage boolean;
        target_email text;
begin
 if p_role not in ('school_admin','teacher','staff') then raise exception 'Cannot revoke this role here'; end if;
 if p_actor=p_target then raise exception 'Cannot revoke your own membership'; end if;
 if length(btrim(coalesce(p_reason,'')))<8 then raise exception 'Reason required'; end if;
 if not exists(select 1 from public.platform_schools where id=p_school_id and status='active')
   then raise exception 'School unavailable'; end if;
 select exists(select 1 from public.school_memberships where school_id=p_school_id
   and auth_user_id=p_actor and role='school_owner' and active) into is_owner;
 select exists(select 1 from public.school_memberships m
   join public.school_admin_permissions p on p.school_id=m.school_id
     and p.auth_user_id=m.auth_user_id
   where m.school_id=p_school_id and m.auth_user_id=p_actor
     and m.role='school_admin' and m.active and 'people.manage'=any(p.permissions))
   into may_manage;
 if not is_owner and not may_manage then raise exception 'Not authorized to revoke members'; end if;
 if p_role='school_admin' and not is_owner then raise exception 'Only school owner can revoke administrator'; end if;
 update public.school_memberships set active=false where school_id=p_school_id
  and auth_user_id=p_target and role=p_role and active;
 if not found then raise exception 'Active membership not found'; end if;
 select lower(email) into target_email from auth.users where id=p_target;
 update public.school_role_invites set status='revoked'
   where school_id=p_school_id and email=target_email and role=p_role;
 insert into public.school_admin_audit(school_id,actor_id,event,metadata)
 values(p_school_id,p_actor,'member.revoked',
   jsonb_build_object('target_user',p_target,'role',p_role,'reason',p_reason));
 return jsonb_build_object('target_user',p_target,'role',p_role,'active',false);
end;
$$;

-- RPCs can only be invoked by trusted app server, which verifies auth identity.
revoke all on function public.school_invite_member(uuid,text,text,text[],uuid)
  from public,anon,authenticated;
revoke all on function public.school_claim_member_invite(uuid,uuid,text,text)
  from public,anon,authenticated;
revoke all on function public.school_set_admin_permissions(uuid,uuid,text[],text,uuid)
  from public,anon,authenticated;
revoke all on function public.school_revoke_member(uuid,uuid,text,text,uuid)
  from public,anon,authenticated;
grant execute on function public.school_invite_member(uuid,text,text,text[],uuid) to service_role;
grant execute on function public.school_claim_member_invite(uuid,uuid,text,text) to service_role;
grant execute on function public.school_set_admin_permissions(uuid,uuid,text[],text,uuid) to service_role;
grant execute on function public.school_revoke_member(uuid,uuid,text,text,uuid) to service_role;
