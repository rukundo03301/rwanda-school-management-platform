-- Learning content layer: activities, flashcards, storybooks and participation records,
-- plus tenant-purge registration for these tables and the nursery observation tables.
-- Content starts as a draft for teacher review and is only visible to children and
-- guardians once a teacher or leader publishes it. Same security model as the rest of
-- the school schema: RLS on, no client grants, every read and write goes through the API.
create table if not exists public.school_learning_activities (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 class_id uuid not null,
 subject_id uuid not null,
 title text not null check(length(btrim(title)) between 3 and 160),
 language text not null check(language in ('Kinyarwanda','English','French')),
 learning_objective text not null default '' check(length(learning_objective)<=600),
 activity_type text not null check(activity_type in
  ('song','story_cards','counting','colouring','shape_tiles','nature_walk','play','other')),
 teacher_steps text not null default '' check(length(teacher_steps)<=3000),
 student_steps text not null default '' check(length(student_steps)<=3000),
 materials_needed text not null default '' check(length(materials_needed)<=1000),
 estimated_minutes smallint not null default 20 check(estimated_minutes between 5 and 120),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(school_id,id),
 foreign key(school_id,class_id) references public.school_classes(school_id,id) on delete restrict,
 foreign key(school_id,subject_id) references public.school_subjects(school_id,id) on delete restrict
);
create index if not exists school_learning_activities_class_idx
 on public.school_learning_activities(school_id,class_id,status);

create table if not exists public.school_flashcards (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 class_id uuid not null,
 subject_id uuid not null,
 language text not null check(language in ('Kinyarwanda','English','French')),
 front text not null check(length(btrim(front)) between 1 and 120),
 back text not null default '' check(length(back)<=240),
 kind text not null default 'word' check(kind in ('word','shape','number','colour','picture')),
 image_path text check(image_path is null or length(image_path)<=300),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(school_id,id),
 foreign key(school_id,class_id) references public.school_classes(school_id,id) on delete restrict,
 foreign key(school_id,subject_id) references public.school_subjects(school_id,id) on delete restrict
);
create index if not exists school_flashcards_class_idx
 on public.school_flashcards(school_id,class_id,status);

create table if not exists public.school_storybooks (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 subject_id uuid,
 title text not null check(length(btrim(title)) between 3 and 160),
 language text not null check(language in ('Kinyarwanda','English','French')),
 age_band text not null default '3-6' check(length(age_band)<=20),
 author text not null default '' check(length(author)<=160),
 summary text not null default '' check(length(summary)<=2000),
 cover_path text check(cover_path is null or length(cover_path)<=300),
 rights_note text not null default '' check(length(rights_note)<=500),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(school_id,id),
 foreign key(school_id,subject_id) references public.school_subjects(school_id,id) on delete restrict
);

create table if not exists public.school_activity_sessions (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 activity_id uuid not null,
 class_id uuid not null,
 student_id uuid not null,
 session_on date not null,
 participation text not null check(participation in ('participated','completed','needs_support')),
 teacher_note text not null default '' check(length(teacher_note)<=500),
 completion_percent smallint check(completion_percent is null or completion_percent between 0 and 100),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 unique(school_id,activity_id,student_id,session_on),
 foreign key(school_id,activity_id) references public.school_learning_activities(school_id,id) on delete restrict,
 foreign key(school_id,class_id) references public.school_classes(school_id,id) on delete restrict,
 foreign key(school_id,student_id) references public.school_students(school_id,id) on delete restrict
);
create index if not exists school_activity_sessions_student_idx
 on public.school_activity_sessions(school_id,student_id,session_on desc);

