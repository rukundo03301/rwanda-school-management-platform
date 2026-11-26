"use client";
import { useEffect, useRef, useState } from "react";
import { RWANDA_DISTRICTS, DISTRICT_PROVINCE } from "../../lib/rwanda-geo.js";

// Pieces of the Platform Owner console that sit around the dashboard: top bar, sidebar card,
// plans, school profile form, reports, communications and system health. Real platform data only.
export const PROVINCE_LABEL = { kigali: "Kigali City", northern: "Northern Province", southern: "Southern Province", eastern: "Eastern Province", western: "Western Province" };
export const LEVEL_LABEL = { nursery: "Nursery", primary: "Primary", secondary: "Secondary", college: "College / University" };
const nf = (n) => Number(n || 0).toLocaleString("en-US");
const rwf = (n) => "RWF " + nf(n);
const when = (x) => x ? new Date(x).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

function Lbl({ label, children }) { return <label className="pm-field"><span>{label}</span>{children}</label>; }

export function SidebarCard() {
  return <div className="pm-sidecard">
    <svg width="74" height="74" viewBox="0 0 74 74" aria-hidden="true"><ellipse cx="37" cy="58" rx="30" ry="8" fill="#ffffff22"/><rect x="12" y="30" width="50" height="14" rx="5" fill="#dbe8ff"/><rect x="12" y="46" width="50" height="14" rx="5" fill="#b9d2ff"/><circle cx="20" cy="37" r="2" fill="#2563eb"/><circle cx="20" cy="53" r="2" fill="#2563eb"/><path d="M37 8l15 6v12c0 10-7 17-15 20-8-3-15-10-15-20V14z" fill="#2563eb" stroke="#fff" strokeWidth="2.500"/><path d="M30 27l5 5 9-10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>
    <strong>Umurage Platform</strong>
    <span>Secure, scalable, multi-school</span>
  </div>;
}

