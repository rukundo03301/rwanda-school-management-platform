-- Platform Owner demo school + safe, comprehensive school-tenant erasure.
-- Ninth isolated migration, AFTER all 8 school modules. No APEX writes.
-- Purpose: exact per-school deletion without CASCADE, cross-tenant harm,
-- leaving records in a newer, unregistered tenant table, or claiming files
-- were removed by only deleting storage.objects metadata.

alter table public.platform_schools
 add column is_demo boolean not null default false,
 add column legal_hold boolean not null default false;
create index platform_schools_demo_idx on public.platform_schools(is_demo);

-- These are ALL 54 known school_id tables across Modules 1–7. Fail closed
-- when future migrations create/delete scoped tables until manifest updated.
create or replace function public.platform_tenant_scope_manifest()
returns text[] language sql immutable security invoker
set search_path=pg_catalog,public as $$
 select array[
  'platform_fee_terms',
  'platform_manual_payments',
  'platform_school_sites',
  'platform_tickets',
  'school_academic_years',
  'school_admin_audit',
  'school_admin_permissions',
  'school_admission_applications',
  'school_admissions_audit',
  'school_admissions_permissions',
  'school_announcement_reads',
  'school_announcements',
  'school_assessment_marks',
  'school_assessment_terms',
  'school_attendance_records',
  'school_calendar_events',
  'school_class_subjects',
  'school_classes',
  'school_classroom_audit',
  'school_communication_permissions',
  'school_communications_audit',
  'school_curriculum_class_subjects',
  'school_curriculum_profiles',
  'school_curriculum_units',
  'school_family_message_threads',
  'school_family_messages',
  'school_fee_catalog',
  'school_fee_credits',
  'school_fee_invoices',
  'school_fee_payments',
  'school_fee_receipts',
  'school_finance_audit',
  'school_finance_permissions',
  'school_guardian_invitations',
  'school_guardian_links',
  'school_homework',
  'school_homework_submissions',
  'school_lesson_plans',
  'school_memberships',
  'school_message_notifications',
  'school_onboarding',
  'school_owner_invites',
  'school_published_reports',
  'school_report_admin_permissions',
  'school_report_audit',
  'school_role_invites',
  'school_site_drafts',
  'school_student_account_invites',
  'school_student_accounts',
  'school_student_enrollments',
  'school_students',
  'school_subjects',
  'school_teacher_assignments',
  'school_timetable_periods'
 ]::text[]
$$;

create or replace function public.platform_verify_tenant_scope()
returns table(relid oid,table_name text)
language plpgsql volatile security invoker
set search_path=pg_catalog,public as $$
declare expected text[];
        actual text[];
        missing text[];
        extra text[];
begin
 expected:=public.platform_tenant_scope_manifest();
 select array_agg(c.relname::text order by c.relname)
 into actual
 from pg_catalog.pg_class c
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
 join pg_catalog.pg_attribute a on a.attrelid=c.oid
   and a.attname='school_id' and a.attnum>0 and not a.attisdropped
 where c.relkind in ('r','p') and c.relname<>'platform_schools';
 select array_agg(e) into missing
 from unnest(expected) e where not(e=any(coalesce(actual,'{}'::text[])));
 select array_agg(a) into extra
 from unnest(coalesce(actual,'{}'::text[])) a where not(a=any(expected));
 if missing is not null or extra is not null
 then raise exception 'Tenant purge blocked: scoped table inventory changed. Missing: %, new: %',missing,extra; end if;
 -- Do not overlook a child table that references scoped data without carrying
 -- a school_id of its own; that would cause an incomplete wipe.
 if exists(
   select 1 from pg_catalog.pg_constraint fk
   join pg_catalog.pg_class parent on parent.oid=fk.confrelid
   join pg_catalog.pg_namespace pn on pn.oid=parent.relnamespace and pn.nspname='public'
   join pg_catalog.pg_class child on child.oid=fk.conrelid
   join pg_catalog.pg_namespace cn on cn.oid=child.relnamespace
   where fk.contype='f' and parent.relname=any(expected)
    and child.relname<>all(expected)
    and child.relname<>'platform_schools'
    and child.relkind in ('r','p')
 )
 then raise exception 'Tenant purge blocked: unexpected table references tenant data'; end if;
 return query select c.oid,c.relname::text
 from pg_catalog.pg_class c
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
 where c.relname=any(expected) and c.relkind in ('r','p');
end;
$$;

