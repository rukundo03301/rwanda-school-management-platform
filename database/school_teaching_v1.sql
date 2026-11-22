-- Module 4: Teacher classroom, lesson plans, attendance, homework, student portal.
-- Requires the previous FOUR migrations. GitHub-only source; NOT live APEX.
-- Sensitive records: no anon/authenticated access, service role on verified server only.

create table public.school_teacher_assignments (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 teacher_user_id uuid not null references auth.users(id) on delete restrict,
 teacher_role text not null default 'teacher' check(teacher_role='teacher'),
 class_id uuid not null,
 subject_id uuid not null,
 academic_year_id uuid not null,
 active boolean not null default true,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(school_id,id), unique(school_id,teacher_user_id,class_id,subject_id),
 foreign key(school_id,teacher_user_id,teacher_role)
   references public.school_memberships(school_id,auth_user_id,role) on delete restrict,
 foreign key(school_id,class_id,subject_id)
   references public.school_class_subjects(school_id,class_id,subject_id) on delete restrict,
 foreign key(school_id,class_id,academic_year_id)
   references public.school_classes(school_id,id,academic_year_id) on delete restrict
);
create index school_teacher_assignments_lookup
 on public.school_teacher_assignments(school_id,teacher_user_id,active);

create table public.school_lesson_plans (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 teacher_assignment_id uuid not null,
 lesson_on date not null,
 topic text not null check(length(btrim(topic)) between 3 and 140),
 objectives text not null default '' check(length(objectives)<=4000),
 created_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id) on delete restrict,
 unique(school_id,id),
 foreign key(school_id,teacher_assignment_id)
   references public.school_teacher_assignments(school_id,id) on delete restrict
);
create index school_lessons_scope on public.school_lesson_plans(school_id,teacher_assignment_id,lesson_on);

create table public.school_homework (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 teacher_assignment_id uuid not null,
 title text not null check(length(btrim(title)) between 3 and 160),
 instructions text not null default '' check(length(instructions)<=6000),
 due_at timestamptz not null,
 status text not null default 'draft' check(status in ('draft','published','closed')),
 published_at timestamptz,
 created_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id) on delete restrict,
 unique(school_id,id),
 foreign key(school_id,teacher_assignment_id)
   references public.school_teacher_assignments(school_id,id) on delete restrict
);
create index school_homework_scope on public.school_homework(school_id,teacher_assignment_id,status,due_at);

-- Enrollment identity and class are carried into attendance for a composite FK.
alter table public.school_student_enrollments add constraint
 school_enrollment_teacher_attendance_ref
 unique(school_id,id,student_id,class_id);
create table public.school_attendance (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 enrollment_id uuid not null,
 student_id uuid not null,
 class_id uuid not null,
 attendance_on date not null,
 attendance_status text not null check(attendance_status in ('present','absent','late','excused')),
 note text not null default '' check(length(note)<=350),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 updated_at timestamptz not null default now(),
 unique(school_id,enrollment_id,attendance_on),
 foreign key(school_id,enrollment_id,student_id,class_id)
   references public.school_student_enrollments(school_id,id,student_id,class_id) on delete restrict
);
create index school_attendance_day on public.school_attendance(school_id,class_id,attendance_on);

create table public.school_student_portal_invitations (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 student_id uuid not null,
 email text not null check(email=lower(btrim(email)) and length(email) between 5 and 254),
 status text not null default 'awaiting_guardian'
   check(status in ('awaiting_guardian','approved','claimed','revoked')),
 invited_by uuid not null references auth.users(id) on delete restrict,
 approved_by uuid references auth.users(id) on delete restrict,
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '14 days'),
 claimed_by uuid references auth.users(id) on delete restrict,
 claimed_at timestamptz,
 unique(school_id,student_id),
 foreign key(school_id,student_id)
   references public.school_students(school_id,id) on delete restrict
);
create table public.school_student_accounts (
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 student_id uuid not null,
 auth_user_id uuid not null references auth.users(id) on delete restrict,
 active boolean not null default true,
 verified_at timestamptz not null default now(),
 primary key(school_id,student_id),
 unique(school_id,auth_user_id),
 foreign key(school_id,student_id)
   references public.school_students(school_id,id) on delete restrict
);

