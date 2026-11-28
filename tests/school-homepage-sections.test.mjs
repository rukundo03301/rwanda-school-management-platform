import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
const migration=read("../database/school_homepage_sections_v1.sql");
const publicSite=read("../app/s/[code]/page.jsx");
const schoolApi=read("../app/api/school/[code]/route.js");
const uploadApi=read("../app/api/school/[code]/upload/route.js");
const onboarding=read("../app/s/[code]/setup/SchoolSetup.jsx");
const css=read("../app/globals.css");
const FIELDS=["address_text","programs_intro","admissions_intro","admissions_instructions","admissions_contact","gallery"];

test("homepage section columns exist in the migration, draft API and public page",()=>{
  for(const field of FIELDS){
    assert.ok(migration.includes("add column if not exists "+field),"Missing DB column "+field);
    assert.ok(schoolApi.includes(field),"School API does not handle "+field);
    assert.ok(publicSite.includes(field),"Public page does not read "+field);
  }
  assert.ok(migration.includes("add column if not exists education_levels"));
  assert.match(migration,/_homepage_sections_chk/);
  assert.match(migration,/jsonb_array_length\(gallery\)\s*<=\s*12/);
  assert.doesNotMatch(migration,/disable row level security/i);
});

test("programs come only from the school's own selected education levels",()=>{
  assert.match(schoolApi,/from\("school_onboarding"\)\.select\("education_levels"\)\.eq\("school_id",school\.id\)/);
  assert.match(schoolApi,/education_levels:educationLevels/);
  assert.match(publicSite,/LEVEL_LABELS\[l\]/);
  assert.match(publicSite,/\{hasPrograms&&<section id="programs"/);
  assert.doesNotMatch(publicSite,/School life & learning/);
});

test("admissions section is informational and shows no application button",()=>{
  assert.match(publicSite,/\{hasAdmissions&&<section id="admissions"/);
  assert.doesNotMatch(publicSite,/Apply now/i);
  assert.doesNotMatch(publicSite,/\/admissions\/apply/);
  assert.match(onboarding,/Admissions introduction/);
});

test("gallery photographs are school-scoped on upload, save and display",()=>{
  assert.match(uploadApi,/\["logo","hero","leader","gallery"\]\.includes\(kind\)/);
  assert.match(uploadApi,/schoolContext\(request,code\)/);
  assert.match(uploadApi,/const path=school\.id\+"\/"\+kind/);
  assert.match(schoolApi,/body\.gallery\.length>12/);
  assert.match(schoolApi,/const url=image\(item\.url\)/);
  assert.match(schoolApi,/school-branding\/"\+school\.id\+"\/"/);
  assert.match(publicSite,/school-branding\/"\+school\.id\+"\/"/);
  assert.match(publicSite,/g\.url\.includes\(ownMedia\)/);
  assert.match(onboarding,/upload\(e\.target\.files\?\.\[0\],"gallery"\)/);
});

test("gallery and section text stay in the private draft until publish",()=>{
  const save=schoolApi.slice(schoolApi.indexOf('action==="saveSite"'),schoolApi.indexOf('action==="requestReview"'));
  assert.match(save,/site\.gallery=/);
  assert.match(save,/from\("school_site_drafts"\)\.upsert/);
  assert.doesNotMatch(save,/platform_school_sites/);
});

test("a hidden school website reveals no school identity",()=>{
  const start=publicSite.indexOf("if(!available)return");
  const hidden=publicSite.slice(start,publicSite.indexOf("</main>;",start));
  assert.ok(start>0);
  assert.doesNotMatch(hidden,/school\.name/);
  assert.doesNotMatch(hidden,/logo_url/);
  assert.doesNotMatch(hidden,/--school-color/);
  assert.match(publicSite,/if\(!found\|\|!found\.available\)return NEUTRAL/);
  assert.match(publicSite,/if\(school\.status!=="active"\)return \{school,site:null,available:false\}/);
});

test("address is published and the mobile menu is present",()=>{
  assert.match(publicSite,/className="site-address"/);
  assert.match(publicSite,/className="site-menu-toggle"/);
  assert.match(css,/\.site-menu-toggle:checked ~ nav\{display:flex\}/);
  assert.match(css,/\.site-gallery\{display:grid/);
});