create or replace function public.platform_preview_tenant_purge(p_school uuid)
returns jsonb language plpgsql volatile security invoker
set search_path=pg_catalog,public as $$
declare school public.platform_schools%rowtype;
        table_ref record;
        current_count bigint;
        row_total bigint:=0;
        detail jsonb:='{}'::jsonb;
        storage_count bigint:=0;
        storage_buckets text[]:='{}'::text[];
        siblings bigint:=0;
begin
 select * into school from public.platform_schools where id=p_school;
 if not found then raise exception 'School tenant not found'; end if;
 for table_ref in select * from public.platform_verify_tenant_scope()
 loop
  execute format('select count(*) from %s where school_id=$1',table_ref.relid::regclass)
   into current_count using p_school;
  detail:=detail||jsonb_build_object(table_ref.table_name,current_count);
  row_total:=row_total+current_count;
 end loop;
 select count(*),coalesce(array_agg(distinct bucket_id),'{}'::text[])
 into storage_count,storage_buckets from storage.objects
 where name like p_school::text||'/%'
    or name like 'schools/'||p_school::text||'/%'
    or name like 'tenants/'||p_school::text||'/%';
 select count(*) into siblings from public.platform_schools
 where company_id=school.company_id and id<>p_school;
 return jsonb_build_object(
  'school_id',school.id,'school_code',school.school_code,
  'school_name',school.name,'is_demo',school.is_demo,
  'status',school.status,'legal_hold',school.legal_hold,
  'school_scoped_tables',cardinality(public.platform_tenant_scope_manifest()),
  'tenant_rows',row_total,'rows_by_table',detail,
  'stored_files',storage_count,'storage_buckets',storage_buckets,
  'other_schools_in_company',siblings,
  'shared_auth_accounts_preserved',true,
  'external_backup_erasure_immediate',false);
end;
$$;

