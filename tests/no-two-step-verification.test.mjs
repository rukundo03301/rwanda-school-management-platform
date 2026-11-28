import test from "node:test";
import assert from "node:assert/strict";
import {readdirSync,readFileSync,existsSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("../",import.meta.url));
const read=(path)=>readFileSync(join(root,path),"utf8");
function codeFiles(dir){
 return readdirSync(join(root,dir),{withFileTypes:true}).flatMap(entry=>{
  const rel=join(dir,entry.name);
  return entry.isDirectory()?codeFiles(rel):/\.(?:js|jsx|mjs)$/.test(entry.name)?[rel]:[];
 });
}
test("no two-step challenges, account MFA enrollment UI or AAL2 requirement remain in the application",()=>{
 const files=[...codeFiles("app"),...codeFiles("lib")];
 for(const f of files){
  const body=read(f);
  assert.doesNotMatch(body,/requireAal2|getAuthenticatorAssuranceLevel|auth\.mfa\.|challengeAndVerify|factorType:\s*["']totp["']/i,f);
  assert.doesNotMatch(body,/Set up authenticator|Two-step verification|Open two-step verification|MFA is required|with MFA/i,f);
 }
 assert.equal(existsSync(join(root,"app/s/[code]/security/SchoolSecurity.jsx")),false);
});
test("verified identity, role/tenant restrictions and deletion safeguards remain in place",()=>{
 const platform=read("app/api/platform/route.js");
 const school=read("app/api/school/[code]/admin/route.js");
 const purge=read("lib/tenant-purge.mjs");
 assert.match(platform,/requireOwner\(actor\)/);
 assert.match(platform,/validSchoolCodeConfirmation/);
 assert.match(platform,/before\.legal_hold/);
 assert.match(school,/requireSchoolOwner\(actor\)|requireSchoolPermission\(actor/);
 assert.match(purge,/TENANT_DELETE_PHRASE/);
});
test("no environment-specific backdoor used to skip verification",()=>{
 const files=[...codeFiles("app"),...codeFiles("lib")];
 for(const f of files)assert.doesNotMatch(read(f),/BYPASS_MFA|SKIP_MFA|DISABLE_MFA|MFA_TEST_MODE/i,f);
});
