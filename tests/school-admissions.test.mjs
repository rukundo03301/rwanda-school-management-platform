import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ADMISSIONS_ACTIONS,ADMISSIONS_PERMISSIONS}
 from "../lib/school-admissions-permissions.mjs";

const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
const db=read("../database/school_admissions_v1.sql");
const api=read("../app/api/school/[code]/admissions/route.js");
const family=read("../app/api/school/[code]/family/route.js");
const secure=read("../lib/school-admissions.mjs");
const parentUi=read("../app/s/[code]/family/FamilyDashboard.jsx");
const dashboard=read("../app/s/[code]/admissions/AdmissionsDashboard.jsx");
const portal=read("../app/s/[code]/portal/SchoolPortal.jsx");
const schoolAdmin=read("../app/s/[code]/admin/SchoolAdmin.jsx");
const ci=read("../.github/workflows/owner-console-ci.yml");

test("admissions permissions are four separate school-specific capabilities",()=>{
 assert.deepEqual(ADMISSIONS_PERMISSIONS,[
  "admissions.read","admissions.manage","enrollments.manage","guardians.manage"
 ]);
 assert.equal(ADMISSIONS_ACTIONS.length,4);
 assert.match(dashboard,/ADMISSIONS_ACTIONS\.map/);
 assert.match(dashboard,/role="switch"/);
 assert.match(api,/if\(!actor\.isOwner\)/);
 assert.match(api,/requireAal2\(token\)/);
 assert.match(db,/school_set_admissions_permissions/);
 assert.match(db,/Only this school|School owner required/);
});

test("all seven child-related tables are RLS protected and browser access revoked",()=>{
 for(const name of [
  "school_admissions_permissions","school_admission_applications","school_students",
  "school_student_enrollments","school_guardian_invitations","school_guardian_links",
  "school_admissions_audit"
 ]) assert.ok(db.includes("'"+name+"'"),"Missing secure table "+name);
 assert.match(db,/enable row level security/);
 assert.match(db,/revoke all on table public\.%I from public,anon,authenticated/);
 assert.match(db,/grant all on table public\.%I to service_role/);
 assert.doesNotMatch(db,/create policy.*to authenticated[^\n]*using \(true\)/i);
});

test("application becomes student only after atomic, authorized approval",()=>{
 assert.match(db,/create or replace function public\.school_submit_admission/);
 assert.match(db,/create or replace function public\.school_review_admission/);
 assert.match(db,/p_decision='admit'/);
 assert.match(db,/for update/);
 assert.match(db,/count\(\*\) into current_count/);
 assert.match(db,/Class is already at capacity/);
 assert.match(db,/insert into public\.school_students/);
 assert.match(db,/insert into public\.school_student_enrollments/);
 assert.match(db,/update public\.school_admission_applications set[\s\S]*status='admitted'/);
 assert.match(db,/if p_decision='reject'/);
 assert.match(api,/p_application_id:appId/);
 assert.match(api,/p_school_id:school\.id/);
});

test("composite foreign keys prohibit cross-school students, class and academic-year records",()=>{
 assert.match(db,/foreign key\(school_id,academic_year_id\)/);
 assert.match(db,/references public\.school_academic_years\(school_id,id\)/);
 assert.match(db,/foreign key\(school_id,class_id,academic_year_id\)/);
 assert.match(db,/references public\.school_classes\(school_id,id,academic_year_id\)/);
 assert.match(db,/foreign key\(school_id,student_id\)/);
 assert.match(db,/references public\.school_students\(school_id,id\)/);
 assert.match(db,/unique\(school_id,student_id,academic_year_id\)/);
 assert.match(secure,/schoolAdminContext\(request,code\)/);
 assert.match(api,/eq\("school_id",school\.id\)/);
});

test("school must verify the guardian; confirmed recipient opts in before any child details",()=>{
 assert.match(db,/verification_attested boolean not null/);
 assert.match(db,/p_attested is distinct from true/);
 assert.match(db,/p_verified_email/);
 assert.match(db,/email_confirmed_at is not null/);
 assert.match(db,/inv\.status<>'pending'/);
 assert.match(db,/inv\.expires_at<=now\(\)/);
 assert.match(db,/p_guardian_user_id/);
 assert.match(family,/guardianContext\(request,code\)/);
 assert.match(family,/if\(isLinkedParent\)/);
 assert.match(family,/eq\("auth_user_id",user\.id\)/);
 assert.match(family,/eq\("active",true\)/);
 assert.match(family,/Never expose names or personal details for pending\/unclaimed/);
 assert.match(parentUi,/The child's identity is hidden/);
 assert.match(parentUi,/Accept family link/);
 assert.match(portal,/Check My Family Invitation/);
});

test("no public self-registration or teacher-wide access to personal child data",()=>{
 assert.doesNotMatch(api,/anon|public application/);
 assert.match(api,/admissionsContext\(request,code\)/);
 assert.doesNotMatch(family,/schoolAdminContext\(request,code\)/);
 assert.match(schoolAdmin,/Admissions & Students/);
 assert.doesNotMatch(api,/platform_fee_terms|platform_manual_payments/);
 assert.doesNotMatch(parentUi,/school_fees|teacher_grades|platform_fee_terms/);
});

test("server-only privileged RPCs and absence of accidental destructive deletes",()=>{
 for(const name of [
   "school_admissions_actor_allowed","school_submit_admission","school_review_admission",
   "school_invite_guardian","school_claim_guardian_invitation",
   "school_revoke_guardian","school_set_admissions_permissions"
 ]){
  assert.ok(db.includes("revoke all on function public."+name),
    "RPC is not restricted: "+name);
 }
 assert.doesNotMatch(db,/on delete cascade/i);
 assert.doesNotMatch(db,/create table.*school_student_grades/i);
 assert.match(db,/student_code text not null unique/);
 assert.match(db,/application_code text not null unique/);
});

test("owner console, onboarding, school admin, admissions migrations have stable order",()=>{
 const names=["platform_owner_console","school_onboarding_v1",
  "school_administration_v1","school_admissions_v1"];
 const positions=names.map(n=>ci.indexOf("supabase migration new "+n));
 assert.ok(positions.every(i=>i>=0),JSON.stringify(positions));
 assert.ok(positions.every((p,i)=>!i||p>positions[i-1]));
 assert.match(ci,/supabase db reset/);
 assert.doesNotMatch(ci,/--linked|--remote|db push/);
});
