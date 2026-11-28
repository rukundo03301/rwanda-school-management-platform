import {TEMPLATE_LABEL,NURSERY_AREAS,NURSERY_DESCRIPTORS,COMPETENCE,SCALE_TEXT} from "../../lib/report-templates.mjs";
const label=(list,v)=>(list.find(([k])=>k===v)||[,v||"Not recorded"])[1];
const cell={padding:"6px 8px",borderBottom:"1px solid #e3e9f2",textAlign:"left",verticalAlign:"top"};

// The printed term report for any level. Used by staff while reviewing and by families once published.
export default function TermReportView({report,student,className,schoolName,yearName,bare}){
 const t=report.template,c=report.content||{};
 const att=c.attendance&&c.attendance.total?c.attendance.present+" of "+c.attendance.total+" days":null;
 return <article className="term-report" style={bare?{}:{background:"#fff",border:"1px solid #dbe4f0",borderRadius:12,padding:20}}>
  {!bare&&<header style={{marginBottom:12}}>
   {schoolName&&<p style={{margin:0,color:"#637690"}}>{schoolName}</p>}
   <h3 style={{margin:"4px 0"}}>{TEMPLATE_LABEL[t]||"Term Report"}</h3>
   <p style={{margin:0}}><strong>{student}</strong>{className?" · "+className:""}{yearName?" · "+yearName:""}{report.term_number?" · Term "+report.term_number:""}</p>
  </header>}
  {t==="nursery"&&<table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={cell}>Learning area</th><th style={cell}>Progress</th><th style={cell}>What we see</th></tr></thead>
   <tbody>{NURSERY_AREAS.map(([k,l])=><tr key={k}><td style={cell}>{l}</td><td style={cell}>{typeof c.areas?.[k]==="string"?"Not rated":label(NURSERY_DESCRIPTORS,c.areas?.[k]?.descriptor)}</td><td style={cell}>{typeof c.areas?.[k]==="string"?c.areas[k]:c.areas?.[k]?.summary||""}</td></tr>)}</tbody></table>}
  {(t==="primary"||t==="secondary")&&<>
   <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={cell}>Subject</th><th style={cell}>Continuous %</th><th style={cell}>Exam %</th><th style={cell}>Total %</th><th style={cell}>Grade</th><th style={cell}>Comment</th></tr></thead>
    <tbody>{(c.subjects||[]).map((s,i)=><tr key={i}><td style={cell}>{s.name}</td><td style={cell}>{s.continuous??""}</td><td style={cell}>{s.exam??""}</td><td style={cell}>{s.total??""}</td><td style={cell}>{s.grade}</td><td style={cell}>{s.comment}</td></tr>)}</tbody></table>
   <p><strong>Average:</strong> {c.average??"Not calculated"}{c.overallGrade?" ("+c.overallGrade+")":""}{c.conduct?<> · <strong>Conduct:</strong> {c.conduct}</>:null}</p>
   <p style={{fontSize:12,color:"#637690"}}>Grade scale: {SCALE_TEXT[t]}</p></>}
  {t==="tvet"&&<table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={cell}>Module</th><th style={cell}>Result</th><th style={cell}>Practical hours</th><th style={cell}>Comment</th></tr></thead>
   <tbody>{(c.modules||[]).map((m,i)=><tr key={i}><td style={cell}>{m.name}</td><td style={cell}>{label(COMPETENCE,m.competence)}</td><td style={cell}>{m.hours??""}</td><td style={cell}>{m.comment}</td></tr>)}</tbody></table>}
  {t==="university"&&<>
   <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={cell}>Code</th><th style={cell}>Course</th><th style={cell}>Credits</th><th style={cell}>Mark %</th><th style={cell}>Grade</th><th style={cell}>Points</th></tr></thead>
    <tbody>{(c.courses||[]).map((k,i)=><tr key={i}><td style={cell}>{k.code}</td><td style={cell}>{k.name}</td><td style={cell}>{k.credits??""}</td><td style={cell}>{k.mark??""}</td><td style={cell}>{k.grade}</td><td style={cell}>{k.points??""}</td></tr>)}</tbody></table>
   <p><strong>Credits:</strong> {c.credits||0} · <strong>GPA:</strong> {c.gpa??"Not calculated"}</p>
   <p style={{fontSize:12,color:"#637690"}}>Grade scale: {SCALE_TEXT.university}</p></>}
  {att&&<p><strong>Attendance:</strong> {att}</p>}
  {!bare&&report.teacher_comment&&<p><strong>Teacher comment:</strong> {report.teacher_comment}</p>}
  {!bare&&report.reviewer_comment&&<p><strong>Reviewer comment:</strong> {report.reviewer_comment}</p>}
  {!bare&&report.headteacher_comment&&<p><strong>Headteacher comment:</strong> {report.headteacher_comment}</p>}
  {!bare&&report.published_at&&<p style={{fontSize:12,color:"#637690"}}>Published {new Date(report.published_at).toLocaleDateString()}</p>}
 </article>;
}
