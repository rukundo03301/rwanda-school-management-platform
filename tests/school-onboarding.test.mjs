import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const get=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
const migration=get("../database/school_onboarding_v1.sql");
const api=get("../app/api/school/[code]/route.js");
const scope=get("../lib/school-server.js");
const wizard=get("../app/s/[code]/setup/SchoolSetup.jsx");
const login=get("../app/s/[code]/login/SchoolLogin.jsx");
const site=get("../app/s/[code]/page.jsx");
const platform=get("../app/api/platform/route.js");
const ci=get("../.github/workflows/owner-console-ci.yml");

test("school owner claims only a preapproved, pending verified email invite",()=>{
  assert.match(scope,/email_confirmed_at/);
  assert.match(scope,/eq\("school_id",school\.id\)/);
  assert.match(scope,/eq\("email",user\.email\.toLowerCase\(\)\)/);
  assert.match(scope,/invite\?\.status==="pending"/);
  assert.doesNotMatch(scope,/invite\?\.status==="claimed"/);
  assert.match(migration,/if invitation\.status <> 'pending'/);
  assert.match(migration,/school_claim_owner_invitation/);
  assert.match(migration,/primary key\(school_id,auth_user_id\)/);
});

test("no direct browser access to draft, invitations or student-facing data",()=>{
  for(const table of ["school_owner_invites","school_memberships","school_onboarding"]){
    assert.ok(migration.includes("'"+table+"'"),"Missing RLS/revocation for "+table);
  }
  assert.match(migration,/enable row level security/);
  assert.match(migration,/revoke all on table/);
  assert.match(migration,/revoke all on function public\.school_claim_owner_invitation/);
});

test("five distinct school setup steps with save, preview and review",()=>{
  assert.match(wizard,/const STEPS=\["School identity","Logo & photos","Your homepage","School essentials","Review & launch"\]/);
  assert.match(wizard,/Save & exit/);
  assert.match(wizard,/Save & continue/);
  assert.match(wizard,/SchoolPreview/);
  assert.match(wizard,/requestReview/);
  assert.match(wizard,/Publish my school website/);
  assert.match(api,/action==="saveProfile"/);
  assert.match(api,/action==="saveSite"/);
  assert.match(api,/action==="requestReview"/);
});

test("school owners cannot activate tenant or publish before platform status",()=>{
  assert.match(api,/school\.status!=="active"/);
  assert.match(api,/is_published:true/);
  assert.match(platform,/review_requested_at/);
  assert.match(platform,/school owner must complete onboarding and request platform review/i);
  assert.match(site,/school\.status==="active"&&site\?\.is_published===true/);
});

test("branded school auth has email login and Google option but no self-selected school role",()=>{
  assert.match(login,/auth\.signInWithPassword/);
  assert.match(login,/auth\.signInWithOAuth/);
  assert.match(login,/resetPasswordForEmail/);
  assert.doesNotMatch(login,/role:"school_owner"/);
  assert.match(scope,/school\.status/);
});

test("database tests include school migration in isolated local stack",()=>{
  assert.match(ci,/school_onboarding_v1\.sql/);
  assert.match(ci,/supabase db reset/);
});
