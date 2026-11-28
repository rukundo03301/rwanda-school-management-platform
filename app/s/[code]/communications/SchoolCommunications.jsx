"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";

const DAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const PERMISSIONS=[
 {id:"timetable.manage",name:"Create and deactivate school timetables"},
 {id:"announcements.manage",name:"Publish announcements and manage events"}
];
const AUDIENCES=[
 {id:"all",label:"Everyone in this school"},
 {id:"staff",label:"School staff"},
 {id:"teachers",label:"Teachers"},
 {id:"parents",label:"Verified parents"},
 {id:"students",label:"Verified students"},
 {id:"class",label:"One school class"}
];
const EVENT_KINDS=["exam","meeting","holiday","activity","closure","other"];
const kigaliLocal=(date)=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Africa/Kigali",year:"numeric",
 month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(date).replace(" ","T");
const kigaliNow=()=>kigaliLocal(new Date());
const prettyDate=d=>d?new Date(d).toLocaleString("en-RW",{
 timeZone:"Africa/Kigali",dateStyle:"medium",timeStyle:"short"}):"—";
const prettyTime=t=>typeof t==="string"?t.slice(0,5):"—";
const schoolIso=value=>value?new Date(value+":00+02:00").toISOString():"";
function Field({label,children}){return <label className="scom-field"><span>{label}</span>{children}</label>}
function Empty({title,description}){return <div className="scom-empty"><strong>{title}</strong><p>{description}</p></div>}
function Metric({label,value,note}){return <div className="scom-metric">
 <small>{label}</small><strong>{value}</strong><span>{note}</span></div>}
function Dialog({title,onClose,children}){return <div className="scom-shade"
 onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
 <section className="scom-dialog" role="dialog" aria-modal="true" aria-label={title}>
  <header><h2>{title}</h2><button className="button small secondary" onClick={onClose}
   aria-label="Close">✕</button></header>{children}
 </section></div>}
