-- Nursery onboarding load for RW-SCH-000004 (applied 2026-11-27). Same path a new school uses:
-- classes, learning areas, approved admissions, students, enrollments. Staff and guardians are
-- added afterwards through POST /api/school/[code]/people-import. Ids are deterministic valid UUIDs.
create or replace function public.school_onboard_rid(k text) returns uuid language sql immutable as
$f$ select (substr(h,1,12)||'4'||substr(h,14,3)||'8'||substr(h,18,15))::uuid from (select md5(k) h) x $f$;
do $seed$ declare sch uuid; yr uuid; own uuid:='86cf01d2-6d7d-45fc-b806-1cb05e57d3dd'; dry boolean:=false; n int;
 stu text:=$d$
STU-0001|Ganza|Ndayisaba|2023-03-28|CLS-N1|active
STU-0002|Nshuti|Iradukunda|2023-02-10|CLS-N1|active
STU-0003|Maya|Niyonzima|2022-12-05|CLS-N1|active
STU-0004|Rugamba|Nshimiyimana|2022-04-11|CLS-N1|active
STU-0005|Nadia|Niyibizi|2022-10-28|CLS-N1|active
STU-0006|Rene|Musoni|2022-03-09|CLS-N1|active
STU-0007|Abizerwa|Niyomwungeri|2022-04-10|CLS-N1|active
STU-0008|Eloi|Iradukunda|2023-04-03|CLS-N1|active
STU-0009|Ariane|Niyonzima|2023-05-12|CLS-N1|active
STU-0010|Emile|Uwiragiye|2022-10-12|CLS-N1|active
STU-0011|Ishimwe|Munyaneza|2022-10-04|CLS-N1|active
STU-0012|Fabrice|Umutoni|2022-11-08|CLS-N1|active
STU-0013|Uwase|Uwizeye|2022-11-03|CLS-N1|active
STU-0014|Patrick|Mutesi|2023-09-26|CLS-N1|active
STU-0015|Ineza|Habimana|2023-08-20|CLS-N1|active
STU-0016|Patrick|Kamanzi|2023-10-28|CLS-N1|active
STU-0017|Aline|Manzi|2023-03-04|CLS-N1|transferred
STU-0018|Mugisha|Nyirahabimana|2022-07-02|CLS-N1|active
STU-0019|Bella|Nyirahabimana|2023-07-06|CLS-N1|active
STU-0020|Eddy|Kamanzi|2022-12-15|CLS-N1|active
STU-0021|Teta|Rugema|2023-01-13|CLS-N1|active
STU-0022|Niyonsenga|Uwamahoro|2022-10-02|CLS-N1|active
STU-0023|Munezero|Mukeshimana|2023-02-05|CLS-N1|active
STU-0024|Jean|Nkurunziza|2022-06-23|CLS-N1|active
STU-0025|Ishimwe|Mutabazi|2023-09-02|CLS-N1|active
STU-0026|Rugamba|Nyirahabimana|2022-11-26|CLS-N1|active
STU-0027|Isimbi|Iradukunda|2023-11-16|CLS-N1|active
STU-0029|Munezero|Habimana|2022-11-03|CLS-N1|active
STU-0030|Gael|Mukeshimana|2023-08-12|CLS-N1|active
STU-0031|Niyomugabo|Kagabo|2023-08-05|CLS-N1|active
STU-0032|Nshuti|Ishimwe|2022-06-02|CLS-N1|active
STU-0033|Alice|Nkusi|2022-12-03|CLS-N1|active
STU-0034|Murenzi|Bizimana|2022-09-08|CLS-N1|active
STU-0035|Clarisse|Umutoni|2022-09-18|CLS-N2|active
STU-0036|Samuel|Umutoni|2022-11-15|CLS-N2|active
STU-0037|Umutoni|Ishimwe|2021-01-09|CLS-N2|active
STU-0038|Iradukunda|Kamanzi|2022-08-23|CLS-N2|active
STU-0039|Maya|Niyomwungeri|2021-12-13|CLS-N2|active
STU-0040|Munezero|Musoni|2021-11-07|CLS-N2|active
STU-0041|Isimbi|Nshimiyimana|2021-07-21|CLS-N2|active
STU-0042|Patrick|Manzi|2021-05-17|CLS-N2|active
STU-0043|Ishimwe|Niyibizi|2021-10-10|CLS-N2|active
STU-0044|Murenzi|Mukamana|2021-11-04|CLS-N2|active
STU-0045|Amahoro|Kagabo|2022-10-22|CLS-N2|active
STU-0046|Habimana|Mugisha|2021-04-07|CLS-N2|active
STU-0047|Maya|Ndayisaba|2021-01-16|CLS-N2|active
STU-0048|Eloi|Kagabo|2022-01-04|CLS-N2|active
STU-0049|Niyomugabo|Umutoni|2022-05-10|CLS-N2|active
STU-0050|Kevin|Bizimana|2022-09-28|CLS-N2|active
STU-0051|Uwera|Rukundo|2021-08-14|CLS-N2|active
STU-0052|Claude|Rugema|2022-12-21|CLS-N2|active
STU-0053|Ineza|Hategekimana|2021-04-14|CLS-N2|active
STU-0054|Murenzi|Ingabire|2021-11-05|CLS-N2|active
STU-0055|Linda|Niyigena|2021-08-08|CLS-N2|active
STU-0056|Ishimwe|Gasore|2022-12-13|CLS-N2|active
STU-0057|Nelly|Hategekimana|2022-09-01|CLS-N2|active
STU-0058|Munezero|Mukamana|2022-11-06|CLS-N2|transferred
STU-0059|Keza|Mugiraneza|2021-09-07|CLS-N2|active
STU-0060|Yvan|Uwera|2022-06-24|CLS-N2|active
STU-0062|Habimana|Uwiragiye|2022-06-04|CLS-N2|active
STU-0063|Clarisse|Umutoniya|2021-08-22|CLS-N2|active
STU-0065|Mutoni|Mugisha|2021-06-21|CLS-N2|active
STU-0066|David|Niyomwungeri|2021-06-10|CLS-N2|active
STU-0067|Neza|Ingabire|2021-11-07|CLS-N2|active
STU-0068|Iradukunda|Karangwa|2020-12-15|CLS-N3|active
STU-0069|Diane|Hategekimana|2021-07-28|CLS-N3|active
STU-0070|Gael|Munyaneza|2021-11-01|CLS-N3|active
STU-0071|Mugisha|Kagabo|2021-06-04|CLS-N3|active
STU-0072|Niyonsenga|Musoni|2021-01-18|CLS-N3|active
STU-0073|Abizerwa|Uwiragiye|2021-04-27|CLS-N3|active
STU-0074|Nshuti|Ingabire|2021-09-12|CLS-N3|active
STU-0075|Umutesi|Umurerwa|2020-02-05|CLS-N3|active
STU-0076|Samuel|Kamanzi|2021-05-16|CLS-N3|active
STU-0077|Aline|Karangwa|2021-11-28|CLS-N3|active
STU-0078|Gael|Karemera|2020-02-22|CLS-N3|active
STU-0079|Ariane|Umutoni|2020-06-28|CLS-N3|active
STU-0080|Habimana|Uwizeye|2020-06-13|CLS-N3|active
STU-0081|Nelly|Karemera|2020-05-25|CLS-N3|transferred
STU-0082|Gad|Rugema|2021-05-11|CLS-N3|active
STU-0083|Diane|Mutabazi|2020-04-10|CLS-N3|active
STU-0084|Munezero|Nshimiyimana|2020-08-26|CLS-N3|active
STU-0085|Mugisha|Niyomwungeri|2020-06-23|CLS-N3|active
STU-0086|Gad|Munyaneza|2021-12-14|CLS-N3|active
STU-0087|Umutoni|Nkusi|2020-05-25|CLS-N3|active
STU-0088|Patrick|Mugiraneza|2020-02-10|CLS-N3|active
STU-0089|Munezero|Ingabire|2020-10-02|CLS-N3|active
STU-0090|Eric|Ishimwe|2021-01-07|CLS-N3|active
STU-0091|Neza|Rukundo|2020-08-14|CLS-N3|active
STU-0092|Emile|Rugema|2020-08-14|CLS-N3|active
STU-0094|Fabrice|Uwamahoro|2020-10-05|CLS-N3|active
STU-0095|Clarisse|Habimana|2020-08-04|CLS-N3|active
STU-0096|Patrick|Mukeshimana|2020-12-07|CLS-N3|active
STU-0098|Habimana|Mutesi|2020-06-23|CLS-N3|active
STU-0099|Nadia|Mutabazi|2020-10-02|CLS-N3|active
STU-0100|Eddy|Mutesi|2020-09-11|CLS-N3|active
STU-0102|Samuel|Manzi|2020-09-17|CLS-N3|active
$d$;
 apx text:=$d$
