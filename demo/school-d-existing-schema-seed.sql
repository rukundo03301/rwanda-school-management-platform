-- School D fictional demonstration seed. DML only; no auth accounts, emails, actual transfers or schema changes.
-- Target is deliberately guarded by exact School ID, name, and active status.
-- Safe to rerun; all inserted rows have stable DEMO-D-specific identifiers.
DO $seed$
DECLARE
 v_school uuid; v_year uuid; v_owner uuid; v_class uuid; v_app uuid; v_student uuid;
 v_subject uuid; v_fee uuid; v_code text; v_index int; v_class_name text; v_class_section text;
 v_event record; v_topic record; v_cnt int;
BEGIN
 SELECT id INTO STRICT v_school FROM public.platform_schools
 WHERE school_code='RW-SCH-000004' AND name='ZZ Audit Test School D (FICTIONAL)' AND status='active';
 SELECT auth_user_id INTO STRICT v_owner FROM public.school_memberships
 WHERE school_id=v_school AND role='school_owner' AND active=true LIMIT 1;
 SELECT id INTO STRICT v_year FROM public.school_academic_years
 WHERE school_id=v_school AND status='current' LIMIT 1;
 SELECT count(*) INTO v_cnt FROM public.school_students WHERE school_id=v_school;
 IF v_cnt<>2 AND v_cnt<>20 THEN
  RAISE EXCEPTION 'Seed refused: School D has % learners, expected original 2 or already seeded 20',v_cnt;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.school_classes WHERE school_id=v_school AND academic_year_id=v_year AND name='P3 DEMO' AND section='A') THEN
  INSERT INTO public.school_classes(school_id,academic_year_id,name,level,section,capacity,created_by)
  VALUES(v_school,v_year,'P3 DEMO','primary','A',30,v_owner);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.school_classes WHERE school_id=v_school AND academic_year_id=v_year AND name='P6 DEMO' AND section='A') THEN
  INSERT INTO public.school_classes(school_id,academic_year_id,name,level,section,capacity,created_by)
  VALUES(v_school,v_year,'P6 DEMO','primary','A',30,v_owner);
 END IF;
 FOR v_topic IN SELECT * FROM (VALUES
   ('KIN','Kinyarwanda'),('SCI','Science and Elementary Technology'),
   ('SST','Social and Religious Studies'),('ICT','ICT'),('FRE','French')
 ) t(code,name) LOOP
  INSERT INTO public.school_subjects(school_id,code,name,created_by)
  VALUES(v_school,v_topic.code,v_topic.name,v_owner)
  ON CONFLICT DO NOTHING;
 END LOOP;
 FOR v_class IN SELECT id FROM public.school_classes WHERE school_id=v_school AND academic_year_id=v_year AND status='active' LOOP
  FOR v_subject IN SELECT id FROM public.school_subjects WHERE school_id=v_school LOOP
    INSERT INTO public.school_class_subjects(school_id,class_id,subject_id,created_by)
    VALUES(v_school,v_class,v_subject,v_owner) ON CONFLICT DO NOTHING;
  END LOOP;
 END LOOP;
 FOR v_index IN 3..20 LOOP
  v_code:='DEMO-D-STU-'||lpad(v_index::text,3,'0');
  v_class_name:=CASE WHEN v_index<=7 THEN 'P3 DEMO' WHEN v_index<=11 THEN 'P4 TEST' WHEN v_index<=15 THEN 'P5 TEST' ELSE 'P6 DEMO' END;
  v_class_section:=CASE WHEN v_class_name='P5 TEST' THEN 'B' ELSE 'A' END;
  SELECT id INTO STRICT v_class FROM public.school_classes
   WHERE school_id=v_school AND academic_year_id=v_year AND name=v_class_name AND section=v_class_section;
  SELECT id INTO v_app FROM public.school_admission_applications WHERE application_code='DEMO-D-APP-'||lpad(v_index::text,3,'0');
  IF v_app IS NULL THEN
   INSERT INTO public.school_admission_applications(school_id,application_code,first_name,last_name,date_of_birth,academic_year_id,status,created_by)
   VALUES(v_school,'DEMO-D-APP-'||lpad(v_index::text,3,'0'),'DemoLearner'||lpad(v_index::text,2,'0'),'Fictional',
      (date '2015-01-01'+((v_index*41)%365)),v_year,'admitted',v_owner) RETURNING id INTO v_app;
  END IF;
  SELECT id INTO v_student FROM public.school_students WHERE student_code=v_code;
  IF v_student IS NULL THEN
   INSERT INTO public.school_students(school_id,student_code,first_name,last_name,date_of_birth,source_application_id,status,created_by)
   VALUES(v_school,v_code,'DemoLearner'||lpad(v_index::text,2,'0'),'Fictional',
     (date '2015-01-01'+((v_index*41)%365)),v_app,'active',v_owner)
   RETURNING id INTO v_student;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_student_enrollments
       WHERE school_id=v_school AND student_id=v_student AND academic_year_id=v_year) THEN
   INSERT INTO public.school_student_enrollments(school_id,student_id,academic_year_id,class_id,status,enrolled_by)
   VALUES(v_school,v_student,v_year,v_class,'active',v_owner);
  END IF;
 END LOOP;
 IF NOT EXISTS (SELECT 1 FROM public.school_assessment_terms WHERE school_id=v_school AND academic_year_id=v_year AND term_number=1) THEN
  INSERT INTO public.school_assessment_terms(school_id,academic_year_id,term_number,begins_on,ends_on,status,created_by)
  VALUES(v_school,v_year,1,date '2026-09-07',date '2026-12-18','open',v_owner);
 END IF;
 FOR v_event IN SELECT * FROM (VALUES
   ('FICTIONAL DEMO: Open School Day','all','activity','2026-12-05 09:00+02'::timestamptz,'2026-12-05 12:00+02'::timestamptz,'School Hall'),
   ('FICTIONAL DEMO: Parent-Teacher Meeting','parents','meeting','2026-12-12 10:00+02'::timestamptz,'2026-12-12 12:00+02'::timestamptz,'P4 Classroom'),
   ('FICTIONAL DEMO: Science Exhibition','all','activity','2027-02-13 09:00+02'::timestamptz,'2027-02-13 13:00+02'::timestamptz,'School Courtyard'),
   ('FICTIONAL DEMO: Sports Day','all','activity','2027-03-06 08:00+02'::timestamptz,'2027-03-06 14:00+02'::timestamptz,'Sports Ground')
 ) t(title,audience,kind,starts_at,ends_at,location) LOOP
  IF NOT EXISTS (SELECT 1 FROM public.school_calendar_events WHERE school_id=v_school AND title=v_event.title) THEN
   INSERT INTO public.school_calendar_events(school_id,audience,kind,title,details,starts_at,ends_at,location,status,created_by)
   VALUES(v_school,v_event.audience,v_event.kind,v_event.title,'SYNTHETIC DEMO EVENT — not an actual school invitation.',v_event.starts_at,v_event.ends_at,v_event.location,'scheduled',v_owner);
  END IF;
 END LOOP;
 FOR v_topic IN SELECT * FROM (VALUES
 ('FICTIONAL DEMO: Welcome to Term 1','This is a fictional demonstration school. All student identities, dates and event notices are examples.'),
 ('FICTIONAL DEMO: Open School Day Notice','Fictional open school day in the demonstration calendar; do not travel or register.')
 ) t(title,body) LOOP
 IF NOT EXISTS (SELECT 1 FROM public.school_announcements WHERE school_id=v_school AND title=v_topic.title) THEN
  INSERT INTO public.school_announcements(school_id,audience,title,body,status,author_id)
  VALUES(v_school,'all',v_topic.title,v_topic.body,'published',v_owner);
 END IF;
 END LOOP;
 FOR v_topic IN SELECT * FROM (VALUES
   ('tuition','FICTIONAL DEMO: Term 1 tuition',85000::bigint),
   ('meals','FICTIONAL DEMO: Term 1 meals',15000::bigint)
 ) t(category,label,amount_rwf) LOOP
  IF NOT EXISTS(SELECT 1 FROM public.school_fee_catalog WHERE school_id=v_school AND academic_year_id=v_year AND label=v_topic.label) THEN
   INSERT INTO public.school_fee_catalog(school_id,academic_year_id,class_id,term_label,category,label,amount_rwf,due_on,status,created_by)
   VALUES(v_school,v_year,NULL,'Term 1',v_topic.category,v_topic.label,v_topic.amount_rwf,date '2026-12-15','active',v_owner);
  END IF;
 END LOOP;
 -- No fee invoices or payments are posted: figures remain examples until a valid
 -- school-approved finance workflow issues them with verifiable audit provenance.
 INSERT INTO public.school_admin_audit(school_id,actor_id,event,metadata)
 VALUES(v_school,v_owner,'demo.seed.applied',jsonb_build_object('fictional',true,'dataset','school_d_sample_v1','learner_target',20,'no_real_payments',true));
END $seed$;
