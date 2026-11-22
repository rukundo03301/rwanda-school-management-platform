"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Kigali",
 year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const dt=(iso)=>new Date(iso).toLocaleString("en-RW",{timeZone:"Africa/Kigali",dateStyle:"medium",timeStyle:"short"});
export default function TeacherDashboard({code}){
 const [client,setClient]=useState(null),[session,setSession]=useState(null);
 const [data,setData]=useState(null),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const [tab,setTab]=useState("classes"),[assignmentId,setAssignmentId]=useState("");
 const [attendanceDate,setAttendanceDate]=useState(today()),[attendanceValues,setAttendanceValues]=useState({});
 const [lesson,setLesson]=useState({topic:"",objectives:"",date:today()});
 const [homework,setHomework]=useState({title:"",instructions:"",dueAt:""});
 useEffect(()=>{
  const c=browserSupabase();setClient(c);
  if(!c){setLoading(false);return;}
  c.auth.getSession().then(({data})=>setSession(data.session));
  const {data:{subscription}}=c.auth.onAuthStateChange((_e,s)=>setSession(s));
  return ()=>subscription.unsubscribe();
 },[]);
 const api=useCallback(async(body)=>{
  const {data:{session:s}}=await client.auth.getSession();
  if(!s)throw Error("Sign in with your verified school teacher account");
  const res=await fetch("/api/school/"+code+"/classroom",{
   method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+s.access_token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
  const j=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(j.error||"Classroom unavailable");return j;
 },[client,code]);
 const refresh=useCallback(async()=>{if(!client||!session)return;setLoading(true);
  try{
   const d=await api();setData(d);setError("");
   setAssignmentId(old=>d.assignments.some(a=>a.id===old)?old:(d.assignments[0]?.id||""));
  }catch(e){setError(e.message);}finally{setLoading(false);}
 },[client,session?.user?.id,api]);
 useEffect(()=>{if(client&&session)refresh();else if(client)setLoading(false);},[client,session?.user?.id,refresh]);
 const post=async(body)=>{
  setBusy(true);setError("");setNotice("");
  try{await api(body);setNotice("Saved in your school's classroom records.");await refresh();}
  catch(e){setError(e.message);}finally{setBusy(false);}
 };
 if(!client||loading)return <main className="school-admin-loading">Opening your classes…</main>;
 if(!session)return <main className="school-admin-loading"><h2>Teacher Sign-in</h2><a className="button" href={"/s/"+code+"/login?role=teacher"}>Sign in</a></main>;
 if(!data)return <main className="school-admin-loading"><h2>Teacher access unavailable</h2><p>{error}</p><a href={"/s/"+code+"/portal?role=teacher"}>Back to portal</a></main>;
 const active=data.assignments.find(a=>a.id===assignmentId);
 const cls=active?data.classes.find(c=>c.id===active.class_id):null;
 const subject=active?data.subjects.find(s=>s.id===active.subject_id):null;
 const year=active?data.academicYears.find(y=>y.id===active.academic_year_id):null;
 const roster=active?data.enrollments.filter(e=>e.class_id===active.class_id&&e.academic_year_id===active.academic_year_id):[];
 const studentMap=new Map(data.students.map(s=>[s.id,s]));
 const assignmentHomework=data.homework.filter(h=>h.teacher_assignment_id===assignmentId);
 const assignmentLessons=data.lessons.filter(l=>l.teacher_assignment_id===assignmentId);
 const recorded=(enrollmentId)=>data.attendance.find(r=>r.enrollment_id===enrollmentId&&r.attendance_on===attendanceDate);
 const selectStatus=(enrollmentId)=>attendanceValues[enrollmentId]||recorded(enrollmentId)?.attendance_status||"present";
 const saveAttendance=(enrollment)=>post({
   action:"attendance.mark",assignmentId,enrollmentId:enrollment.id,date:attendanceDate,
   status:selectStatus(enrollment.id),note:""
 });
 return <main className="tl-shell">
  <header className="tl-header"><a href={"/s/"+code+"/portal?role=teacher"}>← Teacher Portal</a>
   <strong>{data.school.name}</strong><span>My Classroom</span></header>
  <div className="tl-container">
   <p className="micro">VERIFIED TEACHER · SCHOOL-ASSIGNED ACCESS</p><h1>My Teaching Workspace</h1>
   <p className="muted">Lesson preparation, your assigned students, attendance and homework. Other teachers' private classes are not visible.</p>
   {error&&<div className="notice error" role="alert">{error}</div>}
   {notice&&<div className="notice ok" role="status">{notice}</div>}
   {data.assignments.length===0?<div className="tl-panel"><h2>No classes assigned yet</h2>
    <p>Your school administrator must assign you to a verified class and subject before you can see any student records.</p></div>:<>
   <section className="tl-panel tl-selector"><label className="field">My assigned class & subject
    <select className="input" value={assignmentId} onChange={e=>{setAssignmentId(e.target.value);setAttendanceValues({});}}>
     {data.assignments.map(a=>{const c=data.classes.find(x=>x.id===a.class_id),s=data.subjects.find(x=>x.id===a.subject_id);
       return <option key={a.id} value={a.id}>{c?.name||"Class"} · {s?.name||"Subject"}</option>})}
    </select></label><div><strong>{roster.length}</strong><small>Enrolled students shown</small>
      <span className="micro">{year?.name||"Academic Year"}</span></div>
   </section>
   <div className="tl-tabs" role="tablist" aria-label="Teacher workspace">
    {[["classes","My Students"],["attendance","Attendance"],["lessons","Lesson Plans"],["homework","Homework"]].map(([key,label])=>
     <button key={key} role="tab" aria-selected={tab===key} className={tab===key?"active":""} onClick={()=>setTab(key)}>{label}</button>)}
   </div>
   {tab==="classes"&&<section className="tl-panel"><h2>{cls?.name} · {subject?.name}</h2>
    <p className="muted">This list includes only currently enrolled students in your assigned class for {year?.name||"the school year"}.</p>
    <div className="table-wrap"><table><thead><tr><th>Student ID</th><th>Student</th><th>Class</th></tr></thead><tbody>
    {roster.map(e=>{const s=studentMap.get(e.student_id);return s&&<tr key={e.id}>
     <td><kbd>{s.student_code}</kbd></td><td>{s.first_name} {s.last_name}</td><td>{cls?.name}</td></tr>})}
    </tbody></table></div>{!roster.length&&<p>No enrolled students in this class yet.</p>}
   </section>}
   {tab==="attendance"&&<section className="tl-panel"><h2>Daily attendance</h2>
    <label className="field" style={{maxWidth:280}}>School date<input className="input" type="date" max={today()} value={attendanceDate}
      onChange={e=>{setAttendanceDate(e.target.value);setAttendanceValues({});}}/></label>
    <p className="muted">Select a status and save each student. Changes are audited by teacher ID and class.</p>
    <div className="table-wrap"><table><thead><tr><th>Student</th><th>Status</th><th>Action</th></tr></thead><tbody>
    {roster.map(e=>{const s=studentMap.get(e.student_id);return s&&<tr key={e.id}>
      <td><strong>{s.first_name} {s.last_name}</strong><div className="micro">{s.student_code}</div></td>
      <td><select className="input" aria-label={"Attendance for "+s.first_name}
       value={selectStatus(e.id)} onChange={event=>setAttendanceValues(v=>({...v,[e.id]:event.target.value}))}>
       <option value="present">Present</option><option value="absent">Absent</option>
       <option value="late">Late</option><option value="excused">Excused</option></select></td>
      <td><button className="button small" disabled={busy} onClick={()=>saveAttendance(e)}>Save</button></td>
    </tr>})}
    </tbody></table></div>{!roster.length&&<p>No active student enrollment found.</p>}
   </section>}
   {tab==="lessons"&&<section className="tl-panel"><h2>Lesson plans</h2>
    <form onSubmit={e=>{e.preventDefault();post({action:"lesson.create",assignmentId,title:lesson.topic,
      body:lesson.objectives,date:lesson.date});}}>
      <label className="field">Lesson date<input className="input" type="date" required value={lesson.date} onChange={e=>setLesson({...lesson,date:e.target.value})}/></label>
      <label className="field">Topic<input className="input" maxLength={140} minLength={3} required value={lesson.topic} onChange={e=>setLesson({...lesson,topic:e.target.value})}/></label>
      <label className="field">Objectives & teaching notes<textarea className="input" rows={4} maxLength={4000}
       value={lesson.objectives} onChange={e=>setLesson({...lesson,objectives:e.target.value})}/></label>
      <button className="button" disabled={busy} type="submit">Save lesson plan</button>
    </form><h3 style={{marginTop:25}}>Saved plans</h3>
    {assignmentLessons.map(l=><div key={l.id} className="tl-entry"><b>{l.topic}</b><small>{l.lesson_on}</small><p>{l.objectives}</p></div>)}
    {!assignmentLessons.length&&<p className="muted">No lesson plans for this assignment.</p>}
   </section>}
   {tab==="homework"&&<section className="tl-panel"><h2>Publish homework</h2>
    <p className="muted">Homework becomes visible only to students enrolled in this class, and their verified guardians.</p>
    <form onSubmit={e=>{e.preventDefault();post({action:"homework.create",assignmentId,title:homework.title,
      body:homework.instructions,date:new Date(homework.dueAt).toISOString()});}}>
      <label className="field">Homework title<input className="input" minLength={3} maxLength={140} required value={homework.title} onChange={e=>setHomework({...homework,title:e.target.value})}/></label>
      <label className="field">Instructions<textarea className="input" maxLength={4000} rows={5} value={homework.instructions} onChange={e=>setHomework({...homework,instructions:e.target.value})}/></label>
      <label className="field">Due date & time<input className="input" required type="datetime-local" value={homework.dueAt} onChange={e=>setHomework({...homework,dueAt:e.target.value})}/></label>
      <button className="button" type="submit" disabled={busy||!homework.dueAt}>Publish to assigned students</button>
    </form><h3 style={{marginTop:25}}>Published homework</h3>
    {assignmentHomework.map(h=><div className="tl-entry" key={h.id}><b>{h.title}</b><small>{dt(h.due_at)}</small>
      <p>{h.instructions}</p><div className="micro">{data.submissions.filter(s=>s.homework_id===h.id).length} loaded submission(s)</div>
    </div>)}
    {!assignmentHomework.length&&<p className="muted">No homework published for this class yet.</p>}
   </section>}
   </>}
  </div>
 </main>;
}
