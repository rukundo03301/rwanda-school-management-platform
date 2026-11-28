"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {useSearchParams} from "next/navigation";
import {browserSupabase} from "../../../../lib/client.js";

const number=(v)=>typeof v==="number"?Number(v).toLocaleString("en-RW",{maximumFractionDigits:2}):"—";
const FIELD=(label,value)=><div className="rep-field"><small>{label}</small><strong>{value||"Not provided"}</strong></div>;
import {TEMPLATE_LABEL} from "../../../../lib/report-templates.mjs";
import TermReportView from "../../../ui/TermReportView.jsx";
export default function PublishedReportCard({code}){
 const [client,setClient]=useState(null),[ready,setReady]=useState(false),[session,setSession]=useState(null);
 const [loading,setLoading]=useState(true),[data,setData]=useState(null),[error,setError]=useState("");
 const [selected,setSelected]=useState("");
 // ?report= (from a notification) chooses which report opens first.
 const wanted=useSearchParams().get("report")||"",seen=useRef(new Set());
 useEffect(()=>{
  const c=browserSupabase();setClient(c);
  if(!c){setLoading(false);setReady(true);return;}
  let alive=true;
  c.auth.getSession().then(({data:r})=>{if(alive){setSession(r.session);setReady(true);}});
  const {data:{subscription}}=c.auth.onAuthStateChange((_evt,s)=>{if(alive)setSession(s);});
  return ()=>{alive=false;subscription.unsubscribe();};
 },[]);
 const load=useCallback(async()=>{
  if(!client)return;
  setLoading(true);setError("");
  try{
   const {data:{session:s}}=await client.auth.getSession();
   if(!s)throw Error("Sign in to your school's authorized parent or student account");
   const res=await fetch("/api/school/"+code+"/published-reports",{
    headers:{Authorization:"Bearer "+s.access_token},cache:"no-store"
   });
   const d=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(d.error||"Published reports are unavailable");
   d.nurseryReports=d.nurseryReports||[];setData(d);setSelected(v=>d.reports.some(r=>r.id===v)||d.nurseryReports.some(r=>"n:"+r.id===v)?v:d.nurseryReports.some(r=>r.id===wanted)?"n:"+wanted:d.reports.some(r=>r.id===wanted)?wanted:(d.nurseryReports[0]?"n:"+d.nurseryReports[0].id:d.reports[0]?.id||""));
  }catch(e){setError(e.message);}
  finally{setLoading(false);}
 },[client,code]);
 useEffect(()=>{if(ready&&session)load();else if(ready){setLoading(false);setData(null);}},[ready,session?.user?.id,load]);
 useEffect(()=>{if(wanted&&data&&data.nurseryReports.some(r=>r.id===wanted))setSelected("n:"+wanted);},[wanted,data]);
 // Opening a term report tells the school it was seen, which clears it from the bell.
 useEffect(()=>{const id=selected.startsWith("n:")?selected.slice(2):"";if(!id||!client||seen.current.has(id))return;seen.current.add(id);
  client.auth.getSession().then(({data:{session:s}})=>s&&fetch("/api/school/"+code+"/published-reports",{method:"POST",
   headers:{Authorization:"Bearer "+s.access_token,"Content-Type":"application/json"},body:JSON.stringify({action:"viewed",reportId:id})})
   .then(()=>{try{window.dispatchEvent(new Event("ds-notes-refresh"));}catch{}}).catch(()=>null));},[selected,client,code]);
 if(!ready||loading)return <main className="school-admin-loading">Checking your authorized school reports…</main>;
 if(!session)return <main className="school-admin-loading"><h2>Verified school sign-in required</h2>
  <p>Only a school-approved student or the child's verified parent/guardian can view a published report.</p>
  <a className="button" href={"/s/"+code+"/login?role=parent"}>School Login</a></main>;
 if(error&&!data)return <main className="school-admin-loading"><h2>School reports are unavailable</h2><p role="alert">{error}</p>
  <a href={"/s/"+code+"/portal?role=parent"}>Back to school</a></main>;
 if(!data)return <main className="school-admin-loading">No reports are available.</main>;
 const report=data.reports.find(r=>r.id===selected);
 const nursery=(data.nurseryReports||[]).find(r=>"n:"+r.id===selected);
 const printed=report?.report_data,school=data.school;
 const rows=Array.isArray(printed?.subjects)?printed.subjects:[];
 const attendance=printed?.attendance||{};
 const canPrint=!!report||!!nursery;
 return <main className="rep-shell">
  <header className="rep-toolbar">
   <div><a href={"/s/"+code}>School Website</a><span>Private Academic Records</span></div>
   <div className="rep-toolbar-actions">
    {(data.reports.length>0||data.nurseryReports.length>0)&&<label>Report <select className="input" value={selected} onChange={e=>setSelected(e.target.value)}>
     {data.nurseryReports.map(r=><option key={"n:"+r.id} value={"n:"+r.id}>{r.student_name} · {r.class_name} · Term {r.term} · {r.academic_year}</option>)}
     {data.reports.map(r=><option key={r.id} value={r.id}>
       {r.report_data?.student_name||"Student"} · Term {r.report_data?.term||"?"} · {r.report_data?.academic_year||"School year"}
     </option>)}</select></label>}
    <button className="button" disabled={!canPrint} onClick={()=>window.print()}>Print / Save as PDF</button>
   </div>
  </header>
  {data.role==="unlinked"&&<section className="rep-empty">
   <h2>No verified student or guardian link</h2><p>School reports are not accessible merely by selecting Parent or Student at login.</p>
  </section>}
  {data.role!=="unlinked"&&!report&&!nursery&&<section className="rep-empty"><h2>No published reports yet</h2>
   <p>Your school must complete curriculum-linked assessments and approve publication. Draft marks are not shown here.</p></section>}
  {nursery&&<article className="rep-paper" style={{"--report-brand":/^#[a-f0-9]{6}$/i.test(school.primaryColor||"")?school.primaryColor:"#204a78"}}>
   <div className="rep-print-header">
    <div className="rep-identity">
     {school.logoUrl?<img src={school.logoUrl} alt={school.name+" official school logo"} width="68" height="68"/>:
      <span className="rep-logo-placeholder" aria-hidden="true">✦</span>}
     <div><small>OFFICIAL SCHOOL IDENTITY</small><h1>{school.name}</h1><p>School ID: {school.code}</p></div>
    </div>
    <div className="rep-term-label"><span>{(TEMPLATE_LABEL[nursery.template]||"Term report").toUpperCase()}</span><strong>Term {nursery.term}</strong>
     <small>{nursery.academic_year}</small></div>
   </div>
   <h2 className="rep-page-heading">{TEMPLATE_LABEL[nursery.template]||"Term Report"}</h2>
   <div className="rep-student-fields">
    {FIELD(nursery.template==="nursery"?"Child":"Student",nursery.student_name)}
    {FIELD("Student ID",nursery.student_code)}
    {FIELD("Class",nursery.class_name)}
    {FIELD("Academic year",nursery.academic_year)}
    {FIELD("Reporting term","Term "+nursery.term)}
   </div>
   <section className="rep-section">
    {nursery.template==="nursery"&&<div className="rep-section-heading"><h3>How your child is learning and growing</h3>
     <p>Six early years learning areas. Nursery children are described, not marked, ranked or given percentages.</p></div>}
    <TermReportView bare report={{template:nursery.template,content:nursery.content}}/>
   </section>
   <div className="rep-two">
    <section className="rep-section"><h3>Class teacher</h3><p>{nursery.teacher_comment||"No teacher comment."}</p>
     {nursery.reviewer_comment&&<><h3>Reviewer</h3><p>{nursery.reviewer_comment}</p></>}</section>
    <section className="rep-section"><h3>Headteacher</h3><p>{nursery.headteacher_comment||"No headteacher comment."}</p>
     <div className="rep-sign"><span>Approved and published by the school</span><span>{new Date(nursery.published_at).toLocaleDateString("en-RW",{timeZone:"Africa/Kigali",year:"numeric",month:"long",day:"numeric"})}</span></div></section>
   </div>
   <footer className="rep-disclaimer">
    <strong>School-issued {nursery.template==="nursery"?"early years record":"term report"}</strong>
    <p>Prepared by {school.name}'s teachers and approved by school leadership. This is not a government document.</p>
    <p>Report reference: {nursery.id.toUpperCase()} · School ID {school.code}</p>
   </footer>
  </article>}
  {report&&<article className="rep-paper" style={{"--report-brand":/^#[a-f0-9]{6}$/i.test(school.primaryColor||"")?school.primaryColor:"#204a78"}}>
   <div className="rep-print-header">
    <div className="rep-identity">
     {school.logoUrl?<img src={school.logoUrl} alt={school.name+" official school logo"} width="68" height="68"/>:
      <span className="rep-logo-placeholder" aria-hidden="true">✦</span>}
     <div><small>OFFICIAL SCHOOL IDENTITY</small><h1>{school.name}</h1><p>School ID: {school.code}</p></div>
    </div>
    <div className="rep-term-label"><span>SCHOOL-ISSUED REPORT</span><strong>Term {printed.term}</strong>
     <small>{printed.academic_year}</small></div>
   </div>
   <h2 className="rep-page-heading">Student Academic Performance Report</h2>
   <div className="rep-student-fields">
    {FIELD("Student",printed.student_name)}
    {FIELD("Student ID",printed.student_code)}
    {FIELD("Class",printed.class_name)}
    {FIELD("Academic year",printed.academic_year)}
    {FIELD("Reporting term","Term "+printed.term)}
    {FIELD("Report dates",printed.term_begins+" to "+printed.term_ends)}
   </div>
   <section className="rep-section">
    <div className="rep-section-heading"><h3>Curriculum-linked subject assessment</h3>
     <p>NESA guidance: End-of-unit 25% · Projects 25% · End-of-term 50%</p></div>
    <div className="rep-table-wrap"><table className="rep-grade-table">
     <thead><tr><th>Subject</th><th>End-of-unit<br/>/ Max</th><th>Projects<br/>/ Max</th>
      <th>End-of-term<br/>/ Max</th><th>Term total<br/>/ Max</th><th>Percent</th></tr></thead>
     <tbody>{rows.map(row=>row.excluded_from_overall?<tr key={row.subject_id}><td>
       <strong>{row.subject_name}</strong><span>{row.subject_code} · LEGRA · {row.weekly_periods} periods/week</span>
      </td><td>{number(row.end_unit_avg)} / {number(row.maximum_marks)}</td>
      <td>{number(row.project_avg)} / {number(row.maximum_marks)}</td>
      <td colSpan={3}>{(row.legra_entries||[]).map(e=><div key={e.code}>{e.aspect}: <strong>{number(e.score)} / {number(e.maximum_marks)}</strong></div>)}
       <small>Four LEGRA scores are shown separately and are not combined into one mark.</small></td></tr>:<tr key={row.subject_id}><td>
       <strong>{row.subject_name}</strong><span>{row.subject_code} · {row.weekly_periods} periods/week</span>
      </td><td>{number(row.end_unit_avg)} / {number(row.maximum_marks)}</td>
      <td>{number(row.project_avg)} / {number(row.maximum_marks)}</td>
      <td>{number(row.end_term_marks)} / {number(row.maximum_marks)}</td>
      <td><strong>{number(row.term_total_marks)} / {number(row.maximum_marks)}</strong></td>
      <td><strong>{number(row.term_percentage)}%</strong></td></tr>)}</tbody>
     <tfoot><tr><th colSpan={4}>Weighted total (LEGRA subjects excluded)</th>
      <th>{number(printed.earned_marks)} / {number(printed.maximum_marks)}</th>
      <th>{number(printed.overall_percentage)}%</th></tr></tfoot>
    </table></div>
    <p className="rep-explain">Maximum marks depend on the verified curriculum teaching periods for each subject (weekly periods × 10). The overall percentage uses total earned marks divided by total available marks; it is not an unweighted average of the subject percentages. No national grade, national rank or promotion decision is implied.</p>
   </section>
   <div className="rep-two">
    <section className="rep-section"><h3>Recorded term attendance</h3><div className="rep-attendance">
      {["present","absent","late","excused"].map(v=><div key={v}><small>{v}</small><strong>{attendance[v]??0}</strong></div>)}
     </div><small>Only dates recorded by the school within this reporting term are included. Missing attendance records are not automatically classified as absent.</small></section>
    <section className="rep-section"><h3>School leadership comments</h3>
     <p>{printed.school_remark||"No additional remark supplied by the school."}</p>
     <div className="rep-sign"><span>School approval recorded</span><span>{new Date(report.published_at).toLocaleDateString("en-RW",{timeZone:"Africa/Kigali",year:"numeric",month:"long",day:"numeric"})}</span></div></section>
   </div>
   <section className="rep-section"><h3>Curriculum competences & teacher feedback</h3>
    {rows.map(row=><div key={row.subject_id} className="rep-competency">
     <strong>{row.subject_name}</strong>
     {Array.isArray(row.curriculum_units)&&row.curriculum_units.length>0?
      <ul>{row.curriculum_units.map((u,i)=><li key={i}><b>{u.unit_code} — {u.title}:</b> {u.competence}</li>)}</ul>:
      <p>No detailed syllabus units supplied by the school.</p>}
     <p className="rep-feedback"><strong>Feedback:</strong> {row.teacher_feedback||"No additional teacher feedback recorded."}</p>
    </div>)}
   </section>
   <footer className="rep-disclaimer">
    <strong>School-issued academic record</strong>
    <p>Prepared by {school.name} using curriculum information approved by its school leadership and NESA's published assessment guidance.
    This is not a NESA national examination result, government certificate, CA-MIS submission, or ministry-issued document. No government seal or signature is reproduced.</p>
    <p>Report reference: {report.id.toUpperCase()} · Version {printed.report_version||1} · Published {new Date(report.published_at).toLocaleDateString("en-RW",{timeZone:"Africa/Kigali"})} · School ID {school.code}</p>
   </footer>
  </article>}
 </main>;
}
