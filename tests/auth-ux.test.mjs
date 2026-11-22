import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const login=readFileSync(new URL("../app/platform/page.jsx",import.meta.url),"utf8");
const reset=readFileSync(new URL("../app/platform/reset-password/page.jsx",import.meta.url),"utf8");
const api=readFileSync(new URL("../app/api/platform/route.js",import.meta.url),"utf8");
const sql=readFileSync(new URL("../database/platform_owner_console.sql",import.meta.url),"utf8");

test("login supports password, Google and verified staff signup",()=>{
  assert.match(login,/signInWithPassword/);
  assert.match(login,/signInWithOAuth/);
  assert.match(login,/provider:"google"/);
  assert.match(login,/signUp/);
});
test("password reset uses actual Supabase recovery APIs",()=>{
  assert.match(login,/resetPasswordForEmail/);
  assert.match(login,/\/platform\/reset-password/);
  assert.match(reset,/auth\.updateUser\(\{password\}\)/);
  assert.match(reset,/auth\.signOut/);
});
test("staff permission UI is table-based with on/off switch",()=>{
  assert.match(login,/function PermissionToggleTable/);
  assert.match(login,/className="switch"/);
  assert.match(login,/role:"support"/);
  assert.match(login,/modal==="editStaff"/);
  assert.match(login,/staff\.permissions/);
});
test("staff updates require MFA owner authorization in server",()=>{
  assert.match(api,/action === "staff\.permissions"/);
  assert.match(api,/requireOwner\(actor\); requireAal2\(token\)/);
  assert.match(api,/normalizePermissions\(body\.permissions\)/);
  assert.match(sql,/platform_update_staff_permissions/);
  assert.match(sql,/staff\.permissions_changed/);
  assert.match(sql,/revoke all on function public\.platform_update_staff_permissions/);
});
test("auth role selection does not grant server permissions",()=>{
  assert.doesNotMatch(login,/localStorage\.setItem\(\s*["']role/);
  assert.match(api,/requirePermission\(actor/);
});
