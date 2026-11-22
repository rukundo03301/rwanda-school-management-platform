"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";

function MiniStat({label,value}){return <div className="lr-stat"><small>{label}</small><strong>{value}</strong></div>}
export default function StudentLearning({code}){
 const [client,setClient]=useState(null),[ready,setReady]=useState(false),[session,setSession]=useState(null);
 const [loading,setLoading]=useState(true),[data,setData]=useState(null),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false),[tab,setTab]=useState("homework"),[responses,setResponses]=useState({});
 useEffect(()=>{
  const c=browserSupabase();setClient(c);
  if(!c){setReady(true);setLoading(false);return;}
  let alive=true;
  c.auth.getSession().then(({data})=>{if(alive){setSession(data.session);setReady(true);}});
  const {data:{subscription}}=c.auth.onAuthStateChange((_e,s)=>{if(alive)setSession(s);});
  return ()=>{alive=false;subscription.unsubscribe();};
 },[]);
 const api=useCallback(async(body)=>{
  if(!client)throw Error("School student sign-in is not configured");
  const {data:{session:active}}=await client.auth.getSession();
  if(!active)throw Error("Sign in again to continue");
  const response=await fetch("/api/school/"+code+"/learning",{
   method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+active.access_token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
  const res=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(res.error||"Unable to load student learning");
  return res;
 },[client,code]);
 const reload=useCallback(async()=>{
  setLoading(true);
  try{setData(await api());setError("");}catch(e){setError(e.message);}
  finally{setLoading(false);}
 },[api]);
 useEffect(()=>{if(ready&&session)reload();else if(ready)setLoading(false);},[ready,session?.user?.id,reload]);
 async function doAction(body,success){
  setBusy(true);setError("");setNotice("");
  try{await api(body);setNotice(success);await reload();}
  catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 if(!ready||loading)return <main className="school-admin-loading">Opening your school learning workspace…</main>;
 if(!session)return <main className="school-admin-loading"><h2>Student school login required</h2>
  <p>Use the account explicitly authorized by your school.</p>
  <a className="button" href={"/s/"+code+"/login?role=student"}>Student sign-in</a></main>;
 if(error&&!data)return <main className="school-admin-loading"><h2>Student learning unavailable</h2><p role="alert">{error}</p>
  <a href={"/s/"+code+"/portal?role=student"}>Back to school</a></main>;
 if(!data)return <main className="school-admin-loading">No student records available.</main>;
 const {school,student,activeClass,academicYear,subjects,homework,submissions,attendance,pendingInvitations}=data;
 const submitMap=new Map(submissions.map(s=>[s.homework_id,s]));
 const dueCount=homework.filter(h=>!submitMap.has(h.id)).length;
 return <main className="lr-shell">
  <header className="lr-header"><div><a href={"/s/"+code}>School Homepage</a><strong>{school.name}</strong><span>My Student Workspace</span></div>
   <div><a href={"/s/"+code+"/portal?role=student"}>School Portal</a>
    <button className="button secondary small" onClick={async()=>{await client.auth.signOut();window.location.assign("/s/"+code+"/login?role=student");}}>Sign out</button></div></header>
  <div className="lr-content">
   <p className="cr-eyebrow">VERIFIED SCHOOL ACCOUNT · STUDENT PORTAL</p>
   <h1>{student?"Welcome, "+student.name:"Your School Learning Portal"}</h1>
   <p className="muted">Everything here belongs to your school and is linked to your actual student account.</p>
   {notice&&<div className="notice ok" role="status">{notice}</div>}
   {error&&<div className="notice error" role="alert">{error}</div>}
   {pendingInvitations.length>0&&<section className="lr-panel"><h2>Student account invitations</h2>
    <p className="muted">Your school has approved a pending invitation for your verified email account. Student identity stays hidden until you accept it.</p>
    {pendingInvitations.map(i=><div className="lr-invite" key={i.studentId}><div><strong>School-issued Student Invitation</strong><p>Expires {i.expiresAt?.slice(0,10)}</p></div>
     <button className="button" disabled={busy} onClick={()=>doAction({action:"student.claim",studentId:i.studentId,accepted:true},"Your school-approved student account is now active.")}>Accept student account</button>
    </div>)}
   </section>}
   {!student?<section className="lr-panel"><h2>Account not linked yet</h2>
    <p>A student workspace must be authorized by the school owner. If you have no invitation, contact your school; choosing Student on login does not grant access to another pupil's records.</p>
    <a href={"/s/"+code+"/login?role=student"}>Switch student account</a>
   </section>:<>
    <div className="lr-stats">
     <MiniStat label="My Student ID" value={student.code}/>
     <MiniStat label="Academic year" value={academicYear?.name||"Not configured"}/>
     <MiniStat label="Current class" value={activeClass?activeClass.name+(activeClass.section?" · "+activeClass.section:""):"Not enrolled"}/>
     <MiniStat label="Homework not submitted" value={dueCount}/>
    </div>
    {!activeClass?<div className="lr-panel"><h2>No current-year class enrollment</h2><p>Contact your school administration to confirm your current class before homework or attendance can appear.</p></div>:<>
     <nav className="lr-tabs" aria-label="Student learning sections">
      {["homework","subjects","attendance"].map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{({homework:"My Homework",subjects:"My Subjects",attendance:"My Attendance"})[t]}</button>)}
     </nav>
     {tab==="subjects"&&<section className="lr-panel"><h2>My current-year subjects</h2>
      <div className="lr-subjects">{subjects.map(s=><article key={s.id}><span>📚</span><strong>{s.name}</strong><small>{s.code}</small></article>)}</div>
      {!subjects.length&&<p className="muted">Your school has not assigned subjects to your current class yet.</p>}
      <p className="lr-note">Timetables, examination reports, grade publication and digital learning materials are separate later modules.</p>
     </section>}
     {tab==="homework"&&<section className="lr-panel"><h2>Published homework</h2>
      <p className="muted">Only homework assigned to your enrolled class is visible. Your answers are private to you and your assigned teacher.</p>
      <div className="lr-homework-list">{homework.map(h=>{
       const submitted=submitMap.get(h.id);
       const subject=subjects.find(s=>s.id===h.subject_id)?.name||"Class subject";
       return <article className="lr-homework" key={h.id}>
        <div className="lr-homework-top"><span className="cr-tag">{subject}</span>
         <span className={submitted?"lr-state good":"lr-state"}>{submitted?"Submitted":"Not submitted"}</span></div>
        <h3>{h.title}</h3><p>{h.instructions}</p>
        <small>Due {new Date(h.due_at).toLocaleString("en-RW",{timeZone:"Africa/Kigali",dateStyle:"medium",timeStyle:"short"})} (Rwanda)</small>
        {submitted?<div className="lr-submitted"><strong>Your submitted response</strong><p>{submitted.response_text}</p>
         <small>{submitted.is_late?"Submitted after due date · ":""}Submitted {new Date(submitted.submitted_at).toLocaleString("en-RW",{timeZone:"Africa/Kigali"})}</small></div>:
        <div className="lr-answer">
         <label>My homework response<textarea className="input" maxLength={5000} value={responses[h.id]||""}
           onChange={e=>setResponses(old=>({...old,[h.id]:e.target.value}))}
           placeholder="Write your answer here. Check it before submitting, as this version accepts one submission." /></label>
         <button className="button" disabled={busy||!(responses[h.id]||"").trim()}
           onClick={()=>doAction({action:"homework.submit",homeworkId:h.id,responseText:responses[h.id]},"Homework submitted successfully.")}>Submit my homework</button>
        </div>}
       </article>;
      })}</div>
      {!homework.length&&<p className="lr-empty">Your teacher has not published homework for this class yet.</p>}
     </section>}
     {tab==="attendance"&&<section className="lr-panel"><h2>My attendance</h2>
      <p className="muted">Only your own school attendance records are displayed, as recorded by assigned teachers.</p>
      <div className="table-wrap"><table><thead><tr><th>Rwanda school date</th><th>Status</th></tr></thead><tbody>
       {attendance.map((a,i)=><tr key={a.attendance_on+"#"+i}><td>{a.attendance_on}</td><td><span className="lr-attendance-status">{a.status}</span></td></tr>)}
      </tbody></table></div>
      {!attendance.length&&<p className="lr-empty">No attendance entries have been recorded for your current class yet.</p>}
     </section>}
    </>}
    <div className="lr-note"><div className="row">
        <a className="button secondary small" href={"/s/"+code+"/report-card"}>My Approved Reports</a>
        <a className="button secondary small" href={"/s/"+code+"/communications"}>My Class Timetable & Notices</a>
       </div>
       <p><strong>Not yet available:</strong> government-issued exam certificates, school-fee balances and direct student–teacher messages. Timetables and school calendar events now have their own authorized workspace.</p></div>
   </>}
  </div>
 </main>;
}
