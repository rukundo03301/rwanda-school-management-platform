"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
import {NESA_PRIMARY_REFERENCE,primaryReferenceForGrade} from "../../../../lib/rwanda-nesa-primary-reference.mjs";
import {buildTeacherTermPreview} from "../../../../lib/school-term-preview.mjs";
import TeacherReportPreview from "./TeacherReportPreview.jsx";

const SECTIONS=[
 {id:"overview",title:"Overview"},
 {id:"curriculum",title:"Curriculum & Syllabuses"},
 {id:"marks",title:"Teacher Gradebook"},
 {id:"published",title:"Published Reports"},
 {id:"access",title:"Access Controls"}
];
const ADMIN_PERMS=[
 {id:"curriculum.manage",label:"Set up school curriculum, syllabus units and term dates"},
 {id:"reports.read",label:"Review student marks and approved reports"}
];
const TRACKS=[
 ["general","General Education"],["professional","Professional Education"],
 ["tvet","TVET (separate rules needed)"],["nursery","Nursery (separate rules needed)"],
 ["international","International (school-specific rules)"],
 ["higher_education","Higher Education (institutional rules)"]
];
const LEVEL_BANDS={
 general:[["lower_primary","Lower Primary P1–P3 (Kinyarwanda uses LEGRA)"],
  ["upper_primary","Upper Primary P4–P6"],["ordinary_secondary","Ordinary Level S1–S3"],
  ["advanced_secondary","Advanced Level S4–S6"]],
 professional:[["professional","Professional Education"]],
 tvet:[["tvet","TVET"]],nursery:[["nursery","Nursery"]],
 international:[["international","International"]],
 higher_education:[["higher_education","Higher Education"]]
};
function Field({label,children}){return <label className="repm-field"><strong>{label}</strong>{children}</label>}
function Empty({label,description}){return <div className="repm-empty"><strong>{label}</strong><p>{description}</p></div>}
function Modal({name,close,children}){return <div className="repm-backdrop" role="presentation" onClick={e=>{if(e.target===e.currentTarget)close();}}>
 <div className="repm-modal" role="dialog" aria-modal="true" aria-label={name}>
  <header><h2>{name}</h2><button className="button small secondary" onClick={close} aria-label="Close dialog">✕</button></header>{children}
 </div>
 </div>}
