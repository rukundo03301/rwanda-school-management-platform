import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema=readFileSync(new URL("../database/platform_owner_console.sql",import.meta.url),"utf8");
test("all platform tables explicitly enable RLS",()=>{
  for(const table of ["platform_companies","platform_schools","platform_staff","platform_staff_requests","platform_tickets","platform_payment_methods","platform_invoices","platform_payments","platform_audit"]){
    assert.ok(schema.includes("'"+table+"'"),"table missing from RLS list: "+table);
  }
  assert.match(schema,/enable row level security/);
  assert.match(schema,/revoke all on table/);
});
test("restricted RPCs are revoked from authenticated/anon roles",()=>{
  for(const func of ["platform_register_school","platform_change_school_state","platform_approve_staff_request","platform_disable_staff","platform_configure_payment_method","platform_owner_stats"]){
    assert.ok(schema.includes("revoke all on function public."+func),"RPC is not explicitly restricted: "+func);
  }
});
test("tenant deletion is a request, not a destructive cascade",()=>{
  assert.match(schema,/deletion_requested/);
  assert.doesNotMatch(schema,/on delete cascade/i);
  assert.doesNotMatch(schema,/drop table public\.platform_/i);
});
