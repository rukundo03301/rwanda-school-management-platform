import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const sql=read("../database/school_learning_v1.sql");
const classroom=read("../app/api/school/[code]/classroom/route.js");
const learning=read("../app/api/school/[code]/learning/route.js");
const roles=read("../lib/school-classroom.mjs");
const teacherUI=read("../app/s/[code]/teaching/TeachingConsole.jsx");
const studentUI=read("../app/s/[code]/learning/StudentLearning.jsx");
const parentUI=read("../app/s/[code]/family/FamilyDashboard.jsx");
const portal=read("../app/s/[code]/portal/SchoolPortal.jsx");
const ci=read("../.github/workflows/owner-console-ci.yml");

test("learning tables restrict direct users and have tenant scoped foreign keys",()=>{
 for(const t of ["school_teacher_assignments","school_lessons","school_homework",
 "school_attendance","school_student_access_invitations","school_student_accounts",
 "school_homework_submissions","school_learning_audit"]){
  assert.ok(sql.includes("'"+t+"'"),"RLS list missing "+t);
 }
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on table public\.%I from public,anon,authenticated/);
 assert.match(sql,/references public\.school_class_subjects\(school_id,class_id,subject_id\)/);
 assert.match(sql,/references public\.school_student_enrollments\(school_id,id\)/);
 assert.match(sql,/foreign key\(school_id,homework_id\)/);
 assert.match(sql,/references public\.school_students\(school_id,id\)/);
 assert.doesNotMatch(sql,/on delete cascade/i);
});

test("teacher API returns only assigned class roster and submissions",()=>{
 assert.match(roles,/schoolVerifiedContext\(request,code\)/);
 assert.match(roles,/eq\("role","teacher"\)/);
 assert.match(roles,/membership\?\.active!==true/);
 assert.match(classroom,/eq\("teacher_user_id",user\.id\)/);
 assert.match(classroom,/in\("class_id",classes\.map\(c=>c\.id\)\)/);
 assert.match(classroom,/in\("student_id",studentIds/);
 assert.match(classroom,/in\("enrollment_id",enrollments\.map\(e=>e\.id\)\)/);
 assert.match(sql,/school_teacher_is_assigned\(p_school,p_assignment,p_actor\)/);
 assert.match(sql,/m\.role='teacher' and m\.active/);
 assert.match(sql,/y\.status='current'/);
});

test("teacher assignment requires current-year class subject and approved teacher membership",()=>{
 assert.match(sql,/school_assign_teacher/);
 assert.match(sql,/p\.permissions/);
 assert.match(sql,/m\.role='school_owner'/);
 assert.match(sql,/teacher_user_id,teacher_role/);
 assert.match(sql,/class_id=p_class/);
 assert.match(sql,/subject_id=p_subject/);
 assert.match(classroom,/requireAal2\(token\)/);
 assert.match(classroom,/action==="teacher.assign"/);
 assert.match(teacherUI,/Teacher ↔ Class ↔ Subject/);
});

test("attendance records authorized students and audits changes",()=>{
 assert.match(sql,/create or replace function public\.school_record_attendance/);
 assert.match(sql,/unique\(school_id,enrollment_id,attendance_on\)/);
 assert.match(sql,/e\.class_id=cls/);
 assert.match(sql,/stu\.status='active'/);
 assert.match(sql,/p_day between y\.starts_on and y\.ends_on/);
 assert.match(sql,/attendance\.recorded/);
 assert.match(classroom,/action==="attendance.record"/);
 assert.match(teacherUI,/Mark attendance/);
});

test("homework and lessons published to real current-year teaching assignments",()=>{
 assert.match(sql,/create or replace function public\.school_publish_lesson/);
 assert.match(sql,/create or replace function public\.school_publish_homework/);
 assert.match(sql,/school_teacher_is_assigned/);
 assert.match(sql,/due_on date not null/);
 assert.match(classroom,/action==="homework.publish"/);
 assert.match(classroom,/action==="lesson.publish"/);
 assert.match(studentUI,/My Homework/);
 assert.match(studentUI,/My Lessons/);
});

test("student invitation requires verified guardian link and confirmed email, not login-selected role",()=>{
 assert.match(sql,/create or replace function public\.school_invite_student_account/);
 assert.match(sql,/Verified guardian link must exist first/);
 assert.match(sql,/Student account must have its own email/);
 assert.match(sql,/School must verify guardian permission/);
 assert.match(sql,/email_confirmed_at is not null/);
 assert.match(sql,/inv\.status<>'pending'/);
 assert.match(sql,/inv\.expires_at<=now\(\)/);
 assert.match(sql,/Guardian account cannot claim the same child as a student/);
 assert.match(sql,/role,active\)/);
 assert.match(sql,/values\(p_school,p_user,'student',true\)/);
 assert.match(learning,/body\.action!==|action==="student.claim"/);
 assert.match(studentUI,/Accept Student Invitation/);
 assert.match(portal,/Check Student Invitation/);
});

test("student can submit only their own homework for current active enrollment",()=>{
 assert.match(roles,/eq\("role","student"\)/);
 assert.match(roles,/eq\("auth_user_id",user\.id\)/);
 assert.match(sql,/create or replace function public\.school_submit_homework/);
 assert.match(sql,/sa\.auth_user_id=p_user and sa\.active/);
 assert.match(sql,/e\.class_id=assigned_class/);
 assert.match(sql,/y\.status='current'/);
 assert.match(sql,/unique\(school_id,homework_id,student_id\)/);
 assert.match(sql,/Homework deadline has passed/);
 assert.match(learning,/studentLearningContext\(request,code\)/);
 assert.match(learning,/p_student:authenticated\.student\.id/);
 assert.match(studentUI,/Submit homework/);
});

test("parents can read only the approved linked child without student submit access",()=>{
 assert.match(learning,/mode==="family"/);
 assert.match(learning,/eq\("role","parent"\)/);
 assert.match(learning,/eq\("auth_user_id",user\.id\)/);
 assert.match(learning,/eq\("student_id",studentId\)/);
 assert.match(learning,/eq\("active",true\)/);
 assert.match(learning,/No verified family access to this child/);
 assert.match(parentUI,/View attendance, lessons &amp; homework/);
 assert.match(studentUI,/family\|\|data\.accessReady/);
 assert.match(studentUI,/!family&&writing===h\.id/);
 assert.doesNotMatch(learning,/platform_fee_terms|platform_manual_payments/);
});

test("SQL privileged functions remain server-only",()=>{
 const names=["school_teacher_is_assigned","school_assign_teacher","school_publish_lesson",
  "school_publish_homework","school_record_attendance","school_invite_student_account",
  "school_claim_student_account","school_submit_homework"];
 for(const name of names)assert.ok(sql.includes("revoke all on function public."+name),"Missing revoke for "+name);
});

test("CI stages five migrations locally and never changes hosted APEX",()=>{
 const names=["platform_owner_console","school_onboarding_v1",
   "school_administration_v1","school_admissions_v1","school_learning_v1"];
 const locations=names.map(n=>ci.indexOf("supabase migration new "+n));
 assert.ok(locations.every(i=>i>=0));
 assert.ok(locations.every((v,i)=>i===0||v>locations[i-1]));
 assert.match(ci,/supabase db reset/);
 assert.doesNotMatch(ci,/^\s*supabase (db push|link) /m);
});
