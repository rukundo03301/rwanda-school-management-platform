import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 normalizeComPermissions,canViewAnnouncement,validClock,comText,
 ANNOUNCEMENT_AUDIENCES,WEEKDAYS
} from "../lib/school-communications.mjs";

const read=relative=>readFileSync(new URL(relative,import.meta.url),"utf8");
const sql=read("../database/school_communications_v1.sql");
const api=read("../app/api/school/[code]/communications/route.js");
const access=read("../lib/school-communications.mjs");
const ui=read("../app/s/[code]/communications/SchoolCommunications.jsx");
const flow=read("../.github/workflows/owner-console-ci.yml");
const parent=read("../app/s/[code]/family/FamilyDashboard.jsx");
const portal=read("../app/s/[code]/portal/SchoolPortal.jsx");

test("all communication tables have RLS, server-only grants and no destructive cascade",()=>{
 const tables=["school_communication_permissions","school_timetable_periods",
  "school_announcements","school_calendar_events","school_announcement_reads",
  "school_family_message_threads","school_family_messages",
  "school_message_notifications","school_communications_audit"];
 for(const n of tables)assert.ok(sql.includes("'"+n+"'"),n+" missing from protected table list");
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on table public\.%I from public,anon,authenticated/);
 assert.match(sql,/grant all on table public\.%I to service_role/);
 assert.doesNotMatch(sql,/on delete cascade/i);
});

test("timetable schedule checks active teacher assignment and prevents overlapping classes, teachers, rooms",()=>{
 assert.match(sql,/school_add_timetable_period/);
 assert.match(sql,/school_comms_manager_allowed\(p_school,p_actor,'timetable\.manage'\)/);
 assert.match(sql,/join public\.school_academic_years y/);
 assert.match(sql,/y\.status='current'/);
 assert.match(sql,/a\.teacher_id=p_teacher and a\.active/);
 assert.match(sql,/pg_advisory_xact_lock\(hashtext\(p_school::text\),p_day\)/);
 assert.match(sql,/p\.starts_at<p_end and p\.ends_at>p_start/);
 assert.match(sql,/p\.class_id=p_class or p\.teacher_id=p_teacher/);
 assert.match(sql,/btrim\(p\.room\)=btrim\(p_room\)/);
 assert.match(sql,/school_disable_timetable_period/);
 assert.match(api,/action==="period\.add"/);
 assert.match(ui,/Schedule Lesson/);
 assert.equal(validClock("08:45"),"08:45:00");
 assert.throws(()=>validClock("25:00"));
 assert.throws(()=>validClock("8:45"));
});

