-- Term reports for every education level (nursery, primary, secondary, TVET, university).
-- One workflow for every school: the class teacher drafts, then people the school owner chooses
-- review, approve and publish. The report template follows the class's education level.

create table if not exists public.school_report_roles (
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 auth_user_id uuid not null references auth.users(id) on delete restrict,
 permissions text[] not null default '{}'
  check (permissions <@ array['reports.review','reports.approve','reports.publish']::text[]),
 updated_by uuid not null references auth.users(id) on delete restrict,
 updated_at timestamptz not null default now(),
 primary key (school_id,auth_user_id)
);
alter table public.school_report_roles enable row level security;
revoke all on public.school_report_roles from public,anon,authenticated;
grant all on public.school_report_roles to service_role;

create table if not exists public.school_term_reports (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 academic_year_id uuid not null,
 class_id uuid not null,
 student_id uuid not null,
 term_number smallint not null check (term_number between 1 and 3),
 template text not null check (template in ('nursery','primary','secondary','tvet','university')),
 content jsonb not null default '{}'::jsonb check (jsonb_typeof(content)='object' and length(content::text)<=60000),
 teacher_comment text not null default '' check (length(teacher_comment)<=1500),
 reviewer_comment text not null default '' check (length(reviewer_comment)<=1500),
 headteacher_comment text not null default '' check (length(headteacher_comment)<=1500),
 status text not null default 'draft'
  check (status in ('draft','submitted','reviewed','approved','published','returned','withdrawn')),
 return_reason text not null default '' check (length(return_reason)<=1000),
 drafted_by uuid not null references auth.users(id) on delete restrict,
 submitted_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete restrict,
 reviewed_at timestamptz,
 approved_by uuid references auth.users(id) on delete restrict,
 approved_at timestamptz,
 published_by uuid references auth.users(id) on delete restrict,
 published_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (school_id,student_id,academic_year_id,term_number),
 foreign key (school_id,class_id) references public.school_classes(school_id,id) on delete restrict,
 foreign key (school_id,student_id) references public.school_students(school_id,id) on delete restrict
);
create index if not exists school_term_reports_queue_idx on public.school_term_reports(school_id,status,class_id);
alter table public.school_term_reports enable row level security;
revoke all on public.school_term_reports from public,anon,authenticated;
grant all on public.school_term_reports to service_role;

-- Bring the existing early-years reports into the shared workflow (same ids, nothing lost).
insert into public.school_term_reports(id,school_id,academic_year_id,class_id,student_id,term_number,template,
 content,teacher_comment,headteacher_comment,status,drafted_by,submitted_at,approved_by,approved_at,
 published_by,published_at,created_at,updated_at)
select r.id,r.school_id,r.academic_year_id,r.class_id,r.student_id,r.term_number,'nursery',
 jsonb_build_object('areas',r.area_summaries),r.teacher_comment,r.headteacher_comment,r.status,r.drafted_by,
 case when r.status<>'draft' then coalesce(r.approved_at,r.updated_at) end,r.approved_by,r.approved_at,
 r.published_by,r.published_at,r.created_at,r.updated_at
from public.school_nursery_reports r
on conflict do nothing;

-- Who may do what. The owner may always do everything; anyone else only what the owner granted.
create or replace function public.school_report_allowed(p_school uuid,p_actor uuid,p_permission text)
returns boolean language sql stable security invoker set search_path=pg_catalog,public as $$
 select exists(select 1 from public.school_memberships where school_id=p_school and auth_user_id=p_actor
   and role='school_owner' and active)
 or exists(select 1 from public.school_report_roles rr join public.school_memberships m
   on m.school_id=rr.school_id and m.auth_user_id=rr.auth_user_id and m.active
   where rr.school_id=p_school and rr.auth_user_id=p_actor and p_permission=any(rr.permissions))
$$;

create or replace function public.school_report_teacher_ok(p_school uuid,p_class uuid,p_actor uuid)
returns boolean language sql stable security invoker set search_path=pg_catalog,public as $$
 select exists(select 1 from public.school_teacher_assignments where school_id=p_school and class_id=p_class
   and teacher_id=p_actor and active)
$$;

