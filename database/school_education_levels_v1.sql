-- Education levels: every school chooses which levels it offers (nursery, primary, secondary,
-- TVET, university). Each class belongs to one level. Level-specific tools (for example the
-- early-years observation report) only appear and only accept data for classes of that level.

create table if not exists public.school_education_levels(
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 level text not null check(level in ('nursery','primary','secondary','tvet','university')),
 enabled boolean not null default true,
 updated_by uuid not null references auth.users(id) on delete restrict,
 updated_at timestamptz not null default now(),
 primary key(school_id,level)
);
alter table public.school_education_levels enable row level security;
revoke all on public.school_education_levels from public,anon,authenticated;
grant all on public.school_education_levels to service_role;

alter table public.school_classes add column if not exists level_band text;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='school_classes_level_band_chk') then
  alter table public.school_classes add constraint school_classes_level_band_chk
   check(level_band is null or level_band in ('nursery','primary','secondary','tvet','university'));
 end if;
end $$;

-- Backfill existing classes from their free-text level and name (one time; new classes choose explicitly).
update public.school_classes set level_band=case
  when (level||' '||name) ~* '(nurser|pre-?primary|kindergarten|early years|\mN[123]\M)' then 'nursery'
  when (level||' '||name) ~* '(primary|\mP[1-6]\M)' then 'primary'
  when (level||' '||name) ~* '(secondary|senior|\mS[1-6]\M|o-?level|a-?level)' then 'secondary'
  when (level||' '||name) ~* '(tvet|technical|vocational)' then 'tvet'
  when (level||' '||name) ~* '(university|college|year [1-6]|bachelor|diploma)' then 'university'
  else null end
where level_band is null;

-- Each school offers the levels its existing classes already use.
insert into public.school_education_levels(school_id,level,enabled,updated_by)
select distinct c.school_id,c.level_band,true,m.auth_user_id
from public.school_classes c
join lateral (select auth_user_id from public.school_memberships
  where school_id=c.school_id and role='school_owner' and active order by auth_user_id limit 1) m on true
where c.level_band is not null
on conflict do nothing;

create or replace function public.school_set_education_levels(
 p_school uuid,p_levels text[],p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare lv text;
begin
 if not exists(select 1 from public.school_memberships m join public.platform_schools s on s.id=m.school_id
   where m.school_id=p_school and m.auth_user_id=p_actor and m.role='school_owner' and m.active and s.status='active')
 then raise exception 'Only the school owner can choose the levels the school offers'; end if;
 if p_levels is null or cardinality(p_levels)=0
   or not (p_levels <@ array['nursery','primary','secondary','tvet','university']::text[])
 then raise exception 'Choose at least one valid level'; end if;
 for lv in select unnest(array['nursery','primary','secondary','tvet','university']) loop
  if not (lv=any(p_levels)) and exists(select 1 from public.school_classes
     where school_id=p_school and level_band=lv and status='active')
  then raise exception 'Level % still has active classes; deactivate them first',lv; end if;
  insert into public.school_education_levels(school_id,level,enabled,updated_by,updated_at)
  values(p_school,lv,lv=any(p_levels),p_actor,now())
  on conflict(school_id,level) do update set enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=now();
 end loop;
 insert into public.school_admin_audit(school_id,actor_id,event,metadata)
 values(p_school,p_actor,'education_levels.updated',jsonb_build_object('levels',p_levels));
 return jsonb_build_object('levels',p_levels);
end $$;
revoke all on function public.school_set_education_levels(uuid,text[],uuid) from public,anon,authenticated;
grant execute on function public.school_set_education_levels(uuid,text[],uuid) to service_role;

-- A class may only use a level the school offers.
create or replace function public.school_classes_level_guard() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if new.level_band is not null and not exists(select 1 from public.school_education_levels
   where school_id=new.school_id and level=new.level_band and enabled)
 then raise exception 'This school does not offer the % level; enable it first',new.level_band; end if;
 return new;
end $$;
drop trigger if exists school_classes_level_guard on public.school_classes;
create trigger school_classes_level_guard before insert or update of level_band on public.school_classes
 for each row execute function public.school_classes_level_guard();

-- Early-years observations and reports only for classes at the nursery level.
create or replace function public.school_nursery_class_guard() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if not exists(select 1 from public.school_classes where school_id=new.school_id and id=new.class_id and level_band='nursery')
 then raise exception 'Early years observations and reports apply only to nursery classes'; end if;
 return new;
end $$;
drop trigger if exists school_nursery_observations_class_guard on public.school_nursery_observations;
create trigger school_nursery_observations_class_guard before insert or update of class_id on public.school_nursery_observations
 for each row execute function public.school_nursery_class_guard();
drop trigger if exists school_nursery_reports_class_guard on public.school_nursery_reports;
create trigger school_nursery_reports_class_guard before insert or update of class_id on public.school_nursery_reports
 for each row execute function public.school_nursery_class_guard();

-- Register the new tenant table with the purge manifest (read live, extended, never replaced from memory).
do $$
declare current_list text[]; merged text; want text[]:=array['school_education_levels'];
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
