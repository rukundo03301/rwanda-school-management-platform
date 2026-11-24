import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SCHOOL_ROLES,SCHOOL_ROLE_IDS,schoolPortalPath,validSchoolRole,approvedSchoolRoles,resolveSchoolRole,schoolWorkspacePath} from "../lib/school-roles.mjs";

const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
const migration=read("../database/school_onboarding_v1.sql");
const publicSite=read("../app/s/[code]/page.jsx");
const schoolLogin=read("../app/s/[code]/login/SchoolLogin.jsx");
const schoolPortal=read("../app/s/[code]/portal/SchoolPortal.jsx");
const accessApi=read("../app/api/school/[code]/access/route.js");
const schoolApi=read("../app/api/school/[code]/route.js");
const onboarding=read("../app/s/[code]/setup/SchoolSetup.jsx");

test("exactly six supported role types; school login does not ask users to select one",()=>{
  assert.deepEqual(SCHOOL_ROLE_IDS,["school_owner","school_admin","teacher","staff","parent","student"]);
  assert.equal(SCHOOL_ROLES.length,6);
  assert.equal(validSchoolRole("platform_owner"),false);
  assert.throws(()=>schoolPortalPath("RW-SCH-000002","platform_owner"),/Invalid/);
  assert.equal(schoolPortalPath("RW-SCH-000002","teacher"),"/s/RW-SCH-000002/portal?role=teacher");
  assert.doesNotMatch(schoolLogin,/SCHOOL_ROLES\\.map|Choose your school role before signing in/);
  assert.match(schoolLogin,/Your school administrator assigns and manages roles/);
  assert.match(schoolLogin,/window\\.location\\.assign/);
  assert.doesNotMatch(schoolLogin,/window\.location\.assign\("\/s\/"\+code\+"\/setup"\)/);
});

test("role picker cannot authorize membership, including across schools",()=>{
  assert.match(accessApi,/auth\.getUser\(raw\.slice\(7\)\)/);
  assert.match(accessApi,/email_confirmed_at/);
  assert.match(accessApi,/eq\("school_id",school\.id\)/);
  assert.match(accessApi,/eq\("auth_user_id",user\.id\)/);
  assert.match(accessApi,/eq\("active",true\)/);
  assert.match(accessApi,/school\.status==="active"\|\|role==="school_owner"/);
  assert.doesNotMatch(accessApi,/body\.role/);
  assert.match(schoolPortal,/access\?\.roles\?\.includes\(role\)===true/);
  assert.match(schoolPortal,/This role is not approved for your account/);
  assert.match(schoolPortal,/Workspace under development/);
});

test("homepage uses published marketing content, not a draft or operator ledger",()=>{
  assert.match(publicSite,/from\("platform_school_sites"\)/);
  assert.doesNotMatch(publicSite,/school_site_drafts/);
  assert.doesNotMatch(publicSite,/platform_fee_terms/);
  assert.doesNotMatch(publicSite,/platform_manual_payments/);
  for(const field of ["mission_statement","vision_statement","leader_name","leader_title","leader_message","leader_photo_url","advertisements"]){
    assert.ok(publicSite.includes(field),"Missing published field "+field);
    assert.ok(migration.includes("add column if not exists "+field),"Missing DB column "+field);
  }
  assert.match(publicSite,/className="site-portal-link"/);
  assert.match(publicSite,/promos\.map/);
  assert.match(publicSite,/a\?\.enabled/);
});

test("owner edits mission, vision, leader and approved promos in private draft",()=>{
  assert.match(onboarding,/Mission statement/);
  assert.match(onboarding,/Vision statement/);
  assert.match(onboarding,/Leadership photograph/);
  assert.match(onboarding,/form\.advertisements\.map/);
  assert.match(onboarding,/SchoolPreview/);
  assert.match(schoolApi,/action==="saveSite"/);
  assert.match(schoolApi,/from\("school_site_drafts"\)\.upsert/);
  assert.match(schoolApi,/from\("platform_school_sites"\)\.upsert/);
  assert.match(schoolApi,/advertisements:\(\(\)=>/);
  assert.match(schoolApi,/advertisements\.length>3/);
});

test("multi-role schools remain scoped and owner setup requires owner membership specifically",()=>{
  const security=read("../lib/school-server.js");
  assert.match(migration,/primary key\(school_id,auth_user_id,role\)/);
  assert.match(security,/eq\("role","school_owner"\)/);
  assert.match(migration,/check\(role in \('school_owner','school_admin','teacher','staff','parent','student'\)\)/);
});

test("role routing uses approved membership, not user-selected labels",()=>{
 assert.deepEqual(approvedSchoolRoles(["teacher","teacher","student","fake"]),["teacher","student"]);
 assert.equal(resolveSchoolRole(["teacher"],"school_owner"),"teacher");
 assert.equal(resolveSchoolRole(["teacher","parent"],"school_owner"),null);
 assert.equal(resolveSchoolRole(["teacher","parent"],"parent"),"parent");
 assert.equal(resolveSchoolRole([],"school_owner"),null);
 assert.equal(schoolWorkspacePath("RW-SCH-000004","teacher"),"/s/RW-SCH-000004/classroom");
 assert.equal(schoolWorkspacePath("RW-SCH-000004","student"),"/s/RW-SCH-000004/learning");
 assert.equal(schoolWorkspacePath("RW-SCH-000004","parent"),"/s/RW-SCH-000004/family");
 assert.equal(schoolWorkspacePath("RW-SCH-000004","school_admin"),"/s/RW-SCH-000004/admin");
 assert.throws(()=>schoolWorkspacePath("RW-SCH-000004","platform_owner"),/Invalid/);
});
