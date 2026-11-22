import test from "node:test";
import assert from "node:assert/strict";
import {buildOwnerDigest,digestText} from "../lib/owner-reminder.mjs";
const school=(name,code,status="active")=>({name,school_code:code,status});
test("daily email groups overdue, today, and next seven days",()=>{
  const digest=buildOwnerDigest([
    {school:school("Kigali A","RW-SCH-000001"),next_due_on:"2026-11-19",monthly_fee_rwf:40000},
    {school:school("Kigali B","RW-SCH-000002"),next_due_on:"2026-11-22",monthly_fee_rwf:20000},
    {school:school("Kigali C","RW-SCH-000003"),next_due_on:"2026-11-29",monthly_fee_rwf:30000},
    {school:school("Kigali D","RW-SCH-000004"),next_due_on:"2026-11-30",monthly_fee_rwf:10000},
  ],{today:"2026-11-22",windowDays:7});
  assert.deepEqual([digest.overdue.length,digest.dueToday.length,digest.dueSoon.length],[1,1,1]);
  assert.equal(digest.totalDueRwf,90000);
  assert.match(digestText(digest),/Kigali A/);
  assert.doesNotMatch(digestText(digest),/Kigali D/);
});
test("no email sent for unconfigured or archived schools",()=>{
  const d=buildOwnerDigest([
    {school:school("Archived","RW-SCH-000005","archived"),next_due_on:"2026-11-20",monthly_fee_rwf:15000},
    {school:school("Not configured","RW-SCH-000006"),next_due_on:null,monthly_fee_rwf:20000}
  ],{today:"2026-11-22"});
  assert.equal(d.hasItems,false);
});
test("no unchecked HTML or untrusted strings needed in reminder body",()=>{
  const d=buildOwnerDigest([{school:school("<script>","RW-SCH-000001"),next_due_on:"2026-11-22",monthly_fee_rwf:1000}],{today:"2026-11-22"});
  const t=digestText(d);
  assert.match(t,/<script>/); // plain text only, not HTML sent to provider.
});