create or replace function public.school_set_report_roles(
 p_school uuid,p_target uuid,p_permissions text[],p_actor uuid
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if not exists(select 1 from public.school_memberships where school_id=p_school and auth_user_id=p_actor
   and role='school_owner' and active)
 then raise exception 'Only the school owner can decide who reviews, approves and publishes reports'; end if;
 if not exists(select 1 from public.school_memberships where school_id=p_school and auth_user_id=p_target
   and active and role in ('school_admin','teacher','staff'))
 then raise exception 'Choose an active principal, teacher or staff member of this school'; end if;
 if p_permissions is null or not (p_permissions <@ array['reports.review','reports.approve','reports.publish']::text[])
 then raise exception 'Unknown report permission'; end if;
 insert into public.school_report_roles(school_id,auth_user_id,permissions,updated_by,updated_at)
 values(p_school,p_target,p_permissions,p_actor,now())
 on conflict(school_id,auth_user_id) do update set permissions=excluded.permissions,updated_by=p_actor,updated_at=now();
 insert into public.school_report_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school,p_actor,'report_roles.updated',p_target,jsonb_build_object('permissions',p_permissions));
 return jsonb_build_object('permissions',p_permissions);
end $$;

create or replace function public.school_term_report_save(
 p_school uuid,p_class uuid,p_student uuid,p_term smallint,p_content jsonb,p_teacher_comment text,p_actor uuid
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare yr uuid; band text; rid uuid; cur text;
begin
 if not public.school_report_teacher_ok(p_school,p_class,p_actor)
 then raise exception 'Only a teacher assigned to this class can draft its reports'; end if;
 select c.academic_year_id,c.level_band into yr,band from public.school_classes c
  where c.school_id=p_school and c.id=p_class and c.status='active';
 if yr is null then raise exception 'Class not found'; end if;
 if band is null then raise exception 'Set this class''s education level before drafting reports'; end if;
 if not exists(select 1 from public.school_student_enrollments where school_id=p_school and class_id=p_class
   and student_id=p_student and academic_year_id=yr and status='active')
 then raise exception 'Student is not currently enrolled in this class'; end if;
 select id,status into rid,cur from public.school_term_reports
  where school_id=p_school and student_id=p_student and academic_year_id=yr and term_number=p_term;
 if rid is not null and cur not in ('draft','returned')
 then raise exception 'This report has been submitted; it can be changed only after it is returned to you'; end if;
 if rid is null then
  insert into public.school_term_reports(school_id,academic_year_id,class_id,student_id,term_number,template,
   content,teacher_comment,drafted_by)
  values(p_school,yr,p_class,p_student,p_term,band,coalesce(p_content,'{}'::jsonb),coalesce(btrim(p_teacher_comment),''),p_actor)
  returning id into rid;
 else
  update public.school_term_reports set content=coalesce(p_content,'{}'::jsonb),
   teacher_comment=coalesce(btrim(p_teacher_comment),''),template=band,class_id=p_class,
   status='draft',drafted_by=p_actor,updated_at=now()
  where id=rid;
 end if;
 insert into public.school_report_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school,p_actor,'term_report.saved',rid,jsonb_build_object('template',band,'term',p_term));
 return jsonb_build_object('id',rid,'status','draft');
end $$;

