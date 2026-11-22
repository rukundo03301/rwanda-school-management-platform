-- Module 4: real teacher/class assignment, attendance, lessons, homework and
-- explicitly school-approved student account access. NO APEX deployment.
-- Apply after school_admissions_v1.sql. Keep all private school student data
-- server-only: RLS plus no anon/authenticated direct table grants.

create table public.school_teacher_assignments (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 class_id uuid not null,
 subject_id uuid not null,
 teacher_user_id uuid not null references auth.users(id) on delete restrict,
 teacher_role text not null default 'teacher' check(teacher_role='teacher'),
 active boolean not null default true,
 assigned_by uuid not null references auth.users(id) on delete restrict,
 assigned_at timestamptz not null default now(),
 unique(school_id,id),
 unique(school_id,class_id,subject_id,teacher_user_id),
 foreign key(school_id,class_id,subject_id)
  references public.school_class_subjects(school_id,class_id,subject_id) on delete restrict,
 foreign key(school_id,teacher_user_id,teacher_role)
  references public.school_memberships(school_id,auth_user_id,role) on delete restrict
);
create index school_teacher_assignments_user_idx
 on public.school_teacher_assignments(school_id,teacher_user_id,active);

create table public.school_lessons (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 assignment_id uuid not null,
 title text not null check(length(btrim(title)) between 3 and 160),
 content text not null check(length(btrim(content)) between 3 and 5000),
 lesson_on date not null,
 published_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(school_id,id),
 foreign key(school_id,assignment_id)
  references public.school_teacher_assignments(school_id,id) on delete restrict
);

create table public.school_homework (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 assignment_id uuid not null,
 title text not null check(length(btrim(title)) between 3 and 160),
 instructions text not null check(length(btrim(instructions)) between 3 and 5000),
 due_on date not null,
 published_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(school_id,id),
 foreign key(school_id,assignment_id)
  references public.school_teacher_assignments(school_id,id) on delete restrict
);
create index school_homework_assignment_due_idx
 on public.school_homework(school_id,assignment_id,due_on);

create table public.school_attendance (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 assignment_id uuid not null,
 enrollment_id uuid not null,
 attendance_on date not null,
 state text not null check(state in ('present','absent','late','excused')),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(school_id,enrollment_id,attendance_on),
 foreign key(school_id,assignment_id)
  references public.school_teacher_assignments(school_id,id) on delete restrict,
 foreign key(school_id,enrollment_id)
  references public.school_student_enrollments(school_id,id) on delete restrict
);
create index school_attendance_assignment_date_idx
 on public.school_attendance(school_id,assignment_id,attendance_on);

create table public.school_student_access_invitations (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 student_id uuid not null,
 email text not null check(email=lower(btrim(email)) and length(email) between 5 and 254),
 guardian_consent_attested boolean not null check(guardian_consent_attested=true),
 status text not null default 'pending'
  check(status in ('pending','claimed','revoked')),
 invited_by uuid not null references auth.users(id) on delete restrict,
 invited_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '14 days'),
 claimed_by uuid references auth.users(id) on delete restrict,
 claimed_at timestamptz,
 unique(school_id,student_id,email),
 foreign key(school_id,student_id)
  references public.school_students(school_id,id) on delete restrict
);

create table public.school_student_accounts (
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 student_id uuid not null,
 auth_user_id uuid not null references auth.users(id) on delete restrict,
 active boolean not null default true,
 verified_by uuid not null references auth.users(id) on delete restrict,
 linked_at timestamptz not null default now(),
 primary key(school_id,student_id),
 unique(school_id,auth_user_id),
 foreign key(school_id,student_id)
  references public.school_students(school_id,id) on delete restrict
);

