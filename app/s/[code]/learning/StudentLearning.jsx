"use client";
import AssignmentTaker from "./AssignmentTaker.jsx";
import StudentMaterialFiles from "./StudentMaterialFiles.jsx";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
import {initialTab} from "../../../../lib/portal-nav.mjs";
import useTabParam from "../../../ui/useTabParam.js";
import {youtubeEmbed} from "../../../../lib/youtube-embed.mjs";
import {DashboardShell,Stat,Ring,Bar,Card,Icon,Item,greeting,todayLabel} from "../../../ui/DashboardShell.jsx";

function MiniStat({label,value}){return <div className="lr-stat"><small>{label}</small><strong>{value}</strong></div>}
export default function StudentLearning({code}){
 const [taking,setTaking]=useState(null);
 const [client,setClient]=useState(null),[ready,setReady]=useState(false),[session,setSession]=useState(null);
 const [loading,setLoading]=useState(true),[data,setData]=useState(null),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false),[tab,setTab]=useState(()=>initialTab(typeof window==="undefined"?"":location.search,["dashboard","subjects","timetable","homework","attendance","materials","events","profile","help"],"dashboard")),[search,setSearch]=useState(""),[com,setCom]=useState(null),[responses,setResponses]=useState({});
 useTabParam(["dashboard","subjects","timetable","homework","attendance","materials","events","profile","help"],setTab);
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
 const loadExtra=useCallback(async()=>{
  try{
   const {data:{session:active}}=await client.auth.getSession();
   const r=await fetch("/api/school/"+code+"/communications",{cache:"no-store",headers:{Authorization:"Bearer "+active.access_token}});
   setCom(r.ok?await r.json():null);
  }catch{setCom(null);}
 },[client,code]);
 useEffect(()=>{if(ready&&session){reload();loadExtra();}else if(ready)setLoading(false);},[ready,session?.user?.id,reload,loadExtra]);
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
 const {school,student,activeClass,academicYear,subjects,homework,submissions,attendance,pendingInvitations,materials=[]}=data;
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
 const hhmm=t=>String(t||"").slice(0,5);
 const wdMap={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7};
 const today=wdMap[new Intl.DateTimeFormat("en-US",{weekday:"short",timeZone:"Africa/Kigali"}).format(new Date())];
 const classIds=activeClass?[activeClass.id]:[];
 const courseHref=sid=>activeClass?"/s/"+code+"/courses?class="+activeClass.id+"&subject="+sid:"/s/"+code+"/courses";
 const periods=(com?.timetable||[]).filter(x=>!classIds.length||classIds.includes(x.class_id));
 const todayPeriods=periods.filter(x=>x.weekday===today);
 const events=(com?.events||[]).filter(e=>new Date(e.ends_at)>=new Date()).slice(0,4);
 const notices=(com?.announcements||[]).slice(0,3);
 const onReview=submissions.filter(x=>!x.graded_at);
 const completed=submissions.filter(x=>x.graded_at);
 const feedbackItems=completed.filter(x=>x.feedback||x.score!=null).slice(0,3);
 const attended=presentN+lateN;
 const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
 const nav=[
  {label:"Dashboard",icon:"home",active:tab==="dashboard",onClick:()=>{setSearch("");setTab("dashboard");}},
  {label:"My Classes & Subjects",icon:"book",active:tab==="subjects",onClick:()=>setTab("subjects")},
  {label:"My Timetable",icon:"calendar",active:tab==="timetable",onClick:()=>setTab("timetable")},
  {label:"Homework",icon:"check",active:tab==="homework",badge:dueCount,onClick:()=>setTab("homework")},
  {label:"Results & Grades",icon:"chart",href:"/s/"+code+"/report-card"},
  {label:"Attendance",icon:"clock",active:tab==="attendance",onClick:()=>setTab("attendance")},
  {label:"Report Cards",icon:"file",href:"/s/"+code+"/report-card"},
  {label:"Learning Resources",icon:"folder",active:tab==="materials",badge:0,onClick:()=>setTab("materials")},
  {label:"Messages",icon:"chat",href:"/s/"+code+"/communications"},
  {label:"School Events",icon:"megaphone",active:tab==="events",onClick:()=>setTab("events")},
  {label:"My Profile",icon:"user",active:tab==="profile",onClick:()=>setTab("profile")},
  {label:"Help & Support",icon:"help",active:tab==="help",onClick:()=>setTab("help")},
 ];
 const tones=["blue","purple","orange","green","pink","red"];
 return <DashboardShell code={code} school={{...school,place:"Student workspace"}} title="Student Dashboard"
  user={{name:student.name,role:(activeClass?activeClass.name+(activeClass.section?" "+activeClass.section:"")+" Student":"Student")}}
  nav={nav} notifications={dueCount} onBell={()=>setTab("homework")}
  onSearch={q=>{setSearch(q);setTab("homework");}} searchPlaceholder="Search homework and subjects…"
  helpText="Contact your teacher or school office." onSignOut={signOut} portalHref={"/s/"+code+"/portal?role=student"}>
  <section className="ds-banner"><div><h2>{greeting()}, {first}!</h2>
   <p>{dueCount?"You have "+dueCount+" homework "+(dueCount===1?"task":"tasks")+" to complete.":"You are all caught up with homework."} Welcome to your learning space at {school.name}.</p></div>
   <div className="ds-chips"><span className="ds-chip"><Icon name="calendar" size={18}/>{todayLabel()}</span>
    <span className="ds-chip blue">{academicYear?.name||"Academic year not set"}</span></div></section>
  {notice&&<div className="notice ok" role="status">{notice}</div>}
  {error&&<div className="notice error" role="alert">{error}</div>}
  {!activeClass?<div className="ds-panel"><h3>No current-year class enrollment</h3><p>Contact your school administration to confirm your current class before homework or attendance can appear.</p></div>:<>
  {tab==="dashboard"&&<div className="ds-grid">
   <div className="ds-span8" style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:14,alignContent:"start"}}>
    <div className="ds-stats" style={{margin:0}}>
     <Stat icon="clock" tone="blue" value={attendance.length?attended+"/"+attendance.length:"—"} label="Attendance (days)" onClick={()=>setTab("attendance")}/>
     <Stat icon="check" tone="purple" value={homework.length?submissions.length+"/"+homework.length:"—"} label="Homework done" onClick={()=>setTab("homework")}/>
     <Stat icon="trophy" tone="orange" value={avg===null?"—":avg+"%"} label="Homework average" onClick={()=>setTab("homework")}/>
     <Stat icon="cap" tone="green" value={subjects.length} label="Subjects" onClick={()=>setTab("subjects")}/>
    </div>
    <div className="ds-grid" style={{margin:0}}>
     <Card title="Today's Classes" icon="calendar" size="s6" link={<button className="ds-link" onClick={()=>setTab("timetable")}>Full timetable →</button>}>
      {todayPeriods.length?<ul className="ds-list">{todayPeriods.map((x,i)=><Item key={x.id} onClick={()=>setTab("timetable")}>
       <span className={"ds-ico "+tones[i%tones.length]}><Icon name="clock"/></span>
       <div><strong>{subjectName(x.subject_id)}</strong><small>{hhmm(x.starts_at)} to {hhmm(x.ends_at)}{x.room?" · Room "+x.room:""}</small></div></Item>)}</ul>
       :<p className="ds-empty">{periods.length?"No lessons are scheduled for today.":"Your school has not published a timetable for your class yet."}</p>}
     </Card>
     <Card title="Upcoming Events" icon="megaphone" size="s6" link={<button className="ds-link" onClick={()=>setTab("events")}>All events →</button>}>
      {events.length?<ul className="ds-list">{events.map(e=><Item key={e.id} onClick={()=>setTab("events")}>
       <span className="ds-ico orange"><Icon name="calendar"/></span>
       <div><strong>{e.title}</strong><small>{fmt(e.starts_at)}{e.location?" · "+e.location:""}</small></div></Item>)}</ul>
       :<p className="ds-empty">No upcoming events for your class.</p>}
     </Card>
    </div>
    <div className="ds-grid" style={{margin:0}}>
     <Card title="Teacher Feedback" icon="chat" size="s6" link={<button className="ds-link" onClick={()=>setTab("homework")}>Homework →</button>}>
      {feedbackItems.length?<ul className="ds-list">{feedbackItems.map(x=><Item key={x.homework_id} onClick={()=>setTab("homework")}>
       <span className="ds-ico green"><Icon name="chat"/></span>
       <div><strong>{hwById.get(x.homework_id)?.title||"Homework"}{x.score!=null?" · "+Number(x.score)+" / "+Number(x.max_score):""}</strong>
        <small>{x.feedback||"Graded by your teacher."}</small></div></Item>)}</ul>
       :<p className="ds-empty">Feedback from your teachers will appear here after they grade your work.</p>}
     </Card>
     <Card title="My Progress" icon="chart" size="s6" link={<a href={"/s/"+code+"/report-card"}>Go to report →</a>}>
      <div className="ds-split"><Ring value={overall} label="Overall" href={"/s/"+code+"/report-card"}/>
       <div className="ds-bars"><Bar label="Homework submitted" value={doneHw} color="#1fa64a" href={"/s/"+code+"/learning?tab=homework"}/>
        <Bar label="Homework average" value={avg} color="#3b8df0" href={"/s/"+code+"/learning?tab=homework"}/><Bar label="Attendance" value={attPct} color="#f59e0b" href={"/s/"+code+"/learning?tab=attendance"}/></div></div>
     </Card>
    </div>
    <div className="ds-grid" style={{margin:0}}>
     <Card title="My Courses" icon="book" size="s4" link={<a className="ds-link" href={"/s/"+code+"/courses"}>All courses →</a>}>
      {subjects.length?<ul className="ds-list">{subjects.slice(0,5).map((x,i)=><Item key={x.id} href={courseHref(x.id)}>
       <span className={"ds-ico "+tones[i%tones.length]}><Icon name="book"/></span><div><strong>{x.name}</strong><small>{x.code}</small></div></Item>)}</ul>
       :<p className="ds-empty">Your school has not assigned subjects to your class yet.</p>}
     </Card>
     <Card title="My Attendance" icon="clock" size="s4" link={<button className="ds-link" onClick={()=>setTab("attendance")}>Open →</button>}>
      <div className="ds-split"><Ring value={attPct} label="Present" onClick={()=>setTab("attendance")}/>
       <div className="ds-legend"><div><i className="ds-dot" style={{background:"#1fa64a"}}/>Present<b>{presentN}</b></div>
        <div><i className="ds-dot" style={{background:"#f59e0b"}}/>Late<b>{lateN}</b></div>
        <div><i className="ds-dot" style={{background:"#e5322d"}}/>Absent<b>{absentN}</b></div></div></div>
      {!attendance.length&&<p className="ds-empty">No attendance recorded yet.</p>}
     </Card>
     <Card title="School Notices" icon="megaphone" size="s4" link={<a href={"/s/"+code+"/communications?tab=announcements"}>All →</a>}>
      {notices.length?<ul className="ds-list">{notices.map(n=><Item key={n.id} href={"/s/"+code+"/communications?tab=announcements&notice="+n.id}>
       <span className="ds-ico blue"><Icon name="megaphone"/></span><div><strong>{n.title}</strong><small>{fmt(n.published_at)}</small></div></Item>)}</ul>
       :<p className="ds-empty">No notices right now.</p>}
     </Card>
    </div>
   </div>
   <Card title="Homework Progress" icon="check" size="s4">
    <h4 className="ds-sec">To do ({pending.length})</h4>
    {pending.length?<ul className="ds-list">{pending.slice(0,6).map(h=><Item key={h.id} onClick={()=>setTab("homework")}>
     <span className="ds-ico purple"><Icon name="check"/></span><div><strong>{h.title}</strong><small>{subjectName(h.subject_id)} · Due {fmt(h.due_at)}{h.due_at&&new Date(h.due_at)<new Date()?<b style={{color:"#c0392b"}}> · overdue</b>:null}</small></div></Item>)}</ul>
     :<p className="ds-empty">Nothing to do.</p>}
    <h4 className="ds-sec">On review ({onReview.length})</h4>
    {onReview.length?<ul className="ds-list">{onReview.slice(0,4).map(x=><Item key={x.homework_id} onClick={()=>setTab("homework")}>
     <span className="ds-ico orange"><Icon name="clock"/></span><div><strong>{hwById.get(x.homework_id)?.title||"Homework"}</strong><small>Waiting for your teacher</small></div></Item>)}</ul>
     :<p className="ds-empty">Nothing waiting for review.</p>}
    <h4 className="ds-sec">Completed ({completed.length})</h4>
    {completed.length?<ul className="ds-list">{completed.slice(0,4).map(x=><Item key={x.homework_id} onClick={()=>setTab("homework")}>
     <span className="ds-ico green"><Icon name="check"/></span><div><strong>{hwById.get(x.homework_id)?.title||"Homework"}</strong><small>{x.score!=null?Number(x.score)+" / "+Number(x.max_score):"Graded"}</small></div></Item>)}</ul>
     :<p className="ds-empty">No graded homework yet.</p>}
   </Card>
  </div>}
  {tab==="materials"&&<section className="ds-panel"><h3>Learning Resources</h3>
   <p className="muted">Videos and links your teachers have switched on for your class.</p>
   {materials.length?<div className="ds-materials">{materials.map(m=>{const embed=m.kind==="video"?youtubeEmbed(m.url):null;
    return <article key={m.id} className="ds-material">
     {embed&&<iframe src={embed} title={m.title} loading="lazy" allow="encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>}
     <span className="ds-pill info" style={{marginLeft:0}}>{subjectName(m.subject_id)}</span>
     <h4>{m.title}</h4>{m.description&&<p>{m.description}</p>}
     <a className="ds-action blue" href={m.url} target="_blank" rel="noopener noreferrer">{m.kind==="video"?"Watch":"Open"}</a>
    </article>;})}</div>
    :<p className="ds-empty">Your teachers have not added learning resources for your class yet.</p>}
   <StudentMaterialFiles code={code} subjectName={subjectName}/>
   <p style={{marginTop:14}}><a href={"/s/"+code+"/resources"}>School learning library →</a></p>
  </section>}
  {tab==="timetable"&&<section className="ds-panel"><h3>My weekly timetable</h3>
   {periods.length?<div className="ds-week">{days.slice(0,6).map((d,i)=><div key={d} className={"ds-day"+(i+1===today?" now":"")}>
    <strong>{d}</strong>{periods.filter(x=>x.weekday===i+1).map(x=><div key={x.id} className="ds-slot">
     <b>{subjectName(x.subject_id)}</b><span>{hhmm(x.starts_at)} to {hhmm(x.ends_at)}</span>{x.room&&<span>Room {x.room}</span>}</div>)}
    {!periods.some(x=>x.weekday===i+1)&&<p className="ds-empty">No lessons</p>}</div>)}</div>
    :<p className="ds-empty">Your school has not published a timetable for your class yet.</p>}
  </section>}
  {tab==="events"&&<section className="ds-panel"><h3>School events and notices</h3>
   <h4 className="ds-sec">Events</h4>
   {events.length?<ul className="ds-list">{events.map(e=><Item key={e.id} onClick={()=>setTab("events")}><span className="ds-ico orange"><Icon name="calendar"/></span>
    <div><strong>{e.title}</strong><small>{fmtFull(e.starts_at)}{e.location?" · "+e.location:""}</small>{e.details&&<small>{e.details}</small>}</div></Item>)}</ul>
    :<p className="ds-empty">No upcoming events for your class.</p>}
   <h4 className="ds-sec">Notices</h4>
   {(com?.announcements||[]).length?<ul className="ds-list">{com.announcements.slice(0,10).map(n=><Item key={n.id} href={"/s/"+code+"/communications?tab=announcements&notice="+n.id}><span className="ds-ico blue"><Icon name="megaphone"/></span>
    <div><strong>{n.title}</strong><small>{n.body}</small></div></Item>)}</ul>:<p className="ds-empty">No notices right now.</p>}
  </section>}
  {tab==="profile"&&<section className="ds-panel"><h3>My profile</h3>
   <table className="ds-table"><tbody>
    <tr><th>Name</th><td>{student.name}</td></tr><tr><th>Student ID</th><td>{student.code}</td></tr>
    <tr><th>Class</th><td>{activeClass?activeClass.name+(activeClass.section?" "+activeClass.section:""):"Not enrolled this year"}</td></tr>
    <tr><th>Academic year</th><td>{academicYear?.name||"Not set"}</td></tr><tr><th>School</th><td>{school.name}</td></tr></tbody></table>
   <p className="muted">Your profile details are managed by the school. Ask the school office if something is wrong.</p>
  </section>}
  {tab==="help"&&<section className="ds-panel"><h3>Help & Support</h3>
   <p>Ask your class teacher first. For anything else, contact the school office. You can also send a message to your teachers from the Messages page.</p>
   <div className="ds-actions" style={{maxWidth:420}}><a className="ds-action blue" href={"/s/"+code+"/communications"}><Icon name="chat"/>Open Messages</a>
    <a className="ds-action green" href={"/s/"+code+"/portal?role=student"}><Icon name="home"/>School portal</a></div>
  </section>}
  {tab==="subjects"&&<section className="ds-panel"><h3>My class and subjects</h3>
   {subjects.length?<ul className="ds-list">{subjects.map((s,i)=><Item key={s.id} href={courseHref(s.id)}><span className={"ds-ico "+tones[i%tones.length]}><Icon name="book"/></span><div><strong>{s.name}</strong><small>{s.code}</small></div></Item>)}</ul>
    :<p className="ds-empty">Your school has not assigned subjects to your current class yet.</p>}</section>}
  {tab==="homework"&&taking&&<AssignmentTaker code={code} homeworkId={taking} onDone={reload} onClose={()=>setTaking(null)}/>}
  {tab==="homework"&&!taking&&<section className="ds-panel"><h3>Published homework{search&&" matching “"+search+"”"}</h3>
   <p className="muted">Only homework assigned to your enrolled class is visible. Your answers are private to you and your assigned teacher.</p>
   <div className="lr-homework-list">{shownHomework.map(h=>{
    const submitted=submitMap.get(h.id);
    const isQ=(data.questionHomeworkIds||[]).includes(h.id);
    return <article className="lr-homework" key={h.id}>
     <div className="lr-homework-top"><span className="cr-tag">{subjectName(h.subject_id)}</span>
      <span className={submitted?"lr-state good":"lr-state"}>{submitted?"Submitted":"Not submitted"}</span></div>
     <h3>{h.title}</h3><p>{h.instructions}</p>
     <small>Due {fmtFull(h.due_at)} (Rwanda)</small>
     {isQ?<div className="lr-answer"><button className="button" onClick={()=>setTaking(h.id)}>{submitted?(submitted.graded_at?"View my results":"View my submission"):"Open homework and answer"}</button>
      {submitted?.graded_at&&<small> Score {Number(submitted.score)} / {Number(submitted.max_score)}</small>}</div>
     :submitted?<div className="lr-submitted"><strong>Your submitted response</strong><p>{submitted.response_text}</p>
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
