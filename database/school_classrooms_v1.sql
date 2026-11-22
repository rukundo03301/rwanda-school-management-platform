-- Module 4: Teacher classrooms, lessons, homework, attendance and student access.
-- Run AFTER school_admissions_v1.sql in isolated CI before any production release.
-- NO live APEX writes. Private child data is never exposed to anon/authenticated.

create table if not exists public.school_teacher_assignments (
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 teacher_id uuid not null references auth.users(id) on delete restrict,
 teacher_role text not null default 'teacher' check(teacher_role='teacher'),
 class_id uuid not null,
 subject_id uuid not null,
 active boolean not null default true,
 assigned_by uuid not null references auth.users(id) on delete restrict,
 assigned_at timestamptz not null default now(),
 primary key(school_id,teacher_id,class_id,subject_id),
 foreign key(school_id,teacher_id,teacher_role)
  references public.school_memberships(school_id,auth_user_id,role) on delete restrict,
 foreign key(school_id,class_id,subject_id)
  references public.school_class_subjects(school_id,class_id,subject_id) on delete restrict
);
create index if not exists school_teacher_assignments_teacher_idx
 on public.school_teacher_assignments(school_id,teacher_id,active);

create table if not exists public.school_lesson_plans (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 teacher_id uuid not null references auth.users(id) on delete restrict,
 class_id uuid not null,
 subject_id uuid not null,
 title text not null check(length(btrim(title)) between 3 and 180),
 objectives text not null default '' check(length(objectives)<=4000),
 lesson_date date not null,
 created_at timestamptz not null default now(),
 unique(school_id,id),
 foreign key(school_id,teacher_id,class_id,subject_id)
  references public.school_teacher_assignments(school_id,teacher_id,class_id,subject_id)
  on delete restrict
);
create index if not exists school_lesson_plans_teacher_idx
 on public.school_lesson_plans(school_id,teacher_id,lesson_date desc);

create table if not exists public.school_homework (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 teacher_id uuid not null references auth.users(id) on delete restrict,
 class_id uuid not null,
 subject_id uuid not null,
 title text not null check(length(btrim(title)) between 3 and 180),
 instructions text not null check(length(btrim(instructions)) between 1 and 5000),
 due_at timestamptz not null,
 status text not null default 'draft'
   check(status in ('draft','published','closed')),
 published_at timestamptz,
 created_at timestamptz not null default now(),
 unique(school_id,id),
 foreign key(school_id,teacher_id,class_id,subject_id)
  references public.school_teacher_assignments(school_id,teacher_id,class_id,subject_id)
  on delete restrict,
 check((status='draft' and published_at is null)
   or (status in ('published','closed') and published_at is not null))
);
create index if not exists school_homework_class_idx
 on public.school_homework(school_id,class_id,status,due_at);

-- Student identity is assigned only by a verified school manager AFTER
-- confirming the appropriate family approval where the student is a minor
-- or age is unknown. A public role selection cannot link any student.
create table if not exists public.school_student_account_invites (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 student_id uuid not null,
 email text not null check(email=lower(btrim(email)) and length(email) between 5 and 254),
 consent_attested boolean not null default false check(consent_attested=true),
 invited_by uuid not null references auth.users(id) on delete restrict,
 status text not null default 'pending'
   check(status in ('pending','claimed','revoked')),
 expires_at timestamptz not null default (now()+interval '14 days'),
 claimed_at timestamptz,
 claimed_by uuid references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(school_id,student_id,email),
 foreign key(school_id,student_id)
  references public.school_students(school_id,id) on delete restrict
);
create index if not exists school_student_invites_email_idx
 on public.school_student_account_invites(school_id,email,status);

create table if not exists public.school_student_accounts (
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 student_id uuid not null,
 auth_user_id uuid not null references auth.users(id) on delete restrict,
 active boolean not null default true,
 authorized_by uuid not null references auth.users(id) on delete restrict,
 authorized_at timestamptz not null default now(),
 primary key(school_id,student_id),
 unique(school_id,auth_user_id),
 foreign key(school_id,student_id)
  references public.school_students(school_id,id) on delete restrict
);
create index if not exists school_student_accounts_user_idx
 on public.school_student_accounts(auth_user_id,school_id,active);

