"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {useRouter,useSearchParams} from "next/navigation";
import {browserSupabase} from "../../../../lib/client.js";
import {Icon} from "../../../ui/DashboardShell.jsx";
import "./settings.css";

export const LEVEL_NAME={nursery:"Nursery",primary:"Primary",secondary:"Secondary (O and A level)",tvet:"TVET",university:"University / College"};
const LEVEL_SHORT={nursery:"Nursery",primary:"Primary",secondary:"Secondary",tvet:"TVET",university:"University"};
const LEVEL_EXAMPLE={nursery:"Nursery 1",primary:"Primary 4",secondary:"Senior 2",tvet:"Level 3 Plumbing",university:"Year 1 Business"};
const ALL_LEVELS=["nursery","primary","secondary","tvet","university"];
const CATEGORY={tuition:"Tuition",registration:"Registration",boarding:"Boarding",transport:"Transport",meals:"Meals",examination:"Examination",other:"Other"};
const rwf=v=>Number(v||0).toLocaleString("en-US")+" RWF";
const day=d=>d?new Date(d+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"";
const SECTIONS=[
 ["levels","School levels","Which levels your school teaches: nursery, primary, secondary, TVET, university","building"],
 ["years","Academic years","The school calendar and which year is running now","calendar"],
 ["classes","Classes","Every class in each level, with how many students are in it","users"],
 ["courses","Subjects and courses","Your subjects, and which subjects each class studies","book"],
 ["teachers","Teachers","Add teachers, give them a login, and choose what they teach","cap"],
 ["fees","School fees","How much each class pays, per term or per year","wallet"],
 ["board","Board of directors","Board members and their terms","building"],
 ["staff","Staff access","Principals, staff, logins and permissions","gear"]
];

export default function SchoolSettings({code}){
 const sp=useSearchParams(),router=useRouter();
 const section=SECTIONS.some(s=>s[0]===sp.get("section"))?sp.get("section"):"levels";
 const [client,setClient]=useState(null),[d,setD]=useState(null),[err,setErr]=useState(""),[note,setNote]=useState(null),[busy,setBusy]=useState(false);
 useEffect(()=>{setClient(browserSupabase());},[]);
 const call=useCallback(async(path,body)=>{
  const {data:{session}}=await client.auth.getSession();
  if(!session)throw Error("Your school sign-in has expired. Sign in again.");
  const r=await fetch("/api/school/"+code+(path?"/"+path:""),{method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+session.access_token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(j.error||"Request failed");return j;
 },[client,code]);
 const load=useCallback(()=>call("settings").then(x=>{setD(x);setErr("");}).catch(e=>setErr(e.message)),[call]);
 useEffect(()=>{if(client)load();},[client,load]);
 // Runs a change, shows the result, and reloads. Returns the response, or null when it failed.
 const run=useCallback(async(path,body,ok)=>{
  setBusy(true);setNote(null);
  try{const j=await call(path,body);await load();if(ok)setNote({ok:true,text:typeof ok==="function"?ok(j):ok});return j;}
  catch(e){setNote({ok:false,text:e.message});return null;}
  finally{setBusy(false);}
 },[call,load]);
 const go=s=>{setNote(null);router.push("/s/"+code+"/settings?section="+s,{scroll:false});};
 if(err&&!d)return <section className="ds-panel"><h3>School settings are not available</h3><p role="alert">{err}</p></section>;
 if(!d)return <section className="ds-panel"><p>Loading school settings…</p></section>;
 const props={d,code,run,busy,call,load,setNote,go};
 const meta=SECTIONS.find(s=>s[0]===section);
 return <div className="st-wrap">
  <header className="st-head"><div><h2>School Settings</h2><p>Set up {d.school.name} step by step. Everything the school needs is here: levels, years, classes, subjects, teachers, fees and the board.</p></div></header>
  <div className="st-body">
   <nav className="st-nav" aria-label="Settings sections">{SECTIONS.map(([k,l,h,ic],i)=><button key={k} className={section===k?"on":""} onClick={()=>go(k)} aria-current={section===k?"page":undefined}>
    <span className="st-step">{i+1}</span><span><b>{l}</b><small>{h}</small></span></button>)}</nav>
   <main className="st-main">
    <div className="st-sechead"><Icon name={meta[3]}/><div><h3>{meta[1]}</h3><p>{meta[2]}</p></div></div>
    {note&&<div className={"notice "+(note.ok?"info":"error")} role={note.ok?"status":"alert"}>{note.text}</div>}
    {section==="levels"&&<Levels {...props}/>}
    {section==="years"&&<Years {...props}/>}
    {section==="classes"&&<Classes {...props}/>}
    {section==="courses"&&<Courses {...props}/>}
    {section==="teachers"&&<Teachers {...props}/>}
    {section==="fees"&&<Fees {...props}/>}
    {section==="board"&&<Board {...props}/>}
    {section==="staff"&&<Staff {...props}/>}
   </main>
  </div>
 </div>;
}

function LevelTabs({levels,value,onChange,all}){
 return <div className="st-pills" role="tablist" aria-label="Education level">
  {all&&<button role="tab" aria-selected={value==="all"} className={value==="all"?"on":""} onClick={()=>onChange("all")}>All levels</button>}
  {levels.map(l=><button key={l} role="tab" aria-selected={value===l} className={value===l?"on":""} onClick={()=>onChange(l)}>{LEVEL_SHORT[l]}</button>)}
 </div>;
}
const offered=d=>d.levels.length?ALL_LEVELS.filter(l=>d.levels.includes(l)):ALL_LEVELS;
const yearClasses=d=>d.classes.filter(c=>c.status!=="archived"&&(!d.currentYear||c.academic_year_id===d.currentYear.id));
const cname=c=>c?c.name+(c.section?" "+c.section:""):"Class";

function Levels({d,run,busy}){
 const [pick,setPick]=useState(d.levels);
 const changed=pick.slice().sort().join()!==d.levels.slice().sort().join();
 const used=l=>d.classes.some(c=>c.level_band===l);
 return <section className="ds-panel">
  <p>Tick every level your school teaches. Classes, courses, fees and the teacher screens then only show these levels.</p>
  <div className="st-levels">{ALL_LEVELS.map(l=><label key={l} className={pick.includes(l)?"on":""}>
   <input type="checkbox" checked={pick.includes(l)} disabled={!d.actor.isOwner} onChange={e=>setPick(p=>e.target.checked?[...p,l]:p.filter(x=>x!==l))}/>
   <b>{LEVEL_NAME[l]}</b><small>Example class: {LEVEL_EXAMPLE[l]}{used(l)?" · "+d.classes.filter(c=>c.level_band===l).length+" classes":""}</small></label>)}</div>
  {pick.some(l=>!d.levels.includes(l))&&<p className="muted">After saving, add the classes for the new level under Classes.</p>}
  {d.levels.some(l=>!pick.includes(l)&&used(l))&&<p className="notice error">You unticked a level that still has classes. Those classes keep working, but new classes cannot be added to that level.</p>}
  {d.actor.isOwner?<button className="button" disabled={busy||!changed||!pick.length} onClick={()=>run("",{action:"saveLevels",educationLevels:pick},"School levels saved")}>Save levels</button>
   :<p className="muted">Only the school owner can change the levels.</p>}
 </section>;
}

function Years({d,run,busy}){
 const [f,setF]=useState(null);
 return <section className="ds-panel">
  <p>The current year is the one teachers, students, fees and reports use now. Add next year early, then switch when it starts.</p>
  <table className="st-table"><thead><tr><th>Year</th><th>Dates</th><th>Status</th><th/></tr></thead><tbody>
   {d.years.map(y=><tr key={y.id}><td><b>{y.name}</b></td><td>{day(y.starts_on)} to {day(y.ends_on)}</td>
    <td><span className={"st-tag "+(y.status==="current"?"ok":"")}>{y.status==="current"?"Current year":y.status==="planned"?"Planned":"Finished"}</span></td>
    <td>{y.status!=="current"&&<button className="button secondary small" disabled={busy} onClick={()=>run("admin",{action:"academic.yearCurrent",id:y.id},y.name+" is now the current year")}>Make current</button>}</td></tr>)}
   {!d.years.length&&<tr><td colSpan={4}>No academic year yet. Add the first one below.</td></tr>}
  </tbody></table>
  {!f?<button className="button" onClick={()=>setF({name:"",startsOn:"",endsOn:""})}><Icon name="calendar" size={16}/> Add academic year</button>
   :<form className="st-form" onSubmit={async e=>{e.preventDefault();if(await run("admin",{action:"academic.year",...f},"Academic year "+f.name+" added"))setF(null);}}>
    <label>Name<input className="input" required minLength={3} maxLength={40} placeholder="2027-2028" value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label>
    <label>Starts<input className="input" type="date" required value={f.startsOn} onChange={e=>setF({...f,startsOn:e.target.value})}/></label>
    <label>Ends<input className="input" type="date" required value={f.endsOn} onChange={e=>setF({...f,endsOn:e.target.value})}/></label>
    <div className="st-actions"><button className="button" disabled={busy}>Save year</button><button type="button" className="button secondary" onClick={()=>setF(null)}>Cancel</button></div></form>}
 </section>;
}

function Classes({d,run,busy}){
 const lv=offered(d),[level,setLevel]=useState(lv[0]),[f,setF]=useState(null);
 const list=yearClasses(d).filter(c=>c.level_band===level);
 return <section className="ds-panel">
  {!d.currentYear&&<p className="notice error">Add an academic year and make it current first.</p>}
  <LevelTabs levels={lv} value={level} onChange={setLevel}/>
  <table className="st-table"><thead><tr><th>Class</th><th>Grade</th><th>Students</th><th>Places</th><th>Subjects</th><th>Teachers</th></tr></thead><tbody>
   {list.map(c=><tr key={c.id}><td><b>{cname(c)}</b></td><td>{c.level}</td><td>{c.students}</td><td>{c.capacity||"Not set"}</td>
    <td>{d.classSubjects.filter(m=>m.class_id===c.id).length}</td><td>{new Set(d.assignments.filter(a=>a.class_id===c.id).map(a=>a.teacher_id)).size}</td></tr>)}
   {!list.length&&<tr><td colSpan={6}>No {LEVEL_SHORT[level]} classes in {d.currentYear?.name||"this year"} yet.</td></tr>}
  </tbody></table>
  {d.currentYear&&(!f?<button className="button" onClick={()=>setF({name:"",level:"",section:"",capacity:""})}><Icon name="users" size={16}/> Add a {LEVEL_SHORT[level]} class</button>
   :<form className="st-form" onSubmit={async e=>{e.preventDefault();if(await run("admin",{action:"academic.class",yearId:d.currentYear.id,levelBand:level,name:f.name,level:f.level||f.name,section:f.section,capacity:f.capacity},cname({name:f.name,section:f.section})+" added to "+LEVEL_SHORT[level]))setF(null);}}>
    <label>Class name<input className="input" required maxLength={100} placeholder={LEVEL_EXAMPLE[level]} value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label>
    <label>Grade (optional)<input className="input" maxLength={100} placeholder={"Example: "+LEVEL_EXAMPLE[level]} value={f.level} onChange={e=>setF({...f,level:e.target.value})}/></label>
    <label>Stream (optional)<input className="input" maxLength={50} placeholder="A" value={f.section} onChange={e=>setF({...f,section:e.target.value})}/></label>
    <label>Places (optional)<input className="input" type="number" min={1} max={2000} placeholder="40" value={f.capacity} onChange={e=>setF({...f,capacity:e.target.value})}/></label>
    <div className="st-actions"><button className="button" disabled={busy}>Save class</button><button type="button" className="button secondary" onClick={()=>setF(null)}>Cancel</button></div></form>)}
 </section>;
}

function Courses({d,run,busy}){
 const lv=offered(d),[level,setLevel]=useState(lv[0]),[sf,setSf]=useState(null);
 const list=yearClasses(d).filter(c=>c.level_band===level);
 const [cls,setCls]=useState("");
 const c=list.find(x=>x.id===cls)||list[0];
 const linked=id=>c&&d.classSubjects.some(m=>m.class_id===c.id&&m.subject_id===id);
 const teacherOf=id=>d.assignments.filter(a=>c&&a.class_id===c.id&&a.subject_id===id).map(a=>d.teachers.find(t=>t.id===a.teacher_id)).filter(Boolean);
 return <>
  <section className="ds-panel">
   <p>A course is one subject taught to one class, for example Mathematics in Primary 4 A. Tick the subjects each class studies. Each ticked subject becomes a course card for its students and teachers.</p>
   <LevelTabs levels={lv} value={level} onChange={l=>{setLevel(l);setCls("");}}/>
   {!list.length?<p>No {LEVEL_SHORT[level]} classes yet. Add them under Classes first.</p>:<>
    <div className="st-pills sub">{list.map(x=><button key={x.id} className={c?.id===x.id?"on":""} onClick={()=>setCls(x.id)}>{cname(x)}</button>)}</div>
    <div className="st-grid">{d.subjects.map(s=>{const on=linked(s.id),t=teacherOf(s.id);return <label key={s.id} className={"st-check"+(on?" on":"")}>
     <input type="checkbox" checked={!!on} disabled={busy} onChange={e=>run("admin",{action:e.target.checked?"academic.classSubject":"academic.classSubjectRemove",classId:c.id,subjectId:s.id},
      (e.target.checked?"Added ":"Removed ")+s.name+(e.target.checked?" to ":" from ")+cname(c))}/>
     <span><b>{s.name}</b><small>{s.code}{on?(t.length?" · "+t.map(x=>x.name||x.email).join(", "):" · no teacher yet"):""}</small></span></label>;})}</div>
    {!d.subjects.length&&<p>No subjects yet. Add the first subject below.</p>}
   </>}
  </section>
  <section className="ds-panel"><h3>Subjects</h3>
   <p className="muted">{d.subjects.length} subjects. A subject is created once for the whole school, then ticked for each class above.</p>
   {!sf?<button className="button" onClick={()=>setSf({code:"",name:""})}><Icon name="book" size={16}/> Add a subject</button>
    :<form className="st-form" onSubmit={async e=>{e.preventDefault();if(await run("admin",{action:"academic.subject",...sf},"Subject "+sf.name+" added"))setSf(null);}}>
     <label>Subject name<input className="input" required minLength={2} maxLength={100} placeholder="Mathematics" value={sf.name} onChange={e=>setSf({...sf,name:e.target.value})}/></label>
     <label>Short code<input className="input" required pattern="[A-Za-z0-9_\-]{2,20}" maxLength={20} placeholder="MATH" value={sf.code} onChange={e=>setSf({...sf,code:e.target.value.toUpperCase()})}/></label>
     <div className="st-actions"><button className="button" disabled={busy}>Save subject</button><button type="button" className="button secondary" onClick={()=>setSf(null)}>Cancel</button></div></form>}
  </section>
 </>;
}

function Teachers({d,code,run,busy,call,load,setNote}){
 const lv=offered(d);
 const [level,setLevel]=useState(lv[0]),[a,setA]=useState({teacherId:"",classId:"",subjectId:""}),[add,setAdd]=useState(null),[issued,setIssued]=useState(null),[q,setQ]=useState(""),[confirmId,setConfirmId]=useState(null);
 const canManage=d.actor.isOwner||d.actor.permissions?.includes("people.manage");
 const classes=yearClasses(d).filter(c=>c.level_band===level);
 const cls=classes.find(c=>c.id===a.classId);
 const subs=cls?d.subjects.filter(s=>d.classSubjects.some(m=>m.class_id===cls.id&&m.subject_id===s.id)):[];
 const other=cls?d.subjects.filter(s=>!subs.includes(s)):[];
 const C=new Map(d.classes.map(c=>[c.id,c])),S=new Map(d.subjects.map(s=>[s.id,s]));
 const shown=d.teachers.filter(t=>!q||(t.name+" "+t.email).toLowerCase().includes(q.toLowerCase()));
 async function assign(e){
  e.preventDefault();
  const linked=subs.some(s=>s.id===a.subjectId);
  const t=d.teachers.find(x=>x.id===a.teacherId),s=S.get(a.subjectId);
  if(!linked){const ok=await run("admin",{action:"academic.classSubject",classId:a.classId,subjectId:a.subjectId});if(!ok)return;}
  if(await run("classroom",{action:"teacher.assign",teacherId:a.teacherId,classId:a.classId,subjectId:a.subjectId},(t?.name||t?.email)+" now teaches "+s?.name+" in "+cname(cls)))setA({...a,subjectId:""});
 }
 async function giveLogin(t){
  const j=await run("member-password",{action:"reset",userId:t.id});
  if(j)setIssued({name:t.name||t.email,login:j.login,password:j.temporaryPassword});
 }
 async function addTeacher(e){
  e.preventDefault();
  const name=add.name.trim();
  const email=add.mode==="school"?(name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,".").replace(/^\.|\.$/g,"")+"."+Math.floor(100+Math.random()*900)+"@"+code.toLowerCase()+".school.test"):add.email.trim().toLowerCase();
  const j=await run("people-import",{people:[{name,email,role:"teacher"}]});
  if(!j)return;
  if(j.failures?.length){setNote({ok:false,text:"The teacher could not be added: "+j.failures[0].error});return;}
  setAdd(null);
  const fresh=await call("settings");
  const t=fresh.teachers.find(x=>x.email===email);
  if(t&&add.mode==="school"){await giveLogin(t);}
  else setNote({ok:true,text:name+" was added. They sign in at the school login page with "+email+" and press Forgot password the first time to choose a password."});
  setA(x=>({...x,teacherId:t?.id||""}));
 }
 return <>
  {issued&&<section className="ds-panel st-issued" role="status"><h3>Login for {issued.name}</h3>
   <p>Give these to the teacher. They choose their own password the first time they sign in. This password is shown only once.</p>
   <p>Sign-in page: <code>{typeof window!=="undefined"?location.origin:""}/s/{code}/login</code><br/>Login: <code>{issued.login}</code><br/>First password: <code>{issued.password}</code></p>
   <button className="button secondary small" onClick={()=>setIssued(null)}>Done, I gave it to the teacher</button></section>}
  <section className="ds-panel"><h3>Choose what a teacher teaches</h3>
   <p className="muted">Pick the level, the class and the subject, then the teacher. The teacher then sees that course in My Courses.</p>
   <LevelTabs levels={lv} value={level} onChange={l=>{setLevel(l);setA({...a,classId:"",subjectId:""});}}/>
   <form className="st-form" onSubmit={assign}>
    <label>Class<select className="input" required value={a.classId} onChange={e=>setA({...a,classId:e.target.value,subjectId:""})}><option value="">Choose a class</option>{classes.map(c=><option key={c.id} value={c.id}>{cname(c)}</option>)}</select></label>
    <label>Subject<select className="input" required disabled={!cls} value={a.subjectId} onChange={e=>setA({...a,subjectId:e.target.value})}><option value="">{cls?"Choose a subject":"Choose a class first"}</option>
     {subs.length>0&&<optgroup label={"Subjects of "+cname(cls)}>{subs.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>}
     {other.length>0&&<optgroup label="Other subjects (will be added to this class)">{other.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>}</select></label>
    <label>Teacher<select className="input" required value={a.teacherId} onChange={e=>setA({...a,teacherId:e.target.value})}><option value="">Choose a teacher</option>{d.teachers.map(t=><option key={t.id} value={t.id}>{t.name||t.email}</option>)}</select></label>
    <div className="st-actions"><button className="button" disabled={busy||!a.teacherId||!a.classId||!a.subjectId}>Assign teacher</button></div>
   </form>
   {!classes.length&&<p className="muted">No {LEVEL_SHORT[level]} classes yet. Add them under Classes.</p>}
  </section>
  <section className="ds-panel">
   <div className="st-row"><h3>Teachers ({d.teachers.length})</h3>
    <div className="st-row"><input className="input" aria-label="Search teachers" placeholder="Search teachers" value={q} onChange={e=>setQ(e.target.value)}/>
     {d.actor.isOwner&&!add&&<button className="button" onClick={()=>setAdd({name:"",email:"",mode:"school"})}><Icon name="users" size={16}/> Add a teacher</button>}</div></div>
   {add&&<form className="st-form st-addform" onSubmit={addTeacher}>
    <label>Full name<input className="input" required minLength={3} maxLength={120} placeholder="Jeanne Uwase" value={add.name} onChange={e=>setAdd({...add,name:e.target.value})}/></label>
    <fieldset className="st-radio"><legend>How will the teacher sign in?</legend>
     <label><input type="radio" checked={add.mode==="school"} onChange={()=>setAdd({...add,mode:"school"})}/> The school gives a login and first password (best when the teacher has no email)</label>
     <label><input type="radio" checked={add.mode==="email"} onChange={()=>setAdd({...add,mode:"email"})}/> With the teacher's own email address</label></fieldset>
    {add.mode==="email"&&<label>Teacher's email<input className="input" type="email" required value={add.email} onChange={e=>setAdd({...add,email:e.target.value})}/></label>}
    <div className="st-actions"><button className="button" disabled={busy}>Add teacher</button><button type="button" className="button secondary" onClick={()=>setAdd(null)}>Cancel</button></div></form>}
   <table className="st-table"><thead><tr><th>Teacher</th><th>Teaches</th><th>Login</th></tr></thead><tbody>
    {shown.map(t=>{const mine=d.assignments.filter(x=>x.teacher_id===t.id&&C.has(x.class_id));return <tr key={t.id}>
     <td><b>{t.name||"No name"}</b><br/><small className="muted">{t.email}</small></td>
     <td>{mine.length?<div className="st-chips">{mine.map(x=><span key={x.class_id+x.subject_id} className="st-chip">{cname(C.get(x.class_id))} · {S.get(x.subject_id)?.name}
      <button aria-label={"Remove "+S.get(x.subject_id)?.name+" in "+cname(C.get(x.class_id))} disabled={busy} onClick={()=>run("classroom",{action:"teacher.revoke",teacherId:t.id,classId:x.class_id,subjectId:x.subject_id,reason:"Changed by the school in School Settings"},(t.name||t.email)+" no longer teaches "+S.get(x.subject_id)?.name+" in "+cname(C.get(x.class_id)))}>×</button></span>)}</div>
      :<span className="muted">Nothing assigned yet</span>}</td>
     <td><div className="st-col">{t.schoolIssued?(d.actor.isOwner?<button className="button secondary small" disabled={busy} onClick={()=>giveLogin(t)}>Give new password</button>:<span className="muted">School login</span>)
      :<small className="muted">Own email: uses Forgot password</small>}
      {canManage&&(confirmId===t.id
       ?<span className="st-confirm">Remove {t.name||"this teacher"} from the school?<button className="button small danger" disabled={busy} onClick={async()=>{for(const x of mine)await run("classroom",{action:"teacher.revoke",teacherId:t.id,classId:x.class_id,subjectId:x.subject_id,reason:"Teacher removed from the school in School Settings"});
         await run("admin",{action:"member.revoke",userId:t.id,role:"teacher",reason:"Teacher removed from the school in School Settings"},(t.name||t.email)+" was removed from the school and can no longer sign in here.");setConfirmId(null);}}>Yes, remove</button>
        <button className="button secondary small" onClick={()=>setConfirmId(null)}>No</button></span>
       :<button className="button secondary small" disabled={busy} onClick={()=>setConfirmId(t.id)}>Remove from school</button>)}</div></td></tr>;})}
    {!shown.length&&<tr><td colSpan={3}>{d.teachers.length?"No teacher matches your search.":"No teachers yet. Add the first teacher."}</td></tr>}
   </tbody></table>
  </section>
 </>;
}

function Fees({d,code,run,busy}){
 const lv=offered(d),[level,setLevel]=useState("all"),[f,setF]=useState(null);
 const classes=yearClasses(d);
 const C=new Map(d.classes.map(c=>[c.id,c]));
 const active=d.fees.filter(x=>x.status==="active").sort((a,b)=>(a.class_id?cname(C.get(a.class_id)):"").localeCompare(b.class_id?cname(C.get(b.class_id)):"")||a.label.localeCompare(b.label));
 const [edit,setEdit]=useState(null);
 // Changing a fee: the new amount is saved as a new fee and the old one is stopped. Bills already sent stay as they were.
 async function change(e){e.preventDefault();
  const ok=await run("fees",{action:"fee.create",yearId:d.currentYear.id,classId:edit.class_id||null,category:edit.category,label:edit.label,term:edit.term_label||"",amount:String(edit.amount),dueOn:edit.due_on});
  if(!ok)return;
  if(await run("fees",{action:"fee.disable",feeId:edit.id,reason:"Replaced by a new amount in School Settings"},edit.label+" changed to "+rwf(edit.amount)+". Bills already sent keep the old amount."))setEdit(null);
 }
 const shown=active.filter(x=>level==="all"||(!x.class_id)||C.get(x.class_id)?.level_band===level);
 const perClass=classes.filter(c=>level==="all"||c.level_band===level).map(c=>({c,total:active.filter(x=>!x.class_id||x.class_id===c.id).reduce((a,x)=>a+Number(x.amount_rwf),0)}));
 return <>
  <section className="ds-panel">
   <p>Set what each class pays in {d.currentYear?.name||"the current year"}. A fee for "All classes" applies to every class. After setting fees, bill students and record payments on the Fees and Payments page.</p>
   {!d.currentYear&&<p className="notice error">Add an academic year and make it current first.</p>}
   <LevelTabs levels={lv} value={level} onChange={setLevel} all/>
   <table className="st-table"><thead><tr><th>Fee</th><th>For</th><th>Term</th><th>Amount</th><th>Due</th><th/></tr></thead><tbody>
    {shown.map(x=><tr key={x.id}><td><b>{x.label}</b><br/><small className="muted">{CATEGORY[x.category]||x.category}</small></td><td>{x.class_id?cname(C.get(x.class_id)):"All classes"}</td><td>{x.term_label||"Whole year"}</td>
     <td><b>{rwf(x.amount_rwf)}</b></td><td>{day(x.due_on)}</td>
     <td><div className="st-row" style={{justifyContent:"flex-start"}}><button className="button secondary small" disabled={busy} onClick={()=>setEdit({...x,amount:x.amount_rwf})}>Change</button>
      <button className="button secondary small" disabled={busy} onClick={()=>run("fees",{action:"fee.disable",feeId:x.id,reason:"Stopped by the school in School Settings"},x.label+" stopped. Bills already sent are not changed.")}>Stop</button></div></td></tr>)}
    {!shown.length&&<tr><td colSpan={6}>No fees set {level==="all"?"":"for "+LEVEL_SHORT[level]+" "}yet.</td></tr>}
   </tbody></table>
   {edit&&<form className="st-form" onSubmit={change} aria-label="Change fee"><strong style={{gridColumn:"1/-1"}}>Change {edit.label} for {edit.class_id?cname(C.get(edit.class_id)):"all classes"}</strong>
    <label>Fee name<input className="input" required minLength={3} maxLength={120} value={edit.label} onChange={e=>setEdit({...edit,label:e.target.value})}/></label>
    <label>Amount (RWF)<input className="input" required type="number" min={1} step={1} value={edit.amount} onChange={e=>setEdit({...edit,amount:e.target.value})}/></label>
    <label>Due date<input className="input" required type="date" value={edit.due_on} onChange={e=>setEdit({...edit,due_on:e.target.value})}/></label>
    <div className="st-actions"><button className="button" disabled={busy}>Save new amount</button><button type="button" className="button secondary" onClick={()=>setEdit(null)}>Cancel</button></div></form>}
   {d.currentYear&&!edit&&(!f?<button className="button" onClick={()=>setF({classId:"",category:"tuition",label:"",term:"Term 1",amount:"",dueOn:""})}><Icon name="wallet" size={16}/> Add a fee</button>
    :<form className="st-form" onSubmit={async e=>{e.preventDefault();if(await run("fees",{action:"fee.create",yearId:d.currentYear.id,classId:f.classId||null,category:f.category,label:f.label,term:f.term,amount:String(f.amount),dueOn:f.dueOn},f.label+" saved"))setF(null);}}>
     <label>Fee name<input className="input" required minLength={3} maxLength={120} placeholder="Term 1 tuition" value={f.label} onChange={e=>setF({...f,label:e.target.value})}/></label>
     <label>Type<select className="input" value={f.category} onChange={e=>setF({...f,category:e.target.value})}>{Object.entries(CATEGORY).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
     <label>For<select className="input" value={f.classId} onChange={e=>setF({...f,classId:e.target.value})}><option value="">All classes</option>
      {lv.map(l=>{const cs=classes.filter(c=>c.level_band===l);return cs.length?<optgroup key={l} label={LEVEL_SHORT[l]}>{cs.map(c=><option key={c.id} value={c.id}>{cname(c)}</option>)}</optgroup>:null;})}</select></label>
     <label>Term<input className="input" maxLength={50} placeholder="Term 1, or leave empty for the whole year" value={f.term} onChange={e=>setF({...f,term:e.target.value})}/></label>
     <label>Amount (RWF)<input className="input" required type="number" min={1} step={1} placeholder="150000" value={f.amount} onChange={e=>setF({...f,amount:e.target.value})}/></label>
     <label>Due date<input className="input" required type="date" value={f.dueOn} onChange={e=>setF({...f,dueOn:e.target.value})}/></label>
     <div className="st-actions"><button className="button" disabled={busy}>Save fee</button><button type="button" className="button secondary" onClick={()=>setF(null)}>Cancel</button></div></form>)}
  </section>
  <section className="ds-panel"><h3>Total per student by class</h3>
   <table className="st-table"><thead><tr><th>Class</th><th>Level</th><th>Students</th><th>Total fees per student</th></tr></thead><tbody>
    {perClass.map(({c,total})=><tr key={c.id}><td>{cname(c)}</td><td>{LEVEL_SHORT[c.level_band]||""}</td><td>{c.students}</td><td><b>{rwf(total)}</b></td></tr>)}
   </tbody></table>
   <a className="button secondary" href={"/s/"+code+"/fees"}>Bill students and record payments →</a>
  </section>
 </>;
}

function Board({d,run,busy}){
 const [f,setF]=useState(null);
 return <section className="ds-panel">
  <table className="st-table"><thead><tr><th>Name</th><th>Position</th><th>Phone</th><th>Term</th><th/></tr></thead><tbody>
   {d.board.map(m=><tr key={m.id}><td><b>{m.full_name}</b></td><td>{m.position}</td><td>{m.phone||""}</td><td>{m.term_start?day(m.term_start):""}{m.term_end?" to "+day(m.term_end):""}</td>
    <td><button className="button secondary small" disabled={busy} onClick={()=>run("operations",{action:"board.member.remove",memberId:m.id},m.full_name+" removed from the board")}>Remove</button></td></tr>)}
   {!d.board.length&&<tr><td colSpan={5}>No board members yet.</td></tr>}
  </tbody></table>
  {!f?<button className="button" onClick={()=>setF({fullName:"",position:"",phone:"",termStart:"",termEnd:""})}><Icon name="users" size={16}/> Add a board member</button>
   :<form className="st-form" onSubmit={async e=>{e.preventDefault();if(await run("operations",{action:"board.member",...f},f.fullName+" added to the board"))setF(null);}}>
    <label>Full name<input className="input" required minLength={3} maxLength={120} value={f.fullName} onChange={e=>setF({...f,fullName:e.target.value})}/></label>
    <label>Position<input className="input" required minLength={2} maxLength={80} placeholder="Chairperson" list="st-positions" value={f.position} onChange={e=>setF({...f,position:e.target.value})}/>
     <datalist id="st-positions">{["Chairperson","Vice Chairperson","Secretary","Treasurer","Parents' representative","Teachers' representative","Community representative","Member"].map(p=><option key={p} value={p}/>)}</datalist></label>
    <label>Phone (optional)<input className="input" maxLength={30} placeholder="078..." value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></label>
    <label>Term starts (optional)<input className="input" type="date" value={f.termStart} onChange={e=>setF({...f,termStart:e.target.value})}/></label>
    <label>Term ends (optional)<input className="input" type="date" value={f.termEnd} onChange={e=>setF({...f,termEnd:e.target.value})}/></label>
    <div className="st-actions"><button className="button" disabled={busy}>Save member</button><button type="button" className="button secondary" onClick={()=>setF(null)}>Cancel</button></div></form>}
 </section>;
}

function Staff({d,code}){
 const ROLE={school_admin:"Principal / administrator",staff:"School staff"};
 return <>
  <section className="ds-panel">
   <table className="st-table"><thead><tr><th>Name</th><th>Role</th><th>Login</th></tr></thead><tbody>
    {d.staff.map(s=><tr key={s.id}><td><b>{s.name||"No name"}</b></td><td>{s.roles.map(r=>ROLE[r]||r).join(", ")}</td><td><small>{s.email}</small></td></tr>)}
    {!d.staff.length&&<tr><td colSpan={3}>No principals or staff yet.</td></tr>}
   </tbody></table>
  </section>
  <section className="ds-panel"><h3>Manage access</h3>
   <div className="st-links">
    <a href={"/s/"+code+"/admin"}><b>Invite a principal or staff member</b><small>Send an invitation and choose what a principal is allowed to do</small></a>
    <a href={"/s/"+code+"/staff-logins"}><b>Staff and parent logins</b><small>Give a new first password to a school-issued login</small></a>
    <a href={"/s/"+code+"/student-logins"}><b>Student logins</b><small>Create and reset student IDs and passwords</small></a>
    <a href={"/s/"+code+"/fees"}><b>Finance permissions</b><small>Choose who can bill, record and approve payments (Fees and Payments page, Finance Permissions tab)</small></a>
    <a href={"/s/"+code+"/setup"}><b>School website and profile</b><small>Name, logo, contact details and the public school page</small></a>
   </div>
  </section>
 </>;
}
