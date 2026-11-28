-- Lower primary (P1-P3) support and LEGRA recording. Applied to APEX on 2026-11-27.
-- Source: NESA Guidelines on Recording Marks in CA-MIS (December 2023), sections 2.1, 2.2 and 4.1:
-- P1-P3 subjects use the same 25% units / 25% projects / 50% end-of-term rule with a subject
-- maximum of weekly periods x 10; P1-P3 Kinyarwanda end-of-term is four LEGRA entries.
-- No NESA rule combining the four LEGRA entries was found, so they are shown separately and the
-- subject is excluded from the overall percentage (school owner decision, 2026-11-27).
-- Kinyarwanda is identified by subject name starting with 'Kinyarwanda' or code 'KIN'.
do $guard$ begin
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='school_publish_term_report' and pg_get_functiondef(p.oid) like '%school_report_owner_authorized%' and pg_get_functiondef(p.oid) like '%learning_feedback%')
 then raise exception 'Guard: live school_publish_term_report does not match expected shape'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='school_record_assessment' and pg_get_functiondef(p.oid) like '%school_teacher_can%')
 then raise exception 'Guard: live school_record_assessment does not match expected shape'; end if;
end $guard$;

alter table public.school_assessment_marks drop constraint if exists school_assessment_marks_category_check;
alter table public.school_assessment_marks add constraint school_assessment_marks_category_check
  check(category in ('unit','project','end_term','legra'));

