"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
import {initialTab} from "../../../../lib/portal-nav.mjs";
import useTabParam from "../../../ui/useTabParam.js";
import {DashboardShell,Stat,Ring,Bar,Card,Icon,Item,greeting,todayLabel} from "../../../ui/DashboardShell.jsx";

const rwf=v=>v===null||v===undefined?"—":Number(v).toLocaleString("en-US")+" RWF";
const when=d=>d?new Date(d).toLocaleDateString("en-GB",{timeZone:"Africa/Kigali",day:"numeric",month:"short",year:"numeric"}):"";
const hhmm=t=>String(t||"").slice(0,5);
const tones=["blue","purple","orange","green","pink","red"];
const days=["Mon","Tue","Wed","Thu","Fri","Sat"];

export default function FamilyDashboard({code}){
 const [client,setClient]=useState(null),[ready,setReady]=useState(false),[session,setSession]=useState(null);
 const [data,setData]=useState(null),[com,setCom]=useState(null),[fees,setFees]=useState(null);
 const [loading,setLoading]=useState(true),[claiming,setClaiming]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[tab,setTab]=useState(()=>initialTab(typeof window==="undefined"?"":location.search,["dashboard","children","homework","attendance","events","fees","help"],"dashboard")),[sel,setSel]=useState(0);
 useTabParam(["dashboard","children","homework","attendance","events","fees","help"],setTab);
 useEffect(()=>{
  const c=browserSupabase();setClient(c);
  if(!c){setReady(true);setLoading(false);return;}
  let mounted=true;
  c.auth.getSession().then(({data})=>{if(mounted){setSession(data.session);setReady(true);}});
  const {data:{subscription}}=c.auth.onAuthStateChange((_e,s)=>{if(mounted)setSession(s);});
  return ()=>{mounted=false;subscription.unsubscribe();};
 },[]);
 const call=useCallback(async(body)=>{
  const {data:{session:s}}=await client.auth.getSession();
  if(!s)throw Error("Your school sign-in has expired");
  const response=await fetch("/api/school/"+code+"/family",{
   method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+s.access_token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(result.error||"Cannot load family details");
  return result;
 },[client,code]);
 const refresh=useCallback(async()=>{
  setLoading(true);
  try{
   setData(await call());setError("");
   const {data:{session:s}}=await client.auth.getSession();
   const h={Authorization:"Bearer "+s.access_token};
   const get=async p=>{try{const r=await fetch("/api/school/"+code+"/"+p,{cache:"no-store",headers:h});return r.ok?await r.json():null;}catch{return null;}};
   const [c,f]=await Promise.all([get("communications"),get("fees")]);
   setCom(c);setFees(f);
  }catch(e){setError(e.message);}
  finally{setLoading(false);}
 },[call,client,code]);
 useEffect(()=>{if(ready&&session)refresh();else if(ready)setLoading(false);},[ready,session?.user?.id,refresh]);
 async function accept(studentId){
  setClaiming(true);setError("");setNotice("");
  try{await call({action:"claim",studentId,accepted:true});setNotice("Your verified school-family connection is now active.");await refresh();}
  catch(e){setError(e.message);}
  finally{setClaiming(false);}
 }
 if(!ready||loading)return <main className="school-admin-loading">Checking your school-family connections…</main>;
 if(!session)return <main className="school-admin-loading"><h1>Parent / Guardian Sign-in</h1>
  <p>Only your school's verified parent account can view a linked child.</p>
  <a className="button" href={"/s/"+code+"/login?role=parent"}>Go to School Login</a></main>;
 if(error&&!data)return <main className="school-admin-loading"><h2>Family access unavailable</h2><p role="alert">{error}</p>
  <a href={"/s/"+code+"/login?role=parent"}>Return to login</a></main>;
 if(!data)return <main className="school-admin-loading">No family records are available.</main>;
 const kids=data.children||[];
 const child=kids[Math.min(sel,Math.max(kids.length-1,0))];
 const signOut=async()=>{await client.auth.signOut();window.location.assign("/s/"+code+"/login?role=parent");};
 const pendingHw=c=>(c.homework||[]).filter(h=>!h.submittedAt&&h.status!=="closed");
 const totalPending=kids.reduce((n,c)=>n+pendingHw(c).length,0);
 const attPct=c=>c?.attendance?.recorded?Math.round(100*(c.attendance.present+c.attendance.late)/c.attendance.recorded):null;
 const graded=c=>(c?.homework||[]).filter(h=>h.score!=null&&Number(h.maxScore)>0);
 const avg=c=>{const g=graded(c);return g.length?Math.round(g.reduce((a,h)=>a+100*Number(h.score)/Number(h.maxScore),0)/g.length):null;};
 const doneHw=c=>c?.homework?.length?Math.round(100*c.homework.filter(h=>h.submittedAt).length/c.homework.length):null;
 const classIds=kids.map(k=>k.classId).filter(Boolean);
 const wd={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7};
 const today=wd[new Intl.DateTimeFormat("en-US",{weekday:"short",timeZone:"Africa/Kigali"}).format(new Date())];
 const periods=(com?.timetable||[]).filter(x=>child?.classId?x.class_id===child.classId:classIds.includes(x.class_id));
 const subj=id=>(com?.subjects||[]).find(s=>s.id===id)?.name||"Class subject";
 const todayP=periods.filter(x=>x.weekday===today);
 const events=(com?.events||[]).filter(e=>new Date(e.ends_at)>=new Date()).slice(0,5);
 const notices=(com?.announcements||[]).slice(0,4);
 const pupilIds=new Set(kids.map(k=>k.id));
 const invoices=(fees?.invoices||[]).filter(i=>pupilIds.has(i.student_id)&&(!child||i.student_id===child.id||tab==="dashboard"));
 const balance=invoices.reduce((a,i)=>a+Number(i.balances?.balance_rwf||0),0);
 const dueInv=invoices.filter(i=>Number(i.balances?.balance_rwf||0)>0);
 const nav=[
  {label:"Dashboard",icon:"home",active:tab==="dashboard",onClick:()=>setTab("dashboard")},
  {label:"My Children",icon:"users",active:tab==="children",onClick:()=>setTab("children")},
  {label:"Courses",icon:"book",href:"/s/"+code+"/courses"},
  {label:"Homework",icon:"check",active:tab==="homework",badge:totalPending,onClick:()=>setTab("homework")},
  {label:"Attendance",icon:"clock",active:tab==="attendance",onClick:()=>setTab("attendance")},
  {label:"Timetable & Events",icon:"calendar",active:tab==="events",onClick:()=>setTab("events")},
  {label:"Report Cards",icon:"file",href:"/s/"+code+"/report-card"},
  {label:"Fees & Payments",icon:"wallet",active:tab==="fees",badge:0,onClick:()=>setTab("fees")},
  {label:"Messages",icon:"chat",href:"/s/"+code+"/communications"},
  {label:"Learning Library",icon:"folder",href:"/s/"+code+"/resources"},
  {label:"Help & Support",icon:"help",active:tab==="help",onClick:()=>setTab("help")},
 ];
 const school={name:data.school.name,logoUrl:fees?.school?.logoUrl||null};
 const Pick=kids.length>1&&<div className="ds-chips" style={{marginBottom:12}}>{kids.map((k,i)=>
  <button key={k.id} className={"ds-chip"+(i===sel?" blue":"")} onClick={()=>setSel(i)}>{k.name.split(" ")[0]}</button>)}</div>;
 return <DashboardShell code={code} school={{...school,place:"Parent workspace"}} title="Parent Dashboard"
  user={{name:(session.user.email||"Parent").split("@")[0],role:"Parent / Guardian"}} nav={nav}
  notifications={totalPending} onBell={()=>setTab("homework")}
  helpText="Contact the school office for any question about your child." onSignOut={signOut} portalHref={"/s/"+code+"/portal?role=parent"}>
  <section className="ds-banner"><div><h2>{greeting()}!</h2>
   <p>{kids.length?(totalPending?totalPending+" homework "+(totalPending===1?"task is":"tasks are")+" still waiting across your children.":"Your children are all caught up with homework."):"Your family connection with "+data.school.name+" is protected."}</p></div>
   <div className="ds-chips"><span className="ds-chip"><Icon name="calendar" size={18}/>{todayLabel()}</span>
    <span className="ds-chip blue">{kids.length} {kids.length===1?"child":"children"}</span></div></section>
  {notice&&<div className="notice ok" role="status">{notice}</div>}
  {error&&<div className="notice error" role="alert">{error}</div>}
  {data.invitations.length>0&&<section className="ds-panel"><h3>School connection invitations</h3>
   <p>Your verified email has been invited by the school. Accept only if the school has confirmed your relationship with this child.</p>
   {data.invitations.map(i=><div key={i.studentId} className="ds-item"><div><strong>{i.relationship==="legal_guardian"?"Legal guardian":"Parent"} invitation</strong>
    <small>The child's identity is hidden until you accept. Expires {i.expiresAt?.slice(0,10)}.</small></div>
    <button className="button" disabled={claiming} onClick={()=>accept(i.studentId)}>{claiming?"Checking…":"Accept family link"}</button></div>)}</section>}
  {!kids.length&&<section className="ds-panel"><h3>No linked children yet</h3>
   <p>If your school has already verified your relationship, ask it to invite your confirmed email address. Your child will appear only after you accept the invitation.</p></section>}
  {kids.length>0&&<>
  {tab==="dashboard"&&<div className="ds-grid">
   <div className="ds-span8" style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:14,alignContent:"start"}}>
    {Pick}
    <div className="ds-stats" style={{margin:0}}>
     <Stat icon="clock" tone="blue" value={attPct(child)===null?"—":attPct(child)+"%"} label="Attendance" onClick={()=>setTab("attendance")}/>
     <Stat icon="check" tone="purple" value={child.homework.length?child.homework.filter(h=>h.submittedAt).length+"/"+child.homework.length:"—"} label={child.earlyYears?"Home activities shared":"Homework done"} onClick={()=>setTab("homework")}/>
     {child.earlyYears?<Stat icon="trophy" tone="orange" value={(child.homework||[]).filter(h=>h.feedback).length} label="Teacher notes" onClick={()=>setTab("homework")}/>:<Stat icon="trophy" tone="orange" value={avg(child)===null?"—":avg(child)+"%"} label="Homework average" onClick={()=>setTab("homework")}/>}
     <Stat icon="wallet" tone="green" value={fees?rwf(invoices.filter(i=>i.student_id===child.id).reduce((x,i)=>x+Number(i.balances?.balance_rwf||0),0)):"—"} label="Fees balance" onClick={()=>setTab("fees")}/>
    </div>
    <div className="ds-grid" style={{margin:0}}>
     <Card title={child.name.split(" ")[0]+"'s Classes Today"} icon="calendar" size="s6" link={<button className="ds-link" onClick={()=>setTab("events")}>Timetable →</button>}>
      {todayP.length?<ul className="ds-list">{todayP.map((x,i)=><Item key={x.id} onClick={()=>setTab("events")}><span className={"ds-ico "+tones[i%6]}><Icon name="clock"/></span>
       <div><strong>{subj(x.subject_id)}</strong><small>{hhmm(x.starts_at)} to {hhmm(x.ends_at)}{x.room?" · Room "+x.room:""}</small></div></Item>)}</ul>
       :<p className="ds-empty">{periods.length?"No lessons are scheduled for today.":"The school has not published a timetable for this class yet."}</p>}</Card>
     <Card title="Upcoming Events" icon="megaphone" size="s6" link={<button className="ds-link" onClick={()=>setTab("events")}>All →</button>}>
      {events.length?<ul className="ds-list">{events.slice(0,4).map(e=><Item key={e.id} onClick={()=>setTab("events")}><span className="ds-ico orange"><Icon name="calendar"/></span>
       <div><strong>{e.title}</strong><small>{when(e.starts_at)}{e.location?" · "+e.location:""}</small></div></Item>)}</ul>:<p className="ds-empty">No upcoming events.</p>}</Card>
    </div>
    <div className="ds-grid" style={{margin:0}}>
     <Card title={child.earlyYears?"Home Activities to Do":"Homework to Complete"} icon="check" size="s6" link={<button className="ds-link" onClick={()=>setTab("homework")}>All →</button>}>
      {pendingHw(child).length?<ul className="ds-list">{pendingHw(child).slice(0,4).map(h=><Item key={h.id} onClick={()=>setTab("homework")}><span className="ds-ico purple"><Icon name="check"/></span>
       <div><strong>{h.title}</strong><small>{h.subject||"Class"}{h.dueAt?" · due "+when(h.dueAt):""}{h.dueAt&&new Date(h.dueAt)<new Date()?<b style={{color:"#c0392b"}}> · overdue</b>:null}</small></div></Item>)}</ul>:<p className="ds-empty">No homework is waiting.</p>}</Card>
     <Card title="Teacher Feedback" icon="chat" size="s6">
      {(child.homework||[]).filter(h=>h.feedback||h.score!=null).slice(0,3).length?<ul className="ds-list">{child.homework.filter(h=>h.feedback||h.score!=null).slice(0,3).map(h=><Item key={h.id} onClick={()=>setTab("homework")}><span className="ds-ico green"><Icon name="chat"/></span>
       <div><strong>{h.title}{h.score!=null?" · "+Number(h.score)+" / "+Number(h.maxScore):""}</strong><small>{h.feedback||"Graded by the teacher."}</small></div></Item>)}</ul>
       :<p className="ds-empty">Feedback appears here after the teacher grades work.</p>}</Card>
    </div>
    <div className="ds-grid" style={{margin:0}}>
     {child.earlyYears?<Card title={child.name.split(" ")[0]+"'s Learning"} icon="chart" size="s6" link={<a href={"/s/"+code+"/report-card"}>Progress reports →</a>}>
      <div className="ds-legend">
       <div>Days at school this term<b>{child.attendance.recorded?(child.attendance.present+child.attendance.late)+" of "+child.attendance.recorded:"—"}</b></div>
       <div>Home activities shared<b>{(child.homework||[]).filter(h=>h.submittedAt).length+" of "+(child.homework||[]).length}</b></div>
       <div>Teacher notes on activities<b>{(child.homework||[]).filter(h=>h.feedback).length}</b></div>
      </div>
      <p className="ds-empty" style={{marginTop:8}}>Nursery children are described in six learning areas, not marked or ranked. Open Progress reports to read the term report.</p></Card>:
     <Card title={child.name.split(" ")[0]+"'s Progress"} icon="chart" size="s6" link={<a href={"/s/"+code+"/report-card"}>Report cards →</a>}>
      <div className="ds-split"><Ring value={[doneHw(child),avg(child),attPct(child)].filter(x=>x!==null).length?Math.round([doneHw(child),avg(child),attPct(child)].filter(x=>x!==null).reduce((a,b)=>a+b,0)/[doneHw(child),avg(child),attPct(child)].filter(x=>x!==null).length):null} label="Overall" onClick={()=>setTab("children")}/>
       <div className="ds-bars"><Bar label="Homework submitted" value={doneHw(child)} color="#1fa64a" href={"/s/"+code+"/family?tab=homework"}/><Bar label="Homework average" value={avg(child)} color="#3b8df0" href={"/s/"+code+"/family?tab=homework"}/><Bar label="Attendance" value={attPct(child)} color="#f59e0b" href={"/s/"+code+"/family?tab=attendance"}/></div></div></Card>}
     <Card title="Attendance" icon="clock" size="s6">
      {child.attendance.recorded?<div className="ds-split"><Ring value={attPct(child)} label="Present" onClick={()=>setTab("attendance")}/>
       <div className="ds-legend"><div><i className="ds-dot" style={{background:"#1fa64a"}}/>Present<b>{child.attendance.present}</b></div>
        <div><i className="ds-dot" style={{background:"#f59e0b"}}/>Late<b>{child.attendance.late}</b></div>
        <div><i className="ds-dot" style={{background:"#e5322d"}}/>Absent<b>{child.attendance.absent}</b></div></div></div>
       :<p className="ds-empty">No attendance recorded yet.</p>}</Card>
    </div>
   </div>
   <div className="ds-span4" style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:14,alignContent:"start"}}>
    <Card title="School Notices" icon="megaphone" link={<a href={"/s/"+code+"/communications"}>All →</a>}>
     {notices.length?<ul className="ds-list">{notices.map(n=><Item key={n.id} href={"/s/"+code+"/communications?tab=announcements&notice="+n.id}><span className="ds-ico purple"><Icon name="megaphone"/></span>
      <div><strong>{n.title}</strong><small>{when(n.published_at)}</small></div></Item>)}</ul>:<p className="ds-empty">No notices have been published.</p>}</Card>
    <Card title="Fees" icon="wallet" link={<button className="ds-link" onClick={()=>setTab("fees")}>Details →</button>}>
     {fees?<div className="ds-legend"><div>{kids.length>1?"Balance due, all children":"Balance due"}<b>{rwf(balance)}</b></div><div>Open invoices<b>{dueInv.length}</b></div></div>:<p className="ds-empty">Fee details are not available.</p>}</Card>
    <Card title="Quick Actions" icon="bolt"><div className="ds-actions">
     <a className="ds-action blue" href={"/s/"+code+"/communications"}>Open My Family School Day</a>
     <a className="ds-action orange" href={"/s/"+code+"/communications"}>Message a teacher</a>
     <a className="ds-action green" href={"/s/"+code+"/report-card"}>View report cards</a></div></Card>
   </div>
  </div>}

  {tab==="children"&&<section className="ds-panel"><h3>My linked children</h3>
   <div className="ds-materials">{kids.map(k=><article key={k.id} className="ds-material"><span className="ds-pill info" style={{marginLeft:0}}>{k.relationship==="legal_guardian"?"Legal guardian":"Parent"}</span>
    <h4>{k.name}</h4><p>Student ID: {k.studentCode}</p><p>Class: {k.className||"Not assigned"}</p>
    <p>Attendance: {attPct(k)===null?"Not recorded":attPct(k)+"%"} · Homework waiting: {pendingHw(k).length}</p></article>)}</div></section>}

  {tab==="homework"&&<section className="ds-panel"><h3>Homework</h3>{Pick}
   {(child.homework||[]).length?<table className="ds-table"><thead><tr><th>Task</th><th>Subject</th><th>Due</th><th>Status</th><th>{child.earlyYears?"Teacher note":"Grade"}</th></tr></thead>
    <tbody>{child.homework.map(h=><tr key={h.id}><td>{h.title}</td><td>{h.subject||"—"}</td><td>{h.dueAt?when(h.dueAt):"—"}</td>
     <td>{h.submittedAt?(h.isLate?"Submitted late":"Submitted"):(h.status==="closed"?"Not submitted (closed)":"Not submitted")}</td><td>{child.earlyYears?(h.feedback||"—"):(h.score!=null?Number(h.score)+"/"+Number(h.maxScore):"—")}</td></tr>)}</tbody></table>
    :<p className="ds-empty">No homework has been published for this class yet.</p>}</section>}

  {tab==="attendance"&&<section className="ds-panel"><h3>Attendance</h3>{Pick}
   {child.attendance.recorded?<><div className="ds-split"><Ring value={attPct(child)} label="Present" onClick={()=>setTab("attendance")}/>
    <div className="ds-legend"><div>Present<b>{child.attendance.present}</b></div><div>Late<b>{child.attendance.late}</b></div>
     <div>Absent<b>{child.attendance.absent}</b></div><div>Excused<b>{child.attendance.excused}</b></div></div></div>
    <table className="ds-table"><thead><tr><th>Date</th><th>Status</th></tr></thead><tbody>{child.attendance.recent.map(r=><tr key={r.on}><td>{when(r.on)}</td><td>{r.status}</td></tr>)}</tbody></table></>
    :<p className="ds-empty">No attendance has been recorded yet.</p>}</section>}

  {tab==="events"&&<section className="ds-panel"><h3>Timetable and Events</h3>{Pick}
   {periods.length?<div className="ds-week">{days.map((dn,i)=><div key={dn} className="ds-day"><b>{dn}</b>
    {periods.filter(x=>x.weekday===i+1).map(x=><div key={x.id} className="ds-slot"><strong>{subj(x.subject_id)}</strong><small>{hhmm(x.starts_at)}-{hhmm(x.ends_at)}</small></div>)}</div>)}</div>
    :<p className="ds-empty">The school has not published a timetable for this class yet.</p>}
   <h3 style={{marginTop:18}}>Upcoming events</h3>
   {events.length?<ul className="ds-list">{events.map(e=><Item key={e.id} onClick={()=>setTab("events")}><span className="ds-ico orange"><Icon name="calendar"/></span>
    <div><strong>{e.title}</strong><small>{when(e.starts_at)}{e.location?" · "+e.location:""}</small></div></Item>)}</ul>:<p className="ds-empty">No upcoming events.</p>}</section>}

  {tab==="fees"&&<section className="ds-panel"><h3>Fees and Payments</h3>{Pick}
   {fees?(invoices.length?<table className="ds-table"><thead><tr><th>Child</th><th>Item</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Due</th></tr></thead>
    <tbody>{invoices.map(i=><tr key={i.id}><td>{kids.find(k=>k.id===i.student_id)?.name}</td><td>{i.description||i.category}{i.term_label?" · "+i.term_label:""}</td><td>{rwf(i.amount_rwf)}</td><td>{rwf(i.balances?.paid_rwf)}</td><td>{rwf(i.balances?.balance_rwf)}</td><td>{when(i.due_on)}{i.balances?.overdue?" (overdue)":""}</td></tr>)}</tbody></table>
    :<p className="ds-empty">The school has not issued any invoice for your children.</p>):<p className="ds-empty">Fee details are not available.</p>}
   <p style={{marginTop:14}}><a className="button" href={"/s/"+code+"/fees"}>My Children's School Fees</a></p></section>}

  {tab==="help"&&<section className="ds-panel"><h3>Help and Support</h3>
   <p>Only children officially linked to you by the school appear here. For any question about grades, attendance or fees, message the class teacher or contact the school office.</p>
   <p><a className="button" href={"/s/"+code+"/communications"}>Open messages</a></p></section>}
  </>}
 </DashboardShell>;
}
