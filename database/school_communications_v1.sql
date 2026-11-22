-- Module 6 — School timetable, verified parent/teacher conversations and notices.
-- Apply AFTER school_reports_curriculum_v1.sql in local CI. No APEX writes.
-- Child-related information: server-only; deny browser access by default.

create table public.school_communication_permissions (
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 auth_user_id uuid not null references auth.users(id) on delete restrict,
 role text not null default 'school_admin' check(role='school_admin'),
 permissions text[] not null default '{}'::text[]
  check(permissions <@ array['timetable.manage','announcements.manage']::text[]),
 updated_by uuid not null references auth.users(id) on delete restrict,
 updated_at timestamptz not null default now(),
 primary key(school_id,auth_user_id),
 foreign key(school_id,auth_user_id,role)
  references public.school_memberships(school_id,auth_user_id,role) on delete restrict
);

create table public.school_timetable_periods (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 academic_year_id uuid not null,
 class_id uuid not null,
 subject_id uuid not null,
 teacher_id uuid not null references auth.users(id) on delete restrict,
 weekday smallint not null check(weekday between 1 and 7),
 starts_at time without time zone not null,
 ends_at time without time zone not null,
 room text not null default '' check(length(room)<=60),
 active boolean not null default true,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(school_id,id),
 foreign key(school_id,class_id,academic_year_id)
  references public.school_classes(school_id,id,academic_year_id) on delete restrict,
 foreign key(school_id,teacher_id,class_id,subject_id)
  references public.school_teacher_assignments(school_id,teacher_id,class_id,subject_id)
  on delete restrict,
 check(starts_at<ends_at)
);
create index school_timetable_class_idx
 on public.school_timetable_periods(school_id,academic_year_id,class_id,weekday,active);
create index school_timetable_teacher_idx
 on public.school_timetable_periods(school_id,teacher_id,weekday,active);

create table public.school_announcements (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 audience text not null check(audience in ('all','staff','teachers','parents','students','class')),
 class_id uuid,
 title text not null check(length(btrim(title)) between 3 and 160),
 body text not null check(length(btrim(body)) between 3 and 4000),
 published_at timestamptz not null default now(),
 expires_at timestamptz,
 status text not null default 'published' check(status in ('published','archived')),
 author_id uuid not null references auth.users(id) on delete restrict,
 unique(school_id,id),
 foreign key(school_id,class_id) references public.school_classes(school_id,id) on delete restrict,
 check((audience='class' and class_id is not null) or (audience<>'class' and class_id is null)),
 check(expires_at is null or expires_at>published_at)
);
create index school_announcements_feed_idx
 on public.school_announcements(school_id,status,published_at desc);

create table public.school_calendar_events (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 audience text not null check(audience in ('all','staff','teachers','parents','students','class')),
 class_id uuid,
 kind text not null check(kind in ('exam','meeting','holiday','activity','closure','other')),
 title text not null check(length(btrim(title)) between 3 and 160),
 details text not null default '' check(length(details)<=1500),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 location text not null default '' check(length(location)<=120),
 status text not null default 'scheduled' check(status in ('scheduled','cancelled')),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(school_id,id),
 foreign key(school_id,class_id) references public.school_classes(school_id,id) on delete restrict,
 check(ends_at>starts_at),
 check((audience='class' and class_id is not null) or (audience<>'class' and class_id is null))
);
create index school_calendar_events_date_idx
 on public.school_calendar_events(school_id,status,starts_at);

create table public.school_announcement_reads (
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 announcement_id uuid not null,
 auth_user_id uuid not null references auth.users(id) on delete restrict,
 read_at timestamptz not null default now(),
 primary key(school_id,announcement_id,auth_user_id),
 foreign key(school_id,announcement_id)
  references public.school_announcements(school_id,id) on delete restrict
);

-- One thread is always about one enrolled pupil, between a VERIFIED guardian
-- and a CURRENTLY assigned teacher. School support is metadata-only by default.
create table public.school_family_message_threads (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 student_id uuid not null,
 teacher_id uuid not null references auth.users(id) on delete restrict,
 guardian_id uuid not null references auth.users(id) on delete restrict,
 status text not null default 'open' check(status in ('open','closed')),
 opened_by uuid not null references auth.users(id) on delete restrict,
 opened_at timestamptz not null default now(),
 closed_at timestamptz,
 close_reason text,
 unique(school_id,id),
 unique(school_id,student_id,teacher_id,guardian_id),
 foreign key(school_id,student_id)
  references public.school_students(school_id,id) on delete restrict,
 foreign key(school_id,student_id,guardian_id)
  references public.school_guardian_links(school_id,student_id,auth_user_id) on delete restrict,
 check((status='open' and closed_at is null)
  or (status='closed' and closed_at is not null and length(btrim(close_reason))>=8))
);
create index school_family_threads_guardian_idx
 on public.school_family_message_threads(school_id,guardian_id,status);
