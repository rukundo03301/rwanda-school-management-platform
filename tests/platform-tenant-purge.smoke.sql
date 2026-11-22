-- Run ONLY against the isolated local Supabase CI database.
-- An outer ROLLBACK also removes the synthetic auth user and both demo schools.
\set ON_ERROR_STOP on
begin;
do $smoke$
declare
 actor uuid:=gen_random_uuid();
 first_demo jsonb;
 second_demo jsonb;
 first_id uuid;
 second_id uuid;
 first_company uuid;
 first_code text;
 second_code text;
 inventory jsonb;
 result jsonb;
 table_rec record;
 remaining_count bigint;
 blocked boolean;
begin
 insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
 values(
  actor,'00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated','authenticated','synthetic-platform-owner@example.invalid',
  '',now(),now(),now());
 first_demo:=public.platform_create_demo_school(actor);
 second_demo:=public.platform_create_demo_school(actor);
 first_id:=(first_demo->>'school_id')::uuid;
 second_id:=(second_demo->>'school_id')::uuid;
 first_company:=(first_demo->>'company_id')::uuid;
 first_code:=first_demo->>'school_code';
 second_code:=second_demo->>'school_code';
 if first_id=second_id or first_code=second_code then
  raise exception 'Demo schools must have distinct School IDs and codes'; end if;
 inventory:=public.platform_preview_tenant_purge(first_id);
 if (inventory->>'school_scoped_tables')::integer<>54
  or (inventory->>'tenant_rows')::bigint<15
  or (inventory->>'stored_files')::integer<>0
  or (inventory->>'is_demo')::boolean is distinct from true
 then raise exception 'Demo fixture preflight failed: %',inventory; end if;
 for table_rec in select * from public.platform_verify_tenant_scope() loop
  execute format('select count(*) from %s where school_id=$1',table_rec.relid::regclass)
  into remaining_count using first_id;
  if (inventory->'rows_by_table'->>table_rec.table_name)::bigint<>remaining_count
  then raise exception 'Inventory count mismatch in %',table_rec.table_name; end if;
 end loop;

 -- Future module table not in the manifest must block ALL purges.
 create table public.school_untracked_temp(
  id uuid primary key default gen_random_uuid(),school_id uuid not null);
 blocked:=false;
 begin
  perform public.platform_preview_tenant_purge(first_id);
 exception when others then blocked:=true;
 end;
 drop table public.school_untracked_temp;
 if not blocked then raise exception 'Manifest drift was not blocked'; end if;

 -- No deletion without deletion_requested state.
 blocked:=false;
 begin
  perform public.platform_purge_tenant_data(first_id,first_code,actor);
 exception when others then blocked:=true;
 end;
 if not blocked then raise exception 'Active school deletion wrongly allowed'; end if;

 perform public.platform_change_school_state(
  first_id,'deletion_requested','Synthetic end-to-end purge verification',actor);
 update public.platform_schools set legal_hold=true where id=first_id;
 blocked:=false;
 begin
  perform public.platform_purge_tenant_data(first_id,first_code,actor);
 exception when others then blocked:=true;
 end;
 if not blocked then raise exception 'Legal hold must block deletion'; end if;
 update public.platform_schools set legal_hold=false where id=first_id;
 blocked:=false;
 begin
  perform public.platform_purge_tenant_data(first_id,'RW-SCH-WRONG',actor);
 exception when others then blocked:=true;
 end;
 if not blocked then raise exception 'Incorrect school code must block deletion'; end if;

 result:=public.platform_purge_tenant_data(first_id,first_code,actor);
 if result->>'deleted'<>'true' then raise exception 'Purge did not confirm completion'; end if;
 if exists(select 1 from public.platform_schools where id=first_id)
  or exists(select 1 from public.platform_companies where id=first_company)
 then raise exception 'Tenant/company root records remain'; end if;
 for table_rec in select * from public.platform_verify_tenant_scope() loop
  execute format('select count(*) from %s where school_id=$1',table_rec.relid::regclass)
  into remaining_count using first_id;
  if remaining_count<>0 then raise exception 'Orphaned tenant records in %',table_rec.table_name; end if;
 end loop;
 if exists(select 1 from public.platform_audit where resource_id=first_id
  or metadata::text like '%'||first_id::text||'%'
  or metadata::text like '%'||first_code||'%')
 then raise exception 'School-specific platform audit data remains'; end if;

 -- Shared Supabase Auth identity survives, all school membership/links are gone.
 if not exists(select 1 from auth.users where id=actor)
 then raise exception 'Shared Auth identity was deleted'; end if;
 if not exists(select 1 from public.platform_schools where id=second_id)
  or not exists(select 1 from public.school_students where school_id=second_id)
  or not exists(select 1 from public.school_fee_invoices where school_id=second_id)
  or not exists(select 1 from public.school_memberships where school_id=second_id)
 then raise exception 'Another tenant was harmed by the purge'; end if;

 -- Re-test deletion of the remaining separate tenant.
 perform public.platform_change_school_state(
  second_id,'deletion_requested','Remove second synthetic school separately',actor);
 result:=public.platform_purge_tenant_data(second_id,second_code,actor);
 if (result->>'deleted')::boolean is distinct from true
  or exists(select 1 from public.platform_schools where id=second_id)
 then raise exception 'Second tenant deletion did not finish'; end if;
 raise notice 'PASSED: two fictional tenants created, 54-table manifest checked, drift/legal hold/wrong code blocked, two purged, data and company wiped, shared user preserved.';
end;
$smoke$;
rollback;
