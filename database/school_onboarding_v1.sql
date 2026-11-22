-- School onboarding V1. GIT-HUB SOURCE ONLY, no direct changes to APEX.
-- This SQL must follow the platform_owner_console.sql migration in staging.
-- Public schema tables are private (service-role server access only).

create table if not exists public.school_owner_invites (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.platform_schools(id) on delete restrict,
  email text not null,
  status text not null default 'pending' check(status in ('pending','claimed','revoked')),
  invited_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id) on delete restrict,
  unique(school_id,email)
);
create index if not exists school_owner_invites_email_idx on public.school_owner_invites(lower(email));

create table if not exists public.school_memberships (
  school_id uuid not null references public.platform_schools(id) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check(role in ('school_owner','school_admin')),
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key(school_id,auth_user_id)
);
create index if not exists school_memberships_user_idx on public.school_memberships(auth_user_id);

create table if not exists public.school_onboarding (
  school_id uuid primary key references public.platform_schools(id) on delete restrict,
  current_step smallint not null default 1 check(current_step between 1 and 5),
  school_type text not null default 'primary'
    check(school_type in ('nursery','primary','secondary','tvet','university','mixed')),
  education_levels text[] not null default array[]::text[],
  province text not null default '',
  district text not null default '',
  campus_name text not null default '',
  academic_year text not null default '',
  term_system text not null default 'terms'
    check(term_system in ('terms','semesters','continuous')),
  privacy_acknowledged boolean not null default false,
  review_requested_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

do $$
declare t text;
begin
 foreach t in array array['school_owner_invites','school_memberships','school_onboarding'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on table public.%I from public,anon,authenticated',t);
   execute format('grant all on table public.%I to service_role',t);
 end loop;
end $$;

-- Backfill approved invitations for schools registered before this migration.
insert into public.school_owner_invites(school_id,email)
 select id,lower(trim(owner_email)) from public.platform_schools
 where owner_email is not null and position('@' in owner_email)>1
 on conflict(school_id,email) do nothing;

-- New school registration creates a pending owner invitation automatically.
create or replace function public.school_invite_owner_on_insert()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public
as $$
begin
 insert into public.school_owner_invites(school_id,email)
 values(new.id,lower(trim(new.owner_email)))
 on conflict(school_id,email) do nothing;
 insert into public.school_onboarding(school_id)
 values(new.id)
 on conflict(school_id) do nothing;
 return new;
end;
$$;
drop trigger if exists school_after_create_invite on public.platform_schools;
create trigger school_after_create_invite after insert on public.platform_schools
 for each row execute function public.school_invite_owner_on_insert();

-- Ensure older schools have a draft even if no subsequent INSERT takes place.
insert into public.school_onboarding(school_id)
 select id from public.platform_schools on conflict(school_id) do nothing;

-- Claim is idempotent and bound to an email-CONFIRMED Auth identity, already
-- verified using Supabase Auth getUser on the server. An arbitrary user-chosen
-- school ID or role cannot grant membership.
create or replace function public.school_claim_owner_invitation(
 p_school_id uuid,p_auth_user_id uuid,p_verified_email text
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public
as $$
declare invitation public.school_owner_invites%rowtype;
  school_status text;
begin
 if p_school_id is null or p_auth_user_id is null or p_verified_email is null then
    raise exception 'Missing verified invitation data';
 end if;
 select status into school_status from public.platform_schools where id=p_school_id for update;
 if school_status not in ('onboarding','active') then raise exception 'School access unavailable'; end if;
 select * into invitation from public.school_owner_invites
 where school_id=p_school_id and email=lower(trim(p_verified_email)) for update;
 if not found or invitation.status='revoked' then raise exception 'No authorized invitation';
 end if;
 if invitation.status <> 'pending' then
   raise exception 'Invitation is no longer pending; request a new approval';
 end if;
 insert into public.school_memberships(school_id,auth_user_id,role,active)
 values(p_school_id,p_auth_user_id,'school_owner',true)
 on conflict(school_id,auth_user_id) do update set active=true
   where public.school_memberships.role='school_owner';
 update public.school_owner_invites set status='claimed',claimed_at=now(),claimed_by=p_auth_user_id
 where id=invitation.id and status='pending';
 insert into public.platform_audit(actor_id,event,resource_id,metadata)
 values(p_auth_user_id,'school.owner_invitation_claimed',p_school_id,
  jsonb_build_object('invite_id',invitation.id));
 return jsonb_build_object('school_id',p_school_id,'role','school_owner');
end;
$$;

-- Privileged server RPC only (not callable directly with anon/auth JWT).
revoke all on function public.school_claim_owner_invitation(uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.school_claim_owner_invitation(uuid,uuid,text) to service_role;

-- School owner can request review but cannot activate tenant or change platform billing.
-- Human platform operator still controls activate/pause/suspend transitions.
