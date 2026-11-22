-- Module 5: Rwanda curriculum-based assessment and school-issued report cards.
-- Applies AFTER school_classrooms_v1.sql. GitHub source only, not production.
-- Primary guidance: NESA December 2023 Guidelines on Recording Marks in CA-MIS:
-- https://www.nesa.gov.rw/fileadmin/user_upload/NESA/Ressources/Assessment_Standards_and_Guidelines/Guidelines_on_Recording_Marks_in_CA-MIS_December_2023__Signed_.pdf
-- General/Professional Education: unit 25%, projects 25%, end-term 50%.
-- Subject maximum marks = weekly teaching periods * 10.
-- CA-MIS / NESA official certification is NOT claimed. TVET modules have
-- different assessment rules and cannot use this automatic general profile.

create table public.school_report_admin_permissions (
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 auth_user_id uuid not null references auth.users(id) on delete restrict,
 role text not null default 'school_admin' check(role='school_admin'),
 permissions text[] not null default '{}'::text[],
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 primary key(school_id,auth_user_id),
 foreign key(school_id,auth_user_id,role)
  references public.school_memberships(school_id,auth_user_id,role) on delete restrict,
 check(permissions <@ array['curriculum.manage','reports.read']::text[])
);

create table public.school_curriculum_profiles (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 academic_year_id uuid not null,
 name text not null check(length(btrim(name)) between 3 and 120),
 track text not null check(track in (
   'general','professional','tvet','nursery','international','higher_education'
 )),
 pathway text not null default '' check(length(pathway)<=120),
 policy_version text not null check(length(btrim(policy_version)) between 3 and 120),
 source_title text not null check(length(btrim(source_title)) between 3 and 240),
 source_url text not null check(length(source_url) between 12 and 1000
   and source_url like 'https://%'),
 status text not null default 'draft' check(status in ('draft','approved','retired')),
 created_by uuid not null references auth.users(id) on delete restrict,
 approved_by uuid references auth.users(id) on delete restrict,
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 unique(school_id,id),
 unique(school_id,id,academic_year_id),
 unique(school_id,academic_year_id,name),
 foreign key(school_id,academic_year_id)
  references public.school_academic_years(school_id,id) on delete restrict,
 check((status='approved' and approved_at is not null and approved_by is not null)
   or (status<>'approved'))
);
create index school_curriculum_profiles_year_idx
 on public.school_curriculum_profiles(school_id,academic_year_id,status);

create table public.school_curriculum_class_subjects (
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 class_id uuid not null,
 subject_id uuid not null,
 academic_year_id uuid not null,
 curriculum_profile_id uuid not null,
 weekly_periods integer check(weekly_periods is null or weekly_periods between 1 and 20),
 module_credits integer check(module_credits is null or module_credits between 1 and 100),
 syllabus_title text not null check(length(btrim(syllabus_title)) between 3 and 200),
 syllabus_url text not null check(length(syllabus_url) between 12 and 1000
   and syllabus_url like 'https://%'),
 approved_by uuid references auth.users(id) on delete restrict,
 approved_at timestamptz,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 primary key(school_id,class_id,subject_id),
 foreign key(school_id,class_id,subject_id)
  references public.school_class_subjects(school_id,class_id,subject_id) on delete restrict,
 foreign key(school_id,class_id,academic_year_id)
  references public.school_classes(school_id,id,academic_year_id) on delete restrict,
 foreign key(school_id,curriculum_profile_id,academic_year_id)
  references public.school_curriculum_profiles(school_id,id,academic_year_id) on delete restrict,
 check((weekly_periods is not null and module_credits is null)
   or (weekly_periods is null and module_credits is not null)
   or (weekly_periods is null and module_credits is null))
);

create table public.school_curriculum_units (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 class_id uuid not null,
 subject_id uuid not null,
 unit_code text not null check(length(btrim(unit_code)) between 1 and 30),
 unit_title text not null check(length(btrim(unit_title)) between 3 and 180),
 key_competence text not null check(length(btrim(key_competence)) between 3 and 2000),
 learning_outcomes text not null default '' check(length(learning_outcomes)<=3000),
 entered_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(school_id,class_id,subject_id,unit_code),
 foreign key(school_id,class_id,subject_id)
  references public.school_curriculum_class_subjects(school_id,class_id,subject_id)
  on delete restrict
);
create index school_curriculum_units_class_idx
 on public.school_curriculum_units(school_id,class_id,subject_id);

