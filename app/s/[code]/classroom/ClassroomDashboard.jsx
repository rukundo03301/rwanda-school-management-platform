"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
import {DashboardShell,Stat,Ring,Card,Icon,greeting,todayLabel} from "../../../ui/DashboardShell.jsx";

const dateKigali=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Africa/Kigali",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const SECTIONS=[
 {id:"overview",label:"Dashboard"},
 {id:"assignments",label:"Teacher Assignments"},
 {id:"lessons",label:"Lessons & Plans"},
 {id:"homework",label:"Homework"},
 {id:"attendance",label:"Attendance"},
 {id:"submissions",label:"Submissions"},
 {id:"materials",label:"Learning Materials"},
 {id:"studentAccess",label:"Student Accounts"}
];
function Label({name,children}){return <label className="field" style={{marginBottom:14}}><strong>{name}</strong>{children}</label>}
function Blank({title,description}){return <div className="cr-empty"><strong>{title}</strong><p>{description}</p></div>}
function Modal({title,close,children}){return <div className="cr-modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)close();}}>
 <div className="cr-modal" role="dialog" aria-modal="true" aria-label={title}>
  <div className="cr-modal-top"><h2>{title}</h2><button className="button secondary small" onClick={close} aria-label="Close dialog">✕</button></div>{children}
 </div></div>;}
