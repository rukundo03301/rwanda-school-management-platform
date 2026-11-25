"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
import {DashboardShell,Stat,Ring,Bar,Card,Icon,greeting,todayLabel} from "../../../ui/DashboardShell.jsx";

function MiniStat({label,value}){return <div className="lr-stat"><small>{label}</small><strong>{value}</strong></div>}
export default function StudentLearning({code}){
 const [client,setClient]=useState(null),[ready,setReady]=useState(false),[session,setSession]=useState(null);
 const [loading,setLoading]=useState(true),[data,setData]=useState(null),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false),[tab,setTab]=useState("dashboard"),[search,setSearch]=useState(""),[responses,setResponses]=useState({});
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
 const signOut=async()=>{await client.auth.signOut();window.location.assign("/s/"+code+"/login?role=student");};
 if(!student)return <main className="school-admin-loading">
  {pendingInvitations.length>0&&<section className="lr-panel"><h2>Student account invitations</h2>
   <p className="muted">Your school has approved a pending invitation for your verified email account. Student identity stays hidden until you accept it.</p>
   {pendingInvitations.map(i=><div className="lr-invite" key={i.studentId}><div><strong>School-issued Student Invitation</strong><p>Expires {i.expiresAt?.slice(0,10)}</p></div>
    <button className="button" disabled={busy} onClick={()=>doAction({action:"student.claim",studentId:i.studentId,accepted:true},"Your school-approved student account is now active.")}>Accept student account</button>
   </div>)}</section>}
  <section className="lr-panel"><h2>Account not linked yet</h2>
   <p>A student workspace must be authorized by the school owner. If you have no invitation, contact your school; choosing Student on login does not grant access to another pupil's records.</p>
   <a href={"/s/"+code+"/login?role=student"}>Switch student account</a></section></main>;
 const submitMap=new Map(submissions.map(s=>[s.homework_id,s]));
 const pending=homework.filter(h=>!submitMap.has(h.id));
 const dueCount=pending.length;
 const hwById=new Map(homework.map(h=>[h.id,h]));
 const subjectName=id=>subjects.find(s=>s.id===id)?.name||"Class subject";
 const graded=submissions.filter(x=>x.score!==null&&x.score!==undefined&&Number(x.max_score)>0);
 const avg=graded.length?Math.round(graded.reduce((a,x)=>a+100*Number(x.score)/Number(x.max_score),0)/graded.length):null;
 const count=k=>attendance.filter(x=>x.status===k).length;
 const presentN=count("present"),lateN=count("late"),absentN=count("absent");
 const attPct=attendance.length?Math.round(100*(presentN+lateN)/attendance.length):null;
 const doneHw=homework.length?Math.round(100*submissions.length/homework.length):null;
 const parts=[doneHw,avg,attPct].filter(x=>x!==null);
 const overall=parts.length?Math.round(parts.reduce((a,b)=>a+b,0)/parts.length):null;
 const fmt=d=>new Date(d).toLocaleString("en-GB",{timeZone:"Africa/Kigali",day:"numeric",month:"short",year:"numeric"});
 const fmtFull=d=>new Date(d).toLocaleString("en-RW",{timeZone:"Africa/Kigali",dateStyle:"medium",timeStyle:"short"});
 const shownHomework=search?homework.filter(h=>(h.title+" "+subjectName(h.subject_id)).toLowerCase().includes(search.toLowerCase())):homework;
 const first=student.name.split(" ")[0];
 const nav=[
  {label:"Dashboard",icon:"home",active:tab==="dashboard",onClick:()=>{setSearch("");setTab("dashboard");}},
  {label:"My Subjects",icon:"book",active:tab==="subjects",onClick:()=>setTab("subjects")},
  {label:"Homework",icon:"check",active:tab==="homework",badge:dueCount,onClick:()=>setTab("homework")},
  {label:"Attendance",icon:"clock",active:tab==="attendance",onClick:()=>setTab("attendance")},
  {label:"Results & Grades",icon:"chart",href:"/s/"+code+"/report-card"},
  {label:"Learning Resources",icon:"folder",href:"/s/"+code+"/resources"},
  {label:"Messages & Events",icon:"chat",href:"/s/"+code+"/communications"},
 ];
 const tones=["blue","purple","orange","green","pink","red"];
 return <DashboardShell school={{...school,place:"Student workspace"}} title="Student Dashboard"
  user={{name:student.name,role:(activeClass?activeClass.name+(activeClass.section?" "+activeClass.section:"")+" Student":"Student")}}
  nav={nav} notifications={dueCount} onBell={()=>setTab("homework")}
  onSearch={q=>{setSearch(q);setTab("homework");}} searchPlaceholder="Search homework and subjects…"
  helpText="Contact your teacher or school office." onSignOut={signOut} portalHref={"/s/"+code+"/portal?role=student"}>
  <div className="ds-hello"><div><h2>{greeting()}, {first}!</h2><p>Welcome to your learning space at {school.name}.</p></div>
   <div className="ds-chips"><span className="ds-chip"><Icon name="calendar" size={18}/>{todayLabel()}</span>
    <span className="ds-chip blue">{academicYear?.name||"Academic year not set"}</span></div></div>
  {notice&&<div className="notice ok" role="status">{notice}</div>}
  {error&&<div className="notice error" role="alert">{error}</div>}
  {!activeClass?<div className="ds-panel"><h3>No current-year class enrollment</h3><p>Contact your school administration to confirm your current class before homework or attendance can appear.</p></div>:<>
  {tab==="dashboard"&&<>
   <div className="ds-grid">
    <div className="ds-stats ds-span8" style={{margin:0}}>
     <Stat icon="cap" tone="blue" value={subjects.length} label="Subjects"/>
     <Stat icon="check" tone="purple" value={dueCount} label="Homework Due"/>
     <Stat icon="trophy" tone="orange" value={avg===null?"—":avg+"%"} label="Average Grade"/>
     <Stat icon="calendar" tone="green" value={attPct===null?"—":attPct+"%"} label="Attendance"/>
    </div>
    <section className="ds-hero ds-span4">
     <h3>{dueCount?"Continue Learning":"You are all caught up"}</h3>
     <p>{dueCount?"Next up: "+pending[0].title+" ("+subjectName(pending[0].subject_id)+")":"No homework is waiting for you."}</p>
     {dueCount?<button onClick={()=>setTab("homework")}>Open homework</button>:<a href={"/s/"+code+"/resources"}>Learning resources</a>}
    </section>
   </div>
   <div className="ds-grid">
    <Card title="My Learning Progress" icon="chart">
     <div className="ds-split"><Ring value={overall} label="Overall"/>
      <div className="ds-bars"><Bar label="Homework submitted" value={doneHw} color="#1fa64a"/>
       <Bar label="Homework average" value={avg} color="#3b8df0"/><Bar label="Attendance" value={attPct} color="#f59e0b"/></div></div>
    </Card>
    <Card title="My Subjects" icon="book" link={<button className="ds-link" onClick={()=>setTab("subjects")}>View All →</button>}>
     {subjects.length?<ul className="ds-list">{subjects.slice(0,5).map((s,i)=><li key={s.id} className="ds-item">
      <span className={"ds-ico "+tones[i%tones.length]}><Icon name="book"/></span><div><strong>{s.name}</strong><small>{s.code}</small></div></li>)}</ul>
      :<p className="ds-empty">Your school has not assigned subjects to your class yet.</p>}
    </Card>
    <Card title="Upcoming Homework" icon="check" link={<button className="ds-link" onClick={()=>setTab("homework")}>View All →</button>}>
     {pending.length?<ul className="ds-list">{pending.slice(0,4).map(h=><li key={h.id} className="ds-item">
      <span className="ds-ico purple"><Icon name="check"/></span><div><strong>{h.title}</strong><small>{subjectName(h.subject_id)} · Due {fmt(h.due_at)}</small></div>
      <span className="ds-pill warn">Pending</span></li>)}</ul>:<p className="ds-empty">No homework is waiting for you.</p>}
    </Card>
   </div>
   <div className="ds-grid">
    <Card title="Recent Grades" icon="chart">
     {graded.length?<table className="ds-table"><thead><tr><th>Homework</th><th>Score</th><th>%</th></tr></thead><tbody>
      {graded.slice(0,5).map(x=>{const h=hwById.get(x.homework_id);const pct=Math.round(100*Number(x.score)/Number(x.max_score));
       return <tr key={x.homework_id}><td>{h?.title||"Homework"}</td><td>{Number(x.score)} / {Number(x.max_score)}</td><td><span className={"ds-pill "+(pct>=70?"good":pct>=50?"info":"warn")}>{pct}%</span></td></tr>;})}
     </tbody></table>:<p className="ds-empty">Your teachers have not graded any homework yet.</p>}
    </Card>
    <Card title="My Attendance" icon="calendar">
     <div className="ds-split"><Ring value={attPct} label="Present"/>
      <div className="ds-legend"><div><i className="ds-dot" style={{background:"#1fa64a"}}/>Present<b>{presentN} days</b></div>
       <div><i className="ds-dot" style={{background:"#f59e0b"}}/>Late<b>{lateN} days</b></div>
       <div><i className="ds-dot" style={{background:"#e5322d"}}/>Absent<b>{absentN} days</b></div></div></div>
     {!attendance.length&&<p className="ds-empty">No attendance has been recorded yet.</p>}
    </Card>
    <Card title="Reports & Resources" icon="folder">
     <div className="ds-actions" style={{gridTemplateColumns:"1fr"}}>
      <a className="ds-action blue" href={"/s/"+code+"/report-card"}><Icon name="chart"/>My Approved Reports</a>
      <a className="ds-action green" href={"/s/"+code+"/resources"}><Icon name="folder"/>Learning Resources</a>
      <a className="ds-action orange" href={"/s/"+code+"/communications"}><Icon name="calendar"/>Timetable & Notices</a>
     </div>
    </Card>
   </div>
  </>}
  {tab==="subjects"&&<section className="ds-panel"><h3>My current-year subjects</h3>
   {subjects.length?<ul className="ds-list">{subjects.map((s,i)=><li key={s.id} className="ds-item"><span className={"ds-ico "+tones[i%tones.length]}><Icon name="book"/></span><div><strong>{s.name}</strong><small>{s.code}</small></div></li>)}</ul>
    :<p className="ds-empty">Your school has not assigned subjects to your current class yet.</p>}</section>}
  {tab==="homework"&&<section className="ds-panel"><h3>Published homework{search&&" matching “"+search+"”"}</h3>
   <p className="muted">Only homework assigned to your enrolled class is visible. Your answers are private to you and your assigned teacher.</p>
   <div className="lr-homework-list">{shownHomework.map(h=>{
    const submitted=submitMap.get(h.id);
    return <article className="lr-homework" key={h.id}>
     <div className="lr-homework-top"><span className="cr-tag">{subjectName(h.subject_id)}</span>
      <span className={submitted?"lr-state good":"lr-state"}>{submitted?"Submitted":"Not submitted"}</span></div>
     <h3>{h.title}</h3><p>{h.instructions}</p>
     <small>Due {fmtFull(h.due_at)} (Rwanda)</small>
     {submitted?<div className="lr-submitted"><strong>Your submitted response</strong><p>{submitted.response_text}</p>
      <small>{submitted.is_late?"Submitted after due date · ":""}Submitted {new Date(submitted.submitted_at).toLocaleString("en-RW",{timeZone:"Africa/Kigali"})}</small>
      {submitted.graded_at&&<div className="lr-feedback"><strong>Teacher feedback{submitted.score!=null?" · "+Number(submitted.score)+" / "+Number(submitted.max_score):""}</strong>{submitted.feedback&&<p>{submitted.feedback}</p>}</div>}</div>:
     <div className="lr-answer">
      <label>My homework response<textarea className="input" maxLength={5000} value={responses[h.id]||""}
        onChange={e=>setResponses(old=>({...old,[h.id]:e.target.value}))}
        placeholder="Write your answer here. Check it before submitting, as this version accepts one submission." /></label>
      <button className="button" disabled={busy||!(responses[h.id]||"").trim()}
        onClick={()=>doAction({action:"homework.submit",homeworkId:h.id,responseText:responses[h.id]},"Homework submitted successfully.")}>Submit my homework</button>
     </div>}
    </article>;})}</div>
   {!shownHomework.length&&<p className="ds-empty">{search?"No homework matches your search.":"Your teacher has not published homework for this class yet."}</p>}
  </section>}
  {tab==="attendance"&&<section className="ds-panel"><h3>My attendance</h3>
   <p className="muted">Only your own school attendance records are displayed, as recorded by assigned teachers.</p>
   <table className="ds-table"><thead><tr><th>Rwanda school date</th><th>Status</th></tr></thead><tbody>
    {attendance.map((a,i)=><tr key={a.attendance_on+"#"+i}><td>{a.attendance_on}</td><td><span className={"ds-pill "+(a.status==="absent"?"bad":a.status==="late"?"warn":"good")}>{a.status}</span></td></tr>)}
   </tbody></table>
   {!attendance.length&&<p className="ds-empty">No attendance entries have been recorded for your current class yet.</p>}
  </section>}
  </>}
  <p className="ds-foot">Student ID {student.code} · Everything here belongs to your school and is linked to your own student account.</p>
 </DashboardShell>;
}
