import { dueClock, kigaliDate } from "./billing-clock.mjs";

export const PROVINCE_NAMES = { kigali: "Kigali City", northern: "Northern Province", southern: "Southern Province", eastern: "Eastern Province", western: "Western Province" };
export const LEVEL_NAMES = { nursery: "Nursery", primary: "Primary", secondary: "Secondary", college: "College / University" };
export const DUE_SOON_DAYS = 7;

// One row per school with its next payment date, sorted by urgency. state: overdue | today | soon | ok | not_set
export function paymentClock(tenants, feeTerms, today = kigaliDate()) {
  const rank = { overdue: 0, today: 1, soon: 2, ok: 3, not_set: 4 };
  return (tenants || []).map((t) => {
    const f = (feeTerms || []).find((x) => x.school_id === t.id);
    const c = dueClock(f?.next_due_on, today);
    const state = c.state === "overdue" ? "overdue" : c.state === "due_today" ? "today" : c.state === "upcoming" ? (c.days <= DUE_SOON_DAYS ? "soon" : "ok") : "not_set";
    const label = state === "overdue" ? c.days + (c.days === 1 ? " day overdue" : " days overdue") : state === "today" ? "Due today" : state === "soon" || state === "ok" ? "Due in " + c.days + (c.days === 1 ? " day" : " days") : "No fee set";
    return { id: t.id, name: t.name, code: t.school_code, due: f?.next_due_on || "", amount: Number(f?.monthly_fee_rwf || 0), lastPaid: f?.last_paid_on || "", days: c.days, state, label };
  }).sort((a, b) => rank[a.state] - rank[b.state] || (a.due || "9").localeCompare(b.due || "9"));
}

// Everything the Reports page shows and every export contains, computed from the console data.
// Levels a school offers: the ones it selected at onboarding, else the older single profile field.
const LEVEL_TEXT = { ...LEVEL_NAMES, tvet: "TVET", university: "University" };
const schoolLevels = (t) => (Array.isArray(t.levels) && t.levels.length ? t.levels : t.education_level ? [t.education_level] : []);
export function buildReport(data, today = kigaliDate()) {
  const tenants = data.tenants || [], stats = data.schoolStats || {}, plans = data.plans || [];
  const clock = paymentClock(tenants, data.feeTerms, today);
  const planName = (c) => plans.find((p) => p.code === c)?.name || (c ? c : "No plan");
  const rows = tenants.map((t) => {
    const s = stats[t.id] || {}, k = clock.find((c) => c.id === t.id) || {};
    return {
      name: t.name, code: t.school_code, status: String(t.status || "").replace(/_/g, " "),
      district: t.district || "", province: PROVINCE_NAMES[t.province] || "", level: schoolLevels(t).map((l) => LEVEL_TEXT[l] || l).join(", "), plan: planName(t.plan_code),
      students: Number(s.students || 0), attendance: s.marked ? Math.round(100 * s.present / s.marked) : null,
      invoiced: Number(s.invoiced || 0), collected: Number(s.collected || 0),
      collectedPct: s.invoiced ? Math.round(100 * s.collected / s.invoiced) : null,
      monthlyFee: k.amount || 0, nextDue: k.due || "", paymentStatus: k.label || "",
    };
  });
  const sum = (key) => rows.reduce((a, r) => a + (r[key] || 0), 0);
  const marked = tenants.reduce((a, t) => a + Number((stats[t.id] || {}).marked || 0), 0);
  const present = tenants.reduce((a, t) => a + Number((stats[t.id] || {}).present || 0), 0);
  const invoiced = sum("invoiced"), collected = sum("collected");
  const count = (key, names) => { const o = {}; tenants.forEach((t) => { const k = key === "plan_code" ? planName(t.plan_code) : (names[t[key]] || "Not set"); o[k] = (o[k] || 0) + 1; }); return Object.entries(o); };
  return {
    title: "Umurage platform report", generatedOn: today,
    kpis: [
      ["Schools", tenants.length], ["Students", sum("students")],
      ["Attendance, last 30 days", marked ? Math.round(100 * present / marked) + "%" : "No data"],
      ["Fees invoiced (RWF)", invoiced], ["Fees collected (RWF)", collected],
      ["Collection rate", invoiced ? Math.round(100 * collected / invoiced) + "%" : "No data"],
      ["Past due", clock.filter((c) => c.state === "overdue").length],
      ["Due within " + DUE_SOON_DAYS + " days", clock.filter((c) => c.state === "today" || c.state === "soon").length],
    ],
    schools: rows,
    payments: clock,
    spread: [["By province", count("province", PROVINCE_NAMES)], ["By education level", (() => { const o = {}; tenants.forEach((t) => { const ls = schoolLevels(t); (ls.length ? ls.map((l) => LEVEL_TEXT[l] || l) : ["Not set"]).forEach((k) => { o[k] = (o[k] || 0) + 1; }); }); return Object.entries(o); })()], ["By plan", count("plan_code", {})]],
  };
}