create index school_family_threads_teacher_idx
 on public.school_family_message_threads(school_id,teacher_id,status);

create table public.school_family_messages (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 thread_id uuid not null,
 sender_id uuid not null references auth.users(id) on delete restrict,
 body text not null check(length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default now(),
 unique(school_id,id),
 foreign key(school_id,thread_id)
  references public.school_family_message_threads(school_id,id) on delete restrict
);
create index school_family_messages_thread_idx
 on public.school_family_messages(school_id,thread_id,created_at);

create table public.school_message_notifications (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 recipient_id uuid not null references auth.users(id) on delete restrict,
 thread_id uuid not null,
 message_id uuid not null,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 email_status text not null default 'not_configured'
  check(email_status in ('not_configured','queued','sent','failed')),
 unique(school_id,recipient_id,message_id),
 foreign key(school_id,thread_id)
  references public.school_family_message_threads(school_id,id) on delete restrict,
 foreign key(school_id,message_id)
  references public.school_family_messages(school_id,id) on delete restrict
);
create index school_message_notifications_user_idx
 on public.school_message_notifications(school_id,recipient_id,created_at desc);

create table public.school_communications_audit (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 event text not null check(length(event) between 3 and 100),
 resource_id uuid,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index school_communications_audit_idx
 on public.school_communications_audit(school_id,created_at desc);

do $$
declare tbl text;
begin
 foreach tbl in array array[
  'school_communication_permissions','school_timetable_periods',
  'school_announcements','school_calendar_events','school_announcement_reads',
  'school_family_message_threads','school_family_messages',
  'school_message_notifications','school_communications_audit'
 ] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on table public.%I from public,anon,authenticated',tbl);
  execute format('grant all on table public.%I to service_role',tbl);
 end loop;
end $$;

create or replace function public.school_comms_manager_allowed(
 p_school uuid,p_actor uuid,p_permission text
) returns boolean language sql stable security invoker
set search_path=pg_catalog,public as $$
 select exists(select 1 from public.platform_schools s
 join public.school_memberships m on m.school_id=s.id
 where s.id=p_school and s.status='active' and m.active
  and m.auth_user_id=p_actor and (
    m.role='school_owner'
    or (m.role='school_admin' and exists(
      select 1 from public.school_communication_permissions g
      where g.school_id=s.id and g.auth_user_id=p_actor
       and p_permission=any(g.permissions)))
  ))
$$;

create or replace function public.school_comms_teacher_for_student(
 p_school uuid,p_teacher uuid,p_student uuid
) returns boolean language sql stable security invoker
set search_path=pg_catalog,public as $$
 select exists(select 1 from public.platform_schools s
 join public.school_teacher_assignments a on a.school_id=s.id and a.teacher_id=p_teacher
 join public.school_memberships m on m.school_id=s.id
   and m.auth_user_id=p_teacher and m.role='teacher' and m.active
 join public.school_classes c on c.school_id=a.school_id and c.id=a.class_id and c.status='active'
 join public.school_academic_years y on y.school_id=c.school_id
   and y.id=c.academic_year_id and y.status='current'
 join public.school_student_enrollments e on e.school_id=a.school_id
   and e.class_id=a.class_id and e.academic_year_id=y.id
   and e.student_id=p_student and e.status='active'
 join public.school_students st on st.school_id=e.school_id
   and st.id=e.student_id and st.status='active'
 where s.id=p_school and s.status='active' and a.active)
$$;

create or replace function public.school_comms_guardian_for_student(
 p_school uuid,p_guardian uuid,p_student uuid
) returns boolean language sql stable security invoker
set search_path=pg_catalog,public as $$
 select exists(select 1 from public.platform_schools s
 join public.school_guardian_links g on g.school_id=s.id
   and g.student_id=p_student and g.auth_user_id=p_guardian and g.active
 join public.school_memberships m on m.school_id=s.id
   and m.auth_user_id=p_guardian and m.role='parent' and m.active
 join public.school_students st on st.school_id=s.id
   and st.id=p_student and st.status='active'
 where s.id=p_school and s.status='active')
$$;

create or replace function public.school_set_comms_permissions(
 p_school uuid,p_target uuid,p_permissions text[],p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare before_permissions text[];
begin
 if not public.school_comms_manager_allowed(p_school,p_actor,'__owner_only__')
  or not exists(select 1 from public.school_memberships where
    school_id=p_school and auth_user_id=p_actor and role='school_owner' and active)
 then raise exception 'Only school owner may change communications access'; end if;
 if p_permissions is null or not(p_permissions <@ array[
   'timetable.manage','announcements.manage']::text[])
 then raise exception 'Unknown communication permission'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 8 and 500
 then raise exception 'Audit reason must have 8–500 characters'; end if;
 if not exists(select 1 from public.school_memberships where
   school_id=p_school and auth_user_id=p_target and role='school_admin' and active)
 then raise exception 'Target must be a verified active school administrator'; end if;
 select permissions into before_permissions from public.school_communication_permissions
  where school_id=p_school and auth_user_id=p_target for update;
 insert into public.school_communication_permissions(
  school_id,auth_user_id,permissions,updated_by)
 values(p_school,p_target,p_permissions,p_actor)
 on conflict(school_id,auth_user_id) do update
 set permissions=excluded.permissions,updated_by=p_actor,updated_at=now();
 insert into public.school_communications_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school,p_actor,'communications.permissions_changed',p_target,
   jsonb_build_object('before',coalesce(before_permissions,'{}'::text[]),
     'after',p_permissions,'reason',p_reason));
 return jsonb_build_object('saved',true);
end;
$$;

-- Serializes scheduler edits within a school/day to prevent overlap races.
create or replace function public.school_add_timetable_period(
 p_school uuid,p_class uuid,p_subject uuid,p_teacher uuid,p_day integer,
 p_start time,p_end time,p_room text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare yr uuid;
        period_id uuid;
begin
 if not public.school_comms_manager_allowed(p_school,p_actor,'timetable.manage')
 then raise exception 'Timetable management permission required'; end if;
 if p_day not between 1 and 7 or p_start is null or p_end is null or p_start>=p_end
 then raise exception 'Invalid weekday or lesson time'; end if;
 if length(coalesce(p_room,''))>60 then raise exception 'Room is too long'; end if;
 select c.academic_year_id into yr from public.school_classes c
 join public.school_academic_years y on y.id=c.academic_year_id and y.school_id=c.school_id
 where c.school_id=p_school and c.id=p_class and c.status='active' and y.status='current';
 if not found then raise exception 'Class must be active in current school year'; end if;
 if not exists(select 1 from public.school_teacher_assignments a
   join public.school_memberships m on m.school_id=a.school_id and m.auth_user_id=a.teacher_id
     and m.role='teacher' and m.active
   where a.school_id=p_school and a.class_id=p_class
     and a.subject_id=p_subject and a.teacher_id=p_teacher and a.active)
 then raise exception 'Verify an active school teacher-class-subject assignment first'; end if;
 perform pg_advisory_xact_lock(hashtext(p_school::text),p_day);
 if exists(select 1 from public.school_timetable_periods p
   where p.school_id=p_school and p.academic_year_id=yr
    and p.weekday=p_day and p.active
    and p.starts_at<p_end and p.ends_at>p_start
    and (p.class_id=p_class or p.teacher_id=p_teacher
      or (length(btrim(coalesce(p_room,'')))>0 and btrim(p.room)=btrim(p_room))))
 then raise exception 'Class, teacher or room has an overlapping lesson'; end if;
 insert into public.school_timetable_periods(
  school_id,academic_year_id,class_id,subject_id,teacher_id,weekday,
  starts_at,ends_at,room,created_by)
 values(p_school,yr,p_class,p_subject,p_teacher,p_day,
   p_start,p_end,btrim(coalesce(p_room,'')),p_actor)
 returning id into period_id;
 insert into public.school_communications_audit(school_id,actor_id,event,resource_id)
 values(p_school,p_actor,'timetable.period_created',period_id);
 return jsonb_build_object('id',period_id);
end;
$$;

create or replace function public.school_disable_timetable_period(
 p_school uuid,p_period uuid,p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
begin
 if not public.school_comms_manager_allowed(p_school,p_actor,'timetable.manage')
 then raise exception 'Timetable management permission required'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 8 and 500
 then raise exception 'Enter a reason of 8–500 characters'; end if;
 update public.school_timetable_periods set active=false
 where school_id=p_school and id=p_period and active;
 if not found then raise exception 'Active timetable period not found'; end if;
 insert into public.school_communications_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school,p_actor,'timetable.period_disabled',p_period,
  jsonb_build_object('reason',p_reason));
 return jsonb_build_object('disabled',true);
end;
$$;

create or replace function public.school_publish_announcement(
 p_school uuid,p_title text,p_body text,p_audience text,p_class uuid,
 p_expiration timestamptz,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare id_new uuid;
begin
 if not public.school_comms_manager_allowed(p_school,p_actor,'announcements.manage')
 then raise exception 'Announcement management permission required'; end if;
 if length(btrim(coalesce(p_title,''))) not between 3 and 160
 or length(btrim(coalesce(p_body,''))) not between 3 and 4000
 then raise exception 'Invalid announcement title or text'; end if;
 if p_audience not in ('all','staff','teachers','parents','students','class')
 or (p_audience='class') is distinct from (p_class is not null)
 then raise exception 'Choose an allowed school audience and class'; end if;
 if p_class is not null and not exists(select 1 from public.school_classes c
   join public.school_academic_years y on y.id=c.academic_year_id
     and y.school_id=c.school_id
   where c.school_id=p_school and c.id=p_class and c.status='active'
    and y.status='current')
 then raise exception 'Announcement class must be in current year'; end if;
 if p_expiration is not null and (p_expiration<=now()
   or p_expiration>now()+interval '1 year')
 then raise exception 'Announcement expiration must be in next year'; end if;
 insert into public.school_announcements(
  school_id,title,body,audience,class_id,expires_at,author_id)
 values(p_school,btrim(p_title),btrim(p_body),p_audience,p_class,
   p_expiration,p_actor) returning id into id_new;
 insert into public.school_communications_audit(school_id,actor_id,event,resource_id)
 values(p_school,p_actor,'announcement.published',id_new);
 return jsonb_build_object('published',true,'id',id_new);
end;
$$;

create or replace function public.school_schedule_calendar_event(
 p_school uuid,p_title text,p_details text,p_kind text,p_audience text,
 p_class uuid,p_start timestamptz,p_end timestamptz,p_location text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $
declare event_id uuid;
begin
 if not public.school_comms_manager_allowed(p_school,p_actor,'announcements.manage')
 then raise exception 'Calendar management permission required'; end if;
 if length(btrim(coalesce(p_title,''))) not between 3 and 160
 or length(coalesce(p_details,''))>1500 or length(coalesce(p_location,''))>120
 then raise exception 'Invalid calendar title or details'; end if;
 if p_kind not in ('exam','meeting','holiday','activity','closure','other')
 then raise exception 'Invalid event type'; end if;
 if p_audience not in ('all','staff','teachers','parents','students','class')
 or (p_audience='class') is distinct from (p_class is not null)
 then raise exception 'Invalid school calendar audience'; end if;
 if p_class is not null and not exists(select 1 from public.school_classes c
  join public.school_academic_years y on y.id=c.academic_year_id
   and y.school_id=c.school_id and y.status='current'
  where c.school_id=p_school and c.id=p_class and c.status='active')
 then raise exception 'Calendar class must be active in current year'; end if;
 if p_start is null or p_end is null or p_end<=p_start
 or p_start<now()-interval '1 year'
 or p_start>now()+interval '2 years'
 then raise exception 'Invalid calendar date range'; end if;
 insert into public.school_calendar_events(
  school_id,title,details,kind,audience,class_id,starts_at,ends_at,
  location,created_by)
 values(p_school,btrim(p_title),coalesce(p_details,''),p_kind,p_audience,
  p_class,p_start,p_end,coalesce(p_location,''),p_actor) returning id into event_id;
 insert into public.school_communications_audit(school_id,actor_id,event,resource_id)
 values(p_school,p_actor,'calendar.event_created',event_id);
 return jsonb_build_object('id',event_id,'scheduled',true);
end;
$;

create or replace function public.school_cancel_calendar_event(
 p_school uuid,p_event uuid,p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $
begin
 if not public.school_comms_manager_allowed(p_school,p_actor,'announcements.manage')
 then raise exception 'Calendar management permission required'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 8 and 500
 then raise exception 'Provide an audit reason'; end if;
 update public.school_calendar_events set status='cancelled'
 where school_id=p_school and id=p_event and status='scheduled';
 if not found then raise exception 'Active calendar event not found'; end if;
 insert into public.school_communications_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school,p_actor,'calendar.event_cancelled',p_event,
   jsonb_build_object('reason',p_reason));
 return jsonb_build_object('cancelled',true);
end;
$;

create or replace function public.school_archive_announcement(
 p_school uuid,p_id uuid,p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
begin
 if not public.school_comms_manager_allowed(p_school,p_actor,'announcements.manage')
 then raise exception 'Announcement management permission required'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 8 and 500
 then raise exception 'Explain the archive reason'; end if;
 update public.school_announcements set status='archived'
 where school_id=p_school and id=p_id and status='published';
 if not found then raise exception 'Published announcement not found'; end if;
 insert into public.school_communications_audit(school_id,actor_id,event,resource_id,metadata)
 values(p_school,p_actor,'announcement.archived',p_id,
  jsonb_build_object('reason',p_reason));
 return jsonb_build_object('archived',true);
end;
$$;

create or replace function public.school_open_family_thread(
 p_school uuid,p_student uuid,p_teacher uuid,p_guardian uuid,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare thread_row public.school_family_message_threads%rowtype;
begin
 if p_actor not in (p_teacher,p_guardian)
 then raise exception 'Only a verified participant may open a conversation'; end if;
 if not public.school_comms_guardian_for_student(p_school,p_guardian,p_student)
 or not public.school_comms_teacher_for_student(p_school,p_teacher,p_student)
 then raise exception 'Active guardian-child and class-teacher relationships required'; end if;
 insert into public.school_family_message_threads(
  school_id,student_id,teacher_id,guardian_id,opened_by)
 values(p_school,p_student,p_teacher,p_guardian,p_actor)
 on conflict(school_id,student_id,teacher_id,guardian_id) do nothing;
 select * into thread_row from public.school_family_message_threads
 where school_id=p_school and student_id=p_student
  and teacher_id=p_teacher and guardian_id=p_guardian;
 if not found or thread_row.status<>'open'
 then raise exception 'This conversation has been closed; contact the school for help'; end if;
 return jsonb_build_object('id',thread_row.id,'status','open');
end;
$$;

create or replace function public.school_send_family_message(
 p_school uuid,p_thread uuid,p_message text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare conversation public.school_family_message_threads%rowtype;
        message_id uuid;
        recipient uuid;
begin
 if length(btrim(coalesce(p_message,''))) not between 1 and 2000
 then raise exception 'Message must contain 1–2000 characters'; end if;
 select * into conversation from public.school_family_message_threads
 where school_id=p_school and id=p_thread for update;
 if not found or conversation.status<>'open'
 then raise exception 'Conversation is not open'; end if;
 if p_actor not in (conversation.teacher_id,conversation.guardian_id)
 then raise exception 'You are not a participant'; end if;
 if not public.school_comms_guardian_for_student(
     p_school,conversation.guardian_id,conversation.student_id)
   or not public.school_comms_teacher_for_student(
     p_school,conversation.teacher_id,conversation.student_id)
 then raise exception 'School family or teacher authorization has been revoked'; end if;
 if (select count(*) from public.school_family_messages
   where school_id=p_school and sender_id=p_actor
    and created_at>now()-interval '1 hour')>=30
 then raise exception 'School message rate limit reached; try later'; end if;
 insert into public.school_family_messages(
   school_id,thread_id,sender_id,body)
 values(p_school,p_thread,p_actor,btrim(p_message))
 returning id into message_id;
 recipient:=case when p_actor=conversation.teacher_id
    then conversation.guardian_id else conversation.teacher_id end;
 insert into public.school_message_notifications(
   school_id,recipient_id,thread_id,message_id)
 values(p_school,recipient,p_thread,message_id);
 insert into public.school_communications_audit(school_id,actor_id,event,resource_id,
   metadata)
 values(p_school,p_actor,'family.message_sent',message_id,
   jsonb_build_object('thread_id',p_thread));
 return jsonb_build_object('id',message_id,'notification','in_app_only');
end;
$$;

create or replace function public.school_close_family_thread(
 p_school uuid,p_thread uuid,p_reason text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare conv public.school_family_message_threads%rowtype;
begin
 if length(btrim(coalesce(p_reason,''))) not between 8 and 500
 then raise exception 'Reason required to close this thread'; end if;
 select * into conv from public.school_family_message_threads
 where school_id=p_school and id=p_thread for update;
 if not found or conv.status<>'open'
  or p_actor not in (conv.guardian_id,conv.teacher_id)
 then raise exception 'Only a current conversation participant may close it'; end if;
 if (p_actor=conv.guardian_id and not
   public.school_comms_guardian_for_student(p_school,conv.guardian_id,conv.student_id))
  or (p_actor=conv.teacher_id and not
   public.school_comms_teacher_for_student(p_school,conv.teacher_id,conv.student_id))
 then raise exception 'Conversation access has expired'; end if;
 update public.school_family_message_threads
 set status='closed',closed_at=now(),close_reason=btrim(p_reason)
 where school_id=p_school and id=p_thread;
 insert into public.school_communications_audit(school_id,actor_id,event,resource_id,
   metadata)
 values(p_school,p_actor,'family.thread_closed',p_thread,
   jsonb_build_object('reason',p_reason));
 return jsonb_build_object('closed',true);
end;
$$;

-- Notification acknowledgement is restricted to the intended recipient,
-- whose current conversation participation is still valid.
create or replace function public.school_read_message_notification(
 p_school uuid,p_notification uuid,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare n public.school_message_notifications%rowtype;
        c public.school_family_message_threads%rowtype;
begin
 select * into n from public.school_message_notifications
 where school_id=p_school and id=p_notification and recipient_id=p_actor for update;
 if not found then raise exception 'Notification not available'; end if;
 select * into c from public.school_family_message_threads
 where school_id=p_school and id=n.thread_id;
 if not found or p_actor not in (c.teacher_id,c.guardian_id)
 or not public.school_comms_teacher_for_student(p_school,c.teacher_id,c.student_id)
 or not public.school_comms_guardian_for_student(p_school,c.guardian_id,c.student_id)
 then raise exception 'Current family messaging relationship is not verified'; end if;
 update public.school_message_notifications set read_at=coalesce(read_at,now())
 where school_id=p_school and id=p_notification;
 return jsonb_build_object('read',true);
end;
$$;

-- RLS and revoked anon/authenticated grants protect direct Data API calls.
-- Server functions use security invoker and only service_role may execute.
revoke all on function public.school_comms_manager_allowed(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.school_comms_teacher_for_student(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.school_comms_guardian_for_student(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.school_set_comms_permissions(uuid,uuid,text[],text,uuid) from public,anon,authenticated;
revoke all on function public.school_add_timetable_period(uuid,uuid,uuid,uuid,integer,time,time,text,uuid) from public,anon,authenticated;
revoke all on function public.school_disable_timetable_period(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.school_publish_announcement(uuid,text,text,text,uuid,timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.school_archive_announcement(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.school_schedule_calendar_event(uuid,text,text,text,text,uuid,timestamptz,timestamptz,text,uuid) from public,anon,authenticated;
revoke all on function public.school_cancel_calendar_event(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.school_open_family_thread(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.school_send_family_message(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.school_close_family_thread(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.school_read_message_notification(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.school_comms_manager_allowed(uuid,uuid,text) to service_role;
grant execute on function public.school_comms_teacher_for_student(uuid,uuid,uuid) to service_role;
grant execute on function public.school_comms_guardian_for_student(uuid,uuid,uuid) to service_role;
grant execute on function public.school_set_comms_permissions(uuid,uuid,text[],text,uuid) to service_role;
grant execute on function public.school_add_timetable_period(uuid,uuid,uuid,uuid,integer,time,time,text,uuid) to service_role;
grant execute on function public.school_disable_timetable_period(uuid,uuid,text,uuid) to service_role;
grant execute on function public.school_publish_announcement(uuid,text,text,text,uuid,timestamptz,uuid) to service_role;
grant execute on function public.school_archive_announcement(uuid,uuid,text,uuid) to service_role;
grant execute on function public.school_schedule_calendar_event(uuid,text,text,text,text,uuid,timestamptz,timestamptz,text,uuid) to service_role;
grant execute on function public.school_cancel_calendar_event(uuid,uuid,text,uuid) to service_role;
grant execute on function public.school_open_family_thread(uuid,uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.school_send_family_message(uuid,uuid,text,uuid) to service_role;
grant execute on function public.school_close_family_thread(uuid,uuid,text,uuid) to service_role;
grant execute on function public.school_read_message_notification(uuid,uuid,uuid) to service_role;