export default function SchoolCommunications({code}){
 const [client,setClient]=useState(null),[ready,setReady]=useState(false);
 const [session,setSession]=useState(null),[loading,setLoading]=useState(true);
 const [data,setData]=useState(null),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [tab,setTab]=useState("overview"),[modal,setModal]=useState(null),[form,setForm]=useState({});
 const [busy,setBusy]=useState(false),[selectedThread,setSelectedThread]=useState("");
 const [draftMessage,setDraftMessage]=useState(""),[classFilter,setClassFilter]=useState("all");
 useEffect(()=>{
  const c=browserSupabase();setClient(c);
  if(!c){setReady(true);setLoading(false);return;}
  let live=true;
  c.auth.getSession().then(({data:r})=>{if(live){setSession(r.session);setReady(true);}});
  const {data:{subscription}}=c.auth.onAuthStateChange((_e,s)=>{if(live)setSession(s);});
  return ()=>{live=false;subscription.unsubscribe();};
 },[]);
 const api=useCallback(async body=>{
  if(!client)throw Error("School authentication has not been configured.");
  const {data:{session:s}}=await client.auth.getSession();
  if(!s)throw Error("Sign in again to continue.");
  const res=await fetch("/api/school/"+code+"/communications",{
   method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+s.access_token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
  const output=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(output.error||"School communication request failed");
  return output;
 },[client,code]);
 const refresh=useCallback(async()=>{
  setLoading(true);
  try{
   const result=await api();setData(result);setError("");
   setSelectedThread(prev=>result.threads.some(t=>t.id===prev)?prev:result.threads[0]?.id||"");
  }catch(e){setError(e.message);}
  finally{setLoading(false);}
 },[api]);
 useEffect(()=>{if(ready&&session)refresh();else if(ready){setData(null);setLoading(false);}},[ready,session?.user?.id,refresh]);
 const open=(name,values={})=>{setModal(name);setForm(values);setError("");setNotice("");};
 async function save(body,success="School record saved successfully."){
  setBusy(true);setError("");setNotice("");
  try{
   const output=await api(body);
   setNotice(success);
   setModal(null);setForm({});
   await refresh();
   return output;
  }catch(e){setError(e.message);return null;}
  finally{setBusy(false);}
 }
 async function startConversation(contact){
  const out=await save({
   action:"thread.open",studentId:contact.studentId,
   teacherId:contact.teacherId,guardianId:contact.guardianId
  },"Verified conversation is ready.");
  if(out?.result?.id){setSelectedThread(out.result.id);setTab("messages");}
 }
 async function sendMessage(){
  if(!selectedThread||!draftMessage.trim())return;
  const out=await save({action:"thread.message",threadId:selectedThread,
   text:draftMessage.trim()},"Message saved and in-app notification created.");
  if(out)setDraftMessage("");
 }
 const isParent=data?.actor.roles.includes("parent");
 const isTeacher=data?.actor.roles.includes("teacher");
 const isStudent=data?.actor.roles.includes("student");
 const isManager=data?.actor.managerTimetable||data?.actor.managerAnnouncements;
 const canMessage=isParent||isTeacher;
 const tabs=[
  {id:"overview",label:isParent?"Family Overview":isTeacher?"My School Day":"School Overview"},
  {id:"timetable",label:"Timetable"},
  {id:"calendar",label:"Calendar"},
  {id:"announcements",label:"Announcements"},
  ...(canMessage?[{id:"messages",label:"Private Messages"}]:[]),
  ...(data?.actor.owner?[{id:"access",label:"Access Controls"}]:[])
 ];
 const subjects=new Map((data?.subjects||[]).map(x=>[x.id,x.name]));
 const classes=new Map((data?.classes||[]).map(x=>[x.id,x]));
 const teacherNames=new Map((data?.teachers||[]).map(x=>[x.userId,x.label]));
 const currentThread=data?.threads.find(t=>t.id===selectedThread);
 const currentMessages=[...(data?.messages||[])]
  .filter(m=>m.thread_id===selectedThread).sort((a,b)=>a.created_at.localeCompare(b.created_at));
 const contactsByThread=(t)=>data?.contacts.find(c=>c.studentId===t.student_id
  &&c.teacherId===t.teacher_id&&c.guardianId===t.guardian_id);
 const unreadMessages=(data?.notifications||[]).filter(n=>!n.read_at);
 const readIds=new Set((data?.noticeReads||[]).map(r=>r.announcement_id));
 const unreadNotices=(data?.announcements||[]).filter(a=>!readIds.has(a.id));
 const visibleTimetable=(data?.timetable||[]).filter(p=>classFilter==="all"||p.class_id===classFilter);
 const classAssignments=data?.teachingAssignments||[];
 const eligibleAssignments=classAssignments.filter(a=>a.class_id===form.classId);
 const newPeriodTeacherAssignments=eligibleAssignments.filter(a=>a.teacher_id===form.teacherId);
 const formSubjectIsValid=newPeriodTeacherAssignments.some(a=>a.subject_id===form.subjectId);
 const canSetAttendance=false; // Attendance belongs to the teacher classroom module.
 // Links from the bell and dashboards: ?tab=messages&thread=…&notification=… or ?tab=announcements&notice=…
 const deep=useRef(null),[focusNotice,setFocusNotice]=useState("");
 if(deep.current===null)deep.current=typeof window==="undefined"?{}:Object.fromEntries(new URLSearchParams(location.search));
 const markThreadRead=useCallback(async(threadId,list)=>{
  const ids=(list||[]).filter(n=>n.thread_id===threadId&&!n.read_at).map(n=>n.id);
  if(!ids.length)return false;
  await Promise.all(ids.map(id=>api({action:"notification.read",notificationId:id}).catch(()=>null)));return true;
 },[api]);
 const openThread=async threadId=>{setTab("messages");setSelectedThread(threadId);setDraftMessage("");
  if(await markThreadRead(threadId,data?.notifications))await refresh();};
 useEffect(()=>{
  const d=deep.current;if(!data||!d||d.done)return;d.done=true;
  const ids=["overview","timetable","calendar","announcements","messages","access"];
  if(d.tab&&ids.includes(d.tab))setTab(d.tab);
  (async()=>{
   let changed=false;
   if(d.thread&&data.threads.some(t=>t.id===d.thread)){setTab("messages");setSelectedThread(d.thread);changed=await markThreadRead(d.thread,data.notifications);}
   if(d.notice&&data.announcements.some(a=>a.id===d.notice)){setTab("announcements");setFocusNotice(d.notice);
    if(!(data.noticeReads||[]).some(r=>r.announcement_id===d.notice)){await api({action:"announcement.read",announcementId:d.notice}).catch(()=>null);changed=true;}}
   if(changed){await refresh();if(d.thread)setSelectedThread(d.thread);}
   if(d.notice)setTimeout(()=>document.getElementById("notice-"+d.notice)?.scrollIntoView({behavior:"smooth",block:"center"}),200);
  })();
 },[data]);
 if(!ready||loading)return <main className="school-admin-loading">Loading your school day…</main>;
 if(!session)return <main className="school-admin-loading"><h2>School sign-in required</h2>
  <p>Sign in using the account authorized by your school.</p>
  <a className="button" href={"/s/"+code+"/login"}>Open School Login</a></main>;
 if(error&&!data)return <main className="school-admin-loading"><h2>Communications unavailable</h2>
  <p role="alert">{error}</p><a href={"/s/"+code}>Back to School Homepage</a></main>;
 if(!data)return <main className="school-admin-loading">No school workspace available.</main>;
 const school=data.school,actor=data.actor;
 const logoColor=/^#[0-9a-f]{6}$/i.test(school.primaryColor||"")?school.primaryColor:"#204a78";
 const noticeLabel=(a)=>AUDIENCES.find(x=>x.id===a.audience)?.label||a.audience;
 const modalName={
  period:"Schedule a lesson",periodDisable:"Deactivate timetable lesson",
  announce:"Publish a school announcement",archive:"Archive school announcement",
  event:"Schedule a school event",eventCancel:"Cancel school event",
  access:"Administrator communication access",closeThread:"Close private conversation"
 };
 return <div className="scom-shell" style={{"--scom-brand":logoColor}}>
  <header className="scom-header">
   <div className="scom-school">
    {school.logoUrl?<img alt={school.name+" logo"} src={school.logoUrl}
     width={49} height={49}/>:<span className="scom-logo-placeholder">✦</span>}
    <div><strong>{school.name}</strong><small>School Community & Daily Life</small></div>
   </div>
   <nav><a href={"/s/"+code}>School Homepage</a>
    {actor.owner&&<a href={"/s/"+code+"/admin"}>Administration</a>}
    {isParent&&<a href={"/s/"+code+"/family"}>My Family</a>}
    {isTeacher&&<a href={"/s/"+code+"/classroom"}>My Classroom</a>}
    {isStudent&&<a href={"/s/"+code+"/learning"}>My Learning</a>}
   </nav>
  </header>
  <div className="scom-layout">
   <aside className="scom-side">
    <small>YOUR SCHOOL WORKSPACE</small>
    {tabs.map(t=><button key={t.id} className={tab===t.id?"selected":""}
      onClick={()=>{setTab(t.id);setError("");}}>
      {t.label}{t.id==="messages"&&unreadMessages.length>0&&<span>{unreadMessages.length}</span>}
      {t.id==="announcements"&&unreadNotices.length>0&&<span>{unreadNotices.length}</span>}
    </button>)}
    <div className="scom-side-foot"><small>School ID</small><strong>{school.code}</strong>
     <p>Only verified accounts and approved school relationships are shown.</p></div>
   </aside>
   <main className="scom-main">
    <div className="scom-headline"><span>SCHOOL COMMUNITY</span>
     <h1>{({
      overview:isParent?"Your Family at School":isTeacher?"Your Teaching Day":"School Community Overview",
      timetable:"Weekly Class Timetable",calendar:"School Calendar",
      announcements:"School Announcements",messages:"Parent–Teacher Messages",
      access:"School Communication Access"
     })[tab]}</h1>
     <p>{isParent?"One safe place for your linked children's activities and communications.":
       isTeacher?"Your assigned classes, school notices and verified family communication.":
       "Organized timetables, important events and school-wide communications."}</p>
    </div>
    {error&&<div className="notice error" role="alert">{error}</div>}
    {notice&&<div className="notice ok" role="status">{notice}</div>}
    {tab==="overview"&&<>
     <div className="scom-metrics">
      <Metric label="My school classes" value={data.classes.length} note="Current-year classes loaded"/>
      <Metric label="Upcoming events" value={data.events.filter(e=>new Date(e.ends_at)>new Date()).length} note="Visible to your school role"/>
      <Metric label="Unread announcements" value={unreadNotices.length} note="Published notices"/>
      <Metric label="Unread messages" value={unreadMessages.length} note="Private in-app notifications"/>
     </div>
     {isParent&&<section className="scom-panel">
      <div className="scom-section-head"><div><h2>My verified children</h2>
       <p>Only children linked and enrolled through your school are listed.</p></div>
       <a className="button secondary small" href={"/s/"+code+"/report-card"}>Approved Report Cards</a>
      </div>
      {data.family.length?<div className="scom-family-grid">{data.family.map(child=><article className="scom-child" key={child.studentId}>
       <div className="scom-child-head"><span className="scom-avatar">🎓</span>
        <div><h3>{child.name}</h3><p>{child.studentCode} · {child.className}</p></div></div>
       <div className="scom-child-details">
        <div><strong>{child.upcomingHomework.length}</strong><small>Recent or upcoming assignments</small></div>
        <div><strong>{child.recordedAttendance.length}</strong><small>Recent recorded attendance entries</small></div>
        <div><strong>{child.publishedReportCount}</strong><small>Published reports loaded</small></div>
       </div>
       <h4>Homework deadlines</h4>
       {child.upcomingHomework.length?<ul>{child.upcomingHomework.slice(0,5).map((h,i)=><li key={i}>
        <b>{h.title}</b><span>{h.submitted?"✓ Submitted · ":"Due · "}{prettyDate(h.dueAt)}</span></li>)}</ul>:
        <p className="muted">No published assignments in the loaded date window.</p>}
       <h4>Attendance recorded by the school</h4>
       {child.recordedAttendance.length?<div className="scom-attendance">
        {child.recordedAttendance.slice(0,5).map((a,i)=><span key={i}>
         {a.attendance_on} · {a.status}</span>)}</div>:
        <p className="muted">No attendance records have been entered for this child.</p>}
      </article>)}</div>:
      <Empty title="No currently enrolled linked children" description="Your school must verify and approve a guardian link and current-year enrollment before a child's records appear."/>}
     </section>}
     {isTeacher&&<section className="scom-panel">
      <div className="scom-section-head"><div><h2>My assigned class roster</h2>
       <p>Verified teaching assignments determine which pupils you may contact.</p></div>
       <a className="button secondary small" href={"/s/"+code+"/classroom"}>Open Teacher Workspace</a>
      </div>
      {data.roster.length?<div className="scom-roster">{data.roster.map(s=><div key={s.studentId}>
       <span>🎒</span><div><strong>{s.name}</strong>
        <small>{s.code} · {classes.get(s.classId)?.name||"Class"}</small></div></div>)}</div>:
       <Empty title="No assigned pupils yet" description="Your school's manager must first assign you a class and enroll pupils."/>}
     </section>}
     {isManager&&<section className="scom-panel scom-quick"><h2>School management actions</h2>
      <div>
       {actor.managerTimetable&&<button className="button secondary" onClick={()=>setTab("timetable")}>Manage Timetable</button>}
       {actor.managerAnnouncements&&<button className="button secondary" onClick={()=>setTab("announcements")}>Publish Announcement</button>}
       {actor.managerAnnouncements&&<button className="button secondary" onClick={()=>setTab("calendar")}>Manage School Calendar</button>}
       {actor.owner&&<button className="button secondary" onClick={()=>setTab("access")}>Staff Permissions</button>}
      </div></section>}
     <div className="scom-two">
      <section className="scom-panel"><h2>Recent school announcements</h2>
       {data.announcements.slice(0,4).map(a=><article key={a.id} className="scom-mini">
        <small>{noticeLabel(a)} · {prettyDate(a.published_at)}</small>
        <h3>{a.title}</h3><p>{a.body}</p></article>)}
       {!data.announcements.length&&<Empty title="No announcements" description="Your school hasn't published a notice for this audience yet."/>}
       <button className="button secondary small" onClick={()=>setTab("announcements")}>All announcements</button>
      </section>
      <section className="scom-panel"><h2>Coming up on the school calendar</h2>
       {data.events.slice(0,5).map(e=><article className="scom-event-mini" key={e.id}>
        <span>{e.kind==="exam"?"📝":e.kind==="holiday"?"🌿":"📅"}</span>
        <div><strong>{e.title}</strong><small>{prettyDate(e.starts_at)} · {e.kind}</small></div></article>)}
       {!data.events.length&&<Empty title="No school events" description="Exams, holidays and meetings appear once approved school staff add them."/>}
       <button className="button secondary small" onClick={()=>setTab("calendar")}>School calendar</button>
      </section>
     </div>
    </>}
    {tab==="timetable"&&<>
     <div className="scom-section-head"><div><h2>{data.year?.name||"No active academic year"}</h2>
      <p>Schedule conflicts are blocked for the same class, teacher or room.</p></div>
      {actor.managerTimetable&&<button className="button" disabled={!classAssignments.length} onClick={()=>{
       const a=classAssignments[0];
       open("period",{classId:a?.class_id||"",teacherId:a?.teacher_id||"",
        subjectId:a?.subject_id||"",weekday:1,start:"08:00",end:"08:45",room:""});
      }}>+ Schedule Lesson</button>}
     </div>
     {data.classes.length>1&&<div className="scom-filter">
      <label>Class <select className="input" value={classFilter} onChange={e=>setClassFilter(e.target.value)}>
       <option value="all">All authorized classes</option>
       {data.classes.map(c=><option key={c.id} value={c.id}>{c.name}{c.section?" · "+c.section:""}</option>)}
      </select></label></div>}
     <div className="scom-days">
      {DAYS.map((day,index)=><section className="scom-day" key={day}>
       <header><strong>{day}</strong><small>{visibleTimetable.filter(p=>p.weekday===index+1).length} lessons</small></header>
       {visibleTimetable.filter(p=>p.weekday===index+1).map(p=><article className="scom-period" key={p.id}>
        <span>{prettyTime(p.starts_at)}–{prettyTime(p.ends_at)}</span>
        <h3>{subjects.get(p.subject_id)||"Subject"}</h3>
        <p>{classes.get(p.class_id)?.name||"Class"}{p.room?" · "+p.room:""}</p>
        {actor.managerTimetable&&<button className="scom-link" onClick={()=>open("periodDisable",{period:p,reason:""})}>Deactivate</button>}
       </article>)}
       {!visibleTimetable.some(p=>p.weekday===index+1)&&<p className="scom-day-empty">No lessons scheduled</p>}
      </section>)}
     </div>
    </>}
    {tab==="calendar"&&<>
     <div className="scom-section-head"><div><h2>School events and important dates</h2>
      <p>Examinations, meetings, holidays, closures and activities are limited to their approved audiences.</p></div>
      {actor.managerAnnouncements&&<button className="button" onClick={()=>open("event",{kind:"meeting",
       audience:"all",startsLocal:kigaliNow(),endsLocal:kigaliLocal(new Date(Date.now()+3600000))})}>+ New Event</button>}</div>
     <div className="scom-event-list">{data.events.map(e=><article className="scom-event" key={e.id}>
       <div className="scom-event-date"><small>{new Date(e.starts_at).toLocaleString("en-RW",
        {timeZone:"Africa/Kigali",month:"short"}).toUpperCase()}</small>
        <strong>{new Date(e.starts_at).toLocaleString("en-RW",{timeZone:"Africa/Kigali",day:"2-digit"})}</strong></div>
       <div className="scom-event-body"><span className="scom-tag">{e.kind.replaceAll("_"," ")}</span>
        <h3>{e.title}</h3><p>{e.details||"School calendar event"}</p>
        <small>{prettyDate(e.starts_at)} to {prettyDate(e.ends_at)}
         {e.location?" · "+e.location:""}</small></div>
       {actor.managerAnnouncements&&<button className="button secondary small" onClick={()=>open("eventCancel",{event:e,reason:""})}>Cancel</button>}
      </article>)}</div>
     {!data.events.length&&<Empty title="Your school calendar is empty" description="Authorized school personnel can schedule exams, meetings, holidays and other real events."/>}
    </>}
    {tab==="announcements"&&<>
     <div className="scom-section-head"><div><h2>Verified school notices</h2>
      <p>Each announcement is delivered only to the approved school audience.</p></div>
      {actor.managerAnnouncements&&<button className="button" onClick={()=>open("announce",{audience:"all",title:"",text:"",expiresAt:""})}>+ Publish Notice</button>}
     </div>
     <div className="scom-notice-list">{data.announcements.map(a=><article key={a.id} id={"notice-"+a.id} className="scom-notice" style={a.id===focusNotice?{outline:"3px solid #f5b400",scrollMarginTop:90}:{scrollMarginTop:90}}>
      <div className="scom-notice-top"><span className="scom-tag">{noticeLabel(a)}</span>
       <small>{prettyDate(a.published_at)}</small></div>
      <h3>{a.title}</h3><p>{a.body}</p>
      <div className="scom-notice-actions">
       {!readIds.has(a.id)?<button className="button secondary small"
        disabled={busy} onClick={()=>save({action:"announcement.read",announcementId:a.id},"Marked as read.")}>Mark as read</button>:
        <span className="scom-read-state">✓ Read</span>}
       {actor.managerAnnouncements&&<button className="scom-link"
        onClick={()=>open("archive",{announcement:a,reason:""})}>Archive notice</button>}
      </div>
     </article>)}</div>
     {!data.announcements.length&&<Empty title="No published notices yet" description="Only announcements intended for your verified school role appear here."/>}
    </>}
    {tab==="messages"&&canMessage&&<>
     <div className="scom-section-head"><div><h2>Private school family messages</h2>
      <p>Every conversation is about one enrolled child and their currently assigned teacher.</p></div>
      {data.contacts.length>0&&<button className="button" onClick={()=>open("contact",{})}>+ New Conversation</button>}
     </div>
     <div className="scom-private-note">Private to the verified teacher and guardian. School administrators do not automatically read message bodies. Text-only messages create in-app alerts; email delivery is not configured.</div>
     <div className="scom-message-layout">
      <aside className="scom-threads"><h3>Conversations</h3>
       {data.threads.map(t=><button key={t.id} className={selectedThread===t.id?"selected":""}
        onClick={()=>openThread(t.id)}>
        <strong>{contactsByThread(t)?.label||"Verified family conversation"}</strong>
        <small>{t.status==="closed"?"Closed":"Open"} · {prettyDate(t.opened_at)}</small>
       </button>)}
       {!data.threads.length&&<Empty title="No conversations yet" description="Choose a verified school family contact to start."/>}
      </aside>
      <section className="scom-conversation">
       {currentThread?<><header><div><strong>{contactsByThread(currentThread)?.label||"School family conversation"}</strong>
         <small>Only the guardian and assigned teacher can read these messages.</small></div>
         {currentThread.status==="open"&&<button className="button small secondary" onClick={()=>open("closeThread",{thread:currentThread,reason:""})}>Close</button>}</header>
        <div className="scom-message-scroll">{currentMessages.map(m=><article key={m.id}
          className={m.sender_id===actor.id?"scom-bubble mine":"scom-bubble"}>
         <p>{m.body}</p><small>{prettyDate(m.created_at)}</small></article>)}
         {!currentMessages.length&&<Empty title="Say hello" description="Write a short introduction or ask a question about this child."/>}
        </div>
        {currentThread.status==="open"?<div className="scom-compose">
         <textarea className="input" value={draftMessage} maxLength={2000}
          placeholder="Write a private message to the verified family or teacher…"
          onChange={e=>setDraftMessage(e.target.value)}/>
         <button className="button" disabled={busy||!draftMessage.trim()} onClick={sendMessage}>Send Message</button>
        </div>:<p className="scom-closed">This conversation was closed. Contact your school for support.</p>}
       </>:<Empty title="No conversation selected" description="Begin a verified conversation using the New Conversation button."/>}
      </section>
     </div>
     <section className="scom-panel"><h2>My notifications</h2>
      {data.notifications.map(n=><div className="scom-alert" key={n.id} role="button" tabIndex={0} style={{cursor:"pointer"}}
       onClick={e=>{if(e.target.closest("button"))return;openThread(n.thread_id);}} onKeyDown={e=>{if(e.key==="Enter")openThread(n.thread_id);}}>
       <div><strong>New family message</strong><small>{prettyDate(n.created_at)} ·
        {n.email_status==="not_configured"?" In-app alert only":" Email status: "+n.email_status}</small></div>
       {n.read_at?<span className="scom-read-state">✓ Read</span>:
        <button className="button secondary small" onClick={()=>save({
          action:"notification.read",notificationId:n.id
        },"Notification marked as read.")}>Mark read</button>}
      </div>)}
      {!data.notifications.length&&<Empty title="No message alerts" description="Notifications appear after a verified teacher or guardian sends you a message."/>}
     </section>
    </>}
    {tab==="access"&&actor.owner&&<section className="scom-panel">
     <h2>Owner-controlled staff access</h2>
     <p>Each approved school administrator can receive timetable or announcement permission independently. These switches never allow access to private family messages.</p>
     <div className="table-wrap"><table><thead><tr><th>Administrator</th><th>Current permissions</th><th>Action</th></tr></thead><tbody>
      {data.adminGrants.map(g=><tr key={g.userId}><td><strong>{g.email}</strong>
       <small className="scom-user-id">{g.userId.slice(0,8)}…</small></td>
       <td>{g.permissions.length?g.permissions.join(", "):"No communication access"}</td>
       <td><button className="button secondary small" onClick={()=>open("access",{admin:g,permissions:[...g.permissions],reason:""})}>Edit ON/OFF switches</button></td>
      </tr>)}</tbody></table>
      {!data.adminGrants.length&&<Empty title="No approved administrators" description="Invite a school administrator first, then grant limited access here."/>}</div>
    </section>}
    <footer className="scom-footer">School ID {school.code} · Kigali time zone · In-app alerts only · No unverified parent or teacher access · No platform-owner payment data</footer>
   </main>
  </div>
  {modal&&<Dialog title={modalName[modal]||"Start a private conversation"}
   onClose={()=>{setModal(null);setError("");}}>
   {error&&<div className="notice error" role="alert">{error}</div>}
   {modal==="period"&&<form onSubmit={e=>{e.preventDefault();save({action:"period.add",...form});}}>
    <p className="muted">Choose a verified teacher assignment. Overlapping lessons are rejected by the database.</p>
    <Field label="Class"><select className="input" value={form.classId||""} required onChange={e=>{
     const a=classAssignments.find(a=>a.class_id===e.target.value);
     setForm({...form,classId:e.target.value,teacherId:a?.teacher_id||"",subjectId:a?.subject_id||""});}}>
     {data.classes.map(c=><option key={c.id} value={c.id}>{c.name}{c.section?" · "+c.section:""}</option>)}</select></Field>
    <Field label="Approved teacher"><select className="input" value={form.teacherId||""} required onChange={e=>{
     const a=eligibleAssignments.find(a=>a.teacher_id===e.target.value);
     setForm({...form,teacherId:e.target.value,subjectId:a?.subject_id||""});}}>
     {[...new Set(eligibleAssignments.map(a=>a.teacher_id))].map(id=><option key={id} value={id}>{teacherNames.get(id)||"Verified teacher"}</option>)}</select></Field>
    <Field label="Assigned subject"><select className="input" value={form.subjectId||""} required onChange={e=>setForm({...form,subjectId:e.target.value})}>
     {newPeriodTeacherAssignments.map(a=><option key={a.subject_id} value={a.subject_id}>{subjects.get(a.subject_id)||"Subject"}</option>)}</select></Field>
    <Field label="Weekday"><select className="input" value={form.weekday} onChange={e=>setForm({...form,weekday:Number(e.target.value)})}>
     {DAYS.map((d,i)=><option key={i} value={i+1}>{d}</option>)}</select></Field>
    <div className="scom-two-fields">
     <Field label="Start · Rwanda time"><input className="input" type="time" required value={form.start}
      onChange={e=>setForm({...form,start:e.target.value})}/></Field>
     <Field label="End · Rwanda time"><input className="input" type="time" required value={form.end}
      onChange={e=>setForm({...form,end:e.target.value})}/></Field></div>
    <Field label="Room or location (optional)"><input className="input" maxLength={60} value={form.room||""}
     onChange={e=>setForm({...form,room:e.target.value})}/></Field>
    <button type="submit" className="button" disabled={busy||!formSubjectIsValid}>Schedule lesson </button>
   </form>}
   {modal==="announce"&&<form onSubmit={e=>{e.preventDefault();save({action:"announcement.publish",...form,
    expiresAt:form.expiresAt?schoolIso(form.expiresAt):null});}}>
    <Field label="Announcement title"><input className="input" required minLength={3} maxLength={160}
     value={form.title||""} onChange={e=>setForm({...form,title:e.target.value})}/></Field>
    <Field label="Message to school"><textarea className="input" required minLength={3} maxLength={4000}
     rows={5} value={form.text||""} onChange={e=>setForm({...form,text:e.target.value})}/></Field>
    <Field label="Who can read it?"><select className="input" value={form.audience||"all"}
     onChange={e=>setForm({...form,audience:e.target.value})}>
     {AUDIENCES.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select></Field>
    {form.audience==="class"&&<Field label="Authorized class"><select className="input" required
      value={form.classId||""} onChange={e=>setForm({...form,classId:e.target.value})}>
      <option value="">Choose class</option>
      {data.classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
    <Field label="Expiration in Rwanda (optional)"><input className="input" type="datetime-local"
     value={form.expiresAt||""} onChange={e=>setForm({...form,expiresAt:e.target.value})}/></Field>
    <div className="scom-private-note">This is published only to verified accounts within the selected school audience. In-app display is active; email/SMS sending is not yet configured.</div>
    <button type="submit" className="button" disabled={busy||form.audience==="class"&&!form.classId}>Publish </button>
   </form>}
   {modal==="event"&&<form onSubmit={e=>{e.preventDefault();save({action:"calendar.schedule",...form,
     startsAt:schoolIso(form.startsLocal),endsAt:schoolIso(form.endsLocal)});}}>
    <Field label="Event title"><input className="input" required minLength={3} maxLength={160}
     value={form.title||""} onChange={e=>setForm({...form,title:e.target.value})}/></Field>
    <Field label="Event type"><select className="input" value={form.kind||"meeting"}
     onChange={e=>setForm({...form,kind:e.target.value})}>
     {EVENT_KINDS.map(x=><option value={x} key={x}>{x[0].toUpperCase()+x.slice(1)}</option>)}</select></Field>
    <Field label="Event details"><textarea className="input" maxLength={1500} value={form.details||""}
     onChange={e=>setForm({...form,details:e.target.value})}/></Field>
    <Field label="Visibility"><select className="input" value={form.audience||"all"}
     onChange={e=>setForm({...form,audience:e.target.value})}>
      {AUDIENCES.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select></Field>
    {form.audience==="class"&&<Field label="Class"><select className="input" required
      value={form.classId||""} onChange={e=>setForm({...form,classId:e.target.value})}>
      <option value="">Select class</option>
      {data.classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
    <div className="scom-two-fields">
     <Field label="Starts (Rwanda time)"><input type="datetime-local" required className="input"
      value={form.startsLocal||""} onChange={e=>setForm({...form,startsLocal:e.target.value})}/></Field>
     <Field label="Ends (Rwanda time)"><input type="datetime-local" required className="input"
      value={form.endsLocal||""} onChange={e=>setForm({...form,endsLocal:e.target.value})}/></Field></div>
    <Field label="Location"><input className="input" maxLength={120} value={form.location||""}
      onChange={e=>setForm({...form,location:e.target.value})}/></Field>
    <button className="button" type="submit" disabled={busy}>Save school event </button>
   </form>}
   {["periodDisable","archive","eventCancel","closeThread"].includes(modal)&&<form onSubmit={e=>{
    e.preventDefault();
    const action=({periodDisable:"period.disable",archive:"announcement.archive",
      eventCancel:"calendar.cancel",closeThread:"thread.close"})[modal];
    const ids=modal==="periodDisable"?{periodId:form.period.id}:
     modal==="archive"?{announcementId:form.announcement.id}:
     modal==="eventCancel"?{eventId:form.event.id}:{threadId:form.thread.id};
    save({action,reason:form.reason,...ids});
   }}>
    <p>Explain the reason for this change. Previous records are kept for audit; no personal messages are deleted.</p>
    <Field label="Audit reason"><textarea className="input" required minLength={8} maxLength={500}
     value={form.reason||""} onChange={e=>setForm({...form,reason:e.target.value})}/></Field>
    <button className="button danger" type="submit" disabled={busy}>Confirm change</button>
   </form>}
   {modal==="contact"&&<div>
    <p className="muted">Select a school-verified contact. A teacher must be currently assigned to the student's class, and the guardian link must still be active.</p>
    <div className="scom-contact-list">{data.contacts.map(c=><button className="scom-contact" key={c.key}
      disabled={busy} onClick={()=>startConversation(c)}>
      <strong>{c.label}</strong><small>{c.className} · {c.subjectName}</small>
     </button>)}</div>
    {!data.contacts.length&&<Empty title="No verified contacts" description="The school must link each guardian and assign the teacher before messaging."/>}
   </div>}
   {modal==="access"&&<form onSubmit={e=>{e.preventDefault();save({action:"permissions.set",
      userId:form.admin.userId,permissions:form.permissions,reason:form.reason});}}>
    <p>Administrator <strong>{form.admin.email}</strong>. Switches are school-specific and do not grant private family message access.</p>
    <div className="table-wrap"><table><thead><tr><th>Module</th><th>Authorized capability</th><th>ON / OFF</th></tr></thead>
     <tbody>{PERMISSIONS.map(p=><tr key={p.id}><td>{p.id}</td><td>{p.name}</td>
      <td><label className="switch"><input type="checkbox" role="switch" aria-label={p.name}
       checked={form.permissions.includes(p.id)}
       onChange={e=>setForm(old=>({...old,permissions:e.target.checked?
        [...old.permissions,p.id]:old.permissions.filter(x=>x!==p.id)}))}/>
       <span className="switch-track"/></label></td></tr>)}</tbody></table></div>
    <Field label="Reason for access change"><textarea className="input" required minLength={8}
      maxLength={500} value={form.reason||""} onChange={e=>setForm({...form,reason:e.target.value})}/></Field>
    <button type="submit" className="button" disabled={busy}>Save permissions </button>
   </form>}
  </Dialog>}
 </div>;
}
