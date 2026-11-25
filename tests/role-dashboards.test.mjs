import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
test("overview numbers are read only and limited to owner or principal of the verified school",()=>{
 const api=read("../app/api/school/[code]/overview/route.js");
 assert.match(api,/schoolAdminContext\(request,code\)/);
 assert.doesNotMatch(api,/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/);
 assert.match(api,/eq\("school_id",sid\)/);
});
test("role dashboards use real school data and the portal routes owner, principal and staff to them",()=>{
 const ui=read("../app/s/[code]/home/RoleHome.jsx");
 for(const t of ["School Owner Dashboard","Principal Dashboard","Bursar Dashboard","Staff Workspace","Inventory & Assets","Board of Directors"])assert.match(ui,new RegExp(t));
 assert.doesNotMatch(ui,/fictional|lorem ipsum/i);
 const portal=read("../app/s/[code]/portal/SchoolPortal.jsx");
 assert.match(portal,/\/home/);
 const family=read("../app/s/[code]/family/FamilyDashboard.jsx");
 assert.match(family,/Parent Dashboard/);
 assert.match(family,/DashboardShell/);
});