-- Minimal homework response: no attachments, grades, comments, or public uploads.
create table public.school_homework_submissions (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 homework_id uuid not null,
 student_id uuid not null,
 response_text text not null check(length(btrim(response_text)) between 1 and 5000),
 submitted_by uuid not null references auth.users(id) on delete restrict,
 submitted_at timestamptz not null default now(),
 unique(school_id,homework_id,student_id),
 foreign key(school_id,homework_id) references public.school_homework(school_id,id) on delete restrict,
 foreign key(school_id,student_id) references public.school_students(school_id,id) on delete restrict
);

create table public.school_teaching_audit (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 event text not null check(length(event) between 3 and 100),
 resource_id uuid,
 created_at timestamptz not null default now(),
 metadata jsonb not null default '{}'::jsonb
);
create index school_teaching_audit_date on public.school_teaching_audit(school_id,created_at desc);

do $$
declare t text;
begin
 foreach t in array array[
  'school_teacher_assignments','school_lesson_plans','school_homework',
  'school_attendance','school_student_portal_invitations','school_student_accounts',
  'school_homework_submissions','school_teaching_audit'
 ] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on table public.%I from public,anon,authenticated',t);
   execute format('grant all on table public.%I to service_role',t);
 end loop;
end $$;

create or replace function public.school_is_teacher_for_assignment(
 p_school uuid,p_assignment uuid,p_actor uuid
) returns boolean language sql stable security invoker
set search_path=pg_catalog,public as $$
 select exists(select 1 from public.platform_schools s
 join public.school_teacher_assignments ta on ta.school_id=s.id
 join public.school_memberships m on m.school_id=s.id
   and m.auth_user_id=ta.teacher_user_id and m.role='teacher'
 where s.id=p_school and s.status='active'
   and ta.id=p_assignment and ta.teacher_user_id=p_actor
   and ta.active and m.active);
$$;

