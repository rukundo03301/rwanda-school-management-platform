import test from "node:test";
import assert from "node:assert/strict";
import { paymentClock, buildReport, reportToSheets, reportToDoc, reportCsv } from "../lib/report-data.js";
import { buildXlsx, buildDocx, zipStore } from "../lib/export-files.js";

const tenants = [{ id: "a", name: "A School", school_code: "S-A", status: "active", district: "Gasabo", province: "kigali", education_level: "primary", plan_code: "basic" }, { id: "b", name: "B <School> & Co", school_code: "S-B", status: "active" }, { id: "c", name: "C School", school_code: "S-C", status: "active" }];
const feeTerms = [{ school_id: "a", monthly_fee_rwf: 50000, next_due_on: "2026-11-27" }, { school_id: "b", monthly_fee_rwf: 70000, next_due_on: "2026-11-20" }];

test("payment clock flags overdue, due soon and unset, most urgent first", () => {
  const c = paymentClock(tenants, feeTerms, "2026-11-25");
  assert.deepEqual(c.map((x) => x.state), ["overdue", "soon", "not_set"]);
  assert.equal(c[0].label, "5 days overdue");
  assert.equal(c[1].label, "Due in 2 days");
  assert.equal(paymentClock(tenants, [{ school_id: "a", next_due_on: "2026-12-30" }], "2026-11-25").find((x) => x.id === "a").state, "ok");
});

test("report numbers are computed from the data", () => {
  const rep = buildReport({ tenants, feeTerms, plans: [{ code: "basic", name: "Basic Plan" }], schoolStats: { a: { students: 20, marked: 10, present: 9, invoiced: 100, collected: 40 } } }, "2026-11-25");
  assert.equal(rep.schools[0].attendance, 90);
  assert.equal(rep.schools[0].collectedPct, 40);
  assert.equal(rep.kpis.find((k) => k[0] === "Students")[1], 20);
  assert.equal(rep.kpis.find((k) => k[0] === "Past due")[1], 1);
  assert.match(reportCsv(rep), /"A School","S-A"/);
});

test("excel and word files are valid zip packages and escape markup", () => {
  const rep = buildReport({ tenants, feeTerms, schoolStats: {} }, "2026-11-25");
  const x = buildXlsx(reportToSheets(rep)), d = buildDocx(reportToDoc(rep));
  for (const f of [x, d]) { assert.equal(f[0], 0x50); assert.equal(f[1], 0x4b); }
  const text = new TextDecoder().decode(x);
  assert.ok(text.includes("B &lt;School&gt; &amp; Co"));
  assert.ok(!text.includes("<School>"));
  assert.ok(zipStore([{ name: "a.txt", data: "hi" }]).length > 20);
});