create table public.school_homework_submissions (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 homework_id uuid not null,
 student_id uuid not null,
 response_text text not null check(length(btrim(response_text)) between 1 and 5000),
 submitted_at timestamptz not null default now(),
 unique(school_id,homework_id,student_id),
 foreign key(school_id,homework_id)
  references public.school_homework(school_id,id) on delete restrict,
 foreign key(school_id,student_id)
  references public.school_students(school_id,id) on delete restrict
);

create table public.school_learning_audit (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 event text not null check(length(event) between 3 and 120),
 resource_id uuid,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index school_learning_audit_school_idx
 on public.school_learning_audit(school_id,created_at desc);

do $$
declare tbl text;
begin
 foreach tbl in array array[
  'school_teacher_assignments','school_lessons','school_homework',
  'school_attendance','school_student_access_invitations',
  'school_student_accounts','school_homework_submissions','school_learning_audit'
 ] loop
   execute format('alter table public.%I enable row level security',tbl);
   execute format('revoke all on table public.%I from public,anon,authenticated',tbl);
   execute format('grant all on table public.%I to service_role',tbl);
 end loop;
end $$;

create or replace function public.school_teacher_is_assigned(
 p_school uuid,p_assignment uuid,p_actor uuid
) returns boolean language sql stable security invoker
set search_path=pg_catalog,public as $$
 select exists (
 select 1 from public.school_teacher_assignments a
 join public.school_memberships m on m.school_id=a.school_id
   and m.auth_user_id=a.teacher_user_id and m.role='teacher' and m.active
 join public.school_classes c on c.school_id=a.school_id and c.id=a.class_id and c.status='active'
 join public.school_academic_years y on y.id=c.academic_year_id
   and y.school_id=c.school_id and y.status='current'
 join public.platform_schools s on s.id=a.school_id and s.status='active'
 where a.school_id=p_school and a.id=p_assignment
   and a.teacher_user_id=p_actor and a.active
 );
$$;

create or replace function public.school_assign_teacher(
 p_school uuid,p_class uuid,p_subject uuid,p_teacher uuid,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare assignment_id uuid;
begin
 if not exists(select 1 from public.school_memberships m
   join public.platform_schools s on s.id=m.school_id and s.status='active'
   where m.school_id=p_school and m.auth_user_id=p_actor and m.active
     and (m.role='school_owner' or (m.role='school_admin' and exists(
       select 1 from public.school_admin_permissions p where p.school_id=m.school_id
        and p.auth_user_id=m.auth_user_id and 'academics.manage'=any(p.permissions)))))
 then raise exception 'Academic manager permission required'; end if;
 if not exists(select 1 from public.school_memberships where school_id=p_school
  and auth_user_id=p_teacher and role='teacher' and active)
 then raise exception 'Teacher not approved for this school'; end if;
 if not exists(select 1 from public.school_class_subjects x
   join public.school_classes c on c.id=x.class_id and c.school_id=x.school_id
   join public.school_academic_years y on y.id=c.academic_year_id
     and y.school_id=c.school_id and y.status='current'
   where x.school_id=p_school and x.class_id=p_class
     and x.subject_id=p_subject and c.status='active')
 then raise exception 'Class and subject must belong to current school year'; end if;
 insert into public.school_teacher_assignments(
  school_id,class_id,subject_id,teacher_user_id,assigned_by)
 values(p_school,p_class,p_subject,p_teacher,p_actor)
 on conflict(school_id,class_id,subject_id,teacher_user_id)
 do update set active=true,assigned_by=p_actor,assigned_at=now()
 returning id into assignment_id;
 insert into public.school_learning_audit(school_id,actor_id,event,resource_id)
 values(p_school,p_actor,'teacher.assigned',assignment_id);
 return jsonb_build_object('assignment_id',assignment_id,'active',true);
end;
$$;

create or replace function public.school_publish_lesson(
 p_school uuid,p_assignment uuid,p_title text,p_content text,p_lesson_on date,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare lesson_id uuid;
begin
 if not public.school_teacher_is_assigned(p_school,p_assignment,p_actor)
 then raise exception 'Not assigned to this school class'; end if;
 if length(btrim(coalesce(p_title,''))) not between 3 and 160 or
   length(btrim(coalesce(p_content,''))) not between 3 and 5000
 then raise exception 'Lesson title or text invalid'; end if;
 if p_lesson_on is null then raise exception 'Lesson date required'; end if;
 insert into public.school_lessons(
   school_id,assignment_id,title,content,lesson_on,created_by)
 values(p_school,p_assignment,btrim(p_title),btrim(p_content),p_lesson_on,p_actor)
 returning id into lesson_id;
 insert into public.school_learning_audit(school_id,actor_id,event,resource_id)
 values(p_school,p_actor,'lesson.published',lesson_id);
 return jsonb_build_object('id',lesson_id);
end;
$$;

create or replace function public.school_publish_homework(
 p_school uuid,p_assignment uuid,p_title text,p_instructions text,p_due_on date,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare homework_id uuid;
begin
 if not public.school_teacher_is_assigned(p_school,p_assignment,p_actor)
 then raise exception 'Not assigned to this school class'; end if;
 if length(btrim(coalesce(p_title,''))) not between 3 and 160 or
   length(btrim(coalesce(p_instructions,''))) not between 3 and 5000
 then raise exception 'Homework details invalid'; end if;
 if p_due_on is null or p_due_on < (now() at time zone 'Africa/Kigali')::date
 then raise exception 'Homework due date cannot be before today'; end if;
 insert into public.school_homework(
  school_id,assignment_id,title,instructions,due_on,created_by)
 values(p_school,p_assignment,btrim(p_title),btrim(p_instructions),p_due_on,p_actor)
 returning id into homework_id;
 insert into public.school_learning_audit(school_id,actor_id,event,resource_id)
 values(p_school,p_actor,'homework.published',homework_id);
 return jsonb_build_object('id',homework_id);
end;
$$;

create or replace function public.school_record_attendance(
 p_school uuid,p_assignment uuid,p_enrollment uuid,p_day date,p_state text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare cls uuid;
        attendance_id uuid;
begin
 if not public.school_teacher_is_assigned(p_school,p_assignment,p_actor)
 then raise exception 'Teacher not assigned to class'; end if;
 if p_state not in ('present','absent','late','excused')
 then raise exception 'Invalid attendance state'; end if;
 if p_day is null or p_day>(now() at time zone 'Africa/Kigali')::date
   or p_day<((now() at time zone 'Africa/Kigali')::date - interval '90 days')::date
 then raise exception 'Attendance date is outside supported correction window'; end if;
 select class_id into cls from public.school_teacher_assignments
 where school_id=p_school and id=p_assignment;
 if not exists(select 1 from public.school_student_enrollments e
   join public.school_classes c on c.id=e.class_id and c.school_id=e.school_id
   join public.school_academic_years y on y.id=e.academic_year_id and y.school_id=e.school_id
   join public.school_students stu on stu.id=e.student_id and stu.school_id=e.school_id
   where e.school_id=p_school and e.id=p_enrollment and e.class_id=cls
    and e.status='active' and stu.status='active' and y.status='current'
    and p_day between y.starts_on and y.ends_on)
 then raise exception 'Enrolled student not in this teacher class and current year'; end if;
 insert into public.school_attendance(
   school_id,assignment_id,enrollment_id,attendance_on,state,recorded_by)
 values(p_school,p_assignment,p_enrollment,p_day,p_state,p_actor)
 on conflict(school_id,enrollment_id,attendance_on)
 do update set state=excluded.state,recorded_by=p_actor,updated_at=now()
 returning id into attendance_id;
 insert into public.school_learning_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school,p_actor,'attendance.recorded',attendance_id,
   jsonb_build_object('day',p_day,'state',p_state));
 return jsonb_build_object('id',attendance_id,'state',p_state);
end;
$$;

-- School-managed student portal invitations require an active guardian link,
-- verified guardian consent attested by school staff, and school authorization.
-- Public registration never creates a student account.
create or replace function public.school_invite_student_account(
 p_school uuid,p_student uuid,p_email text,p_attested boolean,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare normalized_email text; invitation_id uuid;
begin
 if not public.school_admissions_actor_allowed(p_school,p_actor,'guardians.manage')
 then raise exception 'School guardian management permission required'; end if;
 if p_attested is distinct from true
 then raise exception 'School must verify guardian permission before student account invitation'; end if;
 normalized_email:=lower(btrim(coalesce(p_email,'')));
 if normalized_email not like '%_@_%._%' or length(normalized_email)>254
 then raise exception 'Invalid email'; end if;
 if not exists(select 1 from public.school_students
  where school_id=p_school and id=p_student and status='active')
 then raise exception 'Student not active'; end if;
 if not exists(select 1 from public.school_guardian_links
  where school_id=p_school and student_id=p_student and active)
 then raise exception 'Verified guardian link must exist first'; end if;
 if exists(select 1 from public.school_student_accounts
  where school_id=p_school and student_id=p_student and active)
 then raise exception 'Student already has an active account'; end if;
 insert into public.school_student_access_invitations(
   school_id,student_id,email,guardian_consent_attested,invited_by)
 values(p_school,p_student,normalized_email,true,p_actor)
 on conflict(school_id,student_id,email) do update set
   guardian_consent_attested=true,status='pending',invited_by=p_actor,
   invited_at=now(),expires_at=now()+interval '14 days',claimed_at=null,claimed_by=null
 returning id into invitation_id;
 insert into public.school_learning_audit(school_id,actor_id,event,resource_id)
 values(p_school,p_actor,'student.invitation_created',p_student);
 return jsonb_build_object('invitation_id',invitation_id);
end;
$$;

create or replace function public.school_claim_student_account(
 p_school uuid,p_student uuid,p_user uuid,p_verified_email text
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare inv public.school_student_access_invitations%rowtype;
begin
 if not exists(select 1 from public.platform_schools where id=p_school and status='active')
 then raise exception 'School inactive'; end if;
 if not exists(select 1 from auth.users where id=p_user and
   lower(email)=lower(btrim(p_verified_email)) and email_confirmed_at is not null)
 then raise exception 'Confirmed student account email required'; end if;
 select * into inv from public.school_student_access_invitations
 where school_id=p_school and student_id=p_student
 and email=lower(btrim(p_verified_email)) for update;
 if not found or inv.status<>'pending' or not inv.guardian_consent_attested
   or inv.expires_at<=now() then raise exception 'No valid student portal invitation'; end if;
 if not exists(select 1 from public.school_students where school_id=p_school
   and id=p_student and status='active')
 then raise exception 'Student no longer active'; end if;
 if not exists(select 1 from public.school_guardian_links where school_id=p_school
   and student_id=p_student and active)
 then raise exception 'Guardian approval no longer valid'; end if;
 insert into public.school_student_accounts(school_id,student_id,auth_user_id,verified_by)
 values(p_school,p_student,p_user,inv.invited_by)
 on conflict(school_id,student_id) do update set
   auth_user_id=excluded.auth_user_id,active=true,verified_by=excluded.verified_by,
   linked_at=now();
 insert into public.school_memberships(school_id,auth_user_id,role,active)
 values(p_school,p_user,'student',true)
 on conflict(school_id,auth_user_id,role) do update set active=true;
 update public.school_student_access_invitations set status='claimed',
   claimed_by=p_user,claimed_at=now() where id=inv.id;
 insert into public.school_learning_audit(school_id,actor_id,event,resource_id)
 values(p_school,p_user,'student.invitation_claimed',p_student);
 return jsonb_build_object('claimed',true,'role','student');
end;
$$;

create or replace function public.school_submit_homework(
 p_school uuid,p_homework uuid,p_student uuid,p_user uuid,p_text text
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare hw public.school_homework%rowtype;
        assigned_class uuid;
        new_id uuid;
begin
 if not exists(select 1 from public.platform_schools where id=p_school and status='active')
 then raise exception 'School inactive'; end if;
 if not exists(select 1 from public.school_student_accounts sa
   join public.school_memberships m on m.school_id=sa.school_id and
     m.auth_user_id=sa.auth_user_id and m.role='student' and m.active
   join public.school_students stu on stu.school_id=sa.school_id and stu.id=sa.student_id
   where sa.school_id=p_school and sa.student_id=p_student
     and sa.auth_user_id=p_user and sa.active and stu.status='active')
 then raise exception 'Not this student account'; end if;
 if length(btrim(coalesce(p_text,''))) not between 1 and 5000
 then raise exception 'Submission text is required'; end if;
 select * into hw from public.school_homework
   where school_id=p_school and id=p_homework and published_at is not null;
 if not found then raise exception 'Homework not available'; end if;
 select class_id into assigned_class from public.school_teacher_assignments
   where school_id=p_school and id=hw.assignment_id;
 if not exists(select 1 from public.school_student_enrollments e
   join public.school_classes c on c.school_id=e.school_id and c.id=e.class_id
   join public.school_academic_years y on y.school_id=c.school_id
     and y.id=c.academic_year_id and y.status='current'
   where e.school_id=p_school and e.student_id=p_student and
     e.class_id=assigned_class and e.status='active')
 then raise exception 'Student is not enrolled in this class'; end if;
 if (now() at time zone 'Africa/Kigali')::date > hw.due_on
 then raise exception 'Homework deadline has passed'; end if;
 insert into public.school_homework_submissions(
  school_id,homework_id,student_id,response_text)
 values(p_school,p_homework,p_student,btrim(p_text))
 on conflict(school_id,homework_id,student_id) do update
  set response_text=excluded.response_text,submitted_at=now()
 returning id into new_id;
 insert into public.school_learning_audit(school_id,actor_id,event,resource_id)
 values(p_school,p_user,'homework.submitted',new_id);
 return jsonb_build_object('id',new_id,'submitted',true);
end;
$$;

revoke all on function public.school_teacher_is_assigned(uuid,uuid,uuid)
 from public,anon,authenticated;
revoke all on function public.school_assign_teacher(uuid,uuid,uuid,uuid,uuid)
 from public,anon,authenticated;
revoke all on function public.school_publish_lesson(uuid,uuid,text,text,date,uuid)
 from public,anon,authenticated;
revoke all on function public.school_publish_homework(uuid,uuid,text,text,date,uuid)
 from public,anon,authenticated;
revoke all on function public.school_record_attendance(uuid,uuid,uuid,date,text,uuid)
 from public,anon,authenticated;
revoke all on function public.school_invite_student_account(uuid,uuid,text,boolean,uuid)
 from public,anon,authenticated;
revoke all on function public.school_claim_student_account(uuid,uuid,uuid,text)
 from public,anon,authenticated;
revoke all on function public.school_submit_homework(uuid,uuid,uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.school_teacher_is_assigned(uuid,uuid,uuid)
 to service_role;
grant execute on function public.school_assign_teacher(uuid,uuid,uuid,uuid,uuid)
 to service_role;
grant execute on function public.school_publish_lesson(uuid,uuid,text,text,date,uuid)
 to service_role;
grant execute on function public.school_publish_homework(uuid,uuid,text,text,date,uuid)
 to service_role;
grant execute on function public.school_record_attendance(uuid,uuid,uuid,date,text,uuid)
 to service_role;
grant execute on function public.school_invite_student_account(uuid,uuid,text,boolean,uuid)
 to service_role;
grant execute on function public.school_claim_student_account(uuid,uuid,uuid,uuid,text)
 to service_role;
grant execute on function public.school_submit_homework(uuid,uuid,uuid,uuid,text)
 to service_role;