create or replace function public.school_term_report_advance(
 p_school uuid,p_report uuid,p_action text,p_comment text,p_actor uuid
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare r public.school_term_reports%rowtype; nxt text;
begin
 select * into r from public.school_term_reports where school_id=p_school and id=p_report for update;
 if not found then raise exception 'Report not found'; end if;
 if p_action='submit' then
  if not public.school_report_teacher_ok(p_school,r.class_id,p_actor)
  then raise exception 'Only a teacher of this class can submit its reports'; end if;
  if r.status not in ('draft','returned') then raise exception 'Only a draft report can be submitted'; end if;
  update public.school_term_reports set status='submitted',submitted_at=now(),return_reason='',updated_at=now() where id=r.id;
  nxt:='submitted';
 elsif p_action='review' then
  if not public.school_report_allowed(p_school,p_actor,'reports.review')
  then raise exception 'The school owner has not given you permission to review reports'; end if;
  if r.status<>'submitted' then raise exception 'Only a submitted report can be reviewed'; end if;
  if r.drafted_by=p_actor and not public.school_report_allowed(p_school,p_actor,'reports.publish')
  then raise exception 'Someone other than the teacher who wrote this report must review it'; end if;
  update public.school_term_reports set status='reviewed',reviewed_by=p_actor,reviewed_at=now(),
   reviewer_comment=coalesce(btrim(p_comment),''),updated_at=now() where id=r.id;
  nxt:='reviewed';
 elsif p_action='approve' then
  if not public.school_report_allowed(p_school,p_actor,'reports.approve')
  then raise exception 'The school owner has not given you permission to approve reports'; end if;
  if r.status not in ('submitted','reviewed') then raise exception 'Only a submitted or reviewed report can be approved'; end if;
  if length(btrim(coalesce(p_comment,'')))>1500 then raise exception 'Keep the headteacher comment under 1500 characters'; end if;
  update public.school_term_reports set status='approved',approved_by=p_actor,approved_at=now(),
   headteacher_comment=coalesce(btrim(p_comment),''),updated_at=now() where id=r.id;
  nxt:='approved';
 elsif p_action='publish' then
  if not public.school_report_allowed(p_school,p_actor,'reports.publish')
  then raise exception 'The school owner has not given you permission to publish reports'; end if;
  if r.status<>'approved' then raise exception 'Only an approved report can be published'; end if;
  update public.school_term_reports set status='published',published_by=p_actor,published_at=now(),updated_at=now() where id=r.id;
  nxt:='published';
 elsif p_action='return' then
  if not (public.school_report_allowed(p_school,p_actor,'reports.review') or public.school_report_allowed(p_school,p_actor,'reports.approve'))
  then raise exception 'The school owner has not given you permission to return reports'; end if;
  if r.status not in ('submitted','reviewed','approved') then raise exception 'Only a report waiting for review or approval can be returned'; end if;
  if length(btrim(coalesce(p_comment,''))) not between 5 and 1000 then raise exception 'Tell the teacher what to change (5 to 1000 characters)'; end if;
  update public.school_term_reports set status='returned',return_reason=btrim(p_comment),updated_at=now() where id=r.id;
  nxt:='returned';
 elsif p_action='withdraw' then
  if not public.school_report_allowed(p_school,p_actor,'reports.publish')
  then raise exception 'The school owner has not given you permission to withdraw reports'; end if;
  if r.status<>'published' then raise exception 'Only a published report can be withdrawn'; end if;
  if length(btrim(coalesce(p_comment,''))) not between 5 and 1000 then raise exception 'Give a reason for withdrawing (5 to 1000 characters)'; end if;
  update public.school_term_reports set status='returned',return_reason=btrim(p_comment),published_at=null,published_by=null,updated_at=now() where id=r.id;
  nxt:='returned';
 else raise exception 'Unknown report action'; end if;
 insert into public.school_report_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school,p_actor,'term_report.'||p_action,r.id,jsonb_build_object('from',r.status,'to',nxt));
 return jsonb_build_object('id',r.id,'status',nxt);
end $$;

revoke all on function public.school_report_allowed(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.school_report_teacher_ok(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.school_set_report_roles(uuid,uuid,text[],uuid) from public,anon,authenticated;
revoke all on function public.school_term_report_save(uuid,uuid,uuid,smallint,jsonb,text,uuid) from public,anon,authenticated;
revoke all on function public.school_term_report_advance(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.school_report_allowed(uuid,uuid,text) to service_role;
grant execute on function public.school_report_teacher_ok(uuid,uuid,uuid) to service_role;
grant execute on function public.school_set_report_roles(uuid,uuid,text[],uuid) to service_role;
grant execute on function public.school_term_report_save(uuid,uuid,uuid,smallint,jsonb,text,uuid) to service_role;
grant execute on function public.school_term_report_advance(uuid,uuid,text,text,uuid) to service_role;

-- Register the new tenant tables with the purge manifest (read live, extended, never replaced from memory).
do $$
declare current_list text[]; merged text; want text[]:=array['school_report_roles','school_term_reports'];
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
