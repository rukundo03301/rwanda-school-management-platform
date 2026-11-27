-- Umurage QA Academy: fictional test school for end-to-end checks. Safe to purge as a demo tenant.
-- Data part only. Login accounts are created separately (passwords are never stored in GitHub).
-- Fixed ids make this script idempotent and let tests address each fixture.
do $seed$
declare
 sch constant uuid:='aaaaaaaa-0000-4000-8000-000000000001';
 own constant uuid:='aaaaaaaa-0000-4000-8000-0000000000a1';
 prn constant uuid:='aaaaaaaa-0000-4000-8000-0000000000a2';
 tch constant uuid:='aaaaaaaa-0000-4000-8000-0000000000a3';
 par constant uuid:='aaaaaaaa-0000-4000-8000-0000000000a4';
 stu constant uuid:='aaaaaaaa-0000-4000-8000-0000000000a5';
 yr constant uuid:='aaaaaaaa-0000-4000-8000-000000000011';
 trm constant uuid:='aaaaaaaa-0000-4000-8000-000000000021';
 cp3 constant uuid:='aaaaaaaa-0000-4000-8000-000000000031';
 cp4 constant uuid:='aaaaaaaa-0000-4000-8000-000000000032';
 kin constant uuid:='aaaaaaaa-0000-4000-8000-000000000041';
 mth constant uuid:='aaaaaaaa-0000-4000-8000-000000000042';
 eng constant uuid:='aaaaaaaa-0000-4000-8000-000000000043';
 pr_lo constant uuid:='aaaaaaaa-0000-4000-8000-000000000051';
 pr_up constant uuid:='aaaaaaaa-0000-4000-8000-000000000052';
 s3 constant uuid:='aaaaaaaa-0000-4000-8000-000000000061';
 s4 constant uuid:='aaaaaaaa-0000-4000-8000-000000000062';
 s4b constant uuid:='aaaaaaaa-0000-4000-8000-000000000063';
 subj uuid; cls uuid; stdt uuid; prof uuid; r record;