export function TopBar({ data, onGo, onPick, onSignOut }) {
  const [q, setQ] = useState(""); const [bell, setBell] = useState(false); const input = useRef(null);
  useEffect(() => {
    const k = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);
  const t = data.totals || {};
  const items = [
    [t.ticketsOpen, "open support tickets", "tickets"],
    [(data.requests || []).length, "staff access requests", "staff"],
    [t.pastDue, "schools past due", "billing"],
    [(data.onboardingReviews || []).length, "schools waiting for onboarding review", "tenants"],
  ].filter((i) => i[0] > 0);
  const count = items.reduce((a, i) => a + i[0], 0);
  const needle = q.trim().toLowerCase();
  const hits = !needle ? [] : [
    ...(data.tenants || []).filter((s) => [s.name, s.school_code, s.owner_email].join(" ").toLowerCase().includes(needle)).slice(0, 5).map((s) => ({ kind: "School", label: s.name + " (" + s.school_code + ")", tab: "tenants", query: s.name })),
    ...(data.staff || []).filter((s) => String(s.email).toLowerCase().includes(needle)).slice(0, 3).map((s) => ({ kind: "User", label: s.email, tab: "staff", query: "" })),
    ...(data.manualPayments || []).filter((p) => [p.reference, p.notes].join(" ").toLowerCase().includes(needle)).slice(0, 3).map((p) => ({ kind: "Payment", label: (p.reference || "Payment") + " - " + rwf(p.amount_rwf), tab: "billing", query: "" })),
  ];
  return <div className="topbar pm-top">
    <div className="pm-title"><strong>Platform Owner Dashboard</strong><div className="micro">Manage schools, subscriptions, users and the entire Umurage platform</div></div>
    <div className="pm-search"><input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search schools, users, payments..." aria-label="Search the platform"/><kbd>Ctrl + K</kbd>
      {needle && <div className="pm-pop" role="listbox">{hits.length ? hits.map((h, i) => <button key={i} onClick={() => { onPick(h); setQ(""); }}><b>{h.kind}</b> {h.label}</button>) : <div className="pm-none">No matches</div>}</div>}
    </div>
    <div className="pm-bellwrap"><button className="pm-bell" aria-label={"Notifications (" + count + ")"} onClick={() => setBell((b) => !b)}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.300 21a1.940 1.940 0 0 0 3.400 0"/></svg>{count > 0 && <b>{count}</b>}</button>
      {bell && <div className="pm-pop right" role="menu">{items.length ? items.map((i) => <button key={i[2]} onClick={() => { onGo(i[2]); setBell(false); }}><b>{i[0]}</b> {i[1]}</button>) : <div className="pm-none">Nothing needs your attention.</div>}</div>}
    </div>
    <div className="pm-user"><span className="avatar">{(data.actor.email || "U")[0].toUpperCase()}</span><div><strong>{data.actor.email}</strong><div className="micro">{data.actor.isOwner ? "Platform Owner" : data.actor.role}</div></div><button className="button secondary small" onClick={onSignOut}>Sign out</button></div>
  </div>;
}

export function SchoolProfileForm({ form, setForm, plans, busy, onSubmit }) {
  const set = (k, v) => setForm({ ...form, [k]: v });
  return <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
    <p className="muted">Where <strong>{form.tenant.name}</strong> is, what it teaches and which plan it is on. This feeds the platform map, level and plan cards.</p>
    <Lbl label="District"><select className="input" value={form.district || ""} onChange={(e) => setForm({ ...form, district: e.target.value, province: e.target.value ? DISTRICT_PROVINCE[e.target.value] : form.province })}><option value="">Not set</option>{Object.entries(PROVINCE_LABEL).map(([pk, pv]) => <optgroup key={pk} label={pv}>{RWANDA_DISTRICTS.filter((d) => d.p === pk).map((d) => d.n).sort().map((n) => <option key={n} value={n}>{n}</option>)}</optgroup>)}</select></Lbl>
    <Lbl label="Province (set automatically from the district)"><select className="input" value={form.province || ""} disabled={Boolean(form.district)} onChange={(e) => set("province", e.target.value)}><option value="">Not set</option>{Object.entries(PROVINCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Lbl>
    <Lbl label="Education level"><select className="input" value={form.educationLevel || ""} onChange={(e) => set("educationLevel", e.target.value)}><option value="">Not set</option>{Object.entries(LEVEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Lbl>
    <Lbl label="Plan"><select className="input" value={form.planCode || ""} onChange={(e) => set("planCode", e.target.value)}><option value="">No plan</option>{(plans || []).filter((p) => p.active).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></Lbl>
    <div className="modal-footer"><button type="submit" className="button" disabled={busy}>Save school profile</button></div>
  </form>;
}

export function PlansPanel({ plans, tenants, isOwner, busy, onSave }) {
  const [edit, setEdit] = useState({});
  const used = (code) => (tenants || []).filter((t) => t.plan_code === code).length;
  return <div className="panel"><div className="panel-header"><h2>Subscription plans</h2></div>
    <div className="table-wrap"><table><thead><tr><th>Plan</th><th>Monthly fee (RWF)</th><th>Schools</th><th>Status</th>{isOwner && <th></th>}</tr></thead>
      <tbody>{(plans || []).map((p) => { const e = edit[p.code]; return <tr key={p.code}>
        <td>{e ? <input className="input" value={e.name} onChange={(x) => setEdit({ ...edit, [p.code]: { ...e, name: x.target.value } })}/> : <strong>{p.name}</strong>}</td>
        <td>{e ? <input className="input" inputMode="numeric" value={e.fee} onChange={(x) => setEdit({ ...edit, [p.code]: { ...e, fee: x.target.value.replace(/\D/g, "") } })}/> : (p.monthly_fee_rwf == null ? "Not set" : rwf(p.monthly_fee_rwf))}</td>
        <td>{used(p.code)}</td><td>{p.active ? "Active" : "Hidden"}</td>
        {isOwner && <td>{e ? <button className="button small" disabled={busy} onClick={() => { onSave({ action: "plan.save", code: p.code, name: e.name, monthlyFeeRwf: e.fee, description: p.description, active: p.active, sortOrder: p.sort_order }); setEdit({ ...edit, [p.code]: undefined }); }}>Save</button> : <button className="button secondary small" onClick={() => setEdit({ ...edit, [p.code]: { name: p.name, fee: p.monthly_fee_rwf == null ? "" : String(p.monthly_fee_rwf) } })}>Edit</button>}</td>}
      </tr>; })}</tbody></table>{!(plans || []).length && <div className="empty"><strong>Plans are not available yet</strong><div>They appear once the latest database update has been applied.</div></div>}</div></div>;
}

function Bars({ rows, color = "#2563eb", fmt = nf }) {
  const mx = Math.max(1, ...rows.map((r) => r[1]));
  return <div className="pm-bars">{rows.length ? rows.map((r) => <div key={r[0]}><span><b>{r[0]}</b><b>{fmt(r[1])}</b></span><i><u style={{ width: Math.max(2, 100 * r[1] / mx) + "%", background: color }}/></i></div>) : <div className="pm-none">No data yet.</div>}</div>;
}

export function ReportsPanel({ data }) {
  const tenants = data.tenants || [], stats = data.schoolStats || {};
  const att = tenants.map((t) => { const s = stats[t.id]; return [t.name, s && s.marked ? Math.round(100 * s.present / s.marked) : 0]; });
  const students = tenants.map((t) => [t.name, (stats[t.id] || {}).students || 0]);
  const fees = tenants.map((t) => { const s = stats[t.id]; return [t.name, s && s.invoiced ? Math.round(100 * s.collected / s.invoiced) : 0]; });
  const count = (key, labels) => { const o = {}; tenants.forEach((t) => { const k = t[key] ? labels[t[key]] || t[key] : "Not set"; o[k] = (o[k] || 0) + 1; }); return Object.entries(o); };
  function csv() {
    const head = ["School", "School ID", "Status", "Province", "District", "Level", "Plan", "Students", "Attendance % (30 days)", "Fees invoiced RWF", "Fees collected RWF"];
    const q = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
    const lines = tenants.map((t) => { const s = stats[t.id] || {}; return [t.name, t.school_code, t.status, PROVINCE_LABEL[t.province] || "", t.district || "", LEVEL_LABEL[t.education_level] || "", t.plan_code || "", s.students || 0, s.marked ? Math.round(100 * s.present / s.marked) : "", s.invoiced || 0, s.collected || 0].map(q).join(","); });
    const blob = new Blob([[head.map(q).join(",")].concat(lines).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "umurage-schools-report.csv"; a.click(); URL.revokeObjectURL(a.href);
  }
  return <div className="pm-page"><div className="pm-head"><div><h2>Reports and analytics</h2><p>Computed live from each school's own records. No student names are shown.</p></div><button className="button" onClick={csv}>Download schools report (CSV)</button></div>
    <div className="pm-grid">
      <div className="od-card"><h3>Students per school</h3><Bars rows={students}/></div>
      <div className="od-card"><h3>Attendance, last 30 days</h3><Bars rows={att} color="#16a34a" fmt={(v) => v + "%"}/></div>
      <div className="od-card"><h3>Fees collected</h3><Bars rows={fees} color="#f97316" fmt={(v) => v + "%"}/></div>
      <div className="od-card"><h3>Schools by province</h3><Bars rows={count("province", PROVINCE_LABEL)}/></div>
      <div className="od-card"><h3>Schools by level</h3><Bars rows={count("education_level", LEVEL_LABEL)}/></div>
      <div className="od-card"><h3>Schools by plan</h3><Bars rows={count("plan_code", Object.fromEntries((data.plans || []).map((p) => [p.code, p.name])))}/></div>
    </div></div>;
}

export function CommunicationsPanel({ data, canManage, busy, onSend }) {
  const [f, setF] = useState({ title: "", body: "", audience: "school_owners", expiresOn: "" });
  const list = data.announcements || [];
  return <div className="pm-page"><div className="pm-head"><div><h2>Communications</h2><p>Send an announcement to schools. It appears on each school's own dashboard. Nothing is emailed from here.</p></div></div>
    {canManage && <div className="od-card"><h3>New announcement</h3>
      <form className="pm-form" onSubmit={(e) => { e.preventDefault(); onSend({ action: "announce.create", ...f }); setF({ title: "", body: "", audience: "school_owners", expiresOn: "" }); }}>
        <Lbl label="Title"><input className="input" required minLength={3} maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })}/></Lbl>
        <Lbl label="Message"><textarea className="input" required minLength={3} maxLength={2000} rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })}/></Lbl>
        <Lbl label="Who sees it"><select className="input" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}><option value="school_owners">School owners</option><option value="all_members">Everyone in each school</option></select></Lbl>
        <Lbl label="Hide after (optional)"><input className="input" type="date" value={f.expiresOn} onChange={(e) => setF({ ...f, expiresOn: e.target.value })}/></Lbl>
        <button className="button" disabled={busy}>Publish announcement</button></form></div>}
    <div className="od-card"><h3>Sent announcements</h3>
      {list.length ? <div className="od-act">{list.map((a) => <div key={a.id}><span><b>{a.title}</b><br/>{a.body}<br/><small>{a.audience === "all_members" ? "Everyone" : "School owners"} - {when(a.created_at)}{a.expires_on ? " - hides after " + a.expires_on : ""}</small></span>
        {canManage && <button className="button secondary small" disabled={busy} onClick={() => onSend({ action: "announce.toggle", id: a.id, active: !a.active })}>{a.active ? "Hide" : "Show"}</button>}</div>)}</div> : <div className="pm-none">No announcements yet.</div>}</div></div>;
}

export function HealthPanel({ data, onRefresh }) {
  const h = data.health;
  const row = (label, state, detail) => <div className="pm-hrow" key={label}><span><b>{label}</b><small>{detail}</small></span><span className={"od-ok " + (state === "ok" ? "" : state === "warn" ? "od-warn" : "od-bad")}>{state === "ok" ? "Healthy" : state === "warn" ? "Not verified" : "Problem"}</span></div>;
  if (!h) return <div className="pm-page"><div className="pm-none">Health checks are not available.</div></div>;
  return <div className="pm-page"><div className="pm-head"><div><h2>System health</h2><p>Checked just now from the platform server. Anything it cannot verify is shown as not verified, never as healthy.</p></div><button className="button secondary" onClick={onRefresh}>Check again</button></div>
    <div className="od-card"><h3>Services</h3>{row("Database", h.database.ok ? "ok" : "bad", "Answered in " + h.database.ms + " ms")}
      {row("Sign-in service", h.auth.ok ? "ok" : "bad", "Answered in " + h.auth.ms + " ms")}
      {row("File storage", h.storage.ok ? "ok" : "bad", h.storage.brandingBucket ? "School branding bucket found" : "School branding bucket missing")}
      {row("Email sending", h.email.configured ? "ok" : "warn", h.email.configured ? "A sender key is configured" : "No sender key is configured, so no email is sent")}
      {row("Mobile money", h.mobileMoney.configured ? "ok" : "warn", h.mobileMoney.configured ? "A provider key is configured" : "No provider key is configured, so payments are recorded by hand")}
      {row("Backups", "warn", "Managed by the database provider. This server cannot confirm the last backup.")}</div>
    <div className="pm-none">Last checked {when(h.checkedAt)}</div></div>;
}