-- This is deliberately a single PostgreSQL transaction. Remove files via
-- Supabase Storage API BEFORE calling this RPC; then verify storage.objects is
-- empty so nobody can claim success while leaving uploaded bytes behind.
create or replace function public.platform_purge_tenant_data(
 p_school uuid,p_school_code text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare s public.platform_schools%rowtype;
        item record;
        affected bigint;
        total_rows bigint:=0;
        removed_files bigint;
        company_removed boolean:=false;
        audit_rows bigint;
begin
 select * into s from public.platform_schools
 where id=p_school for update;
 if not found then raise exception 'School not found or previously deleted'; end if;
 if s.school_code<>p_school_code then raise exception 'Exact school ID confirmation is required'; end if;
 if s.status<>'deletion_requested'
 then raise exception 'School must be stopped and marked for deletion first'; end if;
 if s.legal_hold then raise exception 'Deletion blocked by school legal hold'; end if;
 if not exists(select 1 from auth.users u where u.id=p_actor and u.email_confirmed_at is not null)
 then raise exception 'Verified authorized actor required'; end if;
 perform 1 from public.platform_verify_tenant_scope();
 select count(*) into removed_files from storage.objects
 where name like p_school::text||'/%'
    or name like 'schools/'||p_school::text||'/%'
    or name like 'tenants/'||p_school::text||'/%';
 if removed_files<>0 then raise exception 'Storage object(s) remain; use Storage API before database purge'; end if;

 create temporary table if not exists pg_temp._tenant_tables_for_purge(
  relid oid primary key) on commit drop;
 delete from pg_temp._tenant_tables_for_purge;
 insert into pg_temp._tenant_tables_for_purge(relid)
 select relid from public.platform_verify_tenant_scope();

 -- FK dependency walk: child tables first, then referenced tables. This avoids
 -- turning ON DELETE CASCADE on and prevents accidentally deleting other schools.
 for item in
  with recursive paths as (
   select t.relid,0 as depth,array[t.relid]::oid[] as seen
   from pg_temp._tenant_tables_for_purge t
   union all
   select fk.confrelid,p.depth+1,p.seen||fk.confrelid
   from paths p
   join pg_catalog.pg_constraint fk on fk.conrelid=p.relid and fk.contype='f'
   join pg_temp._tenant_tables_for_purge t on t.relid=fk.confrelid
   where not(fk.confrelid=any(p.seen))
  )
  select relid,max(depth) as depth from paths
  group by relid order by depth,relid
 loop
  execute format('delete from %s where school_id=$1',item.relid::regclass) using p_school;
  get diagnostics affected=row_count;
  total_rows:=total_rows+affected;
 end loop;
 -- Platform audit has no school_id/FK; wipe school references and names.
 delete from public.platform_audit
 where resource_id=p_school
   or metadata::text like '%'||p_school::text||'%'
   or metadata::text like '%'||s.school_code||'%';
 get diagnostics audit_rows=row_count;
 delete from public.platform_schools where id=p_school;
 if exists(select 1 from public.platform_schools where id=p_school)
 then raise exception 'School root record still exists'; end if;
 if not exists(select 1 from public.platform_schools where company_id=s.company_id)
 then
  delete from public.platform_audit
    where resource_id=s.company_id or metadata::text like '%'||s.company_id::text||'%';
  delete from public.platform_companies where id=s.company_id;
  company_removed:=true;
 end if;
 -- Non-identifying aggregate audit only. Never retain deleted school name/ID.
 insert into public.platform_audit(actor_id,event,metadata)
 values(p_actor,'tenant.data_purge_completed',
   jsonb_build_object('tenant_rows_removed',total_rows,'company_removed',company_removed));
 return jsonb_build_object('deleted',true,'tenant_rows_removed',total_rows,
  'platform_audit_rows_removed',audit_rows,'company_removed',company_removed,
  'storage_files_remaining',0,'shared_user_accounts_preserved',true);
end;
$$;

-- Create a synthetic sample school; no real person's name/contact or payment.
-- No invitation email is sent. Sample invoice and pending payment are NOT money.
create or replace function public.platform_create_demo_school(p_actor uuid)
returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare c uuid;
        s public.platform_schools%rowtype;
        yr uuid;
        cl uuid;
        sub uuid;
        a uuid;
        st uuid;
        fee uuid;
        current_year integer;
        start_day date;
        end_day date;
        due_day date;
begin
 if not exists(select 1 from auth.users where id=p_actor and email_confirmed_at is not null)
 then raise exception 'A verified platform owner is required'; end if;
 current_year:=extract(year from (now() at time zone 'Africa/Kigali'))::integer;
 start_day:=make_date(current_year,1,1);
 end_day:=make_date(current_year,12,31);
 due_day:=least(end_day,(now() at time zone 'Africa/Kigali')::date+14);
 insert into public.platform_companies(name)
 values('DEMO · Example School Organization') returning id into c;
 insert into public.platform_schools(
  company_id,name,owner_email,status,is_demo)
 values(c,'Kigali Learning Academy · DEMO','demo-owner@example.invalid','active',true)
 returning * into s;
 insert into public.school_memberships(school_id,auth_user_id,role)
 values(s.id,p_actor,'school_owner'),(s.id,p_actor,'teacher'),(s.id,p_actor,'parent');
 insert into public.platform_school_sites(
  school_id,tagline,about_text,announcement,primary_color,is_published)
 values(s.id,'Learning with purpose · DEMO',
  'This is a fictional demonstration school. Its pupils, invoices and events are not real.',
  'DEMO SCHOOL — SAMPLE DATA ONLY. NO REAL PAYMENTS.', '#176B75',true);
 insert into public.school_site_drafts(
  school_id,tagline,about_text,announcement,primary_color,updated_by)
 values(s.id,'Learning with purpose · DEMO',
  'Our sample mission is quality learning for every student.',
  'DEMO SCHOOL — SAMPLE DATA ONLY.', '#176B75',p_actor);
 insert into public.school_onboarding(
  school_id,current_step,school_type,education_levels,
  province,district,campus_name,academic_year,privacy_acknowledged,updated_by)
 values(s.id,5,'primary',array['P4'],'Kigali City','Gasabo',
  'Fictional Campus',current_year::text,true,p_actor);
 insert into public.platform_fee_terms(school_id,monthly_fee_rwf)
 values(s.id,0);
 insert into public.school_academic_years(
  school_id,name,starts_on,ends_on,status,created_by)
 values(s.id,current_year::text,start_day,end_day,'current',p_actor)
 returning id into yr;
 insert into public.school_classes(
  school_id,academic_year_id,name,level,section,capacity,created_by)
 values(s.id,yr,'Primary Four','P4','A',35,p_actor) returning id into cl;
 insert into public.school_subjects(school_id,code,name,created_by)
 values(s.id,'MAT','Mathematics',p_actor) returning id into sub;
 insert into public.school_class_subjects(school_id,class_id,subject_id,created_by)
 values(s.id,cl,sub,p_actor);
 insert into public.school_teacher_assignments(
  school_id,teacher_id,class_id,subject_id,assigned_by)
 values(s.id,p_actor,cl,sub,p_actor);
 insert into public.school_admission_applications(
  school_id,first_name,last_name,academic_year_id,status,created_by)
 values(s.id,'Sample','Learner',yr,'admitted',p_actor) returning id into a;
 insert into public.school_students(
  school_id,first_name,last_name,source_application_id,created_by)
 values(s.id,'Sample','Learner',a,p_actor) returning id into st;
 insert into public.school_student_enrollments(
  school_id,student_id,academic_year_id,class_id,enrolled_by)
 values(s.id,st,yr,cl,p_actor);
 insert into public.school_guardian_links(
  school_id,student_id,auth_user_id,relationship,verified_by)
 values(s.id,st,p_actor,'legal_guardian',p_actor);
 insert into public.school_lesson_plans(
  school_id,teacher_id,class_id,subject_id,title,objectives,lesson_date)
 values(s.id,p_actor,cl,sub,'Demo Fractions Lesson',
  'Learning equivalent fractions using illustrations',(now() at time zone 'Africa/Kigali')::date);
 insert into public.school_homework(
  school_id,teacher_id,class_id,subject_id,title,instructions,due_at,status,published_at)
 values(s.id,p_actor,cl,sub,'Fictional Homework: Fractions',
  'Demo only: solve four sample fraction problems.',
  now()+interval '7 days','published',now());
 insert into public.school_attendance_records(
  school_id,class_id,student_id,attendance_on,status,taken_by)
 values(s.id,cl,st,(now() at time zone 'Africa/Kigali')::date,'present',p_actor);
 insert into public.school_timetable_periods(
  school_id,academic_year_id,class_id,subject_id,teacher_id,
  weekday,starts_at,ends_at,room,created_by)
 values(s.id,yr,cl,sub,p_actor,1,time '08:00',time '08:45','Room DEMO',p_actor);
 insert into public.school_announcements(
  school_id,audience,title,body,author_id)
 values(s.id,'all','Welcome to the demonstration school',
  'This announcement is fictional. You can delete all this school data from Platform Owner Tenant Management.',p_actor);
 insert into public.school_calendar_events(
  school_id,audience,kind,title,details,starts_at,ends_at,created_by)
 values(s.id,'all','activity','Demo School Open Day',
   'A fictional sample event',now()+interval '3 days',now()+interval '3 days 2 hours',p_actor);
 insert into public.school_fee_catalog(
  school_id,academic_year_id,class_id,category,label,
  term_label,amount_rwf,due_on,created_by)
 values(s.id,yr,cl,'tuition','Demo Term Tuition','Term 3',
  90000,due_day,p_actor) returning id into fee;
 insert into public.school_fee_invoices(
  school_id,fee_id,academic_year_id,class_id,student_id,
  category,description,term_label,amount_rwf,due_on,issued_by)
 values(s.id,fee,yr,cl,st,'tuition','Demo Term Tuition','Term 3',90000,due_day,p_actor);
 insert into public.platform_tickets(
  school_id,title,description,priority,created_by)
 values(s.id,'DEMO: Sample school support request',
  'Fictional sample ticket. No real school has requested support.','normal',p_actor);
 insert into public.platform_audit(actor_id,event,resource_id,metadata)
 values(p_actor,'tenant.demo_created',s.id,
  jsonb_build_object('school_code',s.school_code,'synthetic',true));
 return jsonb_build_object('created',true,'school_id',s.id,
  'school_code',s.school_code,'is_demo',true,'company_id',c,
  'sample_student_id',st,'currency','RWF');
end;
$$;

revoke all on function public.platform_tenant_scope_manifest() from public,anon,authenticated;
revoke all on function public.platform_verify_tenant_scope() from public,anon,authenticated;
revoke all on function public.platform_preview_tenant_purge(uuid) from public,anon,authenticated;
revoke all on function public.platform_purge_tenant_data(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.platform_create_demo_school(uuid) from public,anon,authenticated;
grant execute on function public.platform_tenant_scope_manifest() to service_role;
grant execute on function public.platform_verify_tenant_scope() to service_role;
grant execute on function public.platform_preview_tenant_purge(uuid) to service_role;
grant execute on function public.platform_purge_tenant_data(uuid,text,uuid) to service_role;
grant execute on function public.platform_create_demo_school(uuid) to service_role;
