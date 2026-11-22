import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const workflow=readFileSync(new URL("../.github/workflows/owner-fee-reminders.yml",import.meta.url),"utf8");
const script=readFileSync(new URL("../scripts/send-owner-due-reminders.mjs",import.meta.url),"utf8");
const sql=readFileSync(new URL("../database/platform_owner_console.sql",import.meta.url),"utf8");

test("owner email workflow scheduled in Kigali morning, main branch only",()=>{
  assert.match(workflow,/cron: '17 5 \* \* \*'/);
  assert.match(workflow,/refs\/heads\/main/);
  assert.match(workflow,/ENABLE_OWNER_EMAIL_REMINDERS/);
});
test("email is private to one owner, plain text, guarded by enable flag",()=>{
  assert.match(script,/ENABLE_OWNER_EMAIL_REMINDERS/);
  assert.match(script,/process\.exit\(0\)/);
  assert.match(script,/PLATFORM_OWNER_ALERT_EMAIL/);
  assert.match(script,/to:\[\{email:recipient\}\]/);
  assert.match(script,/textContent:digestText\(digest\)/);
  assert.doesNotMatch(script,/school\.owner_email/);
});
test("SQL has unique per-day recipient claim to avoid routine duplicates",()=>{
  assert.match(sql,/create table if not exists public\.platform_owner_email_digests/);
  assert.match(sql,/primary key\(digest_date,recipient\)/);
  assert.match(sql,/platform_claim_owner_digest/);
  assert.match(sql,/revoke all on table public\.platform_owner_email_digests/);
});
