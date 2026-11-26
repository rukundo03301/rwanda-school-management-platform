import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 RWF,rwfAmount,financeText,financeDate,kigaliToday,invoiceMath,displayRwf,
 normalizeFinanceRights,FINANCE_RIGHT_IDS,FEE_CATEGORIES,PAYMENT_METHODS
} from "../lib/school-fees.mjs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const db=read("../database/school_fees_rwf_v1.sql");
const api=read("../app/api/school/[code]/fees/route.js");
const access=read("../lib/school-fees.mjs");
const ui=read("../app/s/[code]/fees/SchoolFees.jsx");
const portal=read("../app/s/[code]/portal/SchoolPortal.jsx");
const family=read("../app/s/[code]/family/FamilyDashboard.jsx");
const flow=read("../.github/workflows/owner-console-ci.yml");

test("RWF is the only school fee currency and amounts must be whole francs",()=>{
 assert.equal(RWF,"RWF");
 assert.equal(rwfAmount("150000"),150000);
 assert.equal(rwfAmount(750),750);
 assert.throws(()=>rwfAmount("15.75"));
 assert.throws(()=>rwfAmount("0"));
 assert.throws(()=>rwfAmount(-1));
 assert.throws(()=>rwfAmount("1e5"));
 assert.throws(()=>rwfAmount("1000000000001"));
 assert.throws(()=>rwfAmount(Number.MAX_SAFE_INTEGER));
 assert.match(displayRwf("150000"),/RWF$/);
 assert.match(db,/currency text not null default 'RWF' check\(currency='RWF'\)/);
 assert.match(db,/amount_rwf bigint not null/);
 assert.match(api,/currency:"RWF"/);
});
test("invoice balance includes only posted payments and approved credits, never pending claims",()=>{
 const i={id:"i-1",amount_rwf:120000,due_on:"2026-11-15",status:"issued"};
 const ps=[
  {invoice_id:"i-1",amount_rwf:25000,status:"posted"},
  {invoice_id:"i-1",amount_rwf:60000,status:"pending"},
  {invoice_id:"i-1",amount_rwf:15000,status:"reversed"},
  {invoice_id:"i-2",amount_rwf:500,status:"posted"}
 ];
 const credits=[{invoice_id:"i-1",amount_rwf:10000}];
 const x=invoiceMath(i,ps,credits,"2026-11-22");
 assert.deepEqual(x,{
  amount_rwf:"120000",paid_rwf:"25000",waived_rwf:"10000",balance_rwf:"85000",
  fully_paid:false,overdue:true
 });
 assert.equal(invoiceMath({...i,due_on:"2026-12-01"},ps,credits,"2026-11-22").overdue,false);
 assert.equal(invoiceMath(i,[{invoice_id:"i-1",amount_rwf:120000,status:"posted"}],[]).fully_paid,true);
 assert.equal(kigaliToday(new Date("2026-11-21T23:30:00Z")),"2026-11-22");
});
test("only independently reviewed payments create school receipts in one transaction",()=>{
 assert.match(db,/create or replace function public\.school_fee_post_payment/);
 assert.match(db,/payment\.proposed_by=p_actor/);
 assert.match(db,/The person submitting a payment cannot approve their own claim/);
 assert.match(db,/for update/);
 assert.match(db,/available:=public\.school_finance_remaining/);
 assert.match(db,/Payment exceeds invoice balance/);
 assert.match(db,/update public\.school_fee_payments set status='posted'/);
 assert.match(db,/insert into public\.school_fee_receipts/);
 assert.match(db,/return jsonb_build_object\('posted',true,'receipt_id'/);
 assert.match(db,/review_evidence in \('provider_statement','bank_statement','cash_count','other'\)/);
 assert.doesNotMatch(api,/requireAal2/);
 assert.match(api,/action==="payment\.approve"/);
 assert.match(ui,/independently check actual provider, bank, or cash evidence/);
});
test("payment claims cannot impersonate external provider settlement",()=>{
 assert.match(db,/source text not null check\(source in \('guardian_claim','school_operator'\)\)/);
 assert.match(db,/status text not null default 'pending'/);
 assert.match(db,/return jsonb_build_object\('id',pay_id,'status','pending'/);
 assert.match(db,/on conflict\(school_id,method,reference\) do nothing/);
 assert.match(db,/Payment reference already exists in this school/);
 assert.match(db,/if user_source='guardian_claim' and p_method in \('cash','other'\)/);
 assert.match(db,/Too many payment claims/);
 assert.match(api,/providerCollections:"not_connected",providerSettlement:"not_verified_by_api"/);
 assert.match(ui,/Not a payment checkout/);
 assert.match(ui,/Report Transfer/);
 assert.doesNotMatch(ui,/Pay Now|Payment successful|provider payment confirmed/);
});
test("school finance permissions prevent parent or teacher global data access",()=>{
 assert.deepEqual(FINANCE_RIGHT_IDS,[
  "finance.read","fees.manage","invoices.issue","payments.record","payments.approve"
 ]);
 assert.deepEqual(normalizeFinanceRights(["finance.read","payments.record"]),[
  "finance.read","payments.record"
 ]);
 assert.throws(()=>normalizeFinanceRights(["finance.read","platform.billing.read"]));
 assert.match(db,/m\.role in \('school_admin','staff'\)/);
 assert.match(db,/m\.role='school_owner'/);
 assert.match(db,/school_finance_parent_link/);
 assert.match(db,/g\.student_id=p_student and g\.active/);
 assert.match(db,/m\.role='parent'/);
 assert.match(access,/schoolVerifiedContext\(request,code\)/);
 assert.match(access,/eq\("auth_user_id",user\.id\)/);
 assert.match(access,/eq\("active",true\)/);
 assert.match(access,/\.in\("role",\["school_owner","school_admin","staff","parent"\]\)/);
 assert.match(api,/\.in\("student_id",visibleChildIds\)/);
 assert.match(api,/p\.status==="posted"\|\|p\.proposed_by===user\.id/);
 assert.match(api,/review_note/);
 assert.match(ui,/role="switch"/);
 assert.match(portal,/My Children's School Fees/);
 assert.match(family,/My Children's School Fees/);
});
test("money schema uses same-school/year foreign keys and immutable invoice snapshots",()=>{
 assert.match(db,/foreign key\(school_id,fee_id,academic_year_id\)/);
 assert.match(db,/references public\.school_fee_catalog\(school_id,id,academic_year_id\)/);
 assert.match(db,/foreign key\(school_id,student_id,academic_year_id\)/);
 assert.match(db,/references public\.school_student_enrollments\(school_id,student_id,academic_year_id\)/);
 assert.match(db,/unique\(school_id,student_id,fee_id\)/);
 assert.match(db,/fee\.amount_rwf,fee\.due_on,p_actor/);
 assert.match(db,/on conflict\(school_id,student_id,fee_id\) do nothing/);
 assert.match(db,/An invoice already exists for this student and fee/);
 assert.match(db,/Fee must belong to the current academic year/);
 assert.match(db,/School ID|school_id uuid not null/);
});
test("school fee reversals void receipts but don't claim bank or wallet refunds",()=>{
 assert.match(db,/school_fee_reverse_payment/);
 assert.match(db,/Only school owner can reverse posted collections/);
 assert.match(db,/status='reversed',reversed_at=now\(\)/);
 assert.match(db,/update public\.school_fee_receipts set status='voided'/);
 assert.match(db,/refund_executed',false/);
 assert.match(db,/external_refund_executed',false/);
 assert.match(db,/school_fee_approve_credit/);
 assert.match(db,/Credit exceeds the unpaid balance/);
 assert.match(db,/school_fee_cancel_invoice/);
 assert.match(db,/Resolve existing payments and credits before cancellation/);
});
test("full-school database summary excludes cancelled invoices and counts overdue at Kigali date",()=>{
 assert.match(db,/create or replace function public\.school_finance_summary/);
 assert.match(db,/status='posted'/);
 assert.match(db,/i\.status='issued'/);
 assert.match(db,/current_day:=\(now\(\) at time zone 'Africa\/Kigali'\)::date/);
 assert.match(db,/sum\(remaining\) filter\(where due_on<current_day\)/);
 assert.match(db,/issued_invoices',invoice_count,'pending_claims',pending_count/);
 assert.match(api,/school_finance_summary/);
 assert.match(api,/partialLists:true/);
});
test("ledger hardening avoids invoice cancellation races and exactness loss",()=>{
 assert.match(db,/status='issued' for share/);
 assert.match(db,/c\.status='active'/);
 assert.match(db,/invoiced_rwf',gross::text/);
 assert.match(db,/collected_rwf',total_paid::text/);
 assert.match(db,/outstanding_rwf',balance::text/);
 const huge={id:"a",amount_rwf:"9007199254740993",due_on:"2026-01-01",status:"issued"};
 // Large independently read bigint totals never require a JavaScript float.
 assert.equal(invoiceMath(huge,[],[]).balance_rwf,"9007199254740993");
 assert.match(displayRwf(huge.amount_rwf),/RWF$/);
});

test("per-invoice balances use full ledger with strict school and linked-family authorization",()=>{
 assert.match(db,/create or replace function public\.school_finance_invoice_balances/);
 assert.match(db,/school_finance_parent_link\(p_school,p_actor,i\.student_id\)/);
 assert.match(db,/and not public\.school_finance_parent_link/);
 assert.match(db,/not exists\(/);
 assert.match(db,/pay\.status='posted'/);
 assert.match(db,/sum\(pay\.amount_rwf\)::bigint/);
 assert.match(db,/sum\(cr\.amount_rwf\)::bigint/);
 assert.match(db,/greatest\(0,i\.amount_rwf-coalesce\(p\.amount,0\)-coalesce\(c\.amount,0\)\)/);
 assert.match(db,/school_finance_invoice_balances\(uuid,uuid,uuid\[\]\) to service_role/);
 assert.match(api,/school_finance_invoice_balances/);
 assert.match(api,/balances\(invoicesAll,authoritativeBalances,currentDay\)/);
 assert.doesNotMatch(api,/balances\(invoicesAll,payments,credits/);
});

test("all private school finance tables/sequence permissions revoke direct browser privileges",()=>{
 for(const table of ["school_finance_permissions","school_fee_catalog",
  "school_fee_invoices","school_fee_payments","school_fee_receipts",
  "school_fee_credits","school_finance_audit"]){
  assert.ok(db.includes("'"+table+"'"),table);
 }
 assert.match(db,/enable row level security/);
 assert.match(db,/revoke all on table public\.%I from public,anon,authenticated/);
 assert.match(db,/grant all on table public\.%I to service_role/);
 assert.match(db,/revoke all on sequence public\.school_fee_invoice_number_seq from public,anon,authenticated/);
 assert.match(db,/revoke all on sequence public\.school_fee_receipt_number_seq from public,anon,authenticated/);
 assert.doesNotMatch(db,/security definer/i);
 assert.doesNotMatch(db,/on delete cascade/i);
 assert.doesNotMatch(api,/SUPABASE_SECRET_KEY|NEXT_PUBLIC_SERVICE_ROLE/);
});
test("all 17 fee SQL functions have paired quoted bodies and server-only execution",()=>{
 const funcs=[...db.matchAll(/create or replace function public\.(\w+)/g)].map(x=>x[1]);
 assert.equal(funcs.length,17);
 assert.equal((db.match(/as \$\$/g)||[]).length,17);
 assert.equal((db.match(/end;\n\$\$;/g)||[]).length,13);
 assert.doesNotMatch(db,/as \$(?!\$)/);
 assert.doesNotMatch(db,/^\$;$/m);
 for(const name of funcs){
  assert.ok(db.includes("revoke all on function public."+name+"("),name+" missing revoke");
  assert.ok(db.includes("grant execute on function public."+name+"("),name+" missing server grant");
 }
});
test("RWF format, dates and content reject unsafe text",()=>{
 assert.equal(financeDate("2026-11-22"),"2026-11-22");
 assert.throws(()=>financeDate("2026-02-30"));
 assert.throws(()=>financeDate("2026/11/22"));
 assert.equal(financeText("  Tuition  ",100),"Tuition");
 assert.throws(()=>financeText(" ",100));
 assert.ok(FEE_CATEGORIES.includes("tuition"));
 assert.ok(PAYMENT_METHODS.includes("mtn_momo"));
});
test("all eight schema migrations are ordered and local-only",()=>{
 const names=["platform_owner_console","school_onboarding_v1",
  "school_administration_v1","school_admissions_v1",
  "school_classrooms_v1","school_reports_curriculum_v1",
  "school_communications_v1","school_fees_rwf_v1"];
 const pos=names.map(n=>flow.indexOf("supabase migration new "+n));
 assert.ok(pos.every(x=>x>=0),JSON.stringify(pos));
 assert.ok(pos.every((x,i)=>i===0||x>pos[i-1]),JSON.stringify(pos));
 assert.match(flow,/supabase start/);
 assert.match(flow,/supabase db reset/);
 assert.doesNotMatch(flow,/^\s+supabase (?:db push|link|migration up --linked)\b/m);
});
