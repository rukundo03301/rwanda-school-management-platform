import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {collectTenantStoragePaths,removeTenantStorage,
 validSchoolCodeConfirmation,TENANT_DELETE_PHRASE}
 from "../lib/tenant-purge.mjs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const schema=read("../database/platform_demo_tenant_purge_v1.sql");
const api=read("../app/api/platform/route.js");
const ui=read("../app/platform/page.jsx");
const workflow=read("../.github/workflows/owner-console-ci.yml");
const moduleSql=[
 "../database/platform_owner_console.sql","../database/school_onboarding_v1.sql",
 "../database/school_administration_v1.sql","../database/school_admissions_v1.sql",
 "../database/school_classrooms_v1.sql","../database/school_reports_curriculum_v1.sql",
 "../database/school_communications_v1.sql","../database/school_fees_rwf_v1.sql"
];
test("manifest explicitly lists every public table with school_id across modules",()=>{
 const actual=new Set();
 for(const p of moduleSql){
  const s=read(p),tables=[...s.matchAll(/create table (?:if not exists )?public\.(\w+)\s*\(/gi)];
  for(let i=0;i<tables.length;i++){
   const definition=s.slice(tables[i].index,tables[i+1]?.index||s.length).slice(0,2000);
   if(/\bschool_id uuid\b/.test(definition))actual.add(tables[i][1]);
  }
 }
 const list=schema.slice(schema.indexOf("create or replace function public.platform_tenant_scope_manifest"),
   schema.indexOf("create or replace function public.platform_verify_tenant_scope"));
 const expected=[...list.matchAll(/'((?:school|platform)_\w+)'/g)].map(x=>x[1]);
 assert.equal(actual.size,54);
 assert.equal(expected.length,54);
 assert.deepEqual(expected.sort(),[...actual].sort());
 assert.match(schema,/Missing: %, new: %/);
 assert.match(schema,/unexpected table references tenant data/);
});
test("demo school seeds actual synthetic school workflows without emails or monetary collection",()=>{
 assert.match(schema,/create or replace function public\.platform_create_demo_school/);
 assert.match(schema,/is_demo boolean not null default false/);
 assert.match(schema,/legal_hold boolean not null default false/);
 for(const s of [
  "platform_companies","platform_schools","school_memberships",
  "school_onboarding","platform_school_sites","school_site_drafts",
  "school_academic_years","school_classes","school_subjects",
  "school_class_subjects","school_teacher_assignments","school_students",
  "school_student_enrollments","school_guardian_links",
  "school_lesson_plans","school_homework","school_attendance_records",
  "school_timetable_periods","school_announcements",
  "school_calendar_events","school_fee_catalog","school_fee_invoices"
 ])assert.match(schema,new RegExp("insert into public\\."+s+"\\b"),s);
 assert.match(schema,/DEMO SCHOOL — SAMPLE DATA ONLY/);
 assert.match(schema,/demo-owner@example\.invalid/);
 assert.doesNotMatch(schema,/inviteUserByEmail|chargeCustomer|createPayment/);
});
test("only platform owner with verified two-factor and exact school code may permanently delete",()=>{
 assert.match(api,/action === "tenant\.demo\.create"/);
 assert.match(api,/action === "tenant\.purge\.preview"/);
 assert.match(api,/action === "tenant\.purge"/);
 assert.match(api,/requireOwner\(actor\);requireAal2\(token\)/);
 assert.match(api,/validSchoolCodeConfirmation\(before\.school_code,confirmCode,confirmPhrase\)/);
 assert.match(api,/before\.legal_hold/);
 assert.match(api,/platform_change_school_state/);
 assert.match(api,/p_target:"deletion_requested"/);
 assert.match(api,/platform_purge_tenant_data/);
 assert.match(api,/verification:"school_removed_and_storage_empty"/);
 assert.equal(validSchoolCodeConfirmation("RW-SCH-000123","RW-SCH-000123",TENANT_DELETE_PHRASE),true);
 assert.equal(validSchoolCodeConfirmation("RW-SCH-000123","RW-SCH-000124",TENANT_DELETE_PHRASE),false);
 assert.equal(validSchoolCodeConfirmation("RW-SCH-000123","RW-SCH-000123","delete"),false);
});
test("purge is a transaction using dependency-safe order, preserving other schools",()=>{
 assert.match(schema,/status<>'deletion_requested'/);
 assert.match(schema,/s\.legal_hold/);
 assert.match(schema,/select \* into s from public\.platform_schools[\s\S]*for update/);
 assert.match(schema,/pg_catalog\.pg_constraint fk on fk\.conrelid=p\.relid/);
 assert.match(schema,/group by relid order by depth,relid/);
 assert.match(schema,/delete from %s where school_id=\$1/);
 assert.match(schema,/using p_school/);
 assert.match(schema,/storage\.objects/);
 assert.match(schema,/Storage object\(s\) remain/);
 assert.match(schema,/delete from public\.platform_schools where id=p_school/);
 assert.match(schema,/where company_id=s\.company_id/);
 assert.match(schema,/delete from public\.platform_companies where id=s\.company_id/);
 assert.match(schema,/shared_user_accounts_preserved/);
 assert.doesNotMatch(schema,/^\s*on delete cascade\b/im);
});
test("sensitive purge functions are service-role only and use SECURITY INVOKER",()=>{
 for(const name of [
  "platform_tenant_scope_manifest","platform_verify_tenant_scope",
  "platform_preview_tenant_purge","platform_purge_tenant_data",
  "platform_create_demo_school"
 ]) {
  assert.match(schema,new RegExp("revoke all on function public\\."+name));
  assert.match(schema,new RegExp("grant execute on function public\\."+name));
 }
 assert.doesNotMatch(schema,/security definer/i);
 assert.doesNotMatch(api,/NEXT_PUBLIC_SUPABASE_SECRET_KEY|SUPABASE_SECRET_KEY/);
});
test("owner screen exposes demo creation, evidence preflight and strongly confirmed deletion",()=>{
 assert.match(ui,/Create Mockup School/);
 assert.match(ui,/DEMO · SYNTHETIC/);
 assert.match(ui,/onPurge=\{previewPurge\}/);
 assert.match(ui,/tenant\.purge\.preview/);
 assert.match(ui,/rows_by_table/);
 assert.match(ui,/Permanently delete school and verify wipe/);
 assert.match(ui,/confirmSchoolCode!==purgePreview\.school_code/);
 assert.match(ui,/form\.confirmPhrase!=="DELETE ALL SCHOOL DATA"/);
 assert.match(ui,/Backups, independently hosted images and already delivered external emails/);
 assert.match(ui,/shared login accounts|Shared user accounts|shared user accounts/i);
});
test("Storage traversal deletes exactly school-owned prefixed files, not whole buckets",async()=>{
 const id="1b8e5d9a-1111-4111-8111-111111111111";
 const calls=[],removed=[];
 const roots=new Map([
  [id,[{id:"logo-1",name:"logo.webp"},{id:null,name:"nested"}]],
  [id+"/nested",[{id:"hero-1",name:"hero.webp"}]],
  ["schools/"+id,[]],["tenants/"+id,[]]
 ]);
 const storage={
  from(bucket){
   assert.equal(bucket,"school-branding");
   return {
    async list(prefix,opts){calls.push(prefix);return {data:roots.get(prefix)||[],error:null}},
    async remove(paths){removed.push(...paths);return {error:null}}
   };
  }
 };
 const names=await collectTenantStoragePaths(storage,"school-branding",id);
 assert.deepEqual(names,[id+"/logo.webp",id+"/nested/hero.webp"]);
 const count=await removeTenantStorage({storage},{storage_buckets:["school-branding"]},id);
 assert.equal(count,2);
 assert.deepEqual(removed,names);
 assert.ok(!calls.some(x=>x.includes("other-school")));
});
test("storage failures stop purge rather than falsely report a completed wipe",async()=>{
 const id="1b8e5d9a-1111-4111-8111-111111111111";
 const db={storage:{from(){return {
  async list(){return {data:[],error:{message:"not allowed"}};},
  async remove(){throw Error("must never be called")}
 };}}};
 await assert.rejects(()=>removeTenantStorage(db,{storage_buckets:["school-branding"]},id));
});
test("ninth isolated migration and transactional smoke test are in CI",()=>{
 const n=["platform_owner_console","school_onboarding_v1",
  "school_administration_v1","school_admissions_v1",
  "school_classrooms_v1","school_reports_curriculum_v1",
  "school_communications_v1","school_fees_rwf_v1",
  "platform_demo_tenant_purge_v1"];
 const ps=n.map(x=>workflow.indexOf("supabase migration new "+x));
 assert.ok(ps.every(x=>x>=0),JSON.stringify(ps));
 assert.ok(ps.every((x,i)=>i===0||x>ps[i-1]),JSON.stringify(ps));
 assert.match(workflow,/tests\/platform-tenant-purge\.smoke\.sql/);
 assert.doesNotMatch(workflow,/^\s+supabase (?:db push|link|migration up --linked)\b/m);
});
