import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  weightedGeneralMarks,RWANDA_NESA_GENERAL_WEIGHTS,
  normalizeReportPermissions,reportUrl,reportDate,reportText
} from "../lib/school-reporting.mjs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const db=read("../database/school_reports_curriculum_v1.sql");
const api=read("../app/api/school/[code]/reports/route.js");
const viewer=read("../app/api/school/[code]/published-reports/route.js");
const reportsUI=read("../app/s/[code]/reports/ReportsManager.jsx");
const publishedUI=read("../app/s/[code]/report-card/PublishedReportCard.jsx");
const portal=read("../app/s/[code]/portal/SchoolPortal.jsx");
const schoolAdmin=read("../app/s/[code]/admin/SchoolAdmin.jsx");
const ci=read("../.github/workflows/owner-console-ci.yml");

test("NESA 2023 general education marks match its published P4 example",()=>{
 assert.deepEqual(RWANDA_NESA_GENERAL_WEIGHTS,{unit:25,project:25,end_term:50});
 assert.deepEqual(weightedGeneralMarks({endUnit:35,projects:32,endTerm:39,periods:4}),
  {maximum:40,raw:36.25,percentage:90.63});
 assert.deepEqual(weightedGeneralMarks({endUnit:0,projects:0,endTerm:0,periods:8}),
  {maximum:80,raw:0,percentage:0});
 assert.throws(()=>weightedGeneralMarks({endUnit:81,projects:20,endTerm:22,periods:8}));
 assert.throws(()=>weightedGeneralMarks({endUnit:20,projects:10,endTerm:20,periods:0}));
});
test("marks store paper denominators and convert them to approved curriculum maxima",()=>{
 assert.match(db,/raw_score numeric\(8,2\)/);
 assert.match(db,/raw_maximum numeric\(8,2\)/);
 assert.match(db,/normalized_score:=round\(p_raw_score \/ p_raw_maximum \* max_allowed,2\)/);
 assert.match(db,/max_allowed:=m.weekly_periods\*10/);
 assert.match(db,/raw_maximum=excluded.raw_maximum/);
 assert.match(api,/p_raw_score:score,p_raw_maximum:rawMaximum/);
 assert.match(api,/Math\.abs\(Math\.round\(score\*100\)/);
 assert.match(reportsUI,/Actual assessment maximum/);
 assert.match(reportsUI,/39\/40 becomes 78\/80/);
});
test("reports are school-specific, private and require explicit school owner release",()=>{
 assert.match(db,/school_report_owner_authorized\(p_school,p_actor\)/);
 assert.match(db,/Only the verified school owner may publish student reports/);
 assert.match(db,/unique\(school_id,term_id,student_id,version\)/);
 assert.match(db,/school_one_published_report_per_term_idx/);
 assert.match(db,/where status='published'/);
 assert.match(db,/school_withdraw_term_report/);
 assert.match(db,/school_record_assessment/);
 assert.match(db,/for update/);
 assert.doesNotMatch(api,/requireAal2/);
 assert.match(api,/action==="report\.publish"/);
 assert.match(api,/action==="report\.withdraw"/);
});
test("publication requires curriculum validation, full subject map and assessment completeness",()=>{
 assert.match(db,/Missing unit, at least two projects, or end-term marks/);
 assert.match(db,/No verified syllabus units scheduled for this subject and term/);
 assert.match(db,/Missing recorded syllabus unit assessment/);
 assert.match(db,/Curriculum mappings are incomplete for this class/);
 assert.match(db,/school_curriculum_class_subjects/);
 assert.match(db,/profile_status<>'approved'/);
 assert.match(db,/approved_at is null/);
 assert.match(db,/unit_avg\*0\.25\+project_avg\*0\.25\+exam_avg\*0\.50/);
 assert.match(db,/round\(100\*all_earned\/all_max,2\)/);
 assert.match(db,/curriculum_units/);
 assert.match(db,/teacher_feedback/);
 assert.match(db,/attendance_json/);
 assert.match(db,/next_version/);
});
test("unsupported TVET, lower primary LEGRA and other curricula cannot be silently graded as general",()=>{
 assert.match(db,/level_band='lower_primary'/);
 assert.match(db,/track not in \('general','professional'\)/);
 assert.match(db,/This curriculum requires a separate verified grading engine/);
 assert.match(db,/tvet_specific|TVET|tvet/);
 assert.match(reportsUI,/Lower Primary P1/);
 assert.match(reportsUI,/Mathematics and Sciences/);
 assert.match(reportsUI,/Arts and Humanities/);
 assert.match(reportsUI,/Languages/);
 assert.match(reportsUI,/NESA Guidelines on Recording Marks/);
});
test("child private reports only visible via verified parent-child or student school account",()=>{
 assert.match(viewer,/schoolVerifiedContext\(request,code\)/);
 assert.match(viewer,/eq\("auth_user_id",user\.id\)/);
 assert.match(viewer,/eq\("active",true\)/);
 assert.match(viewer,/isParent\?linkedChildren\.map/);
 assert.match(viewer,/isStudent&&studentAccount/);
 assert.match(viewer,/\.eq\("status","published"\)/);
 assert.match(viewer,/\.in\("student_id",studentIds\)/);
 assert.match(viewer,/Cache-Control":"private, no-store/);
 assert.doesNotMatch(viewer,/query\.student_id|body\.student_id|params\.studentId/);
 assert.match(publishedUI,/window\.print\(\)/);
 assert.match(publishedUI,/not a NESA national examination result/);
 assert.match(portal,/Approved School Reports/);
 assert.match(schoolAdmin,/Curriculum & Reports/);
});
test("report permissions have an auditable owner-only ON/OFF matrix",()=>{
 assert.deepEqual(normalizeReportPermissions(["reports.read","curriculum.manage"]),
  ["reports.read","curriculum.manage"]);
 assert.throws(()=>normalizeReportPermissions(["reports.publish"]));
 assert.match(db,/school_report_admin_permissions/);
 assert.match(db,/school_set_report_permissions/);
 assert.match(db,/Only school owner can grant curriculum\/report permissions/);
 assert.match(db,/report.permissions_changed/);
 assert.match(reportsUI,/role="switch"/);
 assert.match(reportsUI,/Save ON\/OFF permissions/);
});
test("RLS and direct browser role restrictions cover all eight reporting tables",()=>{
 const names=["school_report_admin_permissions","school_curriculum_profiles",
  "school_curriculum_class_subjects","school_curriculum_units",
  "school_assessment_terms","school_assessment_marks",
  "school_published_reports","school_report_audit"];
 for(const name of names)assert.ok(db.includes("'"+name+"'"),name+" missing from RLS list");
 assert.match(db,/enable row level security/);
 assert.match(db,/revoke all on table public\.%I from public,anon,authenticated/);
 assert.match(db,/grant all on table public\.%I to service_role/);
 assert.doesNotMatch(db,/on delete cascade/i);
 for(const fn of ["school_report_owner_authorized","school_set_report_permissions",
  "school_approve_curriculum","school_approve_curriculum_subject",
  "school_record_assessment","school_publish_term_report",
  "school_withdraw_term_report"]){
  assert.ok(db.includes("revoke all on function public."+fn),fn+" not protected");
 }
});
test("curriculum version, syllabus units and report rows use same-school foreign keys",()=>{
 assert.match(db,/foreign key\(school_id,academic_year_id\)/);
 assert.match(db,/references public\.school_academic_years\(school_id,id\)/);
 assert.match(db,/foreign key\(school_id,class_id,subject_id\)/);
 assert.match(db,/references public\.school_class_subjects\(school_id,class_id,subject_id\)/);
 assert.match(db,/foreign key\(school_id,curriculum_profile_id,academic_year_id\)/);
 assert.match(db,/references public\.school_curriculum_profiles\(school_id,id,academic_year_id\)/);
 assert.match(db,/term_number smallint not null/);
 assert.match(db,/term_number=t\.term_number/);
 assert.match(api,/eq\("school_id",school\.id\)/);
});
test("URL, input and permission validators reject obvious bad data",()=>{
 assert.throws(()=>reportUrl("http://example.com"));
 assert.throws(()=>reportUrl("javascript:alert(1)"));
 assert.equal(reportUrl("https://www.nesa.gov.rw/"),"https://www.nesa.gov.rw/");
 assert.throws(()=>reportDate("2026-02-30"));
 assert.equal(reportDate("2026-11-22"),"2026-11-22");
 assert.throws(()=>reportText("  ",200));
});
test("all six migrations included in correct isolated CLI order, not applied to APEX",()=>{
 const all=["platform_owner_console","school_onboarding_v1","school_administration_v1",
  "school_admissions_v1","school_classrooms_v1","school_reports_curriculum_v1"];
 const p=all.map(n=>ci.indexOf("supabase migration new "+n));
 assert.ok(p.every(x=>x>=0),p.toString());
 assert.ok(p.every((x,i)=>i===0||x>p[i-1]),p.toString());
 assert.match(ci,/supabase db reset/);
 assert.doesNotMatch(ci,/^\s+supabase (?:db push|link|migration up --linked)\b/m);
});