begin
 if not exists(select 1 from auth.users where id=own) then
  raise exception 'Create the QA login accounts first';
 end if;
 insert into public.platform_companies(id,name) values('aaaaaaaa-0000-4000-8000-0000000000c1','Umurage QA Company') on conflict do nothing;
 insert into public.platform_schools(id,company_id,school_code,name,owner_email,status)
  values(sch,'aaaaaaaa-0000-4000-8000-0000000000c1','RW-SCH-900001','Umurage QA Academy','qa.owner@school-example.test','active')
  on conflict(id) do update set status='active';
 begin execute 'update public.platform_schools set is_demo=true where id=$1' using sch;
 exception when undefined_column then null; end;
 insert into public.school_memberships(school_id,auth_user_id,role) values
  (sch,own,'school_owner'),(sch,prn,'school_admin'),(sch,tch,'teacher'),(sch,par,'parent'),(sch,stu,'student')
  on conflict do nothing;
 insert into public.school_academic_years(id,school_id,name,starts_on,ends_on,status,created_by)
  values(yr,sch,'2026-2027','2026-09-01','2027-07-31','current',own) on conflict do nothing;
 insert into public.school_assessment_terms(id,school_id,academic_year_id,term_number,begins_on,ends_on,status,created_by)
  values(trm,sch,yr,1,'2026-09-01','2026-12-18','open',own) on conflict do nothing;
 insert into public.school_classes(id,school_id,academic_year_id,name,level,section,created_by) values
  (cp3,sch,yr,'Primary 3','P3','A',own),(cp4,sch,yr,'Primary 4','P4','A',own) on conflict do nothing;
 insert into public.school_subjects(id,school_id,code,name,created_by) values
  (kin,sch,'KIN','Kinyarwanda',own),(mth,sch,'MTH','Mathematics',own),(eng,sch,'ENG','English',own) on conflict do nothing;
 insert into public.school_class_subjects(school_id,class_id,subject_id,created_by)
  select sch,c,s,own from (values(cp3),(cp4)) a(c),(values(kin),(mth),(eng)) b(s) on conflict do nothing;
 insert into public.school_teacher_assignments(school_id,teacher_id,class_id,subject_id,assigned_by)
  select sch,tch,c,s,own from (values(cp3),(cp4)) a(c),(values(kin),(mth),(eng)) b(s) on conflict do nothing;
 insert into public.school_curriculum_profiles(id,school_id,academic_year_id,name,track,level_band,policy_version,source_title,source_url,status,created_by,approved_by,approved_at) values
  (pr_lo,sch,yr,'General lower primary (P1-P3)','general','lower_primary','2026.1','NESA Guidelines on Recording Marks in CA-MIS (Dec 2023)','https://www.nesa.gov.rw/fileadmin/user_upload/NESA/Ressources/Assessment_Standards_and_Guidelines/Guidelines_on_Recording_Marks_in_CA-MIS_December_2023__Signed_.pdf','approved',own,own,now()),
  (pr_up,sch,yr,'General upper primary (P4-P6)','general','upper_primary','2026.1','NESA Guidelines on Recording Marks in CA-MIS (Dec 2023)','https://www.nesa.gov.rw/fileadmin/user_upload/NESA/Ressources/Assessment_Standards_and_Guidelines/Guidelines_on_Recording_Marks_in_CA-MIS_December_2023__Signed_.pdf','approved',own,own,now())
  on conflict do nothing;
 for r in select * from (values(cp3,pr_lo),(cp4,pr_up)) v(c,p) loop
  insert into public.school_curriculum_class_subjects(school_id,class_id,subject_id,academic_year_id,curriculum_profile_id,weekly_periods,syllabus_title,syllabus_url,approved_by,approved_at,created_by)
   select sch,r.c,s,yr,r.p,4,'Syllabus (QA fixture)','https://www.reb.gov.rw/',own,now(),own from (values(kin),(mth),(eng)) b(s) on conflict do nothing;
  insert into public.school_curriculum_units(school_id,class_id,subject_id,unit_code,term_number,unit_title,key_competence,entered_by)
   select sch,r.c,s,u,1,'Unit '||u,'Key competence '||u,own from (values(kin),(mth),(eng)) b(s),(values('U1'),('U2')) x(u) on conflict do nothing;
 end loop;
 insert into public.school_admission_applications(id,school_id,first_name,last_name,academic_year_id,status,created_by) values
  ('aaaaaaaa-0000-4000-8000-0000000000d3',sch,'Uwase','Test',yr,'admitted',own),
  ('aaaaaaaa-0000-4000-8000-0000000000d4',sch,'Mugisha','Sample',yr,'admitted',own),
  ('aaaaaaaa-0000-4000-8000-0000000000d5',sch,'Keza','Pending',yr,'admitted',own) on conflict do nothing;
 insert into public.school_students(id,school_id,first_name,last_name,source_application_id,created_by) values
  (s3,sch,'Uwase','Test','aaaaaaaa-0000-4000-8000-0000000000d3',own),
  (s4,sch,'Mugisha','Sample','aaaaaaaa-0000-4000-8000-0000000000d4',own),
  (s4b,sch,'Keza','Pending','aaaaaaaa-0000-4000-8000-0000000000d5',own) on conflict do nothing;
 insert into public.school_student_enrollments(school_id,student_id,academic_year_id,class_id,enrolled_by)
  select sch,a,yr,b,own from (values(s3,cp3),(s4,cp4),(s4b,cp4)) v(a,b)
  where not exists(select 1 from public.school_student_enrollments e where e.school_id=sch and e.student_id=v.a and e.academic_year_id=yr);
 insert into public.school_guardian_links(school_id,student_id,auth_user_id,relationship,verified_by)
  select sch,s,par,'parent',own from (values(s3),(s4)) v(s) on conflict do nothing;
 insert into public.school_student_accounts(school_id,student_id,auth_user_id,authorized_by)
  values(sch,s4,stu,own) on conflict do nothing;
 -- Marks (recorded through the real RPC as the assigned teacher).
 -- P4 Mugisha: all subjects complete. P3 Uwase: complete incl. four LEGRA entries. P4 Keza: only part entered (draft).
 for r in select * from (values(s4,cp4),(s3,cp3)) v(st,c) loop
  for subj in select unnest(array[kin,mth,eng]) loop
   perform public.school_record_assessment(sch,trm,r.st,r.c,subj,k.cat,k.code,k.sc,40,k.fb,tch)
   from (values('unit','U1',30,'Good number work'),('unit','U2',34,''),('project','PROJECT-1',34,''),('project','PROJECT-2',30,'')) k(cat,code,sc,fb);
  end loop;
 end loop;
 perform public.school_record_assessment(sch,trm,s4,cp4,x,'end_term','TERM',39,40,'Excellent exam work',tch) from unnest(array[kin,mth,eng]) x;
 perform public.school_record_assessment(sch,trm,s3,cp3,x,'end_term','TERM',35,40,'',tch) from unnest(array[mth,eng]) x;
 perform public.school_record_assessment(sch,trm,s3,cp3,kin,'legra',k.code,k.sc,40,'',tch)
  from (values('LEGRA_GUTAHURA',30),('LEGRA_ICYANDIKWA',28),('LEGRA_GUSOMA',35),('LEGRA_KUMVA',33)) k(code,sc);
 perform public.school_record_assessment(sch,trm,s4b,cp4,mth,k.cat,k.code,k.sc,40,'',tch)
  from (values('unit','U1',20),('project','PROJECT-1',22)) k(cat,code,sc);
end $seed$;