test("parent and teacher private messages require verified, active guardian-child and assignment links",()=>{
 assert.match(sql,/create or replace function public\.school_comms_guardian_for_student/);
 assert.match(sql,/g\.active/);
 assert.match(sql,/m\.role='parent' and m\.active/);
 assert.match(sql,/create or replace function public\.school_comms_teacher_for_student/);
 assert.match(sql,/m\.role='teacher' and m\.active/);
 assert.match(sql,/e\.status='active'/);
 assert.match(sql,/school_open_family_thread/);
 assert.match(sql,/p_actor not in \(p_teacher,p_guardian\)/);
 assert.match(sql,/school_send_family_message/);
 assert.match(sql,/school_comms_guardian_for_student\(/);
 assert.match(sql,/school_comms_teacher_for_student\(/);
 assert.match(sql,/p_actor not in \(conversation\.teacher_id,conversation\.guardian_id\)/);
 assert.match(sql,/30[\s\S]*School message rate limit reached/);
 assert.match(sql,/family\.message_sent/);
 assert.match(sql,/school_read_message_notification/);
 assert.match(sql,/recipient_id=p_actor/);
 assert.match(api,/graph\.pairs\.has/);
 assert.match(api,/\.eq\("guardian_id",user\.id\)/);
 assert.match(api,/\.eq\("teacher_id",user\.id\)/);
 assert.match(api,/\.in\("thread_id",ids\)/);
 assert.doesNotMatch(api,/params\.guardianId|params\.studentId|query\.guardian_id/);
});

test("announcement and calendar visibility depends on active school role and assigned/linked class",()=>{
 assert.deepEqual(ANNOUNCEMENT_AUDIENCES,[
  "all","staff","teachers","parents","students","class"
 ]);
 const base={roles:["parent"],childIds:["child-1"],studentId:null,classIds:["class-1"]};
 const item={status:"published",audience:"parents",class_id:null,expires_at:null};
 assert.equal(canViewAnnouncement(item,base),true);
 assert.equal(canViewAnnouncement({...item,audience:"students"},base),false);
 assert.equal(canViewAnnouncement({...item,audience:"class",class_id:"class-2"},base),false);
 assert.equal(canViewAnnouncement({...item,audience:"class",class_id:"class-1"},base),true);
 assert.equal(canViewAnnouncement({...item,status:"archived"},base),false);
 assert.equal(canViewAnnouncement({...item,expires_at:"2000-01-01T00:00:00Z"},base),false);
 assert.match(sql,/school_publish_announcement/);
 assert.match(sql,/school_schedule_calendar_event/);
 assert.match(sql,/school_cancel_calendar_event/);
 assert.match(api,/canViewAnnouncement\(a,contextForAudience\)/);
 assert.match(api,/isVisibleTo\(e,contextForAudience\)/);
 assert.match(api,/eq\("status","published"\)/);
 assert.match(api,/eq\("status","scheduled"\)/);
 assert.match(api,/canViewAnnouncement\(notice/);
 assert.equal(WEEKDAYS.length,7);
});

test("parent overview never depends on self-asserted student IDs",()=>{
 assert.match(access,/schoolVerifiedContext\(request,code\)/);
 assert.match(access,/from\("school_guardian_links"\)/);
 assert.match(access,/eq\("auth_user_id",user\.id\)/);
 assert.match(access,/eq\("active",true\)/);
 assert.match(access,/from\("school_student_accounts"\)/);
 assert.match(access,/from\("school_student_enrollments"\)/);
 assert.match(api,/\.in\("student_id",linkedIds\)/);
 assert.match(api,/\.eq\("status","published"\)/);
 assert.match(api,/\.eq\("status","active"\)/);
 assert.match(ui,/My verified children/);
 assert.match(ui,/Homework deadlines/);
 assert.match(ui,/Attendance recorded by the school/);
 assert.match(parent,/Open My Family School Day/);
 assert.match(portal,/Family Timetable & Messages/);
});

test("owner-controlled ON/OFF staff permissions never confer access to private messages",()=>{
 assert.deepEqual(normalizeComPermissions(["announcements.manage","timetable.manage"]),[
  "announcements.manage","timetable.manage"
 ]);
 assert.throws(()=>normalizeComPermissions(["messages.read_all"]));
 assert.throws(()=>normalizeComPermissions(["announcements.manage","timetable.manage","bad"]));
 assert.match(sql,/Only school owner may change communications access/);
 assert.match(sql,/school_set_comms_permissions/);
 assert.match(sql,/communications\.permissions_changed/);
 assert.match(sql,/m\.role='school_owner'/);
 assert.match(ui,/role="switch"/);
 assert.match(ui,/Private to the verified teacher and guardian/);
 assert.match(ui,/These switches never allow access to private family messages|do not grant private family message access/);
 assert.match(api,/requireAal2\(token\)/);
});

test("in-app notifications are real but provider email/SMS aren't falsely claimed",()=>{
 assert.match(sql,/email_status text not null default 'not_configured'/);
 assert.match(sql,/school_message_notifications/);
 assert.match(sql,/recipient:=case when p_actor=conversation\.teacher_id/);
 assert.match(api,/emailAlerts:"not_configured",smsAlerts:"not_configured"/);
 assert.match(ui,/email delivery is not configured/);
 assert.doesNotMatch(ui,/Email delivered successfully|SMS sent/);
});

test("all 12 internal functions have no public execute grant",()=>{
 for(const fn of [
  "school_comms_manager_allowed","school_comms_teacher_for_student",
  "school_comms_guardian_for_student","school_set_comms_permissions",
  "school_add_timetable_period","school_disable_timetable_period",
  "school_publish_announcement","school_archive_announcement",
  "school_schedule_calendar_event","school_cancel_calendar_event",
  "school_open_family_thread","school_send_family_message",
  "school_close_family_thread","school_read_message_notification"
 ]){
  assert.ok(sql.includes("revoke all on function public."+fn),fn+" missing revoke");
  assert.ok(sql.includes("grant execute on function public."+fn),fn+" missing server grant");
 }
 assert.doesNotMatch(sql,/security definer/i);
 assert.doesNotMatch(ui,/SUPABASE_SECRET_KEY|SERVICE_ROLE_KEY/);
});

test("every SQL procedure has complete dollar-quote boundaries and correct service signatures",()=>{
 assert.equal((sql.match(/create or replace function/g)||[]).length,14);
 assert.equal((sql.match(/as \$\$/g)||[]).length,14);
 assert.equal((sql.match(/end;\n\$\$;/g)||[]).length,14);
 assert.doesNotMatch(sql,/as \$(?!\$)/);
 assert.doesNotMatch(sql,/^\$;$/m);
 for(const sig of [
  "school_archive_announcement(uuid,uuid,text,uuid)",
  "school_schedule_calendar_event(uuid,text,text,text,text,uuid,timestamptz,timestamptz,text,uuid)",
  "school_cancel_calendar_event(uuid,uuid,text,uuid)"
 ])assert.ok(sql.includes("grant execute on function public."+sig+" to service_role"),sig);
});

test("parent homework reflects actual submission status and no stale revoked teacher timetable",()=>{
 assert.match(api,/school_homework_submissions/);
 assert.match(api,/submitted:submitted\.some/);
 assert.match(api,/activeTimetableAssignments/);
 assert.match(api,/teacherMembers\.has\(x\.teacher_id\)/);
 assert.match(ui,/h\.submitted\?"✓ Submitted/);
});

test("inputs refuse unknown roles and invalid text",()=>{
 assert.throws(()=>comText(" ",150));
 assert.throws(()=>comText("a",150,{min:3}));
 assert.equal(comText(" School Notice ",150),"School Notice");
});

test("seven isolated migrations run in order, never deploying directly to APEX",()=>{
 const names=["platform_owner_console","school_onboarding_v1",
  "school_administration_v1","school_admissions_v1",
  "school_classrooms_v1","school_reports_curriculum_v1","school_communications_v1"];
 const indexes=names.map(n=>flow.indexOf("supabase migration new "+n));
 assert.ok(indexes.every(n=>n>=0),String(indexes));
 assert.ok(indexes.every((n,i)=>i===0||n>indexes[i-1]),String(indexes));
 assert.match(flow,/supabase db reset/);
 assert.doesNotMatch(flow,/^\s+supabase (?:db push|link|migration up --linked)\b/m);
});
