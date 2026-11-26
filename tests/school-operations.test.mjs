import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const api=read("../app/api/school/[code]/operations/route.js");
const db=read("../database/school_operations_v1.sql");
const unitFix=read("../database/school_record_assessment_unit_fix_v1.sql");

test("operations tables are private to the server and never open to browser roles",()=>{
 for(const t of ["school_stock_items","school_stock_movements","school_assets","school_maintenance_requests","school_board_members","school_board_meetings","school_social_links"]){
  assert.match(db,new RegExp("create table if not exists public\\."+t+"\\("));
 }
 assert.match(db,/enable row level security/);
 assert.match(db,/revoke all on table public\.%I from anon, authenticated/);
 assert.match(db,/grant select, insert, update, delete on table public\.%I to service_role/);
 assert.doesNotMatch(db,/grant[^;]*to (anon|authenticated)\b/i);
});
test("only school staff reach operations and parents and students are refused",()=>{
 assert.match(api,/School operations are available to school staff only/);
 assert.match(api,/if\(!manager&&!staff&&!teacher\)throw new ApiError\(403/);
});
test("operations retain role-specific authorization without an authenticator",()=>{
 assert.doesNotMatch(api,/requireAal2/);
});
test("board, assets, stock creation and social links are owner or administrator only",()=>{
 for(const a of ["stock.add","asset.add","board.member","board.member.remove","board.meeting","social.set"]){
  assert.match(api,new RegExp('action==="'+a.replace(/\./g,"\\.")+'"\\)?\\{?\\s*managerOnly\\(\\)'));
 }
});
test("stock movements and maintenance updates are office-only, teachers can only report",()=>{
 for(const a of ["stock.move","asset.condition","maintenance.update"]){
  assert.match(api,new RegExp('action==="'+a.replace(/\./g,"\\.")+'"\\)\\{\\s*officeOnly\\(\\)'));
 }
 assert.match(api,/if\(!office\)requests=requests\.eq\("reported_by",user\.id\)/);
});
test("stock cannot go negative and concurrent edits are refused",()=>{
 assert.match(api,/if\(next<0\)throw new ApiError\(400,"There is not enough of this item in stock"\)/);
 assert.match(api,/\.eq\("quantity",item\.quantity\)/);
 assert.match(api,/Stock changed while you were saving/);
});
test("social links accept only https links on the platform's own hosts",()=>{
 assert.match(api,/parsed\.protocol!=="https:"/);
 assert.match(api,/HOSTS\[platform\]\.some\(h=>host===h\|\|host\.endsWith\("\."\+h\)\)/);
 assert.match(api,/youtube:\["youtube\.com","youtu\.be"\]/);
 assert.match(db,/school_social_links_url_chk/);
});
test("end-of-unit marks look the term number up instead of reading an unloaded row",()=>{
 assert.match(unitFix,/regexp_replace\(def/);
 assert.match(unitFix,/from public\.school_assessment_terms x where x\.school_id = p_school and x\.id = p_term/);
 assert.match(unitFix,/execute fixed/);
});