function Stat({title,number,detail}){return <div className="repm-stat"><small>{title}</small><strong>{number}</strong><span>{detail}</span></div>}
const safeDate=(d)=>d?new Date(d).toLocaleDateString("en-RW",{timeZone:"Africa/Kigali"}):"—";
export default function ReportsManager({code}){
 const [client,setClient]=useState(null),[ready,setReady]=useState(false),[session,setSession]=useState(null);
 const [loading,setLoading]=useState(true),[data,setData]=useState(null);
 const [tab,setTab]=useState("overview"),[modal,setModal]=useState(null),[form,setForm]=useState({});
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const [termId,setTermId]=useState(""),[classId,setClassId]=useState("");
 const [previewStudentId,setPreviewStudentId]=useState("");
 const [referenceGrade,setReferenceGrade]=useState("P4");
 useEffect(()=>{
  const c=browserSupabase();setClient(c);
  if(!c){setLoading(false);setReady(true);return;}
  let active=true;
  c.auth.getSession().then(({data:r})=>{if(active){setSession(r.session);setReady(true);}});
  const {data:{subscription}}=c.auth.onAuthStateChange((_e,s)=>{if(active)setSession(s);});
  return ()=>{active=false;subscription.unsubscribe();};
 },[]);
 const call=useCallback(async(body)=>{
  if(!client)throw Error("School authentication has not been configured");
  const {data:{session:s}}=await client.auth.getSession();
  if(!s)throw Error("Your school sign-in has expired");
  const response=await fetch("/api/school/"+code+"/reports",{
   method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+s.access_token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(result.error||"School reporting operation failed");
  return result;
 },[client,code]);
 const refresh=useCallback(async()=>{
  setLoading(true);
  try{
   const result=await call();setData(result);setError("");
   setTermId(v=>result.terms.some(t=>t.id===v)?v:result.terms[0]?.id||"");
   setClassId(v=>result.classes.some(c=>c.id===v)?v:result.classes[0]?.id||"");
  }catch(e){setError(e.message);}
  finally{setLoading(false);}
 },[call]);
 useEffect(()=>{if(ready&&session)refresh();else if(ready){setLoading(false);setData(null);}},[ready,session?.user?.id,refresh]);
 const open=(name,initial={})=>{setModal(name);setForm(initial);setError("");setNotice("");};
 async function act(body){
  setBusy(true);setNotice("");setError("");
  try{
   await call(body);
   setModal(null);setForm({});
   setNotice("Saved successfully. Updated school records and permissions have been rechecked.");
   await refresh();
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 if(!ready||loading)return <main className="school-admin-loading">Opening curriculum and school reports…</main>;
 if(!session)return <main className="school-admin-loading"><h2>School sign-in required</h2>
  <a className="button" href={"/s/"+code+"/login?role=teacher"}>Sign in to school</a></main>;
 if(error&&!data)return <main className="school-admin-loading"><h2>Reports unavailable</h2>
  <p role="alert">{error}</p><a href={"/s/"+code}>School homepage</a></main>;
 if(!data)return <main className="school-admin-loading">No reporting data available.</main>;

 const {school,actor,year,terms,classes,subjects,mappings,curriculum,courseMappings,units,
   roster,marks,publishedReports,adminGrants}=data;
 const canManage=actor.owner||actor.reportPermissions?.includes("curriculum.manage");
 const canRead=actor.owner||actor.reportPermissions?.includes("reports.read");
 const teacher=actor.teacher===true;
 const allowedSections=SECTIONS.filter(x=>
  x.id==="overview"||(x.id==="curriculum"&&canManage)||
  (x.id==="marks"&&(teacher||canRead))||
  (x.id==="published"&&canRead)||(x.id==="access"&&actor.owner));
 const subject=(id)=>subjects.find(s=>s.id===id);
 const klass=(id)=>classes.find(s=>s.id===id);
 const profile=(id)=>curriculum.find(p=>p.id===id);
 const courseTitle=(m)=>subject(m.subject_id)?.name||"School subject";
 const gradeCourse=courseMappings.filter(c=>c.class_id===classId&&c.approved_at);
 const classRoster=roster.filter(s=>s.classId===classId);
 const selectedTerm=terms.find(t=>t.id===termId);
 const selectedClass=klass(classId);
 const visibleMarks=marks.filter(m=>m.term_id===termId&&m.class_id===classId);
 const chosenPreviewStudent=classRoster.find(s=>s.studentId===previewStudentId)||classRoster[0]||null;
 const draftPreview=buildTeacherTermPreview({
  school,year,term:selectedTerm,student:chosenPreviewStudent,selectedClass,
  courses:gradeCourse,subjects,curriculum,units,marks
 });
 const ownerAction=(kind,fields={})=>open(kind,fields);
 const stats=[["Approved syllabuses",courseMappings.filter(c=>c.approved_at).length,"Loaded subject mappings"],
  ["Term periods",terms.length,"For current academic year"],
  ["Recorded marks",marks.length,"Loaded records, not full-school totals"],
  ["Published reports",publishedReports.filter(r=>r.status==="published").length,"Loaded and approved"]];
 return <main className="repm-shell" style={{"--repm-primary":/^#[0-9a-f]{6}$/i.test(school.primaryColor||"")?school.primaryColor:"#204a78"}}>
  <header className="repm-header"><div className="repm-brand">
   {school.logoUrl?<img src={school.logoUrl} alt={school.name+" logo"} width="50" height="50"/>:<span className="repm-mark">✦</span>}
   <div><strong>{school.name}</strong><small>Academic Curriculum & Reporting</small></div>
   </div><nav><a href={"/s/"+code+"/admin"}>School Administration</a>
    {teacher&&<a href={"/s/"+code+"/classroom"}>My Classroom</a>}
    <a href={"/s/"+code}>School Homepage</a></nav>
  </header>
  <div className="repm-layout"><aside className="repm-side">
   <span>CURRICULUM & REPORTS</span>
   {allowedSections.map(s=><button key={s.id} className={tab===s.id?"active":""}
     onClick={()=>{setTab(s.id);setError("");}}>{s.title}</button>)}
   <div className="repm-sidefoot"><small>School ID</small><b>{school.code}</b><p>Every calculation uses school-approved curriculum references.</p></div>
  </aside><section className="repm-content">
   <div className="repm-title"><span className="repm-eyebrow">ACADEMIC QUALITY</span>
    <h1>{({overview:"Curriculum-based academic reports",curriculum:"Curriculum & Syllabuses",
      marks:"Assessment Marks",published:"Approved School Reports",
      access:"Administrator Access"})[tab]}</h1>
    <p>Based on NESA's documented assessment guidance, with school-level curriculum review and approval.</p>
   </div>
   {error&&<div className="notice error" role="alert">{error}</div>}
   {notice&&<div className="notice ok" role="status">{notice}</div>}
   {tab==="overview"&&<>
    <div className="repm-stats">{stats.map(x=><Stat key={x[0]} title={x[0]} number={x[1]} detail={x[2]}/>)}</div>
    <div className="repm-columns"><article className="repm-panel"><h2>The complete report workflow</h2>
     <ol className="repm-steps"><li><strong>Approve curriculum versions</strong><span>Use an official source and verify every subject's teaching periods and competencies.</span></li>
      <li><strong>Set up reporting terms</strong><span>Term 1, 2 and 3 must fall within the school's actual calendar.</span></li>
      <li><strong>Teachers enter real assessments</strong><span>End-of-unit, project-based, and end-of-term marks remain private.</span></li>
      <li><strong>School owner approves publication</strong><span>Missing marks and unapproved syllabus allocations block release.</span></li>
      <li><strong>Parent and student view</strong><span>Only published reports appear in their separately verified portals.</span></li></ol>
     </article><article className="repm-panel"><h2>Verified assessment rule</h2>
      <p><b>General & Professional Education (supported tracks)</b></p>
      <div className="repm-weights"><div><strong>25%</strong><small>Units</small></div>
       <div><strong>25%</strong><small>Projects</small></div>
       <div><strong>50%</strong><small>End-of-term</small></div></div>
      <p>Subject maximum marks = teaching periods per week × 10. A report's overall percentage weights subjects by their available marks.</p>
      <p className="repm-source">Source: <a href="https://www.nesa.gov.rw/fileadmin/user_upload/NESA/Ressources/Assessment_Standards_and_Guidelines/Guidelines_on_Recording_Marks_in_CA-MIS_December_2023__Signed_.pdf" target="_blank" rel="noreferrer">NESA Guidelines on Recording Marks in CA-MIS (2023)</a></p>
      <div className="repm-info">Lower Primary P1–P3 (including LEGRA Kinyarwanda), TVET, nursery, higher education and international programmes require separate verified report rules. Their general-education publication is blocked in this version.</div>
      <p><b>Current academic year:</b> {year?.name||"Not configured"}</p>
     </article></div>
   </>}
   {tab==="curriculum"&&canManage&&<>
    <article className="repm-panel">
     <div className="repm-section-top"><div><h2>Official NESA Primary Assessment Reference</h2>
      <p>Verified subject and paper-mark allocations for 2025–2026 Term II; this is not the complete REB syllabus and must not be auto-applied to another year.</p></div>
      <label className="repm-grade-select">Primary grade
       <select className="input" value={referenceGrade} onChange={e=>setReferenceGrade(e.target.value)}>
        {["P1","P2","P3","P4","P5","P6"].map(x=><option key={x} value={x}>{x}</option>)}
       </select></label></div>
     <div className="table-wrap"><table><thead><tr><th>Official assessed subject</th><th>Paper maximum</th><th>CA-MIS marks maximum</th><th>Assessment notes</th></tr></thead>
     <tbody>{primaryReferenceForGrade(referenceGrade).map(ref=><tr key={ref.subject}>
      <td><strong>{ref.subject}</strong></td><td>{ref.paperMax}</td><td><strong>{ref.camisMax}</strong></td>
      <td>{ref.special||"Use the verified assessment standard for paper-to-CA-MIS conversion"}</td>
     </tr>)}</tbody></table></div>
     <p className="repm-source"><a href={NESA_PRIMARY_REFERENCE.sourceUrl} target="_blank" rel="noreferrer">
       Open NESA {NESA_PRIMARY_REFERENCE.version} Primary Assessment Standards</a>. The school must separately verify the REB subject syllabus, learning units and applicable weekly periods before approving a curriculum mapping.</p>
    </article>
    <div className="repm-section-top"><div><h2>Curriculum versions</h2><p>Each school chooses real academic sources. Profiles begin as drafts until school-owner review.</p></div>
     <button className="button" disabled={!year} onClick={()=>ownerAction("profile",{track:"general",policyVersion:"NESA assessment guidance, December 2023",
      sourceTitle:"NESA Guidelines on Recording Marks in CA-MIS",
      sourceUrl:"https://www.nesa.gov.rw/fileadmin/user_upload/NESA/Ressources/Assessment_Standards_and_Guidelines/Guidelines_on_Recording_Marks_in_CA-MIS_December_2023__Signed_.pdf"})}>+ Curriculum Profile</button></div>
    <article className="repm-panel"><div className="table-wrap"><table><thead><tr><th>Curriculum</th><th>Track</th><th>Source and policy</th><th>Status</th><th>Review</th></tr></thead><tbody>
     {curriculum.map(p=><tr key={p.id}><td><strong>{p.name}</strong><p className="micro">{p.pathway||"No pathway assigned"}</p></td>
      <td>{p.track.replaceAll("_"," ")}<p className="micro">{p.level_band?.replaceAll("_"," ")}</p></td><td><a href={p.source_url} target="_blank" rel="noreferrer">{p.source_title}</a>
       <p className="micro">{p.policy_version}</p></td><td><span className="repm-status">{p.status}</span></td>
      <td>{p.status==="draft"&&actor.owner&&<button className="button small secondary"
        onClick={()=>ownerAction("approveProfile",{profile:p})}>Approve source</button>}</td></tr>)}</tbody></table>
      {!curriculum.length&&<Empty label="No curriculum source yet" description="Create a verified source profile for your school's current academic year."/>}</div></article>
    <div className="repm-section-top"><div><h2>Curriculum and subject mappings</h2><p>Attach teaching periods and actual syllabus to every class subject, then record key competences.</p></div>
     <button className="button" disabled={!curriculum.length||!mappings.length} onClick={()=>ownerAction("map",{profileId:curriculum[0]?.id,
       classId:mappings[0]?.class_id,subjectId:mappings[0]?.subject_id})}>+ Subject mapping</button></div>
    <article className="repm-panel"><div className="table-wrap"><table><thead><tr><th>Class</th><th>Subject</th><th>Teaching periods or credits</th><th>Syllabus</th><th>Units</th><th>Approval</th></tr></thead><tbody>
     {courseMappings.map(m=><tr key={m.class_id+"#"+m.subject_id}><td>{klass(m.class_id)?.name||"Class"}</td>
       <td><strong>{courseTitle(m)}</strong></td><td>{m.weekly_periods!=null?m.weekly_periods+" periods/week":m.module_credits!=null?m.module_credits+" module credits":"Not set"}</td>
       <td><a href={m.syllabus_url} target="_blank" rel="noreferrer">{m.syllabus_title}</a></td>
       <td>{units.filter(u=>u.class_id===m.class_id&&u.subject_id===m.subject_id).length}</td>
       <td>{m.approved_at?<span className="repm-status good">Approved</span>:
        <div className="repm-td-actions"><button className="button secondary small" onClick={()=>ownerAction("unit",{classId:m.class_id,subjectId:m.subject_id,termNumber:1})}>+ Unit</button>
         {actor.owner&&<button className="button small" onClick={()=>ownerAction("approveSubject",{course:m})}>Approve</button>}</div>}</td>
     </tr>)}</tbody></table>{!courseMappings.length&&<Empty label="No mapped subjects yet" description="Define classes and subjects in School Administration; link them to an approved syllabus here."/>}</div></article>
    <div className="repm-section-top"><div><h2>Term assessment periods</h2><p>One reporting period for each official school term.</p></div>
     <button className="button" disabled={!year} onClick={()=>ownerAction("term",{termNumber:terms.length+1,beginsOn:year?.starts_on||"",endsOn:year?.ends_on||""})}>+ Add Term</button></div>
    <article className="repm-panel"><div className="table-wrap"><table><thead><tr><th>Term</th><th>Start</th><th>End</th><th>State</th></tr></thead><tbody>
      {terms.map(t=><tr key={t.id}><td>Term {t.term_number}</td><td>{t.begins_on}</td><td>{t.ends_on}</td><td>{t.status}</td></tr>)}</tbody></table>
      {!terms.length&&<Empty label="No term periods" description="Create school term dates within the current academic year."/>}</div></article>
    {units.length>0&&<article className="repm-panel"><h2>Curriculum unit competences</h2>
      <div className="repm-unit-grid">{units.map(u=><div key={u.id}><small>{klass(u.class_id)?.name} / {subject(u.subject_id)?.name}</small>
       <strong>{u.unit_code} — {u.unit_title}</strong><p>Term {u.term_number}: {u.key_competence}</p></div>)}</div></article>}
   </>}
   {tab==="marks"&&(teacher||canRead)&&<>
    <div className="repm-section-top"><div><h2>Assessment gradebook</h2>
      <p>Only assigned teachers may record marks; report viewers receive only school-approved publications. <a href="/templates/Umurage_Rwanda_School_Report_Templates.xlsx" download>Download editable Excel report template</a> (guidance-aligned draft for school review).</p></div>
      {teacher&&<button className="button" disabled={!termId||!classId||!classRoster.length} onClick={()=>ownerAction("mark",{
       termId,classId,studentId:classRoster[0]?.studentId,
       subjectId:gradeCourse[0]?.subject_id,category:"unit",assessmentCode:"",
       score:0,rawMaximum:""})}>+ Record Mark</button>}</div>
    <div className="repm-filters"><label>Academic term<select className="input" value={termId} onChange={e=>setTermId(e.target.value)}>
     {terms.map(t=><option key={t.id} value={t.id}>Term {t.term_number}</option>)}</select></label>
     <label>Class<select className="input" value={classId} onChange={e=>setClassId(e.target.value)}>
      {classes.map(c=><option key={c.id} value={c.id}>{c.name}{c.section?" · "+c.section:""}</option>)}</select></label></div>
    <article className="repm-panel"><p className="repm-info">Each mark's maximum comes from this class's approved weekly teaching periods × 10. Unit and project scores are averaged before applying the 25% / 25% / 50% weights. At least two projects and all configured unit assessments are required before publication.</p>
     <div className="table-wrap"><table><thead><tr><th>Student</th><th>Subject</th><th>Component</th><th>Assessment code</th><th>Marks</th><th>Recorded</th></tr></thead><tbody>
      {visibleMarks.map(m=><tr key={m.id}><td>{roster.find(r=>r.studentId===m.student_id)?.name||"School pupil"}</td>
       <td>{subject(m.subject_id)?.name||"Subject"}</td><td>{m.category.replaceAll("_"," ")}</td>
       <td>{m.assessment_code}</td><td><strong>{m.raw_score} / {m.raw_maximum}</strong><p className="micro">Curriculum equivalent: {m.score} / {m.maximum_marks}</p></td>
       <td>{safeDate(m.entered_at)}</td></tr>)}</tbody></table>
      {!visibleMarks.length&&<Empty label="No marks entered" description="Approved and assigned teachers can record actual curriculum assessments after the school configures a term."/>}</div></article>
    <article className="repm-panel">
      <TeacherReportPreview report={draftPreview} students={classRoster}
       selectedId={chosenPreviewStudent?.studentId||""} onSelect={setPreviewStudentId}/>
    </article>
    <article className="repm-panel"><h3>Curriculum units available for marking</h3>
      <div className="repm-unit-grid">{units.filter(u=>u.class_id===classId).map(u=><div key={u.id}>
       <small>{subject(u.subject_id)?.name}</small><strong>{u.unit_code} · {u.unit_title}</strong><p>Term {u.term_number}: {u.key_competence}</p></div>)}</div>
      {!units.some(u=>u.class_id===classId)&&<Empty label="No syllabus units recorded" description="The school needs to enter approved unit competences before entering end-of-unit marks."/>}</article>
   </>}
   {tab==="published"&&canRead&&<>
    <div className="repm-section-top"><div><h2>School-issued term reports</h2>
     <p>Only your school's owner can approve publication. Students and verified guardians see published records only.</p></div>
     {actor.owner&&<button className="button" disabled={!terms.length||!roster.length}
       onClick={()=>ownerAction("publish",{termId:termId||terms[0]?.id,
         studentId:roster[0]?.studentId,remark:""})}>Publish a report</button>}</div>
    <article className="repm-panel"><div className="table-wrap"><table><thead><tr><th>Student</th><th>Term</th><th>Performance</th><th>Status</th><th>Publication date</th><th>Actions</th></tr></thead><tbody>
     {publishedReports.map(r=><tr key={r.id}><td><strong>{r.report_data?.student_name}</strong>
      <p className="micro">{r.report_data?.student_code}</p></td>
      <td>Term {r.report_data?.term} · {r.report_data?.academic_year}</td>
      <td>{r.report_data?.earned_marks} / {r.report_data?.maximum_marks} ({r.report_data?.overall_percentage}%)</td>
      <td><span className={"repm-status "+(r.status==="published"?"good":"")}>{r.status}</span></td><td>{safeDate(r.published_at)}</td>
      <td><div className="repm-td-actions"><button className="button secondary small" onClick={()=>ownerAction("view",{report:r})}>View summary</button>
       {actor.owner&&r.status==="published"&&<button className="button secondary small"
         onClick={()=>ownerAction("withdraw",{report:r,reason:""})}>Withdraw</button>}</div></td></tr>)}</tbody></table>
     {!publishedReports.length&&<Empty label="No school reports released" description="Students and parents will see nothing until the school owner approves complete term results."/>}</div></article>
   </>}
   {tab==="access"&&actor.owner&&<article className="repm-panel"><h2>School administrator report access</h2>
    <p>Separate ON/OFF switches for curriculum administration and confidential academic results.</p>
    <div className="table-wrap"><table><thead><tr><th>School administrator</th><th>Approved permissions</th><th>Action</th></tr></thead><tbody>
     {adminGrants.map(a=><tr key={a.userId}><td><strong>{a.email||"Verified local administrator"}</strong>
       <p className="micro">{a.userId.slice(0,8)}…</p></td><td>{a.permissions.length?a.permissions.join(", "):"None"}</td>
       <td><button className="button small secondary" onClick={()=>ownerAction("permissions",{admin:a,
          permissions:[...a.permissions],reason:""})}>Edit access switches</button></td></tr>)}</tbody></table>
     {!adminGrants.length&&<Empty label="No verified school administrators" description="Invite and verify administrators in your School Administration module first."/>}</div>
   </article>}
   <footer className="repm-foot">School-issued academic records · NESA guidance referenced, not government certification · No automatic national ranks, examination certificates or promotion claims</footer>
  </section></div>
  {modal&&<Modal name={({profile:"New curriculum source",map:"Map syllabus to class subject",
   unit:"Record a curriculum unit",approveProfile:"Approve curriculum source",
   approveSubject:"Approve subject syllabus",term:"Create term period",mark:"Enter a student assessment",
   publish:"Publish school report",withdraw:"Withdraw report",view:"Published report summary",
   permissions:"Report access control"})[modal]} close={()=>{setModal(null);setError("");}}>
   {error&&<div className="notice error" role="alert">{error}</div>}
   {modal==="profile"&&<form onSubmit={e=>{e.preventDefault();act({action:"curriculum.profile",
     yearId:year.id,...form});}}>
    <p>School-created source profile, not automatically certified by NESA. Your school owner must verify the current syllabus.</p>
    <Field label="Profile title"><input required className="input" maxLength={120} value={form.name||""} placeholder="e.g. P4 General Curriculum 2026" onChange={e=>setForm({...form,name:e.target.value})}/></Field>
    <Field label="Education track"><select className="input" value={form.track} onChange={e=>setForm({...form,track:e.target.value,levelBand:""})}>
     {TRACKS.map(t=><option key={t[0]} value={t[0]}>{t[1]}</option>)}</select></Field>
    <Field label="Education level / band"><select className="input" required value={form.levelBand||""}
      onChange={e=>setForm({...form,levelBand:e.target.value})}>
      <option value="">Choose a verified education level</option>
      {(LEVEL_BANDS[form.track]||[]).map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}
    </select></Field>
    <Field label="Upper-secondary pathway (if relevant)"><select className="input" value={form.pathway||""} onChange={e=>setForm({...form,pathway:e.target.value})}>
     <option value="">Not assigned / not applicable</option>
     {["Mathematics and Sciences","Arts and Humanities","Languages"].map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Policy or syllabus version"><input required className="input" maxLength={120} value={form.policyVersion||""} onChange={e=>setForm({...form,policyVersion:e.target.value})}/></Field>
    <Field label="Official source document title"><input required className="input" maxLength={240} value={form.sourceTitle||""} onChange={e=>setForm({...form,sourceTitle:e.target.value})}/></Field>
    <Field label="Source HTTPS URL"><input required type="url" className="input" value={form.sourceUrl||""} onChange={e=>setForm({...form,sourceUrl:e.target.value})}/></Field>
    <div className="repm-info">Upper-secondary pathways announced by MINEDUC are included for version tracking. Their academic-year applicability and exact subjects still require school verification. TVET and other track publication stays blocked until separately verified.</div>
    <button className="button" type="submit" disabled={busy}>Save curriculum draft</button>
   </form>}
   {modal==="map"&&<form onSubmit={e=>{e.preventDefault();act({action:"curriculum.map",
     ...form,syllabusTitle:form.syllabusTitle,syllabusUrl:form.syllabusUrl});}}>
    <p>Choose a subject already assigned to a real class. Enter periods or credits from the actual curriculum, not an estimate.</p>
    <Field label="Curriculum source profile"><select className="input" value={form.profileId||""} onChange={e=>setForm({...form,profileId:e.target.value})}>
     {curriculum.map(p=><option key={p.id} value={p.id}>{p.name} — {p.track}</option>)}</select></Field>
    <Field label="Class"><select className="input" value={form.classId||""} onChange={e=>{
      const c=e.target.value;setForm({...form,classId:c,subjectId:mappings.find(m=>m.class_id===c)?.subject_id||""});}}>
     {classes.map(c=><option key={c.id} value={c.id}>{c.name} {c.section}</option>)}</select></Field>
    <Field label="Subject"><select className="input" value={form.subjectId||""} onChange={e=>setForm({...form,subjectId:e.target.value})}>
     {mappings.filter(m=>m.class_id===form.classId).map(m=><option key={m.subject_id} value={m.subject_id}>{subject(m.subject_id)?.name}</option>)}</select></Field>
    {["general","professional"].includes(profile(form.profileId)?.track)&&
     <Field label="Weekly teaching periods from syllabus"><input required type="number" min="1" max="20" className="input" value={form.weeklyPeriods||""} onChange={e=>setForm({...form,weeklyPeriods:e.target.value})}/></Field>}
    {profile(form.profileId)?.track==="tvet"&&<Field label="Module credits from approved chronogram"><input type="number" required min="1" max="100" className="input" value={form.moduleCredits||""} onChange={e=>setForm({...form,moduleCredits:e.target.value})}/></Field>}
    <Field label="Exact syllabus title"><input required className="input" maxLength={200} value={form.syllabusTitle||""} onChange={e=>setForm({...form,syllabusTitle:e.target.value})}/></Field>
    <Field label="Official syllabus URL"><input required type="url" className="input" value={form.syllabusUrl||""} onChange={e=>setForm({...form,syllabusUrl:e.target.value})}/></Field>
    <button className="button" disabled={busy} type="submit">Save subject mapping</button>
   </form>}
   {modal==="unit"&&<form onSubmit={e=>{e.preventDefault();act({action:"curriculum.unit",...form});}}>
    <p>Copy the unit's code and competence accurately from your school's verified source syllabus.</p>
    <Field label="Teaching term for this unit"><select className="input" value={form.termNumber||1}
      onChange={e=>setForm({...form,termNumber:Number(e.target.value)})}>
      <option value={1}>Term 1</option><option value={2}>Term 2</option><option value={3}>Term 3</option>
     </select></Field>
    <Field label="Syllabus unit code"><input className="input" required maxLength={30} value={form.unitCode||""} onChange={e=>setForm({...form,unitCode:e.target.value})}/></Field>
    <Field label="Unit title"><input className="input" required maxLength={180} value={form.unitTitle||""} onChange={e=>setForm({...form,unitTitle:e.target.value})}/></Field>
    <Field label="Key competence"><textarea className="input" required minLength={3} maxLength={2000} value={form.competence||""} onChange={e=>setForm({...form,competence:e.target.value})}/></Field>
    <Field label="Learning outcomes (optional)"><textarea className="input" maxLength={3000} value={form.learningOutcomes||""} onChange={e=>setForm({...form,learningOutcomes:e.target.value})}/></Field>
    <button className="button" disabled={busy} type="submit">Save syllabus unit</button>
   </form>}
   {modal==="approveProfile"&&<form onSubmit={e=>{e.preventDefault();act({action:"curriculum.approve",profileId:form.profile.id});}}>
    <p>As school owner, confirm the source is valid for the school's academic year: <strong>{form.profile.name}</strong>.</p>
    <p><a href={form.profile.source_url} target="_blank" rel="noreferrer">Review source in new tab</a></p>
    <p>This approval does not claim ministry endorsement and requires authorized academic staff.</p>
    <button className="button" disabled={busy} type="submit">Approve source version</button>
   </form>}
   {modal==="approveSubject"&&<form onSubmit={e=>{e.preventDefault();act({action:"curriculum.subjectApprove",classId:form.course.class_id,subjectId:form.course.subject_id});}}>
    <p>Verify the actual syllabus URL, teaching periods and complete unit competences before approving:</p>
    <p><strong>{courseTitle(form.course)}</strong> · {klass(form.course.class_id)?.name}</p>
    <p><a href={form.course.syllabus_url} target="_blank" rel="noreferrer">View source syllabus</a></p>
    <p className="repm-info">{units.filter(u=>u.class_id===form.course.class_id&&u.subject_id===form.course.subject_id).length} syllabus unit(s) currently entered.</p>
    <button className="button" disabled={busy} type="submit">Approve subject mapping </button>
   </form>}
   {modal==="term"&&<form onSubmit={e=>{e.preventDefault();act({action:"term.create",yearId:year.id,...form});}}>
    <Field label="School term"><select className="input" value={form.termNumber||1} onChange={e=>setForm({...form,termNumber:Number(e.target.value)})}>
     <option value={1}>Term 1</option><option value={2}>Term 2</option><option value={3}>Term 3</option></select></Field>
    <Field label="Term starts"><input type="date" required className="input" min={year.starts_on} max={year.ends_on} value={form.beginsOn||""} onChange={e=>setForm({...form,beginsOn:e.target.value})}/></Field>
    <Field label="Term ends"><input type="date" required className="input" min={form.beginsOn||year.starts_on} max={year.ends_on} value={form.endsOn||""} onChange={e=>setForm({...form,endsOn:e.target.value})}/></Field>
    <button className="button" disabled={busy} type="submit">Create term</button>
   </form>}
   {modal==="mark"&&<form onSubmit={e=>{e.preventDefault();act({action:"mark.record",...form});}}>
    <p className="muted">Marks are confidential until school-owner publication. Use only your assigned class and subject.</p>
    <Field label="Student"><select required className="input" value={form.studentId||""} onChange={e=>setForm({...form,studentId:e.target.value})}>
     {classRoster.map(s=><option key={s.studentId} value={s.studentId}>{s.studentCode} · {s.name}</option>)}</select></Field>
    <Field label="Assigned subject"><select required className="input" value={form.subjectId||""} onChange={e=>setForm({...form,subjectId:e.target.value,assessmentCode:""})}>
     {gradeCourse.map(m=><option key={m.subject_id} value={m.subject_id}>{courseTitle(m)} · Max {m.weekly_periods*10}</option>)}</select></Field>
    <Field label="Assessment type"><select className="input" value={form.category} onChange={e=>setForm({...form,category:e.target.value,assessmentCode:""})}>
     <option value="unit">End of unit</option><option value="project">Project assessment</option>
     <option value="end_term">End of term</option>
     <option value="legra">LEGRA (P1-P3 Kinyarwanda)</option></select></Field>
    {form.category==="unit"&&<Field label="Curriculum unit"><select required className="input" value={form.assessmentCode||""} onChange={e=>setForm({...form,assessmentCode:e.target.value})}>
     <option value="">Choose official unit</option>
     {units.filter(u=>u.class_id===form.classId&&u.subject_id===form.subjectId
       &&u.term_number===terms.find(t=>t.id===form.termId)?.term_number).map(u=><option key={u.id} value={u.unit_code}>{u.unit_code} · {u.unit_title}</option>)}</select></Field>}
    {form.category==="project"&&<Field label="Project reference"><input className="input" required maxLength={30} placeholder="PROJECT-1" value={form.assessmentCode||""} onChange={e=>setForm({...form,assessmentCode:e.target.value})}/></Field>}
    {form.category==="legra"&&<Field label="LEGRA aspect"><select required className="input" value={form.assessmentCode||""} onChange={e=>setForm({...form,assessmentCode:e.target.value})}>
     <option value="">Choose LEGRA aspect</option><option value="LEGRA_GUTAHURA">Gutahura inyuguti/amagambo</option><option value="LEGRA_ICYANDIKWA">Icyandikwa</option>
     <option value="LEGRA_GUSOMA">Gusoma udategwa</option><option value="LEGRA_KUMVA">Kumva wandikiwe</option></select></Field>}
    {form.category==="end_term"&&<p className="repm-info">The end-of-term examination is recorded once as TERM for this subject.</p>}
    <Field label="Marks earned on this assessment"><input className="input" type="number" step="0.01" min="0" required
      max={form.rawMaximum||undefined}
      value={form.score??0} onChange={e=>setForm({...form,score:e.target.value})}/></Field>
    <Field label="Actual assessment maximum (paper marked out of)"><input className="input" required
      type="number" step="0.01" min="0.01" max="10000"
      placeholder="e.g. 40 if the exam was out of 40"
      value={form.rawMaximum||""}
      onChange={e=>setForm({...form,rawMaximum:e.target.value})}/></Field>
    <p className="repm-info">Marks will be converted to the verified curriculum subject maximum automatically. For example, 39/40 becomes 78/80 if that subject has a curriculum maximum of 80.</p>
    <Field label="Teacher feedback (optional)"><textarea className="input" maxLength={1500} value={form.feedback||""} onChange={e=>setForm({...form,feedback:e.target.value})}/></Field>
    <button className="button" disabled={busy||!form.subjectId||!form.studentId||!form.rawMaximum} type="submit">Record secure mark</button>
   </form>}
   {modal==="publish"&&<form onSubmit={e=>{e.preventDefault();act({action:"report.publish",termId:form.termId,studentId:form.studentId,remark:form.remark||""});}}>
    <p>Publish a school's report only after reviewing all official mapped subjects, unit assessments, at least two projects per subject, and the end-of-term examination. Requires authorized school staff.</p>
    <Field label="Student"><select className="input" required value={form.studentId||""} onChange={e=>setForm({...form,studentId:e.target.value})}>
     {roster.map(s=><option key={s.studentId} value={s.studentId}>{s.name} · {s.studentCode}</option>)}</select></Field>
    <Field label="Term"><select className="input" required value={form.termId||""} onChange={e=>setForm({...form,termId:e.target.value})}>
     {terms.map(t=><option key={t.id} value={t.id}>Term {t.term_number}</option>)}</select></Field>
    <Field label="School leadership comment (optional)"><textarea className="input" maxLength={2000} value={form.remark||""} onChange={e=>setForm({...form,remark:e.target.value})}/></Field>
    <div className="repm-info">This creates a permanent school-issued snapshot; it does not upload marks to CA-MIS or certify NESA national results. Publication will fail if any required mark or approved syllabus source is missing.</div>
    <button className="button" disabled={busy} type="submit">Approve and publish report</button>
   </form>}
   {modal==="withdraw"&&<form onSubmit={e=>{e.preventDefault();act({action:"report.withdraw",reportId:form.report.id,reason:form.reason});}}>
    <p>Withdraw this report from parent and student access? Previous academic evidence is retained for audit.</p>
    <Field label="Reason for withdrawal"><textarea className="input" required minLength={8} maxLength={1000} value={form.reason||""} onChange={e=>setForm({...form,reason:e.target.value})}/></Field>
    <button className="button danger" disabled={busy} type="submit">Withdraw report</button>
   </form>}
   {modal==="view"&&<div className="repm-summary">
    <h3>{form.report.report_data.student_name}</h3>
    <p>Term {form.report.report_data.term} · {form.report.report_data.academic_year} · {form.report.report_data.class_name}</p>
    <div className="table-wrap"><table><thead><tr><th>Subject</th><th>Term total</th><th>%</th></tr></thead><tbody>
     {(form.report.report_data.subjects||[]).map(m=><tr key={m.subject_id}><td>{m.subject_name}</td>
      <td>{m.term_total_marks} / {m.maximum_marks}</td><td>{m.term_percentage}%</td></tr>)}</tbody></table></div>
    <p><strong>Overall:</strong> {form.report.report_data.earned_marks} / {form.report.report_data.maximum_marks} ({form.report.report_data.overall_percentage}%)</p>
    <p>Student and guardian access uses the separate verified report viewer.</p>
   </div>}
   {modal==="permissions"&&<form onSubmit={e=>{e.preventDefault();act({
     action:"report.permissions",userId:form.admin.userId,
     permissions:form.permissions,reason:form.reason});}}>
    <p>School administrator: <strong>{form.admin.email||form.admin.userId.slice(0,8)}</strong></p>
    <div className="table-wrap"><table><thead><tr><th>Access</th><th>Permission</th><th>ON / OFF</th></tr></thead><tbody>
     {ADMIN_PERMS.map(p=><tr key={p.id}><td>{p.id}</td><td>{p.label}</td><td>
      <label className="switch"><input type="checkbox" role="switch" aria-label={"Allow "+p.label}
       checked={form.permissions.includes(p.id)} onChange={e=>setForm(old=>({...old,
         permissions:e.target.checked?[...old.permissions,p.id]:old.permissions.filter(x=>x!==p.id)}))}/>
      <span className="switch-track"/></label></td></tr>)}</tbody></table></div>
    <Field label="Reason required for access change"><textarea required minLength={8} maxLength={600} className="input"
     value={form.reason||""} onChange={e=>setForm({...form,reason:e.target.value})}/></Field>
    <button className="button" disabled={busy} type="submit">Save ON/OFF permissions </button>
   </form>}
  </Modal>}
 </main>;
}