create table public.school_assessment_terms (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 academic_year_id uuid not null,
 term_number smallint not null check(term_number between 1 and 3),
 begins_on date not null,
 ends_on date not null,
 status text not null default 'open' check(status in ('open','closed')),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(school_id,id),
 unique(school_id,id,academic_year_id),
 unique(school_id,academic_year_id,term_number),
 foreign key(school_id,academic_year_id)
  references public.school_academic_years(school_id,id) on delete restrict,
 check(ends_on>=begins_on)
);
create index school_assessment_terms_year_idx
 on public.school_assessment_terms(school_id,academic_year_id,term_number);

create table public.school_assessment_marks (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 term_id uuid not null,
 student_id uuid not null,
 class_id uuid not null,
 subject_id uuid not null,
 teacher_id uuid not null references auth.users(id) on delete restrict,
 category text not null check(category in ('unit','project','end_term')),
 assessment_code text not null check(length(btrim(assessment_code)) between 1 and 30),
 score numeric(8,2) not null check(score>=0),
 maximum_marks numeric(8,2) not null check(maximum_marks>0 and score<=maximum_marks),
 raw_score numeric(8,2) not null check(raw_score>=0),
 raw_maximum numeric(8,2) not null check(raw_maximum>0 and raw_score<=raw_maximum),
 learning_feedback text not null default '' check(length(learning_feedback)<=1500),
 entered_at timestamptz not null default now(),
 unique(school_id,term_id,student_id,class_id,subject_id,category,assessment_code),
 foreign key(school_id,term_id)
  references public.school_assessment_terms(school_id,id) on delete restrict,
 foreign key(school_id,student_id)
  references public.school_students(school_id,id) on delete restrict,
 foreign key(school_id,class_id,subject_id)
  references public.school_curriculum_class_subjects(school_id,class_id,subject_id)
  on delete restrict
);
create index school_assessment_marks_student_idx
 on public.school_assessment_marks(school_id,student_id,term_id);
create index school_assessment_marks_teacher_idx
 on public.school_assessment_marks(school_id,teacher_id,term_id);

create table public.school_published_reports (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 term_id uuid not null,
 student_id uuid not null,
 class_id uuid not null,
 status text not null default 'published' check(status in ('published','withdrawn')),
 report_data jsonb not null,
 approved_by uuid not null references auth.users(id) on delete restrict,
 published_at timestamptz not null default now(),
 withdrawn_at timestamptz,
 withdrawn_by uuid references auth.users(id) on delete restrict,
 withdrawal_reason text,
 unique(school_id,term_id,student_id),
 unique(school_id,id),
 foreign key(school_id,term_id)
  references public.school_assessment_terms(school_id,id) on delete restrict,
 foreign key(school_id,student_id)
  references public.school_students(school_id,id) on delete restrict,
 foreign key(school_id,class_id)
  references public.school_classes(school_id,id) on delete restrict,
 check((status='published' and withdrawn_at is null)
   or (status='withdrawn' and withdrawn_at is not null
      and withdrawn_by is not null
      and length(btrim(withdrawal_reason))>=8))
);
create index school_published_reports_student_idx
 on public.school_published_reports(school_id,student_id,published_at desc);