function Tag({children}){return <span className="cr-tag">{children}</span>}
export default function ClassroomDashboard({code}){
 const [client,setClient]=useState(null),[ready,setReady]=useState(false),[session,setSession]=useState(null);
 const [loading,setLoading]=useState(true),[data,setData]=useState(null);
 const [tab,setTab]=useState("overview"),[selectedClass,setSelectedClass]=useState("");
 const [modal,setModal]=useState(null),[form,setForm]=useState({});
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[com,setCom]=useState(null);
 useEffect(()=>{
  const c=browserSupabase();setClient(c);
  if(!c){setReady(true);setLoading(false);return;}
  let alive=true;
  c.auth.getSession().then(({data:s})=>{if(alive){setSession(s.session);setReady(true);}});
  const {data:{subscription}}=c.auth.onAuthStateChange((_e,s)=>{if(alive)setSession(s);});
  return ()=>{alive=false;subscription.unsubscribe();};
 },[]);
 const api=useCallback(async(body)=>{
  if(!client)throw Error("School sign-in is not configured");
  const {data:{session:s}}=await client.auth.getSession();
  if(!s)throw Error("Sign in again to continue");
  const response=await fetch("/api/school/"+code+"/classroom",{
   method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+s.access_token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(result.error||"School classroom request failed");
  return result;
 },[client,code]);
 const refresh=useCallback(async()=>{
  setLoading(true);
  try{const r=await api();setData(r);setError("");
   setSelectedClass(old=>r.classes.some(c=>c.id===old)?old:r.myAssignments[0]?.class_id||r.classes[0]?.id||"");
  }catch(e){setError(e.message);}
  finally{setLoading(false);}
 },[api]);
 const loadExtra=useCallback(async()=>{
  try{
   const {data:{session:s}}=await client.auth.getSession();
   const r=await fetch("/api/school/"+code+"/communications",{cache:"no-store",headers:{Authorization:"Bearer "+s.access_token}});
   setCom(r.ok?await r.json():null);
  }catch{setCom(null);}
 },[client,code]);
 useEffect(()=>{if(ready&&session){refresh();loadExtra();}else if(ready){setLoading(false);setData(null);}},[ready,session?.user?.id,refresh,loadExtra]);
 const open=(mode,fields={})=>{setModal(mode);setForm(fields);setError("");setNotice("");};
 async function submit(body){
  setBusy(true);setError("");setNotice("");
  try{
   const result=await api(body);
   setModal(null);setForm({});
   setNotice(body.action==="student.invite"?
    "Student invitation saved. "+(result.result?.mailStatus==="provider_accepted"?
      "The email provider accepted the invite; delivery is not confirmed.":
      "Email not confirmed. An existing verified student can use the school login."):
    "School classroom record saved successfully.");
   await refresh();
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 if(!ready||loading)return <main className="school-admin-loading">Opening your school's classrooms…</main>;
 if(!session)return <main className="school-admin-loading"><h2>School login required</h2><a className="button" href={"/s/"+code+"/login?role=teacher"}>Sign in</a></main>;
 if(error&&!data)return <main className="school-admin-loading"><h2>Classroom access unavailable</h2><p role="alert">{error}</p><a href={"/s/"+code+"/portal?role=teacher"}>School Portal</a></main>;
 if(!data)return <main className="school-admin-loading">Classroom data unavailable.</main>;

 const {school,actor,year,classes,subjects,mappings,teachers,assignments,myAssignments,roster,homework,lessons,submissions,attendance,materials=[]}=data;
 const ownClasses=[...new Set(myAssignments.map(a=>a.class_id))];
 const visibleClasses=actor.teacher?classes.filter(c=>ownClasses.includes(c.id)):classes;
 const classLabel=(id)=>{const c=classes.find(x=>x.id===id);return c?c.name+(c.section?" · "+c.section:""):"Unassigned class";};
 const subjectLabel=(id)=>subjects.find(x=>x.id===id)?.name||"School subject";
 const rows=roster.filter(r=>r.classId===selectedClass);
 const myAssignmentsClass=myAssignments.filter(a=>a.class_id===selectedClass);
 const allClassSubjects=mappings.filter(m=>m.class_id===form.classId);
 const eligibleSubjects=subjects.filter(s=>allClassSubjects.some(m=>m.subject_id===s.id));
 const currentDay=dateKigali();
 const teacherClasses=visibleClasses;
 const assignedStudents=roster.filter(r=>teacherClasses.some(cls=>cls.id===r.classId));
 const uniqueStudentCount=new Set(assignedStudents.map(r=>r.studentId)).size;
 const activeHomework=homework.filter(h=>h.status==="published"&&teacherClasses.some(cls=>cls.id===h.class_id));
 const assignedSubmissions=submissions.filter(s=>activeHomework.some(h=>h.id===s.homework_id));
 const todayAttendance=attendance.filter(a=>a.attendance_on===currentDay&&teacherClasses.some(cls=>cls.id===a.class_id));
 const presentToday=todayAttendance.filter(a=>a.status==="present").length;
 const dateLabel=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Kigali",weekday:"short",day:"numeric",month:"long",year:"numeric"}).format(new Date());
 const teacherTodayLessons=lessons.filter(l=>l.lesson_date===currentDay&&teacherClasses.some(cls=>cls.id===l.class_id));
 const recentAssignments=[...activeHomework].sort((a,b)=>new Date(a.due_at||0)-new Date(b.due_at||0)).slice(0,4);
 const selectSection=(id)=>{setTab(id);setError("");};
 const visibleTabs=SECTIONS.filter(t=>{
   if(t.id==="studentAccess")return actor.owner;
   if(t.id==="assignments")return actor.manager;
   if(["lessons","homework","attendance","submissions","materials"].includes(t.id))return actor.teacher;
   return true;
 });
 const hhmm=t=>String(t||"").slice(0,5);
 const todayNo=({Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7})[new Intl.DateTimeFormat("en-US",{weekday:"short",timeZone:"Africa/Kigali"}).format(new Date())];
 const myPeriods=(com?.timetable||[]).filter(x=>x.weekday===todayNo);
 const toGrade=assignedSubmissions.filter(x=>!x.graded_at);
 const TITLES={overview:"Teacher Dashboard",assignments:"Teacher Class Assignments",lessons:"Lesson Planning",homework:"Homework and Deadlines",attendance:"Daily Attendance",submissions:"Homework Submissions",studentAccess:"Verified Student Accounts",materials:"Learning Materials"};
 const ICON={overview:"home",assignments:"users",lessons:"book",homework:"check",attendance:"clock",submissions:"file",studentAccess:"user",materials:"folder"};
 const NAMES={overview:"Dashboard",attendance:"Attendance",submissions:"Grade Submissions"};
 const navItems=[...visibleTabs.map(t=>({label:NAMES[t.id]||t.label,icon:ICON[t.id],active:tab===t.id,onClick:()=>{setTab(t.id);setError("");}})),
  {label:"Timetable & Messages",icon:"calendar",href:"/s/"+code+"/communications"},
  {label:"Assessment Gradebook",icon:"chart",href:"/s/"+code+"/reports"},
  ...(code==="RW-SCH-000004"?[{label:"Learning Library",icon:"folder",href:"/s/"+code+"/resources"}]:[]),
  ...(actor.manager?[{label:"Administration",icon:"gear",href:"/s/"+code+"/admin"}]:[])];
 const signOut=async()=>{await client.auth.signOut();window.location.assign("/s/"+code+"/login?role="+(actor.teacher?"teacher":"school_owner"));};
 return <DashboardShell school={{name:school.name,logoUrl:school.logo,place:actor.teacher?"Teacher workspace":"Academic workspace"}}
  title={TITLES[tab]} user={{name:session.user.email||"School member",role:actor.teacher?"Teacher":actor.owner?"School Owner":"School Staff"}}
  nav={navItems} notifications={actor.teacher?toGrade.length:0} onBell={()=>selectSection("submissions")}
  helpText="Contact the school administration." onSignOut={signOut} portalHref={"/s/"+code+"/portal?role="+(actor.teacher?"teacher":"school_owner")}>
    {!(tab==="overview"&&actor.teacher)&&<div className="cr-title">
     <p>{actor.teacher?"Only your school-approved class assignments and students appear here.":
       "Approve class teaching assignments and verified student access within this school."}</p>
    </div>}
    {notice&&<div className="notice ok" role="status">{notice}</div>}
    {error&&<div className="notice error" role="alert">{error}</div>}
    {tab==="overview"&&actor.teacher&&<>
     <section className="ds-banner"><div><h2>{greeting()}, Teacher!</h2>
      <p>{toGrade.length?"You have "+toGrade.length+" submitted "+(toGrade.length===1?"task":"tasks")+" waiting for your grade.":"No submissions are waiting for your grade."} Manage your classes at {school.name}.</p></div>
      <div className="ds-chips"><span className="ds-chip"><Icon name="calendar" size={18}/>{todayLabel()}</span>
       {year?.name&&<span className="ds-chip blue">{year.name}</span>}</div></section>
     <div className="ds-grid">
      <div className="ds-span8" style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:14,alignContent:"start"}}>
       <div className="ds-stats" style={{margin:0}}>
        <Stat icon="users" tone="blue" value={teacherClasses.length} label="My Classes"/>
        <Stat icon="cap" tone="purple" value={uniqueStudentCount} label="My Students"/>
        <Stat icon="check" tone="orange" value={activeHomework.length} label="Published Homework"/>
        <Stat icon="file" tone="green" value={toGrade.length} label="To Grade"/>
       </div>
       <div className="ds-grid" style={{margin:0}}>
        <Card title="Today's Classes" icon="calendar" size="s6" link={<a href={"/s/"+code+"/communications"}>Timetable →</a>}>
         {myPeriods.length?<ul className="ds-list">{myPeriods.map(x=><li key={x.id} className="ds-item"><span className="ds-ico blue"><Icon name="clock"/></span>
          <div><strong>{subjectLabel(x.subject_id)} · {classLabel(x.class_id)}</strong><small>{hhmm(x.starts_at)} to {hhmm(x.ends_at)}{x.room?" · Room "+x.room:""}</small></div></li>)}</ul>
          :<p className="ds-empty">{(com?.timetable||[]).length?"No lessons are scheduled for you today.":"No timetable has been published for your classes yet."}</p>}
        </Card>
        <Card title="Attendance Today" icon="clock" size="s6" link={<button className="ds-link" onClick={()=>selectSection("attendance")}>Mark attendance →</button>}>
         <div className="ds-split"><Ring value={todayAttendance.length?Math.round(100*presentToday/Math.max(roster.length,todayAttendance.length)):null} label={todayAttendance.length?"Present":"Not recorded"}/>
          <div className="ds-legend">{teacherClasses.map(cls=><div key={cls.id}>{classLabel(cls.id)}<b>{attendance.filter(a=>a.attendance_on===currentDay&&a.class_id===cls.id&&a.status==="present").length} / {new Set(roster.filter(r=>r.classId===cls.id).map(r=>r.studentId)).size}</b></div>)}</div></div>
        </Card>
       </div>
       <Card title="My Classes" icon="users" size="s12" link={<button className="ds-link" onClick={()=>selectSection("attendance")}>Open →</button>}>
        {teacherClasses.length?<table className="ds-table"><thead><tr><th>Class</th><th>Subjects</th><th>Students</th><th></th></tr></thead><tbody>
         {teacherClasses.map(cls=><tr key={cls.id}><td><strong>{classLabel(cls.id)}</strong></td>
          <td>{[...new Set(myAssignments.filter(a=>a.class_id===cls.id).map(a=>subjectLabel(a.subject_id)))].join(", ")||"—"}</td>
          <td>{new Set(roster.filter(r=>r.classId===cls.id).map(r=>r.studentId)).size}</td>
          <td><button className="ds-link" onClick={()=>{setSelectedClass(cls.id);selectSection("attendance")}}>Open class →</button></td></tr>)}</tbody></table>
         :<p className="ds-empty">Your school administrator will assign your classes and subjects.</p>}
       </Card>
       <div className="ds-grid" style={{margin:0}}>
        <Card title="Homework Overview" icon="check" size="s6" link={<button className="ds-link" onClick={()=>selectSection("homework")}>View all →</button>}>
         {recentAssignments.length?<ul className="ds-list">{recentAssignments.map(h=><li key={h.id} className="ds-item" style={{cursor:"pointer"}} onClick={()=>{setSelectedClass(h.class_id);selectSection("submissions")}}>
          <span className="ds-ico purple"><Icon name="check"/></span><div><strong>{h.title}</strong><small>{classLabel(h.class_id)} · Due {new Date(h.due_at).toLocaleDateString("en-GB",{timeZone:"Africa/Kigali"})}</small></div>
          <span className="ds-pill info">{submissions.filter(x=>x.homework_id===h.id).length} submitted</span></li>)}</ul>
          :<p className="ds-empty">Create and publish homework for your assigned classes.</p>}
        </Card>
        <Card title="Needs Grading" icon="file" size="s6" link={<button className="ds-link" onClick={()=>selectSection("submissions")}>Open →</button>}>
         {toGrade.length?<ul className="ds-list">{toGrade.slice(0,4).map(x=><li key={x.id} className="ds-item">
          <span className="ds-ico orange"><Icon name="file"/></span><div><strong>{roster.find(r=>r.studentId===x.student_id)?.name||"Assigned student"}</strong><small>{homework.find(h=>h.id===x.homework_id)?.title||"Homework"}</small></div></li>)}</ul>
          :<p className="ds-empty">Nothing is waiting for a grade.</p>}
        </Card>
       </div>
      </div>
      <div className="ds-span4" style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:14,alignContent:"start"}}>
       <Card title="Quick Actions" icon="bolt">
        <div className="ds-actions" style={{gridTemplateColumns:"1fr"}}>
         <button className="ds-action blue" onClick={()=>{const a=myAssignments[0];if(a){setSelectedClass(a.class_id);open("homework",{classId:a.class_id,subjectId:a.subject_id});}else selectSection("homework");}}><Icon name="check"/>Create Homework</button>
         <button className="ds-action green" onClick={()=>selectSection("attendance")}><Icon name="clock"/>Record Attendance</button>
         <button className="ds-action purple" onClick={()=>{const a=myAssignments[0];if(a){setSelectedClass(a.class_id);open("lesson",{classId:a.class_id,subjectId:a.subject_id,lessonOn:currentDay});}else selectSection("lessons");}}><Icon name="book"/>Plan a Lesson</button>
         <a className="ds-action orange" href={"/s/"+code+"/communications"}><Icon name="chat"/>School Messages</a>
        </div>
       </Card>
       <Card title="Today's Lesson Plans" icon="book">
        {teacherTodayLessons.length?<ul className="ds-list">{teacherTodayLessons.map(l=><li key={l.id} className="ds-item"><span className="ds-ico green"><Icon name="book"/></span>
         <div><strong>{l.title}</strong><small>{classLabel(l.class_id)} · {subjectLabel(l.subject_id)}</small></div></li>)}</ul>
         :<p className="ds-empty">No lesson plans dated today.</p>}
       </Card>
       <Card title="Recent Submissions" icon="file" link={<button className="ds-link" onClick={()=>selectSection("submissions")}>Review →</button>}>
        {assignedSubmissions.length?<ul className="ds-list">{[...assignedSubmissions].sort((a,b)=>new Date(b.submitted_at)-new Date(a.submitted_at)).slice(0,5).map(x=><li key={x.id} className="ds-item">
         <span className="ds-ico blue"><Icon name="user"/></span><div><strong>{roster.find(r=>r.studentId===x.student_id)?.name||"Assigned student"}</strong><small>{homework.find(h=>h.id===x.homework_id)?.title||"Homework"} · {x.submitted_at?.slice(0,10)}</small></div></li>)}</ul>
         :<p className="ds-empty">No student submissions yet.</p>}
       </Card>
      </div>
     </div>
    </>}
    {tab==="overview"&&!actor.teacher&&<>
     <div className="cr-metrics">
      <div><small>Current academic year</small><strong>{year?.name||"Not set"}</strong><span>From school administration</span></div>
      <div><small>School classes</small><strong>{classes.length}</strong><span>Current academic year</span></div>
      <div><small>Assigned teachers</small><strong>{teachers.length}</strong><span>Verified school members</span></div>
      <div><small>Teaching assignments</small><strong>{assignments.length}</strong><span>Current records</span></div>
     </div>
     <section className="cr-panel"><h2>Academic administration</h2><p className="muted">Assign approved teachers, oversee classes and verify student enrollment within this school.</p>
      <button className="button" onClick={()=>selectSection("assignments")}>Manage teacher assignments</button></section>
    </>}
    {tab==="assignments"&&actor.manager&&<>
     <div className="cr-section-head"><div><h2>Who teaches each subject?</h2><p>Assign only verified school teachers to a class and subject already in Academic Setup.</p></div>
      <button className="button" disabled={!teachers.length||!classes.length||!mappings.length} onClick={()=>{
       const c=classes.find(x=>mappings.some(m=>m.class_id===x.id));
       const sub=mappings.find(m=>m.class_id===c?.id);
       open("assign",{teacherId:teachers[0]?.userId||"",classId:c?.id||"",subjectId:sub?.subject_id||""});
      }}>+ Assign Teacher</button></div>
     <section className="cr-panel"><div className="table-wrap"><table><thead><tr><th>Teacher</th><th>Class</th><th>Subject</th><th>Action</th></tr></thead><tbody>
      {assignments.map(a=><tr key={a.teacher_id+"#"+a.class_id+"#"+a.subject_id}>
       <td><strong>{teachers.find(t=>t.userId===a.teacher_id)?.email||"Verified teacher"}</strong></td>
       <td>{classLabel(a.class_id)}</td><td>{subjectLabel(a.subject_id)}</td>
       <td><button className="button secondary small" onClick={()=>open("revoke",{assignment:a,reason:""})}>Revoke assignment</button></td>
      </tr>)}</tbody></table>{!assignments.length&&<Blank title="No assigned teachers yet" description="Invite teachers in School Administration, define classes and subjects, then assign their teaching responsibilities."/>}</div></section>
    </>}
    {["lessons","homework","attendance","submissions","materials"].includes(tab)&&actor.teacher&&<>
     <div className="cr-class-selector">
      <label>My class <select className="input" value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}>
       {visibleClasses.map(c=><option key={c.id} value={c.id}>{classLabel(c.id)}</option>)}
      </select></label>
      {tab==="lessons"&&<button className="button" disabled={!myAssignmentsClass.length} onClick={()=>open("lesson",{classId:selectedClass,subjectId:myAssignmentsClass[0]?.subject_id,lessonOn:currentDay})}>+ Lesson Plan</button>}
      {tab==="homework"&&<button className="button" disabled={!myAssignmentsClass.length} onClick={()=>open("homework",{classId:selectedClass,subjectId:myAssignmentsClass[0]?.subject_id})}>+ Create Homework</button>}
      {tab==="materials"&&<button className="button" disabled={!myAssignmentsClass.length} onClick={()=>open("material",{classId:selectedClass,subjectId:myAssignmentsClass[0]?.subject_id,kind:"video"})}>+ Add Material</button>}
     </div>
     {tab==="materials"&&<section className="cr-panel"><h2>Learning materials for this class</h2>
       <p className="muted">Add a YouTube video or a web link. Students in this class see a material only while it is switched on.</p>
       <div className="cr-card-grid">{materials.filter(m=>m.class_id===selectedClass).map(m=><article key={m.id} className="cr-lesson">
        <div className="cr-card-header"><Tag>{subjectLabel(m.subject_id)}</Tag><span className="cr-status">{m.published?"Visible to students":"Hidden"}</span></div>
        <h3>{m.title}</h3>{m.description&&<p>{m.description}</p>}
        <small><a href={m.url} target="_blank" rel="noopener noreferrer">Open link</a> · {m.kind}</small>
        <button className="button secondary small" disabled={busy} onClick={()=>submit({action:"material.toggle",materialId:m.id,published:!m.published})}>{m.published?"Hide from students":"Show to students"}</button>
       </article>)}</div>
       {!materials.some(m=>m.class_id===selectedClass)&&<Blank title="No materials yet" description="Add the first video or link for this class. It stays hidden until you switch it on."/>}</section>}
     {tab==="lessons"&&<section className="cr-panel"><h2>My lesson plans</h2><div className="cr-card-grid">
       {lessons.filter(l=>l.class_id===selectedClass).map(l=><article key={l.id} className="cr-lesson">
        <Tag>{subjectLabel(l.subject_id)}</Tag><h3>{l.title}</h3><p>{l.objectives||"No objectives added"}</p><small>Lesson date: {l.lesson_date}</small></article>)}</div>
       {!lessons.some(l=>l.class_id===selectedClass)&&<Blank title="No lesson plans" description="Add an actual lesson plan for your class. Plans are private to verified school staff."/>}</section>}
     {tab==="homework"&&<section className="cr-panel"><h2>Homework for this class</h2>
       <div className="cr-card-grid">{homework.filter(h=>h.class_id===selectedClass).map(h=><article key={h.id} className="cr-lesson">
        <div className="cr-card-header"><Tag>{subjectLabel(h.subject_id)}</Tag><span className="cr-status">{h.status}</span></div>
        <h3>{h.title}</h3><p>{h.instructions}</p><small>Due: {new Date(h.due_at).toLocaleString("en-RW",{timeZone:"Africa/Kigali"})}</small>
        {h.status==="draft"&&<button className="button secondary small" disabled={busy} onClick={()=>submit({action:"homework.publish",homeworkId:h.id})}>Publish for students</button>}
       </article>)}</div>
       {!homework.some(h=>h.class_id===selectedClass)&&<Blank title="No homework posted" description="Draft and publish the first real assignment for this class."/>}</section>}
     {tab==="attendance"&&<section className="cr-panel"><div className="cr-section-head">
       <div><h2>Take class attendance</h2><p>Only students enrolled in your assigned class are listed. Attendance uses the Rwanda calendar date.</p></div>
       <label>Date <input className="input" type="date" max={currentDay} defaultValue={currentDay} id="cr-attendance-date" onChange={e=>setForm({...form,attendanceDate:e.target.value})}/></label>
       </div>
       <div className="table-wrap"><table><thead><tr><th>Student</th><th>Student ID</th><th>Recorded</th><th>Mark attendance</th></tr></thead><tbody>
        {rows.map(s=>{const day=form.attendanceDate||currentDay;
         const existing=attendance.find(a=>a.class_id===selectedClass&&a.student_id===s.studentId&&a.attendance_on===day);
         return <tr key={s.studentId}><td><strong>{s.name}</strong></td><td><kbd>{s.code}</kbd></td>
          <td>{existing?.status||"Not recorded"}</td><td><select className="input" style={{minWidth:130}} disabled={busy} value={existing?.status||""}
            onChange={e=>submit({action:"attendance.record",classId:selectedClass,studentId:s.studentId,on:day,status:e.target.value})}>
             <option value="">Choose</option><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="excused">Excused</option>
            </select></td></tr>})}</tbody></table>
         {!rows.length&&<Blank title="No enrolled students for this class" description="Enroll real students in Admissions before taking attendance."/>}</div></section>}
     {tab==="submissions"&&<section className="cr-panel"><h2>Student homework submissions</h2>
       <div className="table-wrap"><table><thead><tr><th>Homework</th><th>Student</th><th>Response</th><th>Submitted</th><th>Grade &amp; feedback</th></tr></thead>
       <tbody>{submissions.filter(x=>homework.some(h=>h.id===x.homework_id&&h.class_id===selectedClass)).map(s=><tr key={s.id}>
        <td>{homework.find(h=>h.id===s.homework_id)?.title||"Assignment"}</td>
        <td>{roster.find(x=>x.studentId===s.student_id)?.name||"Current student"}</td>
        <td><p className="cr-response">{s.response_text}</p></td><td>{s.submitted_at?.slice(0,16)} {s.is_late?"(Late)":""}</td>
<td>{s.graded_at?<><strong>{s.score!=null?Number(s.score)+" / "+Number(s.max_score):"Feedback only"}</strong>{s.feedback&&<p className="cr-response">{s.feedback}</p>}</>:<span className="micro">Not graded yet</span>}<br/><button type="button" className="button secondary small" disabled={busy} onClick={()=>open("grade",{submissionId:s.id,score:s.score??"",maxScore:s.max_score??10,feedback:s.feedback||""})}>{s.graded_at?"Edit grade":"Grade"}</button></td>
       </tr>)}</tbody></table>
       {!submissions.some(s=>homework.some(h=>h.id===s.homework_id&&h.class_id===selectedClass))&&
        <Blank title="No homework submissions yet" description="Student responses will appear here once verified students submit published assignments."/>}
       </div></section>}
    </>}
    {tab==="studentAccess"&&actor.owner&&<><div className="cr-section-head">
     <div><h2>Student accounts and approval</h2><p>Children cannot create their own school access by selecting Student at login.</p></div>
     <button className="button" disabled={!data.studentCandidates.length} onClick={()=>open("studentInvite",{studentId:data.studentCandidates[0]?.id,consentAttested:false})}>+ Invite Student</button></div>
     <div className="cr-info">Before inviting a minor or a student with unknown age, a verified guardian must already be linked in the Admissions module. The school owner must confirm identity and the required family authorization. Students without appropriate consent do not receive independent accounts.</div>
     <section className="cr-panel"><h3>Student account invitations</h3><div className="table-wrap"><table><thead><tr><th>Student</th><th>Email</th><th>Status</th><th>Expires</th></tr></thead><tbody>
      {data.studentInvites.map((i,n)=><tr key={i.student_id+"#"+n}><td>{data.studentCandidates.find(s=>s.id===i.student_id)?.student_code||"School student"}</td><td>{i.email}</td><td>{i.status}</td><td>{i.expires_at?.slice(0,10)}</td></tr>)}
     </tbody></table>{!data.studentInvites.length&&<Blank title="No student invitations" description="Approved student invitations will appear here."/>}</div></section>
     <section className="cr-panel"><h3>School-verified student accounts</h3><div className="table-wrap"><table><thead><tr><th>Student</th><th>Access status</th><th>Action</th></tr></thead><tbody>
      {data.studentAccounts.map(a=><tr key={a.student_id}>
       <td>{data.studentCandidates.find(s=>s.id===a.student_id)?.student_code||"School student"}</td>
       <td>{a.active?"Active student account":"Access revoked"}</td>
       <td>{a.active&&<button className="button secondary small" onClick={()=>open("revokeStudent",{studentId:a.student_id,reason:""})}>Revoke account</button>}</td>
      </tr>)}</tbody></table>
      {!data.studentAccounts.length&&<Blank title="No activated student accounts" description="Students must use their verified invitation before an account becomes active."/>}</div></section></>}
  <p className="ds-foot">School ID {school.code} · Only approved classes and members are shown.</p>
  {modal&&<Modal title={({assign:"Assign a teacher",revoke:"Revoke teaching assignment",lesson:"Create lesson plan",homework:"Create homework draft",studentInvite:"Authorize student account",revokeStudent:"Revoke student account",grade:"Grade homework submission",material:"Add learning material"})[modal]} close={()=>{setModal(null);setError("");}}>
   {error&&<div className="notice error" role="alert">{error}</div>}
   {modal==="material"&&<form onSubmit={e=>{e.preventDefault();submit({action:"material.create",classId:form.classId,subjectId:form.subjectId,
     kind:form.kind||"video",title:form.title||"",url:form.url||"",description:form.description||""});}}>
    <Label name="Assigned subject"><select className="input" value={form.subjectId||""} onChange={e=>setForm({...form,subjectId:e.target.value})}>
     {myAssignmentsClass.map(a=><option key={a.subject_id} value={a.subject_id}>{subjectLabel(a.subject_id)}</option>)}</select></Label>
    <Label name="Type"><select className="input" value={form.kind||"video"} onChange={e=>setForm({...form,kind:e.target.value})}>
     <option value="video">Video (YouTube, Vimeo, TikTok or Facebook)</option><option value="link">Web link</option><option value="document">Document link (Google Drive and similar)</option></select></Label>
    <Label name="Title"><input className="input" required minLength={3} maxLength={160} value={form.title||""} onChange={e=>setForm({...form,title:e.target.value})}/></Label>
    <Label name="Web link (starts with https://)"><input className="input" type="url" required maxLength={500} value={form.url||""} onChange={e=>setForm({...form,url:e.target.value})}/></Label>
    <Label name="Short description (optional)"><textarea className="input" maxLength={1000} value={form.description||""} onChange={e=>setForm({...form,description:e.target.value})}/></Label>
    <p className="muted">The material is saved hidden. Switch it on when you want students to see it.</p>
    <button className="button" disabled={busy} type="submit">Save material</button></form>}
   {modal==="grade"&&<form onSubmit={e=>{e.preventDefault();submit({action:"submission.grade",submissionId:form.submissionId,score:form.score,maxScore:form.maxScore,feedback:form.feedback||""});}}>
<Label name="Score (leave empty to give feedback only)"><input className="input" type="number" min="0" step="0.5" value={form.score??""} onChange={e=>setForm({...form,score:e.target.value})}/></Label>
<Label name="Maximum mark"><input className="input" type="number" min="1" max="1000" step="0.5" value={form.maxScore??""} onChange={e=>setForm({...form,maxScore:e.target.value})}/></Label>
<Label name="Feedback to the student"><textarea className="input" maxLength={2000} value={form.feedback||""} onChange={e=>setForm({...form,feedback:e.target.value})}/></Label>
<div className="notice info">The student will see this grade and feedback in their own workspace.</div>
<button className="button" disabled={busy}>Save grade</button></form>}
{modal==="assign"&&<form onSubmit={e=>{e.preventDefault();submit({action:"teacher.assign",teacherId:form.teacherId,classId:form.classId,subjectId:form.subjectId});}}>
    <Label name="Verified school teacher"><select className="input" value={form.teacherId||""} onChange={e=>setForm({...form,teacherId:e.target.value})}>{teachers.map(t=><option key={t.userId} value={t.userId}>{t.email}</option>)}</select></Label>
    <Label name="Current-year class"><select className="input" value={form.classId||""} onChange={e=>{const cls=e.target.value;setForm({...form,classId:cls,subjectId:mappings.find(m=>m.class_id===cls)?.subject_id||""});}}>
     {classes.map(c=><option key={c.id} value={c.id}>{classLabel(c.id)}</option>)}</select></Label>
    <Label name="Subject already assigned to class"><select className="input" value={form.subjectId||""} onChange={e=>setForm({...form,subjectId:e.target.value})}>
     {eligibleSubjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Label>
    <div className="notice info">The teacher must accept their school invitation first. Assignment requires MFA and affects this school only.</div>
    <button className="button" type="submit" disabled={busy||!form.subjectId}>Assign teacher</button>
   </form>}
   {modal==="revoke"&&<form onSubmit={e=>{e.preventDefault();submit({action:"teacher.revoke",teacherId:form.assignment.teacher_id,
      classId:form.assignment.class_id,subjectId:form.assignment.subject_id,reason:form.reason});}}>
    <p>Remove this teacher's access to {classLabel(form.assignment.class_id)} · {subjectLabel(form.assignment.subject_id)}?</p>
    <Label name="Audit reason"><textarea className="input" required minLength={8} maxLength={500} value={form.reason||""} onChange={e=>setForm({...form,reason:e.target.value})}/></Label>
    <button className="button danger" type="submit" disabled={busy}>Revoke class assignment</button>
   </form>}
   {modal==="lesson"&&<form onSubmit={e=>{e.preventDefault();submit({action:"lesson.create",classId:form.classId,
     subjectId:form.subjectId,title:form.title,objectives:form.objectives||"",lessonOn:form.lessonOn});}}>
    <p className="muted">Private plan for your verified class. No publication to students in this initial lesson editor.</p>
    <Label name="Assigned subject"><select className="input" value={form.subjectId||""} onChange={e=>setForm({...form,subjectId:e.target.value})}>
     {myAssignmentsClass.map(a=><option key={a.subject_id} value={a.subject_id}>{subjectLabel(a.subject_id)}</option>)}</select></Label>
    <Label name="Lesson title"><input className="input" required minLength={3} maxLength={180} value={form.title||""} onChange={e=>setForm({...form,title:e.target.value})}/></Label>
    <Label name="Teaching objectives"><textarea className="input" maxLength={4000} value={form.objectives||""} onChange={e=>setForm({...form,objectives:e.target.value})}/></Label>
    <Label name="Lesson date"><input className="input" type="date" required value={form.lessonOn} onChange={e=>setForm({...form,lessonOn:e.target.value})}/></Label>
    <button className="button" disabled={busy} type="submit">Save lesson plan</button>
   </form>}
   {modal==="homework"&&<form onSubmit={e=>{e.preventDefault();const dueAt=form.dueLocal?new Date(form.dueLocal+":00+02:00").toISOString():"";
    submit({action:"homework.create",classId:form.classId,subjectId:form.subjectId,title:form.title,
      instructions:form.instructions,dueAt});}}>
    <Label name="Assigned subject"><select className="input" value={form.subjectId||""} onChange={e=>setForm({...form,subjectId:e.target.value})}>
     {myAssignmentsClass.map(a=><option key={a.subject_id} value={a.subject_id}>{subjectLabel(a.subject_id)}</option>)}</select></Label>
    <Label name="Homework title"><input className="input" required minLength={3} maxLength={180} value={form.title||""} onChange={e=>setForm({...form,title:e.target.value})}/></Label>
    <Label name="Instructions"><textarea className="input" required maxLength={5000} value={form.instructions||""} onChange={e=>setForm({...form,instructions:e.target.value})}/></Label>
    <Label name="Due date and time (Rwanda, UTC+02:00)"><input className="input" required type="datetime-local" value={form.dueLocal||""} onChange={e=>setForm({...form,dueLocal:e.target.value})}/></Label>
    <p className="muted">Save as a draft. Students will not see it until you select Publish on the homework card.</p>
    <button className="button" disabled={busy} type="submit">Save homework draft</button>
   </form>}
   {modal==="revokeStudent"&&<form onSubmit={e=>{e.preventDefault();submit({
     action:"student.revoke",studentId:form.studentId,reason:form.reason
    });}}>
    <p>Disable this student's independent access to your school. Their academic records will remain intact.</p>
    <Label name="Required audit reason"><textarea className="input" required minLength={8} maxLength={500}
      value={form.reason||""} onChange={e=>setForm({...form,reason:e.target.value})}/></Label>
    <div className="notice info">This action requires school-owner MFA. The student's verified link will stop authorizing new requests immediately.</div>
    <button type="submit" className="button danger" disabled={busy}>Revoke student account</button>
   </form>}
   {modal==="studentInvite"&&<form onSubmit={e=>{e.preventDefault();submit({action:"student.invite",
     studentId:form.studentId,email:form.email,consentAttested:form.consentAttested});}}>
    <Label name="Approved enrolled student"><select className="input" value={form.studentId||""} onChange={e=>setForm({...form,studentId:e.target.value})}>
     {data.studentCandidates.map(st=><option key={st.id} value={st.id}>{st.student_code} · {st.first_name} {st.last_name}</option>)}</select></Label>
    <Label name="Student's school-approved account email"><input className="input" required type="email" value={form.email||""} onChange={e=>setForm({...form,email:e.target.value})}/></Label>
    <label className="cr-check"><input type="checkbox" required checked={!!form.consentAttested} onChange={e=>setForm({...form,consentAttested:e.target.checked})}/>
      I have verified student identity and confirmed the appropriate guardian approval or adult authorization under school policy.</label>
    <div className="notice info">Children under 18 or whose birth dates are unknown need an active verified guardian link. No automatic nursery accounts. This requires your MFA.</div>
    <button className="button" type="submit" disabled={busy||!form.consentAttested}>Issue student invitation</button>
   </form>}
  </Modal>}
 </DashboardShell>;
}
