"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";

const kigaliToday=()=>new Date().toLocaleDateString("sv-SE",{timeZone:"Africa/Kigali"});
const kind=(role)=>role==="manage"?"School Management":"Teacher Classroom";
function Field({label,children}){return <label className="field" style={{marginBottom:14}}><strong>{label}</strong>{children}</label>}
function Notice({message,type}){return message?<div role={type==="error"?"alert":"status"} className={"notice "+(type==="error"?"error":"ok")}>{message}</div>:null;}
function Empty({title,description}){return <div className="class-empty"><strong>{title}</strong><p>{description}</p></div>}
function Modal({title,close,children}){return <div className="class-overlay" onClick={e=>{if(e.target===e.currentTarget)close();}}><div className="class-modal" role="dialog" aria-label={title} aria-modal="true"><div className="row" style={{justifyContent:"space-between",marginBottom:16}}><h2>{title}</h2><button className="button secondary small" onClick={close}>✕</button></div>{children}</div></div>}

export default function TeachingConsole({code}){
 const [client,setClient]=useState(null),[ready,setReady]=useState(false),[session,setSession]=useState(null);
 const [mode,setMode]=useState("teacher"),[data,setData]=useState(null),[loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
 const [modal,setModal]=useState(null),[form,setForm]=useState({}),[selected,setSelected]=useState("");
 const [tab,setTab]=useState("overview"),[day,setDay]=useState(kigaliToday());
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  setMode(params.get("mode")==="manage"?"manage":"teacher");
  const c=browserSupabase();setClient(c);
  if(!c){setReady(true);setLoading(false);return;}
  let mounted=true;
  c.auth.getSession().then(({data})=>{if(mounted){setSession(data.session);setReady(true);}});
  const {data:{subscription}}=c.auth.onAuthStateChange((_e,s)=>{if(mounted)setSession(s);});
  return ()=>{mounted=false;subscription.unsubscribe();};
 },[]);
 const request=useCallback(async(payload)=>{
  if(!client)throw Error("School authentication is unavailable");
  const {data:{session:current}}=await client.auth.getSession();
  if(!current)throw Error("Please sign in to your school again");
  const query=mode==="manage"?"?mode=manage":"?mode=teacher";
  const res=await fetch("/api/school/"+code+"/classroom"+query,{
   method:payload?"POST":"GET",cache:"no-store",
   headers:{"Authorization":"Bearer "+current.access_token,...(payload?{"Content-Type":"application/json"}:{})},
   ...(payload?{body:JSON.stringify(payload)}:{})
  });
  const json=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(json.error||"Classroom request failed");
  return json;
 },[client,code,mode]);
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const d=await request();setData(d);
   if(d.mode==="teacher"&&d.assignments.length){
    setSelected(old=>d.assignments.some(a=>a.id===old)?old:d.assignments[0].id);
   }
  }catch(e){setError(e.message);}
  finally{setLoading(false);}
 },[request]);
 useEffect(()=>{if(!ready)return;if(!session){setLoading(false);setData(null);return;}refresh();},[ready,session?.user?.id,refresh]);
 async function action(body){
  setBusy(true);setError("");setNotice("");
  try{
   const result=await request(body);
   setModal(null);setForm({});
   setNotice(body.action==="student.invite"?
    "Student invitation saved. "+(result.result?.mailStatus==="provider_accepted"?"Email provider accepted the invitation, but delivery is not yet confirmed.":"The school may share its verified student-login link; email delivery was not confirmed."):
    "School classroom record saved.");
   await refresh();
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 const chooseModal=(name,obj={})=>{setModal(name);setForm(obj);setError("");setNotice("");};
 if(!ready||loading)return <main className="school-admin-loading">Opening {kind(mode).toLowerCase()}…</main>;
 if(!session)return <main className="school-admin-loading"><h1>School sign-in required</h1><a className="button" href={"/s/"+code+"/login?role="+(mode==="teacher"?"teacher":"school_admin")}>Sign in</a></main>;
 if(error&&!data)return <main className="school-admin-loading"><h1>Classroom access unavailable</h1><p role="alert">{error}</p><a href={"/s/"+code+"/portal?role=teacher"}>Return to your school portal</a></main>;
 if(!data)return <main className="school-admin-loading">No classroom records available.</main>;
 const school=data.school,manage=mode==="manage";
 const assignment=data.assignments.find(a=>a.id===selected);
 const cls=data.classes.find(c=>c.id===assignment?.class_id);
 const subject=data.subjects.find(s=>s.id===assignment?.subject_id);
 const enrollments=data.enrollments?.filter(e=>e.class_id===cls?.id)||[];
 const roster=(data.roster||[]).filter(stu=>enrollments.some(e=>e.student_id===stu.id));
 const homework=(data.homework||[]).filter(x=>x.assignment_id===assignment?.id);
 const lessons=(data.lessons||[]).filter(x=>x.assignment_id===assignment?.id);
 const submissions=(data.submissions||[]).filter(x=>homework.some(h=>h.id===x.homework_id));
 const teacherName=(id)=>data.teachers.find(t=>t.id===id)?.email||"Verified school teacher";
 const className=(id)=>{const c=data.classes.find(x=>x.id===id);return c?c.name+(c.section?" · "+c.section:""):"School class";};
 const subjectName=(id)=>data.subjects.find(x=>x.id===id)?.name||"Subject";
 const todayAttendance=(enrollmentId)=>data.attendance?.find(x=>x.enrollment_id===enrollmentId&&x.attendance_on===day);
 const tabs=manage?["overview","teachers","students"]:["overview","lessons","homework","attendance","submissions"];
 return <main className="class-shell" style={{"--school-color":"#204a78"}}>
   <header className="class-header"><div><span className="class-eyebrow">PRIVATE SCHOOL WORKSPACE</span><h1>{school.name}</h1>
      <p>{kind(mode)} · {data.currentYear?.name||"No current academic year configured"}</p></div>
     <div className="class-header-links"><a href={"/s/"+code+"/admin"}>School Administration</a>
       <a href={"/s/"+code}>School Website</a></div>
   </header>
   <div className="class-body">
     <aside className="class-nav"><strong>{manage?"School Setup":"My Teaching"}</strong>
       {tabs.map(t=><button key={t} className={tab===t?"selected":""} onClick={()=>setTab(t)}>{t==="teachers"?"Teacher Assignments":t==="students"?"Student Invitations":t==="submissions"?"Homework Responses":t[0].toUpperCase()+t.slice(1)}</button>)}
       <small>Only verified school users and approved classes are shown.</small>
     </aside>
     <section className="class-content">
       <div className="class-intro"><span>MODULE 4 · {manage?"SCHOOL LEARNING MANAGEMENT":"TEACHER PORTAL"}</span>
          <h2>{manage?"Teaching Assignments & Student Access":"My Classroom"}</h2>
          <p>{manage?"Assign approved teachers to their classes and invite eligible students with verified guardian consent.":"Manage only your approved classes, lessons, homework, attendance and student submissions."}</p></div>
       <Notice message={error} type="error"/><Notice message={notice}/>
       {data.limited&&<div className="notice info">This first release limits each table to recent records. Full pagination is required before large-school production use.</div>}
       {manage?<>
         <div className="class-metrics">
           <div><span>Assigned teachers</span><strong>{data.teachers?.length||0}</strong></div>
           <div><span>Class subject links</span><strong>{data.classSubjects?.length||0}</strong></div>
           <div><span>Active assignments</span><strong>{data.assignments?.filter(x=>x.active).length||0}</strong></div>
         </div>
         {["overview","teachers"].includes(tab)&&<article className="class-panel">
           <div className="class-panel-head"><div><h3>Teacher ↔ Class ↔ Subject</h3><p>Only approved teachers can be assigned to subjects offered by a current-year class.</p></div>
             {data.actor?.academicManager&&<button className="button" disabled={!data.teachers.length||!data.classes.length||!data.classSubjects.length} onClick={()=>chooseModal("assign",{teacherUserId:data.teachers[0]?.id||"",classId:data.classes[0]?.id||"",subjectId:""})}>+ Assign Teacher</button>}</div>
           <div className="table-wrap"><table><thead><tr><th>Teacher</th><th>Class</th><th>Subject</th><th>Active</th></tr></thead><tbody>
             {data.assignments.map(a=><tr key={a.id}><td>{teacherName(a.teacher_user_id)}</td>
             <td>{className(a.class_id)}</td><td>{subjectName(a.subject_id)}</td><td>{a.active?"Yes":"No"}</td></tr>)}
           </tbody></table>{!data.assignments.length&&<Empty title="No teacher assignments" description="Create a class and subject, approve a teacher account, then assign them here."/>}</div>
         </article>}
         {["overview","students"].includes(tab)&&data.actor?.studentAccessManager&&<article className="class-panel">
           <div className="class-panel-head"><div><h3>Student portal invitation</h3><p>Student accounts are optional and must first have a verified guardian link and the school's consent confirmation.</p></div>
             <button className="button secondary" disabled={!data.students.length} onClick={()=>chooseModal("studentInvite",{studentId:data.students[0]?.id||"",guardianConsentAttested:false})}>+ Invite Student</button></div>
           <p className="muted">A student cannot join by entering a School ID or selecting Student on the login screen. Student accounts are not enabled automatically for nursery or young learners.</p>
           {data.students.length?<div className="table-wrap"><table><thead><tr><th>Student ID</th><th>Student</th><th>Invitation</th></tr></thead><tbody>
             {data.students.map(s=><tr key={s.id}><td><kbd>{s.student_code}</kbd></td>
                <td>{s.first_name} {s.last_name}</td>
                <td><button className="button secondary small" onClick={()=>chooseModal("studentInvite",{studentId:s.id,guardianConsentAttested:false})}>Request portal access</button></td></tr>)}
           </tbody></table></div>:<Empty title="No enrolled students" description="Complete admissions in Module 3 first."/>}
         </article>}
       </>:<>
         <div className="class-select-row"><label>My class and subject<select className="input" value={selected} onChange={e=>{setSelected(e.target.value);setError("");}}>
            {data.assignments.map(a=><option value={a.id} key={a.id}>{className(a.class_id)} · {subjectName(a.subject_id)}</option>)}</select></label>
           <span>{cls?.name||"No assigned class"} · {subject?.name||"Choose an assignment"}</span></div>
         {!assignment?<Empty title="No approved teaching assignments" description="Your school owner or authorized administrator must assign you to a current-year class and subject first."/>:<>
           <div className="class-metrics">
             <div><span>Enrolled pupils</span><strong>{roster.length}</strong></div>
             <div><span>Published lessons</span><strong>{lessons.length}</strong></div>
             <div><span>Homework tasks</span><strong>{homework.length}</strong></div>
             <div><span>Responses loaded</span><strong>{submissions.length}</strong></div>
           </div>
           {tab==="overview"&&<div className="class-panels">
             <article className="class-panel"><div className="class-panel-head"><h3>My students</h3><span>{cls?.name}</span></div>
                {roster.length?<div className="class-student-tags">{roster.map(s=><div key={s.id}><strong>{s.first_name} {s.last_name}</strong><small>{s.student_code}</small></div>)}</div>:
                 <Empty title="No students enrolled" description="The school must approve admissions and class placement before a teacher sees pupils."/>}
             </article>
             <article className="class-panel"><h3>Teaching actions</h3>
               <p>Create lessons or homework for your assigned class. Attendance and student responses remain private.</p>
               <div className="class-action-row"><button className="button" onClick={()=>chooseModal("lesson",{lessonOn:kigaliToday()})}>+ Publish Lesson</button>
                 <button className="button secondary" onClick={()=>chooseModal("homework",{dueOn:kigaliToday()})}>+ Homework</button>
                 <button className="button secondary" onClick={()=>setTab("attendance")}>Take Attendance</button></div>
             </article>
           </div>}
           {tab==="lessons"&&<article className="class-panel"><div className="class-panel-head"><h3>Published lessons</h3>
             <button className="button" onClick={()=>chooseModal("lesson",{lessonOn:kigaliToday()})}>+ New Lesson</button></div>
             {lessons.map(l=><div className="class-record" key={l.id}><div><strong>{l.title}</strong><small>Lesson date: {l.lesson_on}</small></div><p>{l.content}</p></div>)}
             {!lessons.length&&<Empty title="No lessons yet" description="Publish a real lesson for this assigned subject."/>}
           </article>}
           {tab==="homework"&&<article className="class-panel"><div className="class-panel-head"><h3>Class homework</h3>
             <button className="button" onClick={()=>chooseModal("homework",{dueOn:kigaliToday()})}>+ Assign Homework</button></div>
             {homework.map(h=><div className="class-record" key={h.id}><div><strong>{h.title}</strong><small>Due: {h.due_on}</small></div><p>{h.instructions}</p><span className="micro">{submissions.filter(s=>s.homework_id===h.id).length} responses loaded</span></div>)}
             {!homework.length&&<Empty title="No homework assigned" description="Publish an assignment with a due date for your students."/>}
           </article>}
           {tab==="attendance"&&<article className="class-panel"><div className="class-panel-head"><div><h3>Attendance register</h3><p>Only students enrolled in your assigned current-year class appear.</p></div>
               <label className="class-date-label">School date<input className="input" type="date" max={kigaliToday()} value={day} onChange={e=>setDay(e.target.value)}/></label></div>
             <div className="table-wrap"><table><thead><tr><th>Student ID</th><th>Student</th><th>Saved status</th><th>Mark attendance</th></tr></thead><tbody>
               {roster.map(s=>{const enrollment=enrollments.find(e=>e.student_id===s.id);
               const marked=todayAttendance(enrollment?.id);
               return <tr key={s.id}><td><kbd>{s.student_code}</kbd></td><td>{s.first_name} {s.last_name}</td><td>{marked?.state||"Not recorded"}</td>
                 <td><div className="class-attendance-actions">{["present","absent","late","excused"].map(state=>
                    <button className={"button small "+(marked?.state===state?"":"secondary")} key={state} disabled={busy}
                     onClick={()=>action({action:"attendance.record",assignmentId:selected,enrollmentId:enrollment.id,
                       attendanceOn:day,state})}>{state}</button>)}</div></td></tr>})}
             </tbody></table>{!roster.length&&<Empty title="No class roster" description="Students must be officially enrolled before attendance can be recorded."/>}</div>
           </article>}
           {tab==="submissions"&&<article className="class-panel"><h3>Homework responses</h3>
             <p className="muted">Only submissions made by students currently assigned to your authorized class are shown. This module does not grade or publish report cards.</p>
             {submissions.map(s=>{const stu=data.roster.find(x=>x.id===s.student_id);
               const task=homework.find(h=>h.id===s.homework_id);
               return <div className="class-record" key={s.id}><div><strong>{stu?stu.first_name+" "+stu.last_name:"School student"}</strong>
                 <small>{task?.title||"Homework"} · {s.submitted_at?.slice(0,10)}</small></div>
                 <p>{s.response_text}</p></div>})}
             {!submissions.length&&<Empty title="No student responses" description="Submissions will appear after students use their approved accounts."/>}
           </article>}
         </>}
       </>}
     </section>
   </div>
   {modal&&<Modal title={({assign:"Assign a teacher",studentInvite:"Approve student portal account",lesson:"Publish a lesson",homework:"Assign homework"})[modal]} close={()=>{setModal(null);setError("");}}>
      {error&&<Notice message={error} type="error"/>}
      {modal==="assign"&&<form onSubmit={e=>{e.preventDefault();action({action:"teacher.assign",
        classId:form.classId,subjectId:form.subjectId,teacherUserId:form.teacherUserId});}}>
        <p className="muted">Assignments are valid only for a school-approved teacher, a current-year class and a subject that class offers. MFA required.</p>
        <Field label="Approved teacher"><select required className="input" value={form.teacherUserId||""} onChange={e=>setForm({...form,teacherUserId:e.target.value})}><option value="">Choose teacher</option>{data.teachers.map(t=><option value={t.id} key={t.id}>{t.email||"Teacher account "+t.id.slice(0,8)}</option>)}</select></Field>
        <Field label="Current-year class"><select required className="input" value={form.classId||""} onChange={e=>{
           const classId=e.target.value;const first=data.classSubjects.find(x=>x.class_id===classId);
           setForm({...form,classId,subjectId:first?.subject_id||""});
        }}><option value="">Choose class</option>{data.classes.filter(c=>c.status==="active").map(c=><option value={c.id} key={c.id}>{className(c.id)}</option>)}</select></Field>
        <Field label="Class subject"><select required className="input" value={form.subjectId||""} onChange={e=>setForm({...form,subjectId:e.target.value})}><option value="">Choose assigned subject</option>{data.classSubjects.filter(x=>x.class_id===form.classId).map(x=><option key={x.subject_id} value={x.subject_id}>{subjectName(x.subject_id)}</option>)}</select></Field>
        <button className="button" type="submit" disabled={busy||!form.teacherUserId||!form.classId||!form.subjectId}>Assign with MFA</button>
      </form>}
      {modal==="studentInvite"&&<form onSubmit={e=>{e.preventDefault();action({action:"student.invite",studentId:form.studentId,email:form.email,
        guardianConsentAttested:form.guardianConsentAttested});}}>
        <p className="muted">The school must already have a verified active guardian link and confirm age-appropriate permission for this student to operate an individual account. No automatic accounts for young pupils.</p>
        <Field label="Enrolled student"><select required className="input" value={form.studentId||""} onChange={e=>setForm({...form,studentId:e.target.value})}><option value="">Choose enrolled student</option>{data.students.map(s=><option key={s.id} value={s.id}>{s.student_code} · {s.first_name} {s.last_name}</option>)}</select></Field>
        <Field label="Verified student's own email"><input required className="input" type="email" value={form.email||""} onChange={e=>setForm({...form,email:e.target.value})}/></Field>
        <label className="class-attestation"><input type="checkbox" required checked={!!form.guardianConsentAttested} onChange={e=>setForm({...form,guardianConsentAttested:e.target.checked})}/>
           School confirms the guardian approved this student's independent account, and it is suitable under the school's child-protection policies.</label>
        <button type="submit" disabled={busy||!form.guardianConsentAttested} className="button">Create student invitation</button>
      </form>}
      {modal==="lesson"&&<form onSubmit={e=>{e.preventDefault();action({action:"lesson.publish",assignmentId:selected,
        title:form.title,content:form.content,lessonOn:form.lessonOn});}}>
        <Field label="Lesson title"><input className="input" required minLength={3} maxLength={160} value={form.title||""} onChange={e=>setForm({...form,title:e.target.value})}/></Field>
        <Field label="Lesson date"><input className="input" required type="date" value={form.lessonOn||""} onChange={e=>setForm({...form,lessonOn:e.target.value})}/></Field>
        <Field label="Lesson content"><textarea className="input" rows={6} minLength={3} maxLength={5000} required value={form.content||""} onChange={e=>setForm({...form,content:e.target.value})}/></Field>
        <p className="micro">Published lessons immediately appear in enrolled students' current-year learning workspace.</p>
        <button className="button" disabled={busy} type="submit">Publish lesson</button>
      </form>}
      {modal==="homework"&&<form onSubmit={e=>{e.preventDefault();action({action:"homework.publish",assignmentId:selected,
        title:form.title,instructions:form.instructions,dueOn:form.dueOn});}}>
        <Field label="Homework title"><input className="input" required minLength={3} maxLength={160} value={form.title||""} onChange={e=>setForm({...form,title:e.target.value})}/></Field>
        <Field label="Due date"><input className="input" required type="date" min={kigaliToday()} value={form.dueOn||""} onChange={e=>setForm({...form,dueOn:e.target.value})}/></Field>
        <Field label="Instructions"><textarea className="input" rows={6} minLength={3} maxLength={5000} required value={form.instructions||""} onChange={e=>setForm({...form,instructions:e.target.value})}/></Field>
        <p className="micro">Text homework only in this release; uploads, marking and grades are future modules.</p>
        <button className="button" disabled={busy} type="submit">Publish homework</button>
      </form>}
    </Modal>}
 </main>;
}