create or replace function public.school_teacher_assign(
 p_school uuid,p_teacher uuid,p_class uuid,p_subject uuid,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare yr uuid; assignment_id uuid;
begin
 if not exists(select 1 from public.platform_schools s
   join public.school_memberships m on m.school_id=s.id
   where s.id=p_school and s.status='active' and m.auth_user_id=p_actor
    and m.active and (m.role='school_owner'
      or (m.role='school_admin' and exists(
        select 1 from public.school_admin_permissions ap where ap.school_id=p_school
         and ap.auth_user_id=p_actor and 'academics.manage'=any(ap.permissions)))))
 then raise exception 'School academic manager required'; end if;
 if not exists(select 1 from public.school_memberships where school_id=p_school
   and auth_user_id=p_teacher and role='teacher' and active)
 then raise exception 'Teacher must be an approved member of this school'; end if;
 select c.academic_year_id into yr from public.school_classes c
   join public.school_class_subjects cs on cs.school_id=c.school_id and cs.class_id=c.id
     and cs.subject_id=p_subject
 where c.school_id=p_school and c.id=p_class and c.status='active';
 if yr is null then raise exception 'Choose an existing class-subject pairing'; end if;
 insert into public.school_teacher_assignments(school_id,teacher_user_id,class_id,subject_id,
  academic_year_id,created_by,active)
 values(p_school,p_teacher,p_class,p_subject,yr,p_actor,true)
 on conflict(school_id,teacher_user_id,class_id,subject_id) do update set active=true
 returning id into assignment_id;
 insert into public.school_teaching_audit(school_id,actor_id,event,resource_id)
 values(p_school,p_actor,'teacher.assigned',assignment_id);
 return jsonb_build_object('assignment_id',assignment_id);
end;
$$;

create or replace function public.school_teacher_create_content(
 p_school uuid,p_assignment uuid,p_kind text,p_title text,p_body text,
 p_on timestamptz,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare created_id uuid; teacher_class uuid; y public.school_academic_years%rowtype;
begin
 if not public.school_is_teacher_for_assignment(p_school,p_assignment,p_actor)
 then raise exception 'You are not assigned to this class and subject'; end if;
 if length(btrim(coalesce(p_title,''))) not between 3 and 140
  or length(coalesce(p_body,''))>4000
 then raise exception 'Invalid content'; end if;
 select ta.class_id into teacher_class from public.school_teacher_assignments ta
   where ta.school_id=p_school and ta.id=p_assignment;
 select ay.* into y from public.school_teacher_assignments ta
  join public.school_academic_years ay on ay.school_id=ta.school_id
    and ay.id=ta.academic_year_id
 where ta.school_id=p_school and ta.id=p_assignment;
 if p_on is null or (p_on at time zone 'Africa/Kigali')::date < y.starts_on
  or (p_on at time zone 'Africa/Kigali')::date > y.ends_on
 then raise exception 'Date is outside academic year'; end if;
 if p_kind='lesson' then
  insert into public.school_lesson_plans(school_id,teacher_assignment_id,lesson_on,
    topic,objectives,created_by)
  values(p_school,p_assignment,(p_on at time zone 'Africa/Kigali')::date,p_title,p_body,p_actor)
  returning id into created_id;
 elsif p_kind='homework' then
  insert into public.school_homework(school_id,teacher_assignment_id,title,
   instructions,due_at,status,published_at,created_by)
  values(p_school,p_assignment,p_title,p_body,p_on,'published',now(),p_actor)
  returning id into created_id;
 else raise exception 'Unsupported teaching content'; end if;
 insert into public.school_teaching_audit(school_id,actor_id,event,resource_id)
 values(p_school,p_actor,'content.'||p_kind||'_created',created_id);
 return jsonb_build_object('id',created_id,'type',p_kind);
end;
$$;

create or replace function public.school_teacher_mark_attendance(
 p_school uuid,p_assignment uuid,p_enrollment uuid,p_day date,
 p_status text,p_note text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare entry public.school_student_enrollments%rowtype;
        y public.school_academic_years%rowtype; record_id uuid;
begin
 if not public.school_is_teacher_for_assignment(p_school,p_assignment,p_actor)
 then raise exception 'Only assigned teacher may mark attendance'; end if;
 if p_status not in ('present','absent','late','excused')
 or length(coalesce(p_note,''))>350 then raise exception 'Invalid attendance entry'; end if;
 select e.* into entry from public.school_student_enrollments e
 join public.school_teacher_assignments ta
 on ta.school_id=e.school_id and ta.class_id=e.class_id
   and ta.academic_year_id=e.academic_year_id
 where e.school_id=p_school and e.id=p_enrollment and e.status='active'
   and ta.id=p_assignment
 for update of e;
 if not found then raise exception 'Student is not enrolled in your assigned class'; end if;
 if not exists(select 1 from public.school_students where id=entry.student_id
    and school_id=p_school and status='active') then raise exception 'Student is inactive'; end if;
 select * into y from public.school_academic_years
 where school_id=p_school and id=entry.academic_year_id;
 if p_day is null or p_day<y.starts_on or p_day>y.ends_on
    or p_day>(now() at time zone 'Africa/Kigali')::date
 then raise exception 'Attendance date outside permitted school days'; end if;
 insert into public.school_attendance(school_id,enrollment_id,student_id,class_id,
  attendance_on,attendance_status,note,recorded_by)
 values(p_school,entry.id,entry.student_id,entry.class_id,p_day,p_status,
   coalesce(p_note,''),p_actor)
 on conflict(school_id,enrollment_id,attendance_on) do update
 set attendance_status=excluded.attendance_status,note=excluded.note,
 recorded_by=excluded.recorded_by,updated_at=now()
 returning id into record_id;
 insert into public.school_teaching_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school,p_actor,'attendance.recorded',record_id,
  jsonb_build_object('student_id',entry.student_id,'day',p_day));
 return jsonb_build_object('id',record_id,'status',p_status);
end;
$$;

-- Student account invitations require verified guardian approval for minors
-- OR unknown DOB. Adult students may claim with verified matching email.
create or replace function public.school_invite_student_account(
 p_school uuid,p_student uuid,p_email text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare dob date; state text; normalized text;
begin
 if not exists(select 1 from public.school_memberships m
  join public.platform_schools s on s.id=m.school_id
  where m.school_id=p_school and m.auth_user_id=p_actor and m.active and s.status='active'
   and m.role='school_owner')
  and not exists(select 1 from public.school_memberships m
   join public.school_admin_permissions p on p.school_id=m.school_id and p.auth_user_id=m.auth_user_id
   where m.school_id=p_school and m.auth_user_id=p_actor and m.role='school_admin'
   and m.active and 'people.invite'=any(p.permissions))
 then raise exception 'School account invitation not authorized'; end if;
 select date_of_birth into dob from public.school_students
 where school_id=p_school and id=p_student and status='active';
 if not found then raise exception 'Student not in this school'; end if;
 normalized:=lower(btrim(coalesce(p_email,'')));
 if normalized not like '%_@_%._%' or length(normalized)>254 then raise exception 'Invalid email'; end if;
 if exists(select 1 from public.school_student_accounts where school_id=p_school
   and student_id=p_student and active) then raise exception 'Student already has a portal account'; end if;
 state:=case when dob is not null and dob<=(current_date-interval '18 years')::date
  then 'approved' else 'awaiting_guardian' end;
 if state='awaiting_guardian' and not exists(select 1 from public.school_guardian_links
   where school_id=p_school and student_id=p_student and active)
 then raise exception 'Minor student requires a verified guardian before account invitation'; end if;
 insert into public.school_student_portal_invitations(
  school_id,student_id,email,status,invited_by,expires_at,approved_by,approved_at)
 values(p_school,p_student,normalized,state,p_actor,now()+interval '14 days',null,null)
 on conflict(school_id,student_id) do update
  set email=excluded.email,status=excluded.status,invited_by=excluded.invited_by,
   expires_at=excluded.expires_at,approved_by=null,approved_at=null,
   claimed_by=null,claimed_at=null
 returning status into state;
 insert into public.school_teaching_audit(school_id,actor_id,event,resource_id)
 values(p_school,p_actor,'student.portal_invited',p_student);
 return jsonb_build_object('status',state,'student_id',p_student);
end;
$$;

create or replace function public.school_approve_student_account(
 p_school uuid,p_student uuid,p_guardian uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
begin
 if not exists(select 1 from public.platform_schools where id=p_school and status='active')
 or not exists(select 1 from public.school_guardian_links where school_id=p_school
  and student_id=p_student and auth_user_id=p_guardian and active)
 then raise exception 'Linked guardian approval required'; end if;
 update public.school_student_portal_invitations
  set status='approved',approved_by=p_guardian,approved_at=now()
  where school_id=p_school and student_id=p_student and status='awaiting_guardian'
    and expires_at>now();
 if not found then raise exception 'No pending student access request'; end if;
 insert into public.school_teaching_audit(school_id,actor_id,event,resource_id)
  values(p_school,p_guardian,'student.portal_approved',p_student);
 return jsonb_build_object('approved',true);
end;
$$;

create or replace function public.school_claim_student_account(
 p_school uuid,p_student uuid,p_user uuid,p_email text
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare inv public.school_student_portal_invitations%rowtype;
begin
 if not exists(select 1 from public.platform_schools where id=p_school and status='active')
 then raise exception 'School unavailable'; end if;
 if not exists(select 1 from auth.users where id=p_user
  and email_confirmed_at is not null and lower(email)=lower(btrim(p_email)))
 then raise exception 'Confirmed email account required'; end if;
 select * into inv from public.school_student_portal_invitations
 where school_id=p_school and student_id=p_student
   and email=lower(btrim(p_email)) for update;
 if not found or inv.status<>'approved' or inv.expires_at<=now()
 then raise exception 'No approved and current student invitation'; end if;
 if not exists(select 1 from public.school_students
 where school_id=p_school and id=p_student and status='active')
 then raise exception 'Student unavailable'; end if;
 insert into public.school_student_accounts(school_id,student_id,auth_user_id,active)
 values(p_school,p_student,p_user,true)
 on conflict(school_id,student_id) do update
  set auth_user_id=excluded.auth_user_id,active=true,verified_at=now()
  where public.school_student_accounts.active=false;
 if not found then raise exception 'Student already has another active account'; end if;
 insert into public.school_memberships(school_id,auth_user_id,role,active)
 values(p_school,p_user,'student',true)
 on conflict(school_id,auth_user_id,role) do update set active=true;
 update public.school_student_portal_invitations set
  status='claimed',claimed_by=p_user,claimed_at=now() where id=inv.id;
 insert into public.school_teaching_audit(school_id,actor_id,event,resource_id)
 values(p_school,p_user,'student.portal_claimed',p_student);
 return jsonb_build_object('claimed',true,'student_id',p_student);
end;
$$;

create or replace function public.school_submit_homework(
 p_school uuid,p_homework uuid,p_student uuid,p_actor uuid,p_answer text
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare hw public.school_homework%rowtype; assn public.school_teacher_assignments%rowtype;
        student_allowed boolean; submission_id uuid;
begin
 if length(btrim(coalesce(p_answer,''))) not between 1 and 5000
 then raise exception 'Response text required'; end if;
 if not exists(select 1 from public.platform_schools where id=p_school and status='active')
 then raise exception 'School unavailable'; end if;
 select * into hw from public.school_homework where id=p_homework and school_id=p_school
  and status='published';
 if not found then raise exception 'Homework not published or unavailable'; end if;
 if hw.due_at<now() then raise exception 'Homework deadline has passed'; end if;
 select * into assn from public.school_teacher_assignments
 where id=hw.teacher_assignment_id and school_id=p_school and active;
 if not found then raise exception 'Assignment is not active'; end if;
 if not exists(select 1 from public.school_student_enrollments
   where school_id=p_school and student_id=p_student and
    academic_year_id=assn.academic_year_id and class_id=assn.class_id and status='active')
 then raise exception 'Student is not in the class'; end if;
 select (
  exists(select 1 from public.school_student_accounts sa
    join public.school_memberships m on m.school_id=sa.school_id
     and m.auth_user_id=sa.auth_user_id and m.role='student'
    where sa.school_id=p_school and sa.student_id=p_student
     and sa.auth_user_id=p_actor and sa.active and m.active)
  or exists(select 1 from public.school_guardian_links g
    join public.school_memberships m on m.school_id=g.school_id
     and m.auth_user_id=g.auth_user_id and m.role='parent'
   where g.school_id=p_school and g.student_id=p_student
    and g.auth_user_id=p_actor and g.active and m.active)
 ) into student_allowed;
 if not student_allowed then raise exception 'Not authorized to submit for this student'; end if;
 insert into public.school_homework_submissions(school_id,homework_id,student_id,response_text,submitted_by)
 values(p_school,p_homework,p_student,btrim(p_answer),p_actor)
 on conflict(school_id,homework_id,student_id) do update set
  response_text=excluded.response_text,submitted_by=p_actor,submitted_at=now()
 returning id into submission_id;
 insert into public.school_teaching_audit(school_id,actor_id,event,resource_id)
 values(p_school,p_actor,'homework.submitted',submission_id);
 return jsonb_build_object('submitted',true,'id',submission_id);
end;
$$;

revoke all on function public.school_is_teacher_for_assignment(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.school_teacher_assign(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.school_teacher_create_content(uuid,uuid,text,text,text,timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.school_teacher_mark_attendance(uuid,uuid,uuid,date,text,text,uuid) from public,anon,authenticated;
revoke all on function public.school_invite_student_account(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.school_approve_student_account(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.school_claim_student_account(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.school_submit_homework(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;

grant execute on function public.school_is_teacher_for_assignment(uuid,uuid,uuid) to service_role;
grant execute on function public.school_teacher_assign(uuid,uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.school_teacher_create_content(uuid,uuid,text,text,text,timestamptz,uuid) to service_role;
grant execute on function public.school_teacher_mark_attendance(uuid,uuid,uuid,date,text,text,uuid) to service_role;
grant execute on function public.school_invite_student_account(uuid,uuid,text,uuid) to service_role;
grant execute on function public.school_approve_student_account(uuid,uuid,uuid) to service_role;
grant execute on function public.school_claim_student_account(uuid,uuid,uuid,text) to service_role;
grant execute on function public.school_submit_homework(uuid,uuid,uuid,uuid,text) to service_role;