do $$
declare tbl text;
begin
 foreach tbl in array array['school_learning_activities','school_flashcards','school_storybooks','school_activity_sessions'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on table public.%I from public,anon,authenticated',tbl);
  execute format('grant all on table public.%I to service_role',tbl);
 end loop;
end $$;

create or replace function public.school_record_activity_session(
 p_school_id uuid,p_activity uuid,p_student uuid,p_date date,p_participation text,
 p_note text,p_percent smallint,p_teacher uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare cls uuid; year_id uuid; new_id uuid;
begin
 if p_date is null or p_date>(now() at time zone 'Africa/Kigali')::date
  then raise exception 'Future sessions cannot be recorded'; end if;
 select class_id into cls from public.school_learning_activities
  where school_id=p_school_id and id=p_activity and status='published';
 if not found then raise exception 'Activity is not published for this school'; end if;
 if not public.school_nursery_teacher_ok(p_school_id,cls,p_teacher)
  then raise exception 'Teacher is not assigned to this class'; end if;
 select academic_year_id into year_id from public.school_classes
  where school_id=p_school_id and id=cls and status='active';
 if not found or not exists(select 1 from public.school_student_enrollments
   where school_id=p_school_id and class_id=cls and student_id=p_student
    and academic_year_id=year_id and status='active')
  then raise exception 'Student is not currently enrolled in this class'; end if;
 insert into public.school_activity_sessions(school_id,activity_id,class_id,student_id,session_on,
  participation,teacher_note,completion_percent,recorded_by)
 values(p_school_id,p_activity,cls,p_student,p_date,p_participation,coalesce(trim(p_note),''),p_percent,p_teacher)
 on conflict(school_id,activity_id,student_id,session_on)
 do update set participation=excluded.participation,teacher_note=excluded.teacher_note,
  completion_percent=excluded.completion_percent,recorded_by=excluded.recorded_by,recorded_at=now()
 returning id into new_id;
 insert into public.school_classroom_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school_id,p_teacher,'learning.session_recorded',new_id,
  jsonb_build_object('student_id',p_student,'activity_id',p_activity,'on',p_date));
 return jsonb_build_object('recorded',true,'id',new_id);
end $$;

create or replace function public.school_publish_learning_content(
 p_school_id uuid,p_kind text,p_id uuid,p_publish boolean,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare cls uuid; target text:=case when p_publish then 'published' else 'draft' end;
begin
 if p_kind not in ('activity','flashcard','storybook')
  then raise exception 'Unknown content kind'; end if;
 if p_kind='storybook' then
  if not public.school_nursery_leader_ok(p_school_id,p_actor,false)
   then raise exception 'Leadership permission required for storybooks'; end if;
  update public.school_storybooks set status=target where school_id=p_school_id and id=p_id and status<>'archived';
 else
  if p_kind='activity' then
   select class_id into cls from public.school_learning_activities where school_id=p_school_id and id=p_id;
  else
   select class_id into cls from public.school_flashcards where school_id=p_school_id and id=p_id;
  end if;
  if cls is null then raise exception 'Content not found'; end if;
  if not (public.school_nursery_teacher_ok(p_school_id,cls,p_actor)
          or public.school_nursery_leader_ok(p_school_id,p_actor,false))
   then raise exception 'Not allowed to publish this content'; end if;
  if p_kind='activity' then
   update public.school_learning_activities set status=target,updated_at=now()
    where school_id=p_school_id and id=p_id and status<>'archived';
  else
   update public.school_flashcards set status=target where school_id=p_school_id and id=p_id and status<>'archived';
  end if;
 end if;
 if not found then raise exception 'Content not found or archived'; end if;
 insert into public.school_classroom_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school_id,p_actor,'learning.content_'||target,p_id,jsonb_build_object('kind',p_kind));
 return jsonb_build_object('status',target);
end $$;

revoke all on function public.school_record_activity_session(uuid,uuid,uuid,date,text,text,smallint,uuid) from public,anon,authenticated;
revoke all on function public.school_publish_learning_content(uuid,text,uuid,boolean,uuid) from public,anon,authenticated;
grant execute on function public.school_record_activity_session(uuid,uuid,uuid,date,text,text,smallint,uuid) to service_role;
grant execute on function public.school_publish_learning_content(uuid,text,uuid,boolean,uuid) to service_role;

-- Register every new tenant table with the purge manifest (read live, extended, never replaced from memory).
do $$
declare current_list text[]; merged text;
 want text[]:=array['school_nursery_observations','school_nursery_reports','school_learning_activities',
  'school_flashcards','school_storybooks','school_activity_sessions'];
begin
 current_list:=public.platform_tenant_scope_manifest();
 if not (want<@current_list) then
  select 'select array['||string_agg(quote_literal(t),',' order by t)||']::text[]'
  into merged
  from (select distinct t from unnest(current_list||want) as t) u;
  execute 'create or replace function public.platform_tenant_scope_manifest() '||
   'returns text[] language sql immutable security invoker '||
   'set search_path=pg_catalog,public as '||quote_literal(merged);
 end if;
end $$;
revoke all on function public.platform_tenant_scope_manifest() from public,anon,authenticated;
grant execute on function public.platform_tenant_scope_manifest() to service_role;
