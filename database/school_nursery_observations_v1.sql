-- Nursery learning observations and narrative progress reports.
-- Nursery children get no marks, percentages or ranks. A teacher records dated
-- observations in the six learning areas, drafts a narrative from them, leadership
-- approves, and only the school owner publishes. Guardians then see only their own
-- child's published narrative (enforced in the API through school_guardian_links).
-- Same security model as school_classrooms_v1: RLS on, service_role only, tenant
-- state and role membership re-checked inside every function.
create table if not exists public.school_nursery_observations (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 class_id uuid not null,
 student_id uuid not null,
 learning_area text not null check(learning_area in (
  'language_communication','numeracy_early_math','social_emotional',
  'physical_health','creative_arts_culture','environment_science')),
 observed_on date not null,
 descriptor text not null check(descriptor in ('developing','secure','extending')),
 comment text not null default '' check(length(comment)<=500),
 observed_by uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 foreign key(school_id,class_id) references public.school_classes(school_id,id) on delete restrict,
 foreign key(school_id,student_id) references public.school_students(school_id,id) on delete restrict
);
create index if not exists school_nursery_obs_student_idx
 on public.school_nursery_observations(school_id,student_id,observed_on desc);
create index if not exists school_nursery_obs_class_idx
 on public.school_nursery_observations(school_id,class_id,observed_on desc);

create table if not exists public.school_nursery_reports (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 academic_year_id uuid not null,
 class_id uuid not null,
 student_id uuid not null,
 term_number smallint not null check(term_number between 1 and 3),
 area_summaries jsonb not null default '{}'::jsonb,
 teacher_comment text not null default '' check(length(teacher_comment)<=1500),
 headteacher_comment text not null default '' check(length(headteacher_comment)<=1500),
 status text not null default 'draft' check(status in ('draft','approved','published','withdrawn')),
 drafted_by uuid not null references auth.users(id) on delete restrict,
 approved_by uuid references auth.users(id) on delete restrict,
 approved_at timestamptz,
 published_by uuid references auth.users(id) on delete restrict,
 published_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(school_id,student_id,academic_year_id,term_number),
 foreign key(school_id,class_id) references public.school_classes(school_id,id) on delete restrict,
 foreign key(school_id,student_id) references public.school_students(school_id,id) on delete restrict
);
create index if not exists school_nursery_reports_class_idx
 on public.school_nursery_reports(school_id,class_id,status);

