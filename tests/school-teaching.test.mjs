import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const sql=read("../database/school_teaching_v1.sql");
const teacher=read("../app/api/school/[code]/classroom/route.js");
const admin=read("../app/api/school/[code]/teaching/route.js");
const learner=read("../app/api/school/[code]/learning/route.js");
const studentInvite=read("../app/api/school/[code]/student-access/route.js");
const learning=read("../lib/school-learning.mjs");
const teacherUI=read("../app/s/[code]/teacher/TeacherDashboard.jsx");
const learnerUI=read("../app/s/[code]/learning/LearningDashboard.jsx");
const familyUI=read("../app/s/[code]/family/FamilyDashboard.jsx");
const schoolPortal=read("../app/s/[code]/portal/SchoolPortal.jsx");
const ci=read("../.github/workflows/owner-console-ci.yml");

test("eight sensitive teaching tables have RLS and no browser grants",()=>{
 for(const name of ["school_teacher_assignments","school_lesson_plans","school_homework",
   "school_attendance","school_student_portal_invitations","school_student_accounts",
   "school_homework_submissions","school_teaching_audit"]){
  assert.ok(sql.includes("'"+name+"'"),"Missing table RLS entry: "+name);
 }
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on table public\.%I from public,anon,authenticated/);
 assert.match(sql,/grant all on table public\.%I to service_role/);
 assert.doesNotMatch(sql,/create policy[\s\S]{0,100}using \(true\)/i);
});

test("teacher class access requires school, active teacher membership and assigned class/subject",()=>{
 assert.match(learning,/schoolVerifiedContext\(request,code\)/);
 assert.match(learning,/eq\("role","teacher"\)/);
 assert.match(learning,/eq\("active",true\)/);
 assert.match(teacher,/teacherContext\(request,code\)/);
 assert.match(teacher,/eq\("teacher_user_id",user\.id\)/);
 assert.match(teacher,/eq\("school_id",school\.id\)/);
 assert.match(teacher,/permitted\.has\(e\.class_id\+"#"\+e\.academic_year_id\)/);
 assert.match(sql,/school_is_teacher_for_assignment/);
 assert.match(sql,/ta\.teacher_user_id=p_actor/);
 assert.match(sql,/ta\.active and m\.active/);
 assert.match(sql,/foreign key\(school_id,class_id,subject_id\)/);
 assert.match(sql,/references public\.school_class_subjects\(school_id,class_id,subject_id\)/);
 assert.match(admin,/teacher\.assign/);
 assert.match(admin,/requireAal2\(token\)/);
});

test("attendance must match student enrollment in same teacher class and school/year",()=>{
 assert.match(sql,/school_enrollment_teacher_attendance_ref/);
 assert.match(sql,/foreign key\(school_id,enrollment_id,student_id,class_id\)/);
 assert.match(sql,/references public\.school_student_enrollments\(school_id,id,student_id,class_id\)/);
 assert.match(sql,/school_teacher_mark_attendance/);
 assert.match(sql,/ta\.academic_year_id=e\.academic_year_id/);
 assert.match(sql,/Student is not enrolled in your assigned class/);
 assert.match(sql,/p_day<y\.starts_on or p_day>y\.ends_on/);
 assert.match(sql,/unique\(school_id,enrollment_id,attendance_on\)/);
 assert.match(teacherUI,/Attendance/);
 assert.match(teacherUI,/saveAttendance/);
});

test("only school-issued student accounts can read personal learning records",()=>{
 assert.match(learning,/eq\("role","student"\)/);
 assert.match(learning,/from\("school_student_accounts"\)/);
 assert.match(learner,/studentContext\(request,code\)/);
 assert.match(learner,/familyStudentContext\(request,code\)/);
 assert.match(learner,/eq\("auth_user_id",user\.id\)/);
 assert.match(learner,/eq\("student_id",selected\)/);
 assert.match(learner,/eq\("active",true\)/);
 assert.match(learner,/classLearningSnapshot\(db,school\.id,studentId\)/);
 assert.match(learning,/eq\("academic_year_id",currentYear\.id\)/);
 assert.match(learning,/from\("school_class_subjects"\)/);
 assert.match(learning,/curriculumRows\.map/);
 assert.match(learnerUI,/data\.curriculum/);
 assert.match(familyUI,/View homework &amp; attendance/);
 assert.match(learnerUI,/My Learning/);
});

test("minor student invitations require verified guardian approval before claiming",()=>{
 assert.match(sql,/awaiting_guardian/);
 assert.match(sql,/school_guardian_links/);
 assert.match(sql,/school_approve_student_account/);
 assert.match(sql,/school_claim_student_account/);
 assert.match(sql,/email_confirmed_at is not null/);
 assert.match(sql,/inv\.status<>'approved'/);
 assert.match(sql,/inv\.expires_at<=now\(\)/);
 assert.match(studentInvite,/consent!==true/);
 assert.match(studentInvite,/action==="guardian\.approve"/);
 assert.match(studentInvite,/action==="student\.claim"/);
 assert.match(studentInvite,/eq\("role","parent"\)/);
 assert.match(learnerUI,/Accept my school student account/);
 assert.match(familyUI,/approveStudentAccount/);
 assert.match(admin,/guardians\.manage/);
});

test("student/parent homework submissions use enrollment+verified identity, no other child",()=>{
 assert.match(sql,/create or replace function public\.school_submit_homework/);
 assert.match(sql,/class_id=assn\.class_id and status='active'/);
 assert.match(sql,/school_student_accounts sa/);
 assert.match(sql,/school_guardian_links g/);
 assert.match(sql,/student_allowed/);
 assert.match(sql,/e\.status='active'/);
 assert.match(sql,/p_kind='homework' and p_on<=now\(\)/);
 assert.match(sql,/unique\(school_id,homework_id,student_id\)/);
 assert.match(learner,/p_student:studentId/);
 assert.match(learnerUI,/homework\.submit/);
 assert.doesNotMatch(learner,/from\("school_students"\)\.select\("\*"\)/);
});

test("teacher/admin, learner and portal UI destinations exist and are distinct",()=>{
 assert.match(schoolPortal,/Open My Classroom/);
 assert.match(schoolPortal,/My Homework &amp; Attendance/);
 assert.match(teacherUI,/Lesson Plans/);
 assert.match(teacherUI,/Attendance/);
 assert.match(teacherUI,/Homework/);
 assert.match(learnerUI,/My Curriculum/);
 assert.match(learnerUI,/Student View/);
 assert.match(learnerUI,/Parent View/);
});

test("SQL RPCs are server-only; teaching migration runs fifth locally",()=>{
 for(const fn of ["school_is_teacher_for_assignment","school_teacher_assign","school_teacher_unassign",
 "school_teacher_create_content","school_teacher_mark_attendance","school_invite_student_account",
 "school_approve_student_account","school_claim_student_account","school_submit_homework"]){
  assert.ok(sql.includes("revoke all on function public."+fn),"RPC not restricted: "+fn);
  assert.ok(sql.includes("grant execute on function public."+fn),"Service role grant missing: "+fn);
 }
 const names=["platform_owner_console","school_onboarding_v1","school_administration_v1",
  "school_admissions_v1","school_teaching_v1"];
 const idx=names.map(n=>ci.indexOf("supabase migration new "+n));
 assert.ok(idx.every(x=>x>=0),"Missing migration");
 assert.ok(idx.every((p,i)=>i===0||p>idx[i-1]),"Migration order is wrong");
 assert.match(ci,/supabase db reset/);
 assert.doesNotMatch(ci,/^\s+supabase (?:db push|link|migration up --linked)\b/m);
});