create table if not exists public.school_homework_submissions (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 homework_id uuid not null,
 student_id uuid not null,
 response_text text not null check(length(btrim(response_text)) between 1 and 5000),
 submitted_at timestamptz not null default now(),
 is_late boolean not null default false,
 unique(school_id,homework_id,student_id),
 foreign key(school_id,homework_id)
  references public.school_homework(school_id,id) on delete restrict,
 foreign key(school_id,student_id)
  references public.school_students(school_id,id) on delete restrict
);
create index if not exists school_homework_submissions_student_idx
 on public.school_homework_submissions(school_id,student_id,submitted_at desc);

create table if not exists public.school_attendance_records (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 class_id uuid not null,
 student_id uuid not null,
 attendance_on date not null,
 status text not null check(status in ('present','absent','late','excused')),
 taken_by uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 unique(school_id,class_id,student_id,attendance_on),
 foreign key(school_id,class_id)
  references public.school_classes(school_id,id) on delete restrict,
 foreign key(school_id,student_id)
  references public.school_students(school_id,id) on delete restrict
);
create index if not exists school_attendance_class_day_idx
 on public.school_attendance_records(school_id,class_id,attendance_on desc);

create table if not exists public.school_classroom_audit (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 event text not null check(length(event) between 3 and 100),
 resource_id uuid,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists school_classroom_audit_school_idx
 on public.school_classroom_audit(school_id,created_at desc);

do $$
declare tbl text;
begin
 foreach tbl in array array[
  'school_teacher_assignments','school_lesson_plans','school_homework',
  'school_student_account_invites','school_student_accounts',
  'school_homework_submissions','school_attendance_records','school_classroom_audit'
 ] loop
   execute format('alter table public.%I enable row level security',tbl);
   execute format('revoke all on table public.%I from public,anon,authenticated',tbl);
   execute format('grant all on table public.%I to service_role',tbl);
 end loop;
end $$;

-- Session identities come from a server-side Supabase Auth token check.
-- SQL additionally checks current tenant state and role memberships to
-- protect mutations from stale or revoked permissions.
create or replace function public.school_teacher_can(
 p_school_id uuid,p_teacher uuid,p_class uuid,p_subject uuid
) returns boolean language sql stable security invoker
set search_path=pg_catalog,public as $$
 select exists(select 1 from public.platform_schools s
  join public.school_memberships m on m.school_id=s.id
  join public.school_teacher_assignments a on a.school_id=m.school_id
   and a.teacher_id=m.auth_user_id
  join public.school_classes c on c.school_id=a.school_id and c.id=a.class_id
  join public.school_academic_years y on y.school_id=c.school_id and y.id=c.academic_year_id
  where s.id=p_school_id and s.status='active' and c.status='active' and y.status='current'
   and m.auth_user_id=p_teacher and m.role='teacher' and m.active
   and a.class_id=p_class and a.subject_id=p_subject and a.active)
$$;

create or replace function public.school_assign_teacher(
 p_school_id uuid,p_teacher uuid,p_class uuid,p_subject uuid,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
begin
 if not exists(select 1 from public.platform_schools where id=p_school_id and status='active')
  then raise exception 'School is not active'; end if;
 if not (
  exists(select 1 from public.school_memberships where school_id=p_school_id
   and auth_user_id=p_actor and role='school_owner' and active)
  or exists(select 1 from public.school_memberships m
    join public.school_admin_permissions ap on ap.school_id=m.school_id
      and ap.auth_user_id=m.auth_user_id
    where m.school_id=p_school_id and m.auth_user_id=p_actor
      and m.role='school_admin' and m.active and 'academics.manage'=any(ap.permissions))
 ) then raise exception 'School academic management permission required'; end if;
 if not exists(select 1 from public.school_memberships
   where school_id=p_school_id and auth_user_id=p_teacher and role='teacher' and active)
 then raise exception 'Teacher must first have an active verified school membership'; end if;
 if not exists(select 1 from public.school_class_subjects cs
    join public.school_classes c on c.id=cs.class_id and c.school_id=cs.school_id
    join public.school_academic_years y on y.id=c.academic_year_id and y.school_id=c.school_id
    where cs.school_id=p_school_id and cs.class_id=p_class and cs.subject_id=p_subject
      and c.status='active' and y.status<>'closed')
 then raise exception 'Class and subject must belong to this school and a non-closed year'; end if;
 insert into public.school_teacher_assignments(
  school_id,teacher_id,class_id,subject_id,assigned_by)
 values(p_school_id,p_teacher,p_class,p_subject,p_actor)
 on conflict(school_id,teacher_id,class_id,subject_id)
 do update set active=true,assigned_by=excluded.assigned_by,assigned_at=now();
 insert into public.school_classroom_audit(school_id,actor_id,event,metadata)
 values(p_school_id,p_actor,'teacher.assigned',
  jsonb_build_object('teacher_id',p_teacher,'class_id',p_class,'subject_id',p_subject));
 return jsonb_build_object('assigned',true);
end;
$$;

create or replace function public.school_revoke_teacher_assignment(
 p_school_id uuid,p_teacher uuid,p_class uuid,p_subject uuid,p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
begin
 if length(btrim(coalesce(p_reason,'')))<8 then raise exception 'Reason required'; end if;
 if not (
   exists(select 1 from public.platform_schools s join public.school_memberships m
    on m.school_id=s.id where s.id=p_school_id and s.status='active'
     and m.auth_user_id=p_actor and m.role='school_owner' and m.active)
   or exists(select 1 from public.platform_schools s
    join public.school_memberships m on m.school_id=s.id
    join public.school_admin_permissions p on p.school_id=m.school_id
     and p.auth_user_id=m.auth_user_id
    where s.id=p_school_id and s.status='active' and m.auth_user_id=p_actor
     and m.role='school_admin' and m.active and 'academics.manage'=any(p.permissions))
 ) then raise exception 'Academic management permission required'; end if;
 update public.school_teacher_assignments set active=false
 where school_id=p_school_id and teacher_id=p_teacher and class_id=p_class
   and subject_id=p_subject and active;
 if not found then raise exception 'Assignment is not active'; end if;
 insert into public.school_classroom_audit(school_id,actor_id,event,metadata)
 values(p_school_id,p_actor,'teacher.assignment_revoked',
  jsonb_build_object('teacher_id',p_teacher,'class_id',p_class,'subject_id',p_subject,
   'reason',p_reason));
 return jsonb_build_object('revoked',true);
end;
$$;

create or replace function public.school_create_lesson(
 p_school_id uuid,p_class uuid,p_subject uuid,p_title text,
 p_objectives text,p_lesson_date date,p_teacher uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare new_id uuid;
begin
 if not public.school_teacher_can(p_school_id,p_teacher,p_class,p_subject)
 then raise exception 'You are not assigned to teach this subject in this class'; end if;
 if length(btrim(coalesce(p_title,''))) not between 3 and 180 or
  length(coalesce(p_objectives,''))>4000 then raise exception 'Invalid lesson content'; end if;
 if p_lesson_date is null then raise exception 'Lesson date required'; end if;
 insert into public.school_lesson_plans(
  school_id,teacher_id,class_id,subject_id,title,objectives,lesson_date)
 values(p_school_id,p_teacher,p_class,p_subject,btrim(p_title),coalesce(p_objectives,''),p_lesson_date)
 returning id into new_id;
 insert into public.school_classroom_audit(school_id,actor_id,event,resource_id)
 values(p_school_id,p_teacher,'lesson.created',new_id);
 return jsonb_build_object('id',new_id);
end;
$$;

create or replace function public.school_create_homework(
 p_school_id uuid,p_class uuid,p_subject uuid,p_title text,
 p_instructions text,p_due_at timestamptz,p_teacher uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare new_id uuid;
begin
 if not public.school_teacher_can(p_school_id,p_teacher,p_class,p_subject)
 then raise exception 'You are not the assigned teacher'; end if;
 if length(btrim(coalesce(p_title,''))) not between 3 and 180 or
  length(btrim(coalesce(p_instructions,''))) not between 1 and 5000
 then raise exception 'Invalid homework content'; end if;
 if p_due_at is null or p_due_at<=now() or p_due_at>now()+interval '1 year'
 then raise exception 'Choose a future deadline within one year'; end if;
 insert into public.school_homework(
  school_id,teacher_id,class_id,subject_id,title,instructions,due_at)
 values(p_school_id,p_teacher,p_class,p_subject,btrim(p_title),btrim(p_instructions),p_due_at)
 returning id into new_id;
 insert into public.school_classroom_audit(school_id,actor_id,event,resource_id)
 values(p_school_id,p_teacher,'homework.draft_created',new_id);
 return jsonb_build_object('id',new_id,'status','draft');
end;
$$;

create or replace function public.school_publish_homework(
 p_school_id uuid,p_homework uuid,p_teacher uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare hw public.school_homework%rowtype;
begin
 select * into hw from public.school_homework
 where school_id=p_school_id and id=p_homework for update;
 if not found or hw.teacher_id<>p_teacher or hw.status<>'draft'
   then raise exception 'This draft is not yours or is not publishable'; end if;
 if not public.school_teacher_can(p_school_id,p_teacher,hw.class_id,hw.subject_id)
   then raise exception 'Teacher assignment is no longer active'; end if;
 if hw.due_at<=now() then raise exception 'Deadline has already passed'; end if;
 update public.school_homework
 set status='published',published_at=now() where id=p_homework;
 insert into public.school_classroom_audit(school_id,actor_id,event,resource_id)
 values(p_school_id,p_teacher,'homework.published',p_homework);
 return jsonb_build_object('published',true);
end;
$$;

create or replace function public.school_record_attendance(
 p_school_id uuid,p_class uuid,p_student uuid,p_date date,p_status text,p_teacher uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare school_year_id uuid;
begin
 if p_status not in ('present','absent','late','excused') then raise exception 'Invalid attendance status'; end if;
 if p_date is null or p_date> (now() at time zone 'Africa/Kigali')::date
   then raise exception 'Future attendance cannot be recorded'; end if;
 if not exists(select 1 from public.school_teacher_assignments a
    join public.school_memberships m on m.school_id=a.school_id
     and m.auth_user_id=a.teacher_id and m.role='teacher'
    join public.platform_schools s on s.id=a.school_id
    where a.school_id=p_school_id and a.class_id=p_class and a.teacher_id=p_teacher
    and a.active and m.active and s.status='active')
 then raise exception 'Teacher is not assigned to this class'; end if;
 select academic_year_id into school_year_id from public.school_classes
 where school_id=p_school_id and id=p_class and status='active';
 if not found or not exists(select 1 from public.school_academic_years
    where id=school_year_id and school_id=p_school_id and status='current'
     and p_date between starts_on and ends_on)
 or not exists(select 1 from public.school_student_enrollments
  where school_id=p_school_id and class_id=p_class and student_id=p_student
   and academic_year_id=school_year_id and status='active')
 then raise exception 'Student is not currently enrolled in this class'; end if;
 insert into public.school_attendance_records(
  school_id,class_id,student_id,attendance_on,status,taken_by)
 values(p_school_id,p_class,p_student,p_date,p_status,p_teacher)
 on conflict(school_id,class_id,student_id,attendance_on)
 do update set status=excluded.status,taken_by=excluded.taken_by,recorded_at=now();
 insert into public.school_classroom_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school_id,p_teacher,'attendance.recorded',p_student,
  jsonb_build_object('class_id',p_class,'on',p_date,'status',p_status));
 return jsonb_build_object('recorded',true);
end;
$$;

-- Student account activation is intentionally explicit, auditable and
-- separate from the public Student role-selection button.
create or replace function public.school_invite_student_account(
 p_school_id uuid,p_student uuid,p_email text,p_consent boolean,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare normalized_email text;
        student_dob date;
        new_id uuid;
begin
 if not exists(select 1 from public.platform_schools s
   join public.school_memberships m on m.school_id=s.id
   where s.id=p_school_id and s.status='active'
     and m.auth_user_id=p_actor and m.role='school_owner' and m.active)
 then raise exception 'Only the verified school owner can invite a student account'; end if;
 if p_consent is distinct from true then raise exception 'School identity and consent attestation required'; end if;
 select date_of_birth into student_dob from public.school_students
  where school_id=p_school_id and id=p_student and status='active';
 if not found then raise exception 'Student not found in this school'; end if;
 -- Conservative policy: unknown age or under 18 requires a verified
 -- guardian link BEFORE enabling a student account. This is a product
 -- safeguard, not a legal conclusion about age thresholds in Rwanda.
 if (student_dob is null or student_dob>current_date-interval '18 years')
   and not exists(select 1 from public.school_guardian_links
    where school_id=p_school_id and student_id=p_student and active)
 then raise exception 'Verified guardian link required before inviting this student'; end if;
 normalized_email:=lower(btrim(coalesce(p_email,'')));
 if normalized_email not like '%_@_%._%' or length(normalized_email)>254
 then raise exception 'Invalid student email'; end if;
 if exists(select 1 from public.school_student_accounts
   where school_id=p_school_id and student_id=p_student and active)
 then raise exception 'Student account already active'; end if;
 -- No two concurrently valid invitations for one student's identity.
 update public.school_student_account_invites set status='revoked'
 where school_id=p_school_id and student_id=p_student and status='pending'
   and email<>normalized_email;
 insert into public.school_student_account_invites(
  school_id,student_id,email,consent_attested,invited_by)
 values(p_school_id,p_student,normalized_email,true,p_actor)
 on conflict(school_id,student_id,email) do update
 set consent_attested=true,status='pending',invited_by=p_actor,
  expires_at=now()+interval '14 days',created_at=now(),claimed_at=null,claimed_by=null
 returning id into new_id;
 insert into public.school_classroom_audit(school_id,actor_id,event,resource_id)
 values(p_school_id,p_actor,'student.account_invited',p_student);
 return jsonb_build_object('invitation_id',new_id);
end;
$$;

create or replace function public.school_claim_student_account(
 p_school_id uuid,p_student uuid,p_user uuid,p_verified_email text
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare inv public.school_student_account_invites%rowtype;
begin
 if not exists(select 1 from public.platform_schools where id=p_school_id and status='active')
 then raise exception 'School unavailable'; end if;
 if not exists(select 1 from auth.users
   where id=p_user and lower(email)=lower(btrim(p_verified_email)) and email_confirmed_at is not null)
 then raise exception 'Verified student email does not match invitation'; end if;
 select * into inv from public.school_student_account_invites
 where school_id=p_school_id and student_id=p_student
  and email=lower(btrim(p_verified_email)) for update;
 if not found or inv.status<>'pending' or inv.expires_at<=now() or not inv.consent_attested
 then raise exception 'No current school-approved student invitation'; end if;
 if not exists(select 1 from public.school_students where school_id=p_school_id
   and id=p_student and status='active') then raise exception 'Student unavailable'; end if;
 if exists(select 1 from public.school_students stu
   where stu.school_id=p_school_id and stu.id=p_student
     and (stu.date_of_birth is null or stu.date_of_birth>current_date-interval '18 years')
     and not exists(select 1 from public.school_guardian_links g
       where g.school_id=p_school_id and g.student_id=p_student and g.active))
 then raise exception 'A verified guardian link is still required'; end if;
 if exists(select 1 from public.school_student_accounts
   where school_id=p_school_id and student_id=p_student and active)
 then raise exception 'This student account has already been claimed'; end if;
 if exists(select 1 from public.school_student_accounts
   where school_id=p_school_id and auth_user_id=p_user and student_id<>p_student and active)
 then raise exception 'One student account cannot represent multiple students'; end if;
 insert into public.school_student_accounts(
  school_id,student_id,auth_user_id,authorized_by)
 values(p_school_id,p_student,p_user,inv.invited_by)
 on conflict(school_id,student_id) do update
 set auth_user_id=excluded.auth_user_id,active=true,
  authorized_by=excluded.authorized_by,authorized_at=now();
 insert into public.school_memberships(school_id,auth_user_id,role,active)
 values(p_school_id,p_user,'student',true)
 on conflict(school_id,auth_user_id,role) do update set active=true;
 update public.school_student_account_invites
 set status='claimed',claimed_at=now(),claimed_by=p_user where id=inv.id;
 insert into public.school_classroom_audit(school_id,actor_id,event,resource_id)
 values(p_school_id,p_user,'student.account_claimed',p_student);
 return jsonb_build_object('claimed',true,'role','student');
end;
$$;

create or replace function public.school_revoke_student_account(
 p_school_id uuid,p_student uuid,p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $
declare previous_user uuid;
begin
 if length(btrim(coalesce(p_reason,'')))<8 then raise exception 'Audit reason required'; end if;
 if not exists(select 1 from public.platform_schools s
  join public.school_memberships m on m.school_id=s.id
  where s.id=p_school_id and s.status='active' and m.auth_user_id=p_actor
   and m.role='school_owner' and m.active)
 then raise exception 'Only the school owner may revoke student access'; end if;
 select auth_user_id into previous_user from public.school_student_accounts
  where school_id=p_school_id and student_id=p_student and active for update;
 if not found then raise exception 'Student account is not active'; end if;
 update public.school_student_accounts set active=false
 where school_id=p_school_id and student_id=p_student and auth_user_id=previous_user;
 update public.school_memberships set active=false
 where school_id=p_school_id and auth_user_id=previous_user and role='student';
 update public.school_student_account_invites set status='revoked'
 where school_id=p_school_id and student_id=p_student;
 insert into public.school_classroom_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school_id,p_actor,'student.account_revoked',p_student,
  jsonb_build_object('reason',p_reason));
 return jsonb_build_object('revoked',true);
end;
$;

create or replace function public.school_submit_homework(
 p_school_id uuid,p_homework uuid,p_response text,p_student_user uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare student_row public.school_student_accounts%rowtype;
declare hw public.school_homework%rowtype;
declare new_id uuid;
begin
 if not exists(select 1 from public.school_memberships m
   join public.platform_schools s on s.id=m.school_id
   where s.id=p_school_id and s.status='active' and m.auth_user_id=p_student_user
   and m.role='student' and m.active)
 then raise exception 'School student account unavailable'; end if;
 select * into student_row from public.school_student_accounts
 where school_id=p_school_id and auth_user_id=p_student_user and active;
 if not found then raise exception 'No school-verified student account'; end if;
 select * into hw from public.school_homework
 where school_id=p_school_id and id=p_homework and status='published';
 if not found then raise exception 'Homework is not published'; end if;
 if not exists(select 1 from public.school_student_enrollments e
  join public.school_classes c on c.school_id=e.school_id and c.id=e.class_id
  where e.school_id=p_school_id and e.student_id=student_row.student_id
   and e.class_id=hw.class_id and e.status='active'
   and exists(select 1 from public.school_academic_years y
    where y.id=c.academic_year_id and y.school_id=c.school_id
     and y.status='current'))
 then raise exception 'This homework is not assigned to your current class'; end if;
 if length(btrim(coalesce(p_response,''))) not between 1 and 5000
 then raise exception 'Write a response of up to 5000 characters'; end if;
 insert into public.school_homework_submissions(
  school_id,homework_id,student_id,response_text,is_late)
 values(p_school_id,p_homework,student_row.student_id,
  btrim(p_response),now()>hw.due_at)
 returning id into new_id;
 insert into public.school_classroom_audit(school_id,actor_id,event,resource_id)
 values(p_school_id,p_student_user,'homework.submitted',new_id);
 return jsonb_build_object('id',new_id,'submitted',true);
end;
$$;

-- Only trusted server may call these functions. Never expose service key in client.
revoke all on function public.school_teacher_can(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.school_assign_teacher(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.school_revoke_teacher_assignment(uuid,uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.school_create_lesson(uuid,uuid,uuid,text,text,date,uuid) from public,anon,authenticated;
revoke all on function public.school_create_homework(uuid,uuid,uuid,text,text,timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.school_publish_homework(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.school_record_attendance(uuid,uuid,uuid,date,text,uuid) from public,anon,authenticated;
revoke all on function public.school_invite_student_account(uuid,uuid,text,boolean,uuid) from public,anon,authenticated;
revoke all on function public.school_claim_student_account(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.school_revoke_student_account(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.school_submit_homework(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.school_teacher_can(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.school_assign_teacher(uuid,uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.school_revoke_teacher_assignment(uuid,uuid,uuid,uuid,text,uuid) to service_role;
grant execute on function public.school_create_lesson(uuid,uuid,uuid,text,text,date,uuid) to service_role;
grant execute on function public.school_create_homework(uuid,uuid,uuid,text,text,timestamptz,uuid) to service_role;
grant execute on function public.school_publish_homework(uuid,uuid,uuid) to service_role;
grant execute on function public.school_record_attendance(uuid,uuid,uuid,date,text,uuid) to service_role;
grant execute on function public.school_invite_student_account(uuid,uuid,text,boolean,uuid) to service_role;
grant execute on function public.school_claim_student_account(uuid,uuid,uuid,text) to service_role;
grant execute on function public.school_revoke_student_account(uuid,uuid,text,uuid) to service_role;
grant execute on function public.school_submit_homework(uuid,uuid,text,uuid) to service_role;