APP-0001|Mugabo|Umurerwa|2023-01-11|submitted
APP-0002|Nadia|Munyaneza|2021-10-14|under_review
APP-0003|Munezero|Nshimiyimana|2021-01-01|submitted
APP-0004|Mutoni|Ndayisaba|2020-07-21|under_review
APP-0005|Lina|Mutabazi|2021-03-09|submitted
APP-0006|Giselle|Karemera|2020-10-12|under_review
APP-0015|Isimbi|Mugiraneza|2022-06-06|rejected
APP-0016|Murenzi|Manzi|2021-11-13|under_review
APP-0017|Uwera|Mukamana|2020-09-20|submitted
APP-0018|Yvan|Umutoniya|2022-03-12|rejected
APP-0019|Uwase|Uwamahoro|2021-11-12|under_review
APP-0020|Jean|Mugiraneza|2020-02-08|submitted
APP-0021|Mugisha|Ishimwe|2022-09-19|rejected
APP-0022|Eric|Nkurunziza|2021-05-22|under_review
APP-0023|Giselle|Manzi|2020-02-17|submitted
APP-0024|Yvan|Mugisha|2022-06-09|rejected
APP-0025|Alice|Habimana|2021-02-27|under_review
$d$;
begin
 select id into sch from public.platform_schools where school_code='RW-SCH-000004' and status='active';
 if sch is null then raise exception 'School not found'; end if;
 select id into yr from public.school_academic_years where school_id=sch and status='current';
 insert into public.school_classes(id,school_id,academic_year_id,name,level,section,capacity,created_by) values
  (public.school_onboard_rid('class:CLS-N1'),sch,yr,'Nursery 1','Nursery','A',38,own),
  (public.school_onboard_rid('class:CLS-N2'),sch,yr,'Nursery 2','Nursery','A',38,own),
  (public.school_onboard_rid('class:CLS-N3'),sch,yr,'Nursery 3','Nursery','A',38,own) on conflict do nothing;
 insert into public.school_subjects(id,school_id,code,name,created_by) values
  (public.school_onboard_rid('subject:NLA-001'),sch,'NLA-001','Language and communication',own),
  (public.school_onboard_rid('subject:NLA-002'),sch,'NLA-002','Numeracy and early math',own),
  (public.school_onboard_rid('subject:NLA-003'),sch,'NLA-003','Social and emotional development',own),
  (public.school_onboard_rid('subject:NLA-004'),sch,'NLA-004','Physical development and health',own),
  (public.school_onboard_rid('subject:NLA-005'),sch,'NLA-005','Creative arts and culture',own),
  (public.school_onboard_rid('subject:NLA-006'),sch,'NLA-006','Environment and science',own) on conflict do nothing;
 insert into public.school_class_subjects(school_id,class_id,subject_id,created_by)
  select sch,c.id,s.id,own from public.school_classes c,public.school_subjects s
  where c.school_id=sch and s.school_id=sch and c.level='Nursery' and s.code like 'NLA-%' on conflict do nothing;
 insert into public.school_admission_applications(id,school_id,first_name,last_name,date_of_birth,academic_year_id,status,created_by)
  select public.school_onboard_rid('app:'||p[1]),sch,p[2],p[3],p[4]::date,yr,'admitted',own from (select string_to_array(l,'|') p from unnest(string_to_array(btrim(stu,E'\n'),E'\n')) l) x
  on conflict do nothing;
 insert into public.school_admission_applications(id,school_id,first_name,last_name,date_of_birth,academic_year_id,status,created_by)
  select public.school_onboard_rid('app:'||p[1]),sch,p[2],p[3],p[4]::date,yr,p[5],own from (select string_to_array(l,'|') p from unnest(string_to_array(btrim(apx,E'\n'),E'\n')) l) x
  on conflict do nothing;
 insert into public.school_students(id,school_id,first_name,last_name,date_of_birth,source_application_id,status,created_by)
  select public.school_onboard_rid('student:'||p[1]),sch,p[2],p[3],p[4]::date,public.school_onboard_rid('app:'||p[1]),case p[6] when 'active' then 'active' else 'inactive' end,own from (select string_to_array(l,'|') p from unnest(string_to_array(btrim(stu,E'\n'),E'\n')) l) x
  on conflict do nothing;
 insert into public.school_student_enrollments(school_id,student_id,academic_year_id,class_id,status,enrolled_by)
  select sch,public.school_onboard_rid('student:'||p[1]),yr,public.school_onboard_rid('class:'||p[5]),case p[6] when 'active' then 'active' else 'withdrawn' end,own from (select string_to_array(l,'|') p from unnest(string_to_array(btrim(stu,E'\n'),E'\n')) l) x
  where not exists(select 1 from public.school_student_enrollments e where e.school_id=sch and e.student_id=public.school_onboard_rid('student:'||p[1]) and e.academic_year_id=yr);
 select count(*) into n from public.school_student_enrollments where school_id=sch and class_id in (select id from public.school_classes where school_id=sch and level='Nursery');
 if dry then raise exception 'DRY RUN OK: nursery enrollments %, rolled back',n; end if;
 raise notice 'nursery enrollments %',n;
end $seed$;
drop function public.school_onboard_rid(text);