create table public.school_report_audit (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 event text not null check(length(event) between 3 and 110),
 resource_id uuid,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index school_report_audit_school_idx
 on public.school_report_audit(school_id,created_at desc);

do $$
declare tbl text;
begin
 foreach tbl in array array[
  'school_report_admin_permissions','school_curriculum_profiles','school_curriculum_class_subjects',
  'school_curriculum_units','school_assessment_terms','school_assessment_marks',
  'school_published_reports','school_report_audit'
 ] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on table public.%I from public,anon,authenticated',tbl);
  execute format('grant all on table public.%I to service_role',tbl);
 end loop;
end $$;

-- School owner must explicitly review and approve a specific official syllabus
-- reference. Merely pasting a link does not establish government endorsement.
create or replace function public.school_report_owner_authorized(
 p_school uuid,p_actor uuid
) returns boolean language sql stable security invoker
set search_path=pg_catalog,public as $$
 select exists(select 1 from public.platform_schools s
 join public.school_memberships m on m.school_id=s.id
 where s.id=p_school and s.status='active' and m.auth_user_id=p_actor
   and m.role='school_owner' and m.active)
$$;

create or replace function public.school_set_report_permissions(
 p_school uuid,p_target uuid,p_permissions text[],p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $
declare prior text[];
begin
 if not public.school_report_owner_authorized(p_school,p_actor)
 then raise exception 'Only school owner can grant curriculum/report permissions'; end if;
 if p_actor=p_target then raise exception 'Cannot edit your own owner permissions'; end if;
 if length(btrim(coalesce(p_reason,'')))<8 or length(p_reason)>600
 then raise exception 'Audit reason required'; end if;
 if p_permissions is null or not (p_permissions <@ array['curriculum.manage','reports.read']::text[])
 then raise exception 'Unknown permission'; end if;
 if not exists(select 1 from public.school_memberships
  where school_id=p_school and auth_user_id=p_target and role='school_admin' and active)
 then raise exception 'Target is not an active local school administrator'; end if;
 select permissions into prior from public.school_report_admin_permissions
 where school_id=p_school and auth_user_id=p_target for update;
 insert into public.school_report_admin_permissions(
  school_id,auth_user_id,role,permissions,updated_by)
 values(p_school,p_target,'school_admin',p_permissions,p_actor)
 on conflict(school_id,auth_user_id) do update
 set permissions=excluded.permissions,updated_by=p_actor,updated_at=now();
 insert into public.school_report_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school,p_actor,'report.permissions_changed',p_target,
  jsonb_build_object('before',coalesce(prior,'{}'::text[]),
   'after',p_permissions,'reason',p_reason));
 return jsonb_build_object('updated',true);
end;
$;

create or replace function public.school_approve_curriculum(
 p_school uuid,p_profile uuid,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare p public.school_curriculum_profiles%rowtype;
begin
 if not public.school_report_owner_authorized(p_school,p_actor)
 then raise exception 'Only the verified school owner approves curriculum sources'; end if;
 select * into p from public.school_curriculum_profiles
   where school_id=p_school and id=p_profile for update;
 if not found or p.status<>'draft' then raise exception 'Curriculum draft unavailable'; end if;
 if not exists(select 1 from public.school_academic_years where
  school_id=p_school and id=p.academic_year_id and status<>'closed')
 then raise exception 'Curriculum academic year is closed'; end if;
 update public.school_curriculum_profiles
 set status='approved',approved_at=now(),approved_by=p_actor
 where school_id=p_school and id=p_profile;
 insert into public.school_report_audit(school_id,actor_id,event,resource_id)
 values(p_school,p_actor,'curriculum.profile_approved',p_profile);
 return jsonb_build_object('approved',true,'profile_id',p_profile);
end;
$$;

create or replace function public.school_approve_curriculum_subject(
 p_school uuid,p_class uuid,p_subject uuid,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare mapping public.school_curriculum_class_subjects%rowtype;
declare track text;
begin
 if not public.school_report_owner_authorized(p_school,p_actor)
 then raise exception 'Only the verified school owner approves subject curriculum'; end if;
 select * into mapping from public.school_curriculum_class_subjects
 where school_id=p_school and class_id=p_class and subject_id=p_subject for update;
 if not found or mapping.approved_at is not null
 then raise exception 'Subject curriculum is missing or already approved'; end if;
 select p.track into track from public.school_curriculum_profiles p
 where p.school_id=p_school and p.id=mapping.curriculum_profile_id
   and p.status='approved';
 if not found then raise exception 'Approve the curriculum source profile first'; end if;
 if track in ('general','professional') and mapping.weekly_periods is null
 then raise exception 'Verified weekly teaching periods are required'; end if;
 if track in ('general','professional') and not exists(
   select 1 from public.school_curriculum_units
   where school_id=p_school and class_id=p_class and subject_id=p_subject)
 then raise exception 'Record verified syllabus units and key competences before approval'; end if;
 if track='tvet' and mapping.module_credits is null
 then raise exception 'TVET module credits are required'; end if;
 update public.school_curriculum_class_subjects
 set approved_by=p_actor,approved_at=now()
 where school_id=p_school and class_id=p_class and subject_id=p_subject;
 insert into public.school_report_audit(school_id,actor_id,event,metadata)
 values(p_school,p_actor,'curriculum.subject_approved',
  jsonb_build_object('class_id',p_class,'subject_id',p_subject));
 return jsonb_build_object('approved',true,'subject_id',p_subject);
end;
$$;

-- A teacher records marks only for an active current-year class and assigned
-- subject; the score ceiling derives from owner-approved curriculum periods.
-- Multiple unit and project entries are averaged for the NESA 25/25/50 rule.
create or replace function public.school_record_assessment(
 p_school uuid,p_term uuid,p_student uuid,p_class uuid,p_subject uuid,
 p_category text,p_assessment_code text,p_raw_score numeric,p_raw_maximum numeric,
 p_feedback text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare t public.school_assessment_terms%rowtype;
        m public.school_curriculum_class_subjects%rowtype;
        track text;
        max_allowed numeric;
        normalized_score numeric;
        entry_id uuid;
begin
 if p_category not in ('unit','project','end_term')
 then raise exception 'Invalid assessment category'; end if;
 if length(btrim(coalesce(p_assessment_code,''))) not between 1 and 30
 or length(coalesce(p_feedback,''))>1500
 then raise exception 'Invalid assessment reference or feedback'; end if;
 if p_category='end_term' and p_assessment_code<>'TERM'
 then raise exception 'Use TERM for the one end-of-term assessment'; end if;
 if p_category<>'end_term' and p_assessment_code='TERM'
 then raise exception 'Reserved assessment reference'; end if;
 if p_category='unit' and not exists(select 1 from public.school_curriculum_units
   where school_id=p_school and class_id=p_class
   and subject_id=p_subject and unit_code=p_assessment_code)
 then raise exception 'End-of-unit marks must reference an approved curriculum unit'; end if;
 select * into t from public.school_assessment_terms
 where school_id=p_school and id=p_term and status='open';
 if not found then raise exception 'Assessment term unavailable or closed'; end if;
 if not exists(select 1 from public.school_academic_years y
   where y.school_id=p_school and y.id=t.academic_year_id and y.status='current')
 then raise exception 'Only a current academic year may receive marks'; end if;
 if not public.school_teacher_can(p_school,p_actor,p_class,p_subject)
 then raise exception 'Teacher is not currently assigned to this class and subject'; end if;
 if not exists(select 1 from public.school_student_enrollments e
   where e.school_id=p_school and e.student_id=p_student and e.class_id=p_class
     and e.academic_year_id=t.academic_year_id and e.status='active')
 then raise exception 'Student is not enrolled in this current-year class'; end if;
 -- Lock the same student row that the publisher locks to serialize marks
 -- and report publication, preventing a mark/report race condition.
 perform 1 from public.school_students where school_id=p_school
   and id=p_student and status='active' for update;
 if not found then raise exception 'Student unavailable'; end if;
 if exists(select 1 from public.school_published_reports
   where school_id=p_school and term_id=p_term and student_id=p_student)
 then raise exception 'A report exists; marks cannot be silently changed'; end if;
 select * into m from public.school_curriculum_class_subjects
 where school_id=p_school and class_id=p_class and subject_id=p_subject
   and academic_year_id=t.academic_year_id and approved_at is not null;
 if not found then raise exception 'School owner must approve official subject allocation first'; end if;
 select p.track into track from public.school_curriculum_profiles p
 where p.school_id=p_school and p.id=m.curriculum_profile_id and p.status='approved';
 if not found or track not in ('general','professional')
 then raise exception 'This module cannot grade this curriculum track with general-education weights'; end if;
 if m.weekly_periods is null then raise exception 'Subject teaching periods missing'; end if;
 max_allowed:=m.weekly_periods*10;
 if p_raw_score is null or p_raw_maximum is null
  or p_raw_maximum<=0 or p_raw_maximum>10000
  or p_raw_score<0 or p_raw_score>p_raw_maximum
 then raise exception 'Marks earned must be from zero to the actual assessment maximum'; end if;
 normalized_score:=round(p_raw_score / p_raw_maximum * max_allowed,2);
 insert into public.school_assessment_marks(
  school_id,term_id,student_id,class_id,subject_id,teacher_id,category,
  assessment_code,score,maximum_marks,raw_score,raw_maximum,learning_feedback)
 values(p_school,p_term,p_student,p_class,p_subject,p_actor,p_category,
  btrim(p_assessment_code),normalized_score,max_allowed,p_raw_score,p_raw_maximum,
  coalesce(p_feedback,''))
 on conflict(school_id,term_id,student_id,class_id,subject_id,category,assessment_code)
 do update set score=excluded.score,teacher_id=p_actor,
    maximum_marks=excluded.maximum_marks,raw_score=excluded.raw_score,
    raw_maximum=excluded.raw_maximum,
    learning_feedback=excluded.learning_feedback,entered_at=now()
 returning id into entry_id;
 insert into public.school_report_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school,p_actor,'assessment.mark_recorded',entry_id,
  jsonb_build_object('term_id',p_term,'student_id',p_student,'class_id',p_class,
   'subject_id',p_subject,'category',p_category));
 return jsonb_build_object('saved',true,'id',entry_id,
    'normalized_marks',normalized_score,'maximum_marks',max_allowed);
end;
$$;

-- Atomic, immutable school-issued term report snapshot.
-- For General and Professional Education, each subject must have at least
-- one end-unit assessment, two projects and exactly one end-term exam.
-- Publication is blocked for TVET/nursery/higher/international until their
-- distinct, source-reviewed grading specifications are implemented.
create or replace function public.school_publish_term_report(
 p_school uuid,p_student uuid,p_term uuid,p_remark text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare t public.school_assessment_terms%rowtype;
        e public.school_student_enrollments%rowtype;
        st public.school_students%rowtype;
        item record;
        marks jsonb:='[]'::jsonb;
        nsubjects integer:=0;
        subject_max numeric;
        unit_avg numeric;
        project_avg numeric;
        exam_avg numeric;
        total numeric;
        all_earned numeric:=0;
        all_max numeric:=0;
        count_units bigint;
        count_projects bigint;
        count_exam bigint;
        profile_track text;
        report_id uuid;
        remark text;
        learning_notes text;
        units_json jsonb;
        attendance_json jsonb;
        class_label text;
        year_label text;
begin
 if not public.school_report_owner_authorized(p_school,p_actor)
 then raise exception 'Only the verified school owner may publish student reports'; end if;
 remark:=btrim(coalesce(p_remark,''));
 if length(remark)>2000 then raise exception 'School remark is too long'; end if;
 -- Prevent concurrent report publication/marking snapshots for one school
 -- student+term (all marks written by RPC which locks the same student).
 perform 1 from public.school_students
 where school_id=p_school and id=p_student and status='active' for update;
 if not found then raise exception 'Active student not found in this school'; end if;
 select * into t from public.school_assessment_terms
 where school_id=p_school and id=p_term;
 if not found then raise exception 'Assessment term not found'; end if;
 if not exists(select 1 from public.school_academic_years
   where school_id=p_school and id=t.academic_year_id and status='current')
 then raise exception 'Only current academic year reports may be released'; end if;
 select * into e from public.school_student_enrollments
 where school_id=p_school and student_id=p_student
   and academic_year_id=t.academic_year_id and status='active';
 if not found then raise exception 'No current-year enrollment for the student'; end if;
 select * into st from public.school_students
 where school_id=p_school and id=p_student;
 select concat_ws(' · ',name,nullif(section,'')) into class_label
 from public.school_classes where school_id=p_school and id=e.class_id;
 select name into year_label from public.school_academic_years
 where school_id=p_school and id=t.academic_year_id;
 if exists(select 1 from public.school_published_reports
 where school_id=p_school and student_id=p_student and term_id=p_term)
 then raise exception 'Report already exists; use formal withdrawal and revision process'; end if;
 for item in
   select map.subject_id,map.weekly_periods,map.approved_at,
     c.name as subject_name,c.code as subject_code,
     p.track as track,p.status as profile_status,
     p.source_title,p.source_url,p.policy_version,map.syllabus_url
   from public.school_class_subjects cs
   join public.school_curriculum_class_subjects map
     on map.school_id=cs.school_id and map.class_id=cs.class_id
      and map.subject_id=cs.subject_id
   join public.school_curriculum_profiles p
     on p.school_id=map.school_id and p.id=map.curriculum_profile_id
   join public.school_subjects c
     on c.school_id=map.school_id and c.id=map.subject_id
   where cs.school_id=p_school and cs.class_id=e.class_id
   order by c.name
 loop
   if item.profile_status<>'approved' or item.approved_at is null
    or item.track not in ('general','professional') or item.weekly_periods is null
   then raise exception 'Only an approved General/Professional Education curriculum may be published'; end if;
   subject_max:=item.weekly_periods*10;
   select count(*) filter(where category='unit'),
          count(*) filter(where category='project'),
          count(*) filter(where category='end_term'),
          avg(score) filter(where category='unit'),
          avg(score) filter(where category='project'),
          avg(score) filter(where category='end_term')
   into count_units,count_projects,count_exam,unit_avg,project_avg,exam_avg
   from public.school_assessment_marks
   where school_id=p_school and student_id=p_student and term_id=p_term
     and class_id=e.class_id and subject_id=item.subject_id;
   if count_units<1 or count_projects<2 or count_exam<>1
   then raise exception 'Missing unit, at least two projects, or end-term marks for subject %',
     item.subject_name; end if;
   if exists(select 1 from public.school_curriculum_units u
     where u.school_id=p_school and u.class_id=e.class_id
       and u.subject_id=item.subject_id and not exists(
       select 1 from public.school_assessment_marks a
       where a.school_id=p_school and a.student_id=p_student and a.term_id=p_term
         and a.class_id=e.class_id and a.subject_id=item.subject_id
         and a.category='unit' and a.assessment_code=u.unit_code))
   then raise exception 'Missing recorded syllabus unit assessment for subject %',
     item.subject_name; end if;
   select string_agg(distinct nullif(btrim(learning_feedback),''), '; ')
   into learning_notes from public.school_assessment_marks
   where school_id=p_school and student_id=p_student and term_id=p_term
    and class_id=e.class_id and subject_id=item.subject_id
    and length(btrim(learning_feedback))>0;
   select coalesce(jsonb_agg(jsonb_build_object(
     'unit_code',u.unit_code,'title',u.unit_title,
     'competence',u.key_competence
   ) order by u.unit_code),'[]'::jsonb) into units_json
   from public.school_curriculum_units u
   where u.school_id=p_school and u.class_id=e.class_id
    and u.subject_id=item.subject_id;
   total:=round((unit_avg*0.25+project_avg*0.25+exam_avg*0.50)::numeric,2);
   all_earned:=all_earned+total;
   all_max:=all_max+subject_max;
   marks:=marks || jsonb_build_array(jsonb_build_object(
     'subject_id',item.subject_id,'subject_name',item.subject_name,
     'subject_code',item.subject_code,'weekly_periods',item.weekly_periods,
     'maximum_marks',subject_max,'end_unit_avg',round(unit_avg,2),
     'project_avg',round(project_avg,2),'end_term_marks',round(exam_avg,2),
     'term_total_marks',total,
     'term_percentage',round(100*total/subject_max,2),
     'curriculum_source',item.source_title,'curriculum_source_url',item.source_url,
     'syllabus_url',item.syllabus_url,'policy_version',item.policy_version,
     'teacher_feedback',coalesce(learning_notes,''),'curriculum_units',units_json
   ));
   nsubjects:=nsubjects+1;
 end loop;
 if nsubjects=0 then raise exception 'No approved, mapped curriculum subjects for this class'; end if;
 -- Ensure ALL class subjects have approved mappings: a missing mapping must
 -- not silently disappear and inflate reported performance.
 if (select count(*) from public.school_class_subjects
     where school_id=p_school and class_id=e.class_id)<>nsubjects
 then raise exception 'Curriculum mappings are incomplete for this class'; end if;
 select jsonb_build_object(
   'present',count(*) filter(where status='present'),
   'absent',count(*) filter(where status='absent'),
   'late',count(*) filter(where status='late'),
   'excused',count(*) filter(where status='excused'),
   'recorded_days',count(*)
 ) into attendance_json from public.school_attendance_records
 where school_id=p_school and class_id=e.class_id and student_id=p_student
   and attendance_on between t.begins_on and t.ends_on;
 insert into public.school_published_reports(
   school_id,term_id,student_id,class_id,report_data,approved_by)
 values(p_school,p_term,p_student,e.class_id,
   jsonb_build_object(
    'report_kind','school_issued_term_report',
    'guideline','NESA 2023 CA-MIS marking guidelines; no NESA endorsement implied',
    'student_id',p_student,'student_code',st.student_code,
    'student_name',st.first_name||' '||st.last_name,
    'academic_year_id',t.academic_year_id,'academic_year',year_label,
    'term',t.term_number,'term_begins',t.begins_on,'term_ends',t.ends_on,
    'class_id',e.class_id,'class_name',class_label,'school_id',p_school,
    'subjects',marks,'earned_marks',round(all_earned,2),
    'maximum_marks',all_max,'overall_percentage',round(100*all_earned/all_max,2),
    'school_remark',remark,'attendance',attendance_json,
    'weights',jsonb_build_object('unit',25,'project',25,'end_term',50)
   ),p_actor)
 returning id into report_id;
 insert into public.school_report_audit(school_id,actor_id,event,resource_id,
   metadata)
 values(p_school,p_actor,'term_report.published',report_id,
   jsonb_build_object('student_id',p_student,'term_id',p_term));
 return jsonb_build_object('published',true,'report_id',report_id);
end;
$$;

create or replace function public.school_withdraw_term_report(
 p_school uuid,p_report uuid,p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
begin
 if not public.school_report_owner_authorized(p_school,p_actor)
 then raise exception 'Only the verified school owner may withdraw reports'; end if;
 if length(btrim(coalesce(p_reason,'')))<8 or length(p_reason)>1000
 then raise exception 'A written reason is required'; end if;
 update public.school_published_reports
 set status='withdrawn',withdrawn_at=now(),withdrawn_by=p_actor,
     withdrawal_reason=btrim(p_reason)
 where school_id=p_school and id=p_report and status='published';
 if not found then raise exception 'Published report not found'; end if;
 insert into public.school_report_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school,p_actor,'term_report.withdrawn',p_report,
  jsonb_build_object('reason',p_reason));
 return jsonb_build_object('withdrawn',true);
end;
$$;

-- Do not let browser clients invoke privileged school-data RPCs directly.
revoke all on function public.school_report_owner_authorized(uuid,uuid) from public,anon,authenticated;
revoke all on function public.school_set_report_permissions(uuid,uuid,text[],text,uuid) from public,anon,authenticated;
revoke all on function public.school_approve_curriculum(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.school_approve_curriculum_subject(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.school_record_assessment(uuid,uuid,uuid,uuid,uuid,text,text,numeric,numeric,text,uuid) from public,anon,authenticated;
revoke all on function public.school_publish_term_report(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.school_withdraw_term_report(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.school_report_owner_authorized(uuid,uuid) to service_role;
grant execute on function public.school_set_report_permissions(uuid,uuid,text[],text,uuid) to service_role;
grant execute on function public.school_approve_curriculum(uuid,uuid,uuid) to service_role;
grant execute on function public.school_approve_curriculum_subject(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.school_record_assessment(uuid,uuid,uuid,uuid,uuid,text,text,numeric,numeric,text,uuid) to service_role;
grant execute on function public.school_publish_term_report(uuid,uuid,uuid,text,uuid) to service_role;
grant execute on function public.school_withdraw_term_report(uuid,uuid,text,uuid) to service_role;
