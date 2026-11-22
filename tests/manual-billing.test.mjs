import test from "node:test";
import assert from "node:assert/strict";
import {addMonth,dueClock,kigaliDate,validateManualPayment,parseDate} from "../lib/billing-clock.mjs";
test("calendar month clamps Jan 31 and Feb leap",()=>{
  assert.equal(addMonth("2027-01-31"),"2027-02-28");
  assert.equal(addMonth("2028-01-31"),"2028-02-29");
  assert.equal(addMonth("2026-12-31"),"2027-01-31");
});
test("due countdown is due-today/overdue/upcoming Kigali civil days",()=>{
  assert.deepEqual(dueClock("2026-12-02","2026-11-22"),{state:"upcoming",days:10,label:"10 days left"});
  assert.equal(dueClock("2026-11-22","2026-11-22").state,"due_today");
  assert.equal(dueClock("2026-11-12","2026-11-22").days,10);
  assert.equal(dueClock(null).state,"not_set");
  assert.equal(kigaliDate(new Date("2026-11-21T23:00:00Z")),"2026-11-22");
});
test("reject invalid dates, future money and invalid amounts",()=>{
  assert.throws(()=>parseDate("2026-02-30"),/Invalid/);
  assert.throws(()=>validateManualPayment({amountRwf:0,paidOn:"2026-11-21"},"2026-11-22"),/amount/);
  assert.throws(()=>validateManualPayment({amountRwf:100,paidOn:"2026-11-23"},"2026-11-22"),/future/);
  assert.equal(validateManualPayment({amountRwf:20000,paidOn:"2026-11-22",reference:"Cash"},"2026-11-22").nextDue,"2026-12-22");
});
