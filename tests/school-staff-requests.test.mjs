import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
test("staff requests are tenant scoped, private, and registered for erasure",()=>{
 const sql=read("../database/school_staff_requests_v1.sql");
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on table public\.school_staff_requests from public,anon,authenticated/);
 assert.match(sql,/platform_tenant_scope_manifest/);
});
test("only approvers decide, never their own request, and others see only their own",()=>{
 const api=read("../app/api/school/[code]/requests/route.js");
 assert.match(api,/if\(!manager\)q=q\.eq\("requester_id",user\.id\)/);
 assert.match(api,/Only the school owner or principal can decide requests/);
 assert.match(api,/You cannot decide your own request/);
 assert.match(api,/You can only cancel your own request/);
});
