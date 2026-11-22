import test from "node:test";
import assert from "node:assert/strict";
import { canTransition, hasPermission, normalizePermissions, validateTenantInput, ROLE_DEFAULTS } from "../lib/access.mjs";
import { formatRwf, paymentSummary } from "../lib/money.mjs";

test("only allowed tenant transitions pass", () => {
  assert.equal(canTransition("active","paused"),true);
  assert.equal(canTransition("paused","active"),true);
  assert.equal(canTransition("active","active"),false);
  assert.equal(canTransition("deletion_requested","active"),false);
  assert.equal(canTransition("suspended","active"),false);
});
test("role selection alone never grants permission", () => {
  assert.equal(hasPermission({role:"operations",active:true,permissions:[]},"tenants.lifecycle"),false);
  assert.equal(hasPermission({role:"support",active:false,permissions:["tickets.manage"]},"tickets.manage"),false);
  assert.equal(hasPermission({role:"support",active:true,permissions:["tickets.manage"]},"tenants.lifecycle"),false);
  assert.equal(hasPermission({isOwner:true,active:true},"staff.manage"),true);
});
test("staff permissions are validated",()=>{
  assert.deepEqual(normalizePermissions(["tickets.read","tickets.read"]),["tickets.read"]);
  assert.throws(()=>normalizePermissions(["platform.superuser"]),/Unknown permission/);
  assert.equal(ROLE_DEFAULTS.support.includes("staff.manage"),false);
});
test("school data is validated",()=>{
  assert.deepEqual(validateTenantInput({companyName:"Rwanda Group",schoolName:"Primary School",ownerEmail:"A@B.rw"}),{company_name:"Rwanda Group",school_name:"Primary School",owner_email:"a@b.rw"});
  assert.throws(()=>validateTenantInput({companyName:"A",schoolName:"School",ownerEmail:"bad"}),/company name/);
});
test("all platform money is whole RWF and only settled collections are counted",()=>{
  assert.equal(formatRwf(25000).startsWith("RWF "),true);
  assert.throws(()=>formatRwf(10.5),/Invalid/);
  assert.deepEqual(paymentSummary([{amount_rwf:10000,status:"open"},{amount_rwf:2000,status:"void"}],[{amount_rwf:3000,status:"settled"},{amount_rwf:500,status:"pending"}]),{billedRwf:10000,collectedRwf:3000,unallocatedDifferenceRwf:7000});
});