create or replace function public.school_record_assessment(
 p_school uuid,p_term uuid,p_student uuid,p_class uuid,p_subject uuid,
 p_category text,p_assessment_code text,p_raw_score numeric,p_raw_maximum numeric,
 p_feedback text,p_actor uuid
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare t public.school_assessment_terms%rowtype;
        m public.school_curriculum_class_subjects%rowtype;
        track text;
        band text;
        max_allowed numeric;
        normalized_score numeric;
        entry_id uuid;
        legra_subject boolean;
begin
 if p_category not in ('unit','project','end_term','legra')
 then raise exception 'Invalid assessment category'; end if;
 if length(btrim(coalesce(p_assessment_code,''))) not between 1 and 30
 or length(coalesce(p_feedback,''))>1500
 then raise exception 'Invalid assessment reference or feedback'; end if;
 if p_category='end_term' and p_assessment_code<>'TERM'
 then raise exception 'Use TERM for the one end-of-term assessment'; end if;
 if p_category<>'end_term' and p_assessment_code='TERM'
 then raise exception 'Reserved assessment reference'; end if;
 select * into t from public.school_assessment_terms
 where school_id=p_school and id=p_term and status='open';
 if not found then raise exception 'Assessment term unavailable or closed'; end if;
 if p_category='unit' and not exists(select 1 from public.school_curriculum_units
   where school_id=p_school and class_id=p_class
   and subject_id=p_subject and unit_code=p_assessment_code
   and term_number=t.term_number)
 then raise exception 'End-of-unit marks must reference an approved curriculum unit'; end if;
 if not exists(select 1 from public.school_academic_years y
   where y.school_id=p_school and y.id=t.academic_year_id and y.status='current')
 then raise exception 'Only a current academic year may receive marks'; end if;
 if not public.school_teacher_can(p_school,p_actor,p_class,p_subject)
 then raise exception 'Teacher is not currently assigned to this class and subject'; end if;
 if not exists(select 1 from public.school_student_enrollments e
   where e.school_id=p_school and e.student_id=p_student and e.class_id=p_class
     and e.academic_year_id=t.academic_year_id and e.status='active')
 then raise exception 'Student is not enrolled in this current-year class'; end if;
 perform 1 from public.school_students where school_id=p_school
   and id=p_student and status='active' for update;
 if not found then raise exception 'Student unavailable'; end if;
 if exists(select 1 from public.school_published_reports
   where school_id=p_school and term_id=p_term and student_id=p_student
    and status='published')
 then raise exception 'An approved report exists; withdraw it before formal correction'; end if;
 select * into m from public.school_curriculum_class_subjects
 where school_id=p_school and class_id=p_class and subject_id=p_subject
   and academic_year_id=t.academic_year_id and approved_at is not null;
 if not found then raise exception 'School owner must approve official subject allocation first'; end if;
 select p.track,p.level_band into track,band from public.school_curriculum_profiles p
 where p.school_id=p_school and p.id=m.curriculum_profile_id and p.status='approved';
 if not found or track not in ('general','professional')
 then raise exception 'This curriculum requires a separate verified grading engine'; end if;
 legra_subject:=band='lower_primary' and exists(select 1 from public.school_subjects sj
   where sj.school_id=p_school and sj.id=p_subject
     and (lower(btrim(sj.name)) like 'kinyarwanda%' or upper(btrim(sj.code))='KIN'));
 if legra_subject and p_category='end_term'
 then raise exception 'P1-P3 Kinyarwanda uses the four LEGRA entries instead of one end-of-term mark'; end if;
 if p_category='legra' and not legra_subject
 then raise exception 'LEGRA applies only to Kinyarwanda in lower primary (P1-P3)'; end if;
 if p_category='legra' and p_assessment_code not in ('LEGRA_GUTAHURA','LEGRA_ICYANDIKWA','LEGRA_GUSOMA','LEGRA_KUMVA')
 then raise exception 'Use LEGRA_GUTAHURA, LEGRA_ICYANDIKWA, LEGRA_GUSOMA or LEGRA_KUMVA'; end if;
 if p_category<>'legra' and p_assessment_code like 'LEGRA\_%'
 then raise exception 'Reserved assessment reference'; end if;
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
        next_version integer;
        remark text;
        learning_notes text;
        units_json jsonb;
        attendance_json jsonb;
        class_label text;
        is_legra boolean;
        legra_json jsonb;
        count_legra bigint;
        year_label text;
begin
 if not public.school_report_owner_authorized(p_school,p_actor)
 then raise exception 'Only the verified school owner may publish student reports'; end if;
 remark:=btrim(coalesce(p_remark,''));
 if length(remark)>2000 then raise exception 'School remark is too long'; end if;
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
 where school_id=p_school and student_id=p_student and term_id=p_term and status='published')
 then raise exception 'Already published; formally withdraw before correcting and reissuing'; end if;
 select coalesce(max(version),0)+1 into next_version
 from public.school_published_reports where school_id=p_school
  and student_id=p_student and term_id=p_term;
 for item in
   select map.subject_id,map.weekly_periods,map.approved_at,
     c.name as subject_name,c.code as subject_code,
     p.track as track,p.level_band as level_band,p.status as profile_status,
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
    or item.track not in ('general','professional')
    or item.weekly_periods is null
   then raise exception 'Only an approved General/Professional Education curriculum may be published'; end if;
   is_legra:=item.level_band='lower_primary' and (lower(btrim(item.subject_name)) like 'kinyarwanda%'
     or upper(btrim(item.subject_code))='KIN');
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
   if not exists(select 1 from public.school_curriculum_units
     where school_id=p_school and class_id=e.class_id
      and subject_id=item.subject_id and term_number=t.term_number)
   then raise exception 'No verified syllabus units scheduled for this subject and term'; end if;
   select count(*) into count_legra from public.school_assessment_marks
   where school_id=p_school and student_id=p_student and term_id=p_term
     and class_id=e.class_id and subject_id=item.subject_id and category='legra';
   if is_legra then
     if count_units<1 or count_projects<2 or count_legra<>4 or count_exam<>0
     then raise exception 'Missing unit, at least two projects, or the four LEGRA entries for subject %',
       item.subject_name; end if;
   elsif count_units<1 or count_projects<2 or count_exam<>1 or count_legra<>0
   then raise exception 'Missing unit, at least two projects, or end-term marks for subject %',
     item.subject_name; end if;
   if exists(select 1 from public.school_curriculum_units u
     where u.school_id=p_school and u.class_id=e.class_id
       and u.subject_id=item.subject_id and u.term_number=t.term_number
       and not exists(
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
     'competence',u.key_competence,'term',u.term_number
   ) order by u.unit_code),'[]'::jsonb) into units_json
   from public.school_curriculum_units u
   where u.school_id=p_school and u.class_id=e.class_id
    and u.subject_id=item.subject_id and u.term_number=t.term_number;
   if is_legra then
     select coalesce(jsonb_agg(jsonb_build_object('code',a.assessment_code,
       'aspect',case a.assessment_code when 'LEGRA_GUTAHURA' then 'Gutahura inyuguti/amagambo'
         when 'LEGRA_ICYANDIKWA' then 'Icyandikwa' when 'LEGRA_GUSOMA' then 'Gusoma udategwa'
         else 'Kumva wandikiwe' end,
       'score',a.score,'maximum_marks',a.maximum_marks) order by a.assessment_code),'[]'::jsonb)
     into legra_json from public.school_assessment_marks a
     where a.school_id=p_school and a.student_id=p_student and a.term_id=p_term
       and a.class_id=e.class_id and a.subject_id=item.subject_id and a.category='legra';
     total:=null;
   else
     legra_json:='[]'::jsonb;
     total:=round((unit_avg*0.25+project_avg*0.25+exam_avg*0.50)::numeric,2);
     all_earned:=all_earned+total;
     all_max:=all_max+subject_max;
   end if;
   marks:=marks || jsonb_build_array(jsonb_build_object(
     'subject_id',item.subject_id,'subject_name',item.subject_name,
     'subject_code',item.subject_code,'weekly_periods',item.weekly_periods,
     'maximum_marks',subject_max,'end_unit_avg',round(unit_avg,2),
     'project_avg',round(project_avg,2),'end_term_marks',case when is_legra then null else round(exam_avg,2) end,
     'term_total_marks',total,
     'term_percentage',case when total is null then null else round(100*total/subject_max,2) end,
     'assessment_model',case when is_legra then 'lower_primary_kinyarwanda_legra' else 'general_25_25_50' end,
     'legra_entries',legra_json,'excluded_from_overall',is_legra,
     'curriculum_source',item.source_title,'curriculum_source_url',item.source_url,
     'syllabus_url',item.syllabus_url,'policy_version',item.policy_version,
     'teacher_feedback',coalesce(learning_notes,''),'curriculum_units',units_json
   ));
   nsubjects:=nsubjects+1;
 end loop;
 if nsubjects=0 then raise exception 'No approved, mapped curriculum subjects for this class'; end if;
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
   school_id,term_id,student_id,class_id,version,report_data,approved_by)
 values(p_school,p_term,p_student,e.class_id,next_version,
   jsonb_build_object(
    'report_kind','school_issued_term_report','report_version',next_version,
    'guideline','NESA 2023 CA-MIS marking guidelines; no NESA endorsement implied',
    'student_id',p_student,'student_code',st.student_code,
    'student_name',st.first_name||' '||st.last_name,
    'academic_year_id',t.academic_year_id,'academic_year',year_label,
    'term',t.term_number,'term_begins',t.begins_on,'term_ends',t.ends_on,
    'class_id',e.class_id,'class_name',class_label,'school_id',p_school,
    'subjects',marks,'earned_marks',round(all_earned,2),
    'maximum_marks',all_max,'overall_percentage',case when all_max>0 then round(100*all_earned/all_max,2) else null end,
    'school_remark',remark,'attendance',attendance_json,
    'weights',jsonb_build_object('unit',25,'project',25,'end_term',50),
    'legra_note','P1-P3 Kinyarwanda end-of-term is recorded as four LEGRA entries and is not combined into the overall percentage'
   ),p_actor)
 returning id into report_id;
 insert into public.school_report_audit(school_id,actor_id,event,resource_id,
   metadata)
 values(p_school,p_actor,'term_report.published',report_id,
   jsonb_build_object('student_id',p_student,'term_id',p_term));
 return jsonb_build_object('published',true,'report_id',report_id,'version',next_version);
end;
$$;

revoke all on function public.school_record_assessment(uuid,uuid,uuid,uuid,uuid,text,text,numeric,numeric,text,uuid) from public,anon,authenticated;
revoke all on function public.school_publish_term_report(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.school_record_assessment(uuid,uuid,uuid,uuid,uuid,text,text,numeric,numeric,text,uuid) to service_role;
grant execute on function public.school_publish_term_report(uuid,uuid,uuid,text,uuid) to service_role;