const num = (n) => Number(n || 0).toLocaleString("en-US");
export const SCHOOL_COLUMNS = [
  { header: "School", width: 34 }, { header: "School ID", width: 16 }, { header: "Status", width: 14 },
  { header: "District", width: 16 }, { header: "Province", width: 20 }, { header: "Level", width: 18 }, { header: "Plan", width: 16 },
  { header: "Students", width: 11, type: "int" }, { header: "Attendance %", width: 14, type: "pct" },
  { header: "Fees invoiced (RWF)", width: 20, type: "int" }, { header: "Fees collected (RWF)", width: 20, type: "int" }, { header: "Collection %", width: 14, type: "pct" },
  { header: "Monthly fee (RWF)", width: 18, type: "int" }, { header: "Next payment due", width: 18 }, { header: "Payment status", width: 18 },
];
export const schoolRowCells = (r) => [r.name, r.code, r.status, r.district, r.province, r.level, r.plan, r.students, r.attendance, r.invoiced, r.collected, r.collectedPct, r.monthlyFee, r.nextDue, r.paymentStatus];

export function reportToSheets(rep) {
  return [
    { name: "Schools", title: rep.title + " - " + rep.generatedOn, columns: SCHOOL_COLUMNS, rows: rep.schools.map(schoolRowCells) },
    { name: "Summary", title: "Summary - " + rep.generatedOn, columns: [{ header: "Measure", width: 34 }, { header: "Value", width: 22 }], rows: rep.kpis.map((k) => [k[0], typeof k[1] === "number" ? num(k[1]) : k[1]]) },
    { name: "Payments", title: "Payment clock - " + rep.generatedOn, columns: [{ header: "School", width: 34 }, { header: "School ID", width: 16 }, { header: "Monthly fee (RWF)", width: 18, type: "int" }, { header: "Last paid", width: 14 }, { header: "Next due", width: 14 }, { header: "Status", width: 20 }], rows: rep.payments.map((p) => [p.name, p.code, p.amount, p.lastPaid, p.due, p.label]) },
    { name: "Distribution", title: "Schools by province, level and plan", columns: [{ header: "Group", width: 22 }, { header: "Category", width: 28 }, { header: "Schools", width: 12, type: "int" }], rows: rep.spread.flatMap(([g, list]) => list.map(([k, n]) => [g, k, n])) },
  ];
}

export function reportToDoc(rep) {
  const cols = ["School", "Location", "Level", "Plan", "Students", "Attendance", "Invoiced (RWF)", "Collected (RWF)", "Next due"];
  return {
    title: rep.title, subtitle: "Generated " + rep.generatedOn + ". Figures come from each school's own records; no student names are included.",
    sections: [
      { heading: "Summary", table: { head: ["Measure", "Value"], rows: rep.kpis.map((k) => [k[0], typeof k[1] === "number" ? num(k[1]) : k[1]]) } },
      { heading: "Schools", table: { head: cols, rows: rep.schools.map((r) => [r.name + " (" + r.code + ")", [r.district, r.province].filter(Boolean).join(", ") || "Not set", r.level || "Not set", r.plan, num(r.students), r.attendance == null ? "No data" : r.attendance + "%", num(r.invoiced), num(r.collected), r.nextDue ? r.nextDue + " (" + r.paymentStatus + ")" : "No fee set"]) } },
      ...rep.spread.map(([g, list]) => ({ heading: "Schools " + g.toLowerCase(), table: { head: ["Category", "Schools"], rows: list.map(([k, n]) => [k, String(n)]) } })),
    ],
  };
}

export function reportCsv(rep) {
  const q = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
  return [SCHOOL_COLUMNS.map((c) => c.header)].concat(rep.schools.map(schoolRowCells)).map((r) => r.map(q).join(",")).join("\n");
}
