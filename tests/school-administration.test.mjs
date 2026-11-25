import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SCHOOL_ADMIN_ACTIONS,SCHOOL_ADMIN_PERMISSIONS,normalizeSchoolAdminPermissions}
  from "../lib/school-admin-permissions.mjs";
const source=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
const db=source("../database/school_administration_v1.sql");
const server=source("../lib/school-admin.mjs");
const api=source("../app/api/school/[code]/admin/route.js");
const inviteApi=source("../app/api/school/[code]/invitation/route.js");
const portal=source("../app/s/[code]/portal/SchoolPortal.jsx");
const page=source("../app/s/[code]/admin/SchoolAdmin.jsx");
const ci=source("../.github/workflows/owner-console-ci.yml");

test("administrator permission set is strict, human-readable and toggleable",()=>{
 assert.equal(SCHOOL_ADMIN_ACTIONS.length,6);
 assert.deepEqual(SCHOOL_ADMIN_PERMISSIONS,[
  "people.read","people.invite","people.manage",
  "academics.read","academics.manage","audit.read"
 ]);
 assert.throws(()=>normalizeSchoolAdminPermissions(["platform_owner"]),/Invalid/);
 assert.throws(()=>normalizeSchoolAdminPermissions(["staff.payroll"]),/Invalid/);
 assert.deepEqual(normalizeSchoolAdminPermissions(["people.invite"]),["people.invite","people.read"]);
 assert.deepEqual(normalizeSchoolAdminPermissions(["academics.manage"]),["academics.manage","academics.read"]);
 assert.deepEqual(normalizeSchoolAdminPermissions(["people.read","people.read"]),["people.read"]);
 assert.match(page,/role="switch"/);
 assert.match(page,/className="switch"/);
 assert.match(page,/Permissions value=/);
});
test("every school-admin table has RLS and revoked browser grants",()=>{
 const tables=["school_admin_permissions","school_role_invites","school_academic_years",
  "school_classes","school_subjects","school_class_subjects","school_admin_audit"];
 for(const table of tables)assert.ok(db.includes("'"+table+"'"),"Missing RLS list "+table);
 assert.match(db,/enable row level security/);
 assert.match(db,/revoke all on table/);
 assert.match(db,/grant all on table.*to service_role/);
});
test("cross-school academic foreign keys prevent assigning a subject or year from another tenant",()=>{
 assert.match(db,/foreign key\(school_id,academic_year_id\)/);
 assert.match(db,/references public\.school_academic_years\(school_id,id\)/);
 assert.match(db,/foreign key\(school_id,class_id\)/);
 assert.match(db,/references public\.school_classes\(school_id,id\)/);
 assert.match(db,/foreign key\(school_id,subject_id\)/);
 assert.match(db,/references public\.school_subjects\(school_id,id\)/);
 assert.match(api,/eq\("school_id",school\.id\)/);
 assert.match(api,/assertSchoolRow\(db,"school_classes",school\.id,classId\)/);
 assert.match(api,/assertSchoolRow\(db,"school_subjects",school\.id,subjectId\)/);
});
test("school owner is required to invite admins or change their permissions",()=>{
 assert.match(api,/if\(role==="school_admin"\)requireSchoolOwner\(actor\)/);
 assert.match(api,/requireSchoolOwner\(actor\);requireAal2\(token\)/);
 assert.match(db,/Only the school owner may update admin permissions/);
 assert.match(db,/Only school owner may invite administrators/);
 assert.match(db,/Only school owner can revoke administrator/);
 assert.match(server,/school\.status!=="active"/);
});
test("server verifies identity + tenant status + active school-scoped membership",()=>{
 assert.match(server,/authClient\.auth\.getUser\(token\)/);
 assert.match(server,/email_confirmed_at/);
 assert.match(server,/eq\("school_code",code\)/);
 assert.match(server,/eq\("school_id",school\.id\)/);
 assert.match(server,/eq\("auth_user_id",user\.id\)/);
 assert.match(server,/eq\("active",true\)/);
 assert.match(server,/m\.role==="school_owner"/);
 assert.match(server,/m\.role==="school_admin"/);
});
test("invitation acceptance requires matching verified email and an active school, not role self-selection",()=>{
 assert.match(inviteApi,/schoolVerifiedContext\(request,code\)/);
 assert.match(inviteApi,/eq\("email",user\.email\.trim\(\)\.toLowerCase\(\)\)/);
 assert.match(inviteApi,/school_claim_member_invite/);
 assert.match(db,/email_confirmed_at is not null/);
 assert.match(db,/inv\.expires_at<=now\(\)/);
 assert.match(db,/inv\.status<>'pending'/);
 assert.match(portal,/claimStaffInvitation/);
 assert.match(portal,/school_role_invites|\/invitation/);
});
test("administration never reads platform owner's manual fee ledger or student records",()=>{
 assert.doesNotMatch(api,/platform_fee_terms|platform_manual_payments|platform_staff|school_student/);
 assert.doesNotMatch(page,/platform_fee_terms|platform_manual_payments/);
 assert.doesNotMatch(page,/Student records are not part of Module/);
});
test("three source migrations run in dependency order in isolated Supabase stack",()=>{
 const first=ci.indexOf("supabase migration new platform_owner_console");
 const second=ci.indexOf("supabase migration new school_onboarding_v1");
 const third=ci.indexOf("supabase migration new school_administration_v1");
 assert.ok(first>=0&&first<second&&second<third);
 assert.match(ci,/supabase db reset/);
 assert.doesNotMatch(ci,/db push --linked|db push --remote/);
});
test("no production receipts, student enrollment or seeded fake user data",()=>{
 assert.doesNotMatch(db,/insert into public\.school_classes|insert into public\.school_subjects/);
 assert.doesNotMatch(db,/create table.*school_student/i);
 assert.doesNotMatch(db,/on delete cascade/i);
 for(const fun of ["school_invite_member","school_claim_member_invite",
  "school_set_admin_permissions","school_revoke_member","school_set_current_year"]){
  assert.ok(db.includes("revoke all on function public."+fun),fun+" not server-protected");
 }
});
