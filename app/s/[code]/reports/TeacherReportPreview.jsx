"use client";
import "./teacher-report-preview.css";
const fmt=(value)=>value==null||!Number.isFinite(Number(value))?"—":Number(value).toLocaleString("en-RW",{maximumFractionDigits:2});
export default function TeacherReportPreview({report,students=[],selectedId,onSelect}){
 if(!report)return <section className="trp-empty"><h3>Student report preview</h3><p>Select a term, class and student to prepare an authorized academic report preview.</p></section>;
 return <section className="trp-container" aria-label="Academic report preview">
  <header className="trp-controls">
   <div><span className="trp-overline">Teacher report workspace</span><h3>Preview student report</h3>
    <p>Draft preview from saved assessment marks. Nothing is published by printing.</p></div>
   <div className="trp-actions">
    <label>Student
     <select className="input" value={selectedId||""} onChange={e=>onSelect(e.target.value)}>
      {students.map(s=><option key={s.studentId} value={s.studentId}>{s.studentCode} · {s.name}</option>)}
     </select></label>
    <button type="button" className="button" disabled={!report.subjects.length} onClick={()=>window.print()}>Print draft / Save PDF</button>
   </div>
  </header>
  <div className="trp-banner" role="status">{report.ready?"All currently visible subjects have valid marks.":"Draft not complete — some assessments or approvals are missing."}
   <small>Teachers see only subjects assigned to them. School leadership must review the full class report before publication.</small>
  </div>
  <article className="trp-paper" style={{"--trp-accent":report.school_color}}>
   <div className="trp-head">
    <div className="trp-school">
     {report.school_logo?<img src={report.school_logo} alt={report.school_name+" school logo"} width="59" height="59"/>:
      <div className="trp-logo-placeholder" aria-hidden="true">U</div>}
     <div><small>RWANDA · SCHOOL ACADEMIC REPORT</small><h2>{report.school_name}</h2><p>School ID: {report.school_code}</p></div>
    </div>
    <div className="trp-term"><span>TEACHER DRAFT</span><strong>TERM {report.term_number}</strong>
     <small>{report.year_name||"Academic year pending"}</small></div>
   </div>
   <div className="trp-stripe"/>
   <div className="trp-title"><span>UMURAGE · SMART LEARNING STARTS HERE</span>
    <h1>Student Academic Performance</h1><p>Curriculum-linked term assessment · Private preview</p></div>
   <div className="trp-meta">
    <div><small>STUDENT NAME</small><strong>{report.student_name}</strong></div>
    <div><small>STUDENT ID</small><strong>{report.student_code}</strong></div>
    <div><small>CLASS</small><strong>{report.class_name}</strong></div>
    <div><small>TERM DATES</small><strong>{report.term_begins} to {report.term_ends}</strong></div>
   </div>
   <div className="trp-section-title"><h3>Subject assessment results</h3><span>NESA guidance · General education</span></div>
   <div className="trp-table-wrap"><table>
    <thead><tr><th>Subject</th><th>Units 25%</th><th>Projects 25%</th><th>Exam 50%</th><th>Term result</th><th>Status</th></tr></thead>
    <tbody>{report.subjects.map(s=><tr key={s.subject_id}>
     <td><b>{s.subject_name}</b><small>{s.subject_code}</small></td>
     <td>{fmt(s.end_unit_avg)} {s.end_unit_avg!=null&&<small>/ {fmt(s.maximum_marks)}</small>}</td>
     <td>{fmt(s.project_avg)} {s.project_avg!=null&&<small>/ {fmt(s.maximum_marks)}</small>}</td>
     <td>{fmt(s.end_term_marks)} {s.end_term_marks!=null&&<small>/ {fmt(s.maximum_marks)}</small>}</td>
     <td><b>{fmt(s.term_total_marks)}</b>{s.complete&&<small>/ {fmt(s.maximum_marks)} · {fmt(s.term_percentage)}%</small>}</td>
     <td><span className={"trp-state "+(s.complete?"ready":"pending")}>{s.complete?"Ready":"Incomplete"}</span></td>
    </tr>)}</tbody>
    {report.ready&&<tfoot><tr><th colSpan="4">Weighted total across visible subjects</th>
      <th>{fmt(report.earned_marks)} / {fmt(report.maximum_marks)}<small>{fmt(report.overall_percentage)}%</small></th><th>Draft</th></tr></tfoot>}
   </table></div>
   {!report.subjects.length&&<p className="trp-note">No approved, assigned subjects are available for this class and term.</p>}
   <div className="trp-section-title"><h3>Readiness and teacher feedback</h3><span>Missing is not zero</span></div>
   {report.subjects.map(s=><div className="trp-feedback" key={"review-"+s.subject_id}>
    <strong>{s.subject_name}</strong>
    <p>{s.complete?(s.teacher_feedback||"No additional learning feedback supplied."):"Required before final report: "+s.issues.join("; ")+". "}</p>
   </div>)}
   <div className="trp-summary"><div><span>REPORT STATUS</span><strong>{report.ready?"Ready for school review":"Incomplete draft"}</strong></div>
    <div><span>AVERAGE OF VISIBLE SUBJECTS</span><strong>{report.ready?fmt(report.overall_percentage)+"%":"Not calculated"}</strong></div></div>
   <section className="trp-signatures"><div><span>Class / subject teacher</span><div/><small>Name · Date · Signature</small></div>
    <div><span>Headteacher / Principal</span><div/><small>Review · Date · Signature</small></div>
    <div><span>School owner / authorized approver</span><div/><small>Approval · Date · Signature</small></div></section>
   <footer className="trp-disclaimer">
    <strong>DRAFT — NOT PUBLISHED OR VALID FOR CERTIFICATION</strong>
    <p>{report.note} Official school publication is a separate role-protected action. This is a school-issued preview informed by NESA guidance, not a ministry-issued form, examination certificate or CA-MIS record. No national grade, ranking or promotion outcome is implied.</p>
    <p>Reference: NESA Guidelines on Recording Marks in CA-MIS (December 2023) · CAMIS 2.0 Marks Recording Teacher Guide (2025)</p>
   </footer>
  </article>
 </section>;
}
