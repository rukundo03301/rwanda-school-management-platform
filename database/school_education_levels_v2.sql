-- Education levels v2: one source of truth.
-- The levels a school offers are already chosen by the owner in School setup
-- (school_onboarding.education_levels). v1 added a second table for the same fact;
-- this removes it and makes every check read the owner's setup choice instead.

-- 1. A school offers at least the levels its active classes already use.
update public.school_onboarding o set education_levels=(
  select array_agg(l order by array_position(array['nursery','primary','secondary','tvet','university'],l))
  from (select unnest(o.education_levels) l
        union select c.level_band from public.school_classes c
        where c.school_id=o.school_id and c.status='active' and c.level_band is not null) u)
where exists(select 1 from public.school_classes c where c.school_id=o.school_id and c.status='active'
  and c.level_band is not null and not (c.level_band=any(coalesce(o.education_levels,'{}'))));

-- Keep a published homepage in step with the setup choice (same rule as the publish action).
update public.platform_school_sites p set education_levels=o.education_levels,updated_at=now()
from public.school_onboarding o
where o.school_id=p.school_id and p.is_published and p.education_levels is distinct from o.education_levels;

-- 2. A class may only use a level the school offers.
create or replace function public.school_classes_level_guard() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if new.level_band is not null and not exists(select 1 from public.school_onboarding
   where school_id=new.school_id and new.level_band=any(education_levels))
 then raise exception 'This school does not offer the % level; add it in School setup first',new.level_band; end if;
 return new;
end $$;

-- 3. A level cannot be removed while active classes still use it.
create or replace function public.school_onboarding_levels_guard() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare lv text;
begin
 select c.level_band into lv from public.school_classes c
 where c.school_id=new.school_id and c.status='active' and c.level_band is not null
   and not (c.level_band=any(coalesce(new.education_levels,'{}'))) limit 1;
 if lv is not null then
  raise exception 'The % level still has active classes; deactivate them before removing the level',lv;
 end if;
 return new;
end $$;
drop trigger if exists school_onboarding_levels_guard on public.school_onboarding;
create trigger school_onboarding_levels_guard before update of education_levels on public.school_onboarding
 for each row execute function public.school_onboarding_levels_guard();

-- 4. Remove the duplicate table from v1 (manifest first, then the table).
drop function if exists public.school_set_education_levels(uuid,text[],uuid);
do $$
declare current_list text[]; merged text;
begin
 current_list:=public.platform_tenant_scope_manifest();
 if 'school_education_levels'=any(current_list) then
  select 'select array['||string_agg(quote_literal(t),',' order by t)||']::text[]' into merged
  from unnest(current_list) t where t<>'school_education_levels';
  execute 'create or replace function public.platform_tenant_scope_manifest() '||
   'returns text[] language sql immutable security invoker set search_path=pg_catalog,public as '||quote_literal(merged);
 end if;
end $$;
revoke all on function public.platform_tenant_scope_manifest() from public,anon,authenticated;
grant execute on function public.platform_tenant_scope_manifest() to service_role;
drop table if exists public.school_education_levels;
