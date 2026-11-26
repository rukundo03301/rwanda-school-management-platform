import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const file=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const db=file("../database/school_classrooms_v1.sql");
const classroom=file("../app/api/school/[code]/classroom/route.js");
const learning=file("../app/api/school/[code]/learning/route.js");
const role=file("../lib/school-classroom.mjs");
const teacherUi=file("../app/s/[code]/classroom/ClassroomDashboard.jsx");
const studentUi=file("../app/s/[code]/learning/StudentLearning.jsx");
const portal=file("../app/s/[code]/portal/SchoolPortal.jsx");
const ci=file("../.github/workflows/owner-console-ci.yml");

test("eight classroom and student tables are tenant-scoped, RLS enabled, browser grants denied",()=>{
 const names=["school_teacher_assignments","school_lesson_plans","school_homework",
  "school_student_account_invites","school_student_accounts",
  "school_homework_submissions","school_attendance_records","school_classroom_audit"];
 for(const name of names)assert.ok(db.includes("'"+name+"'"),"missing table from RLS lockdown "+name);
 assert.match(db,/enable row level security/);
 assert.match(db,/revoke all on table public\.%I from public,anon,authenticated/);
 assert.match(db,/grant all on table public\.%I to service_role/);
 assert.doesNotMatch(db,/create policy[\s\S]*using \(true\)/);
});
test("teacher actions are limited to active school, assigned class and subject, current year",()=>{
 assert.match(db,/create or replace function public\.school_teacher_can/);
 assert.match(db,/m\.role='teacher' and m\.active/);
 assert.match(db,/a\.class_id=p_class and a\.subject_id=p_subject and a\.active/);
 assert.match(db,/y\.status='current'/);
 assert.match(db,/school_create_lesson/);
 assert.match(db,/school_create_homework/);
 assert.match(db,/school_publish_homework/);
 assert.match(db,/homework\.published/);
 assert.match(role,/schoolVerifiedContext\(request,code\)/);
 assert.match(role,/eq\("auth_user_id",user\.id\)/);
 assert.match(classroom,/eq\("teacher_id",actorId\)/);
 assert.match(classroom,/const pairs=new Set\(teacherAssignments\.map/);
 assert.match(classroom,/homework=homework\.filter\(h=>pairs\.has/);
 assert.match(classroom,/lessons=lessons\.filter\(l=>pairs\.has/);
 assert.match(classroom,/eq\("school_id",school\.id\)/);
 assert.match(classroom,/role\.teacher/);
});
test("teacher class assignment requires school manager and previously verified teacher",()=>{
 assert.match(db,/school_assign_teacher/);
 assert.match(db,/role='school_owner' and active/);
 assert.match(db,/'academics\.manage'=any/);
 assert.match(db,/role='teacher' and active/);
 assert.match(db,/references public\.school_class_subjects\(school_id,class_id,subject_id\)/);
 assert.doesNotMatch(classroom,/requireAal2/);
 assert.match(classroom,/action==="teacher\.revoke"/);
 assert.match(db,/teacher\.assignment_revoked/);
});
test("student classwork cannot be read by other students or a self-selected role",()=>{
 assert.match(learning,/schoolVerifiedContext\(request,code\)/);
 assert.match(learning,/eq\("auth_user_id",user\.id\)/);
 assert.match(learning,/eq\("role","student"\)/);
 assert.match(learning,/eq\("active",true\)/);
 assert.match(learning,/from\("school_student_accounts"\)/);
 assert.match(learning,/eq\("student_id",record\.id\)/);
 assert.match(learning,/eq\("status","published"\)/);
 assert.match(learning,/eq\("academic_year_id",academicYear\.id\)/);
 assert.match(db,/school_submit_homework/);
 assert.match(db,/student_row\.student_id/);
 assert.match(db,/e\.student_id=student_row\.student_id/);
 assert.match(db,/unique\(school_id,homework_id,student_id\)/);
 assert.doesNotMatch(learning,/body\.studentId.*homework.submit/);
 assert.match(portal,/Check My Student Invitation/);
 assert.match(portal,/Open My Teaching Workspace/);
 assert.match(portal,/Open My Learning Workspace/);
});
test("guardian approval and verified school owner are required for minor student accounts",()=>{
 assert.match(db,/Only the verified school owner can invite a student account/);
 assert.match(db,/student_dob is null or student_dob>current_date-interval '18 years'/);
 assert.match(db,/school_guardian_links/);
 assert.match(db,/inv\.status<>'pending' or inv\.expires_at<=now\(\)/);
 assert.match(db,/email_confirmed_at is not null/);
 assert.match(db,/already been claimed/);
 assert.match(db,/A verified guardian link is still required/);
 assert.match(db,/school_revoke_student_account/);
 assert.match(db,/student\.account_revoked/);
 assert.match(classroom,/action==="student\.revoke"/);
 assert.match(studentUi,/Student identity stays hidden until you accept it/);
 assert.match(teacherUi,/I have verified student identity/);
});
test("published homework is distinct from teacher drafts, student submits only once",()=>{
 assert.match(db,/check\(\(status='draft' and published_at is null\)/);
 assert.match(db,/hw\.status<>'draft'/);
 assert.match(db,/status='published',published_at=now\(\)/);
 assert.match(db,/where school_id=p_school_id and id=p_homework and status='published'/);
 assert.match(db,/now\(\)>hw\.due_at/);
 assert.match(db,/unique\(school_id,homework_id,student_id\)/);
 assert.match(teacherUi,/Publish for students/);
 assert.match(studentUi,/Submit my homework/);
 assert.match(studentUi,/one submission/);
});
test("attendance requires active assigned teacher and current enrolled class/year",()=>{
 assert.match(db,/create or replace function public\.school_record_attendance/);
 assert.match(db,/p_date> \(now\(\) at time zone 'Africa\/Kigali'\)::date/);
 assert.match(db,/status='current'/);
 assert.match(db,/e\.student_id|student_id=p_student/);
 assert.match(db,/unique\(school_id,class_id,student_id,attendance_on\)/);
 assert.match(classroom,/action==="attendance\.record"/);
 assert.match(teacherUi,/Take class attendance/);
 assert.match(studentUi,/My Attendance/);
});
test("client code never includes server credential or platform-owner billing",()=>{
 for(const s of [teacherUi,studentUi]){
  assert.doesNotMatch(s,/SUPABASE_SECRET_KEY|SERVICE_ROLE_KEY|platform_manual_payments|platform_fee_terms/);
 }
 assert.doesNotMatch(learning,/platform_manual_payments/);
 assert.match(teacherUi,/School ID/);
});
test("five isolated migrations run in dependency order; no remote DB deployment commands",()=>{
 const migrations=["platform_owner_console","school_onboarding_v1","school_administration_v1",
  "school_admissions_v1","school_classrooms_v1"];
 const positions=migrations.map(n=>ci.indexOf("supabase migration new "+n));
 assert.ok(positions.every(x=>x>=0),String(positions));
 assert.ok(positions.every((v,i)=>i===0||v>positions[i-1]),String(positions));
 assert.match(ci,/supabase db reset/);
 assert.doesNotMatch(ci,/^\s+supabase (?:db push|link|migration up --linked)\b/m);
});
test("RPCs are service-only; no destructive child record cascade",()=>{
 const funcs=["school_teacher_can","school_assign_teacher","school_revoke_teacher_assignment",
  "school_create_lesson","school_create_homework","school_publish_homework",
  "school_record_attendance","school_invite_student_account","school_claim_student_account",
  "school_revoke_student_account","school_submit_homework"];
 for(const f of funcs)assert.ok(db.includes("revoke all on function public."+f),
   "Missing RPC grant lockdown for "+f);
 assert.doesNotMatch(db,/on delete cascade/i);
});