do $$
declare tbl text;
begin
 foreach tbl in array array['school_nursery_observations','school_nursery_reports'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on table public.%I from public,anon,authenticated',tbl);
  execute format('grant all on table public.%I to service_role',tbl);
 end loop;
end $$;

create or replace function public.school_nursery_teacher_ok(
 p_school_id uuid,p_class uuid,p_teacher uuid
) returns boolean language sql stable security invoker
set search_path=pg_catalog,public as $$
 select exists(select 1 from public.school_teacher_assignments a
  join public.school_memberships m on m.school_id=a.school_id
   and m.auth_user_id=a.teacher_id and m.role='teacher'
  join public.platform_schools s on s.id=a.school_id
  where a.school_id=p_school_id and a.class_id=p_class and a.teacher_id=p_teacher
   and a.active and m.active and s.status='active')
$$;

create or replace function public.school_nursery_leader_ok(
 p_school_id uuid,p_actor uuid,p_owner_only boolean
) returns boolean language sql stable security invoker
set search_path=pg_catalog,public as $$
 select exists(select 1 from public.school_memberships
   where school_id=p_school_id and auth_user_id=p_actor and role='school_owner' and active)
  or (not p_owner_only and exists(select 1 from public.school_memberships m
   join public.school_admin_permissions ap on ap.school_id=m.school_id and ap.auth_user_id=m.auth_user_id
   where m.school_id=p_school_id and m.auth_user_id=p_actor and m.role='school_admin' and m.active
    and 'academics.manage'=any(ap.permissions)))
$$;

create or replace function public.school_record_nursery_observation(
 p_school_id uuid,p_class uuid,p_student uuid,p_area text,p_date date,
 p_descriptor text,p_comment text,p_teacher uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare year_id uuid; new_id uuid;
begin
 if p_date is null or p_date>(now() at time zone 'Africa/Kigali')::date
  then raise exception 'Future observations cannot be recorded'; end if;
 if not public.school_nursery_teacher_ok(p_school_id,p_class,p_teacher)
  then raise exception 'Teacher is not assigned to this class'; end if;
 select academic_year_id into year_id from public.school_classes
  where school_id=p_school_id and id=p_class and status='active';
 if not found or not exists(select 1 from public.school_student_enrollments
   where school_id=p_school_id and class_id=p_class and student_id=p_student
    and academic_year_id=year_id and status='active')
  then raise exception 'Student is not currently enrolled in this class'; end if;
 insert into public.school_nursery_observations(school_id,class_id,student_id,learning_area,
  observed_on,descriptor,comment,observed_by)
 values(p_school_id,p_class,p_student,p_area,p_date,p_descriptor,coalesce(trim(p_comment),''),p_teacher)
 returning id into new_id;
 insert into public.school_classroom_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school_id,p_teacher,'nursery.observation_recorded',new_id,
  jsonb_build_object('student_id',p_student,'area',p_area,'on',p_date,'descriptor',p_descriptor));
 return jsonb_build_object('recorded',true,'id',new_id);
end $$;

create or replace function public.school_save_nursery_report_draft(
 p_school_id uuid,p_class uuid,p_student uuid,p_term smallint,
 p_area_summaries jsonb,p_teacher_comment text,p_teacher uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare year_id uuid; rid uuid; cur text;
begin
 if not public.school_nursery_teacher_ok(p_school_id,p_class,p_teacher)
  then raise exception 'Teacher is not assigned to this class'; end if;
 select academic_year_id into year_id from public.school_classes
  where school_id=p_school_id and id=p_class and status='active';
 if not found or not exists(select 1 from public.school_student_enrollments
   where school_id=p_school_id and class_id=p_class and student_id=p_student
    and academic_year_id=year_id and status='active')
  then raise exception 'Student is not currently enrolled in this class'; end if;
 select id,status into rid,cur from public.school_nursery_reports
  where school_id=p_school_id and student_id=p_student and academic_year_id=year_id and term_number=p_term;
 if cur in ('approved','published') then raise exception 'This report is already approved or published'; end if;
 if rid is null then
  insert into public.school_nursery_reports(school_id,academic_year_id,class_id,student_id,term_number,
   area_summaries,teacher_comment,drafted_by)
  values(p_school_id,year_id,p_class,p_student,p_term,coalesce(p_area_summaries,'{}'::jsonb),
   coalesce(trim(p_teacher_comment),''),p_teacher) returning id into rid;
 else
  update public.school_nursery_reports set area_summaries=coalesce(p_area_summaries,'{}'::jsonb),
   teacher_comment=coalesce(trim(p_teacher_comment),''),status='draft',drafted_by=p_teacher,updated_at=now()
  where id=rid;
 end if;
 insert into public.school_classroom_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school_id,p_teacher,'nursery.report_drafted',rid,jsonb_build_object('student_id',p_student,'term',p_term));
 return jsonb_build_object('saved',true,'id',rid);
end $$;

create or replace function public.school_approve_nursery_report(
 p_school_id uuid,p_report uuid,p_headteacher_comment text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
begin
 if not public.school_nursery_leader_ok(p_school_id,p_actor,false)
  then raise exception 'Leadership permission required to approve reports'; end if;
 update public.school_nursery_reports set status='approved',approved_by=p_actor,approved_at=now(),
  headteacher_comment=coalesce(trim(p_headteacher_comment),''),updated_at=now()
 where id=p_report and school_id=p_school_id and status='draft';
 if not found then raise exception 'Only a draft report can be approved'; end if;
 insert into public.school_classroom_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school_id,p_actor,'nursery.report_approved',p_report,'{}'::jsonb);
 return jsonb_build_object('approved',true);
end $$;

create or replace function public.school_publish_nursery_report(
 p_school_id uuid,p_report uuid,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
begin
 if not public.school_nursery_leader_ok(p_school_id,p_actor,true)
  then raise exception 'Only the school owner may publish reports'; end if;
 update public.school_nursery_reports set status='published',published_by=p_actor,published_at=now(),updated_at=now()
 where id=p_report and school_id=p_school_id and status='approved';
 if not found then raise exception 'Only an approved report can be published'; end if;
 insert into public.school_classroom_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school_id,p_actor,'nursery.report_published',p_report,'{}'::jsonb);
 return jsonb_build_object('published',true);
end $$;

revoke all on function public.school_nursery_teacher_ok(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.school_nursery_leader_ok(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.school_record_nursery_observation(uuid,uuid,uuid,text,date,text,text,uuid) from public,anon,authenticated;
revoke all on function public.school_save_nursery_report_draft(uuid,uuid,uuid,smallint,jsonb,text,uuid) from public,anon,authenticated;
revoke all on function public.school_approve_nursery_report(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.school_publish_nursery_report(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.school_nursery_teacher_ok(uuid,uuid,uuid) to service_role;
grant execute on function public.school_nursery_leader_ok(uuid,uuid,boolean) to service_role;
grant execute on function public.school_record_nursery_observation(uuid,uuid,uuid,text,date,text,text,uuid) to service_role;
grant execute on function public.school_save_nursery_report_draft(uuid,uuid,uuid,smallint,jsonb,text,uuid) to service_role;
grant execute on function public.school_approve_nursery_report(uuid,uuid,text,uuid) to service_role;
grant execute on function public.school_publish_nursery_report(uuid,uuid,uuid) to service_role;
