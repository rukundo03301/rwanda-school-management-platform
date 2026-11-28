"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {useRouter,useSearchParams} from "next/navigation";
import {browserSupabase} from "../../../../lib/client.js";
import {Icon} from "../../../ui/DashboardShell.jsx";
import AssignmentTaker from "../learning/AssignmentTaker.jsx";
import "./courses.css";

const fmt=d=>d?new Date(d).toLocaleString("en-GB",{timeZone:"Africa/Kigali",weekday:"short",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"";
const day=d=>d?new Date(d).toLocaleDateString("en-GB",{timeZone:"Africa/Kigali",day:"numeric",month:"short"}):"";
const TYPE={quiz:{label:"Quiz",icon:"check",tone:"q"},assignment:{label:"Assignment",icon:"file",tone:"a"},video:{label:"Video",icon:"book",tone:"v"},link:{label:"Link",icon:"folder",tone:"l"},document:{label:"Document",icon:"file",tone:"d"}};
const GROUP=[["assignment","Assignments"],["quiz","Quizzes"],["video","Videos"],["document","Documents"],["link","Links"]];
const PALETTE=[["#1b4fd8","#6d8ff0"],["#0f766e","#34b3a6"],["#b45309","#f0a64a"],["#7c3aed","#a985f2"],["#be123c","#f07390"],["#0e7490","#4cc0db"],["#4d7c0f","#93c34a"],["#9d174d","#e06aa6"]];
const hash=s=>[...s].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7);
function Banner({seed,label}){
 const [a,b]=PALETTE[hash(seed)%PALETTE.length],n=hash(seed+"x")%4;
 return <div className="cr-banner" style={{background:`linear-gradient(135deg,${a},${b})`}} aria-hidden="true">
  <svg viewBox="0 0 200 90" preserveAspectRatio="none">{[0,1,2,3,4].map(i=><circle key={i} cx={(i*53+n*17)%200} cy={(i*29+n*11)%90} r={14+((i+n)%3)*10} fill="#fff" opacity=".12"/>)}</svg>
  <span>{label}</span></div>;
}
function Progress({percent,small}){return <div className={"cr-prog"+(small?" s":"")} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><i style={{width:percent+"%"}}/></div>;}

export default function CoursesView({code}){
 const sp=useSearchParams(),router=useRouter();
 const classId=sp.get("class")||"",subjectId=sp.get("subject")||"",studentQ=sp.get("student")||"",tabQ=sp.get("tab")||"course",itemQ=sp.get("item")||"";
 const [client,setClient]=useState(null);
 useEffect(()=>{setClient(browserSupabase());},[]);
 const call=useCallback(async(query,body)=>{
  const {data:{session}}=await client.auth.getSession();
  if(!session)throw Error("Your school sign-in has expired. Sign in again.");
  const r=await fetch("/api/school/"+code+"/"+(body?.api||"courses")+(query||""),{method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+session.access_token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify({...body,api:undefined})}:{})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(j.error||"Request failed");return j;
 },[client,code]);
 const go=q=>{const p=new URLSearchParams();for(const [k,v] of Object.entries(q))if(v)p.set(k,v);router.push("/s/"+code+"/courses"+(p.toString()?"?"+p:""));};
 if(!client)return <section className="ds-panel"><p>Loading courses…</p></section>;
 return classId&&subjectId
  ?<Course key={classId+subjectId+studentQ} code={code} call={call} classId={classId} subjectId={subjectId} studentQ={studentQ} tab={tabQ} itemQ={itemQ} go={go}/>
  :<CourseList code={code} call={call} go={go}/>;
}

function CourseList({call,go}){
 const [data,setData]=useState(null),[err,setErr]=useState(""),[q,setQ]=useState(""),[lens,setLens]=useState("all"),[sort,setSort]=useState("name");
 useEffect(()=>{call("").then(setData).catch(e=>setErr(e.message));},[call]);
 const lenses=useMemo(()=>{
  if(!data)return [];
  const l=[["all","All courses"]];const has=x=>data.courses.some(c=>c.lens.some(y=>y===x||y.startsWith(x)));
  if(has("teaching"))l.push(["teaching","I teach"]);if(has("learning"))l.push(["learning","I study"]);
  for(const ch of data.children)l.push(["child:"+ch.id,ch.name]);
  if(has("managing"))l.push(["managing","Whole school"]);return l;
 },[data]);
 if(err)return <section className="ds-panel"><p role="alert">{err}</p></section>;
 if(!data)return <section className="ds-panel"><p>Loading courses…</p></section>;
 let list=data.courses.filter(c=>lens==="all"||c.lens.includes(lens));
 if(q.trim()){const t=q.trim().toLowerCase();list=list.filter(c=>(c.subject+" "+c.className+" "+(c.subjectCode||"")).toLowerCase().includes(t));}
 if(sort==="due")list=[...list].sort((a,b)=>(a.nextDue?new Date(a.nextDue):Infinity)-(b.nextDue?new Date(b.nextDue):Infinity));
 if(sort==="progress")list=[...list].sort((a,b)=>(a.progress[0]?.percent??101)-(b.progress[0]?.percent??101));
 return <div className="cr-wrap">
  <header className="cr-head"><div><h2>My Courses</h2><small>{data.year?"Academic year "+data.year+" · ":""}{data.courses.length} course{data.courses.length===1?"":"s"}</small></div></header>
  <div className="cr-tools">
   <input className="input" aria-label="Search courses" placeholder="Search courses" value={q} onChange={e=>setQ(e.target.value)}/>
   <select className="input" aria-label="Show" value={lens} onChange={e=>setLens(e.target.value)}>{lenses.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
   <select className="input" aria-label="Sort" value={sort} onChange={e=>setSort(e.target.value)}><option value="name">Sort by course name</option><option value="due">Sort by next due date</option><option value="progress">Sort by least complete</option></select>
  </div>
  {!list.length&&<section className="ds-panel"><p>{data.courses.length?"No course matches your search.":"No courses yet. Courses appear when the school links subjects to your class or assigns you to teach them."}</p></section>}
  <div className="cr-grid">{list.map(c=>{
   const kids=c.progress.length?c.progress:[null];
   return kids.map(p=><button key={c.classId+c.subjectId+(p?.studentId||"")} className="cr-card" onClick={()=>go({class:c.classId,subject:c.subjectId,student:p?.name?p.studentId:""})}>
    <Banner seed={c.subject+c.classId} label={c.subjectCode||c.subject.slice(0,3).toUpperCase()}/>
    <div className="cr-card-b">
     <small className="cr-cat">{c.className}{c.level?" · "+c.level:""}</small>
     <strong>{c.subject}</strong>
     {p?<><Progress percent={p.percent}/><small><b>{p.percent}% complete</b>{p.name?" · "+p.name:""} · {p.done} of {p.total}</small></>
      :<small>{c.items} item{c.items===1?"":"s"} · {c.modules} module{c.modules===1?"":"s"}{c.lens.includes("teaching")?" · you teach":""}</small>}
     {c.nextDue&&<small className="cr-due">Next due {day(c.nextDue)}</small>}
    </div></button>);
  })}</div>
 </div>;
}

function Course({code,call,classId,subjectId,studentQ,tab,itemQ,go}){
 const [d,setD]=useState(null),[err,setErr]=useState(""),[note,setNote]=useState(""),[open,setOpen]=useState(()=>new Set(["general"])),[taking,setTaking]=useState(null),[busy,setBusy]=useState(false);
 const q="?classId="+classId+"&subjectId="+subjectId+(studentQ?"&student="+studentQ:"");
 const load=useCallback(()=>call(q).then(x=>{setD(x);setErr("");setOpen(o=>{const n=new Set(o);x.modules.forEach(m=>n.add(m.id));return n;});}).catch(e=>setErr(e.message)),[call,q]);
 useEffect(()=>{load();},[load]);
 useEffect(()=>{if(d&&itemQ){const it=d.items.find(i=>i.id===itemQ);if(it&&(it.type==="quiz"||it.type==="assignment")&&d.mode==="student")setTaking(it.id);
  setTimeout(()=>document.getElementById("it-"+itemQ)?.scrollIntoView({behavior:"smooth",block:"center"}),200);}},[d,itemQ]);
 const act=async(body,ok)=>{setBusy(true);setNote("");try{await call("",body);if(ok)setNote(ok);await load();}catch(e){setNote(e.message);}finally{setBusy(false);}};
 if(err)return <section className="ds-panel"><p role="alert">{err}</p><button className="button secondary" onClick={()=>go({})}>Back to My Courses</button></section>;
 if(!d)return <section className="ds-panel"><p>Opening course…</p></section>;
 const setTab=t=>go({class:classId,subject:subjectId,student:studentQ,tab:t==="course"?"":t});
 const sections=[{id:"general",title:"General",summary:"",items:d.items.filter(i=>!i.moduleId||!d.modules.some(m=>m.id===i.moduleId))},
  ...d.modules.map(m=>({...m,items:d.items.filter(i=>i.moduleId===m.id)}))];
 const pct=d.progress&&d.progress.total?Math.round(d.progress.done*100/d.progress.total):0;
 const toggle=id=>setOpen(o=>{const n=new Set(o);n.has(id)?n.delete(id):n.add(id);return n;});
 if(taking)return <div className="cr-wrap"><AssignmentTaker code={code} homeworkId={taking} onDone={load} onClose={()=>{setTaking(null);load();}}/></div>;
 return <div className="cr-wrap">
  <nav className="cr-crumb" aria-label="Breadcrumb"><button className="ds-link" onClick={()=>go({})}>My Courses</button> / <span>{d.course.subject}</span></nav>
  <header className="cr-course-head">
   <div><small className="cr-cat">{d.course.className}{d.course.level?" · "+d.course.level:""}</small><h2>{d.course.subject}{d.course.subjectCode?<small> ({d.course.subjectCode})</small>:null}</h2>
    <small>Teacher{d.course.teachers.length===1?"":"s"}: {d.course.teachers.join(", ")||"not assigned yet"}{d.learner?.name&&d.mode==="parent"?" · Progress for "+d.learner.name:""}</small></div>
   {d.progress&&<div className="cr-headprog"><b>{pct}%</b><Progress percent={pct}/><small>{d.progress.done} of {d.progress.total} done</small></div>}
   {d.children.length>1&&<select className="input" aria-label="Child" value={d.learner?.id||""} onChange={e=>go({class:classId,subject:subjectId,student:e.target.value,tab})}>{d.children.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}
  </header>
  <div className="cr-tabs" role="tablist">{[["course","Course"],["participants","Participants"],["grades","Grades"],["activities","Activities"]].map(([k,l])=>
   <button key={k} role="tab" aria-selected={tab===k} className={tab===k?"on":""} onClick={()=>setTab(k)}>{l}</button>)}</div>
  {note&&<div className="notice info" role="status">{note}</div>}
  <div className="cr-body">
   <aside className="cr-index" aria-label="Course index">
    {sections.map(s=><div key={s.id}>
     <button className="cr-ix-sec" onClick={()=>{if(tab!=="course")setTab("course");setOpen(o=>new Set(o).add(s.id));setTimeout(()=>document.getElementById("sec-"+s.id)?.scrollIntoView({behavior:"smooth"}),120);}}>
      {s.title}{s.published===false?" (hidden)":""}</button>
     {s.items.map(i=><button key={i.id} className="cr-ix-item" onClick={()=>{if(tab!=="course")setTab("course");setOpen(o=>new Set(o).add(s.id));setTimeout(()=>document.getElementById("it-"+i.id)?.scrollIntoView({behavior:"smooth",block:"center"}),120);}}>
      <i className={"cr-dot"+(i.done?" on":"")} aria-label={i.done?"Done":"Not done"}/>{i.title}</button>)}
    </div>)}
   </aside>
   <main className="cr-main">
    {tab==="course"&&<>
     {d.canEdit&&<TeacherBar code={code} d={d} act={act} busy={busy} classId={classId} subjectId={subjectId} call={call} load={load} setNote={setNote}/>}
     {sections.map(s=><section key={s.id} id={"sec-"+s.id} className="cr-sec">
      <div className="cr-sec-h">
       <button className="cr-sec-t" aria-expanded={open.has(s.id)} onClick={()=>toggle(s.id)}><span>{open.has(s.id)?"▾":"▸"}</span>{s.title}{s.published===false&&<em className="cr-tag">Hidden from students</em>}{s.opensAt&&new Date(s.opensAt)>new Date()&&<em className="cr-tag">Opens {day(s.opensAt)}</em>}</button>
       {d.canEdit&&s.id!=="general"&&<ModuleTools m={s} act={act} busy={busy} first={s.position===d.modules[0]?.position} last={s.id===d.modules[d.modules.length-1]?.id}/>}
      </div>
      {open.has(s.id)&&<>
       {s.summary&&<p className="cr-sum">{s.summary}</p>}
       {!s.items.length&&<p className="muted cr-empty">{d.canEdit?"No activities here yet. Use “Move to” on any activity to place it in this module.":"Nothing here yet."}</p>}
       {s.items.map(i=><Item key={i.id} i={i} d={d} code={code} act={act} busy={busy} focus={itemQ===i.id} onTake={()=>setTaking(i.id)}/>)}
      </>}
     </section>)}
    </>}
    {tab==="participants"&&<Participants d={d}/>}
    {tab==="grades"&&<Grades d={d}/>}
    {tab==="activities"&&<Activities d={d} open={id=>{setTab("course");setTimeout(()=>document.getElementById("it-"+id)?.scrollIntoView({behavior:"smooth",block:"center"}),300);}}/>}
   </main>
  </div>
 </div>;
}

function Item({i,d,code,act,busy,focus,onTake}){
 const t=TYPE[i.type]||TYPE.link,hw=i.type==="quiz"||i.type==="assignment";
 const student=d.mode==="student",late=hw&&!i.done&&new Date(i.dueAt)<new Date();
 const [codeEdit,setCodeEdit]=useState(null);
 const openMaterial=()=>{if(student&&!i.done)act({action:"complete.toggle",materialId:i.id,done:true});};
 return <div id={"it-"+i.id} className={"cr-item"+(focus?" focus":"")}>
  <span className={"cr-ic "+t.tone} aria-hidden="true"><Icon name={t.icon} size={18}/></span>
  <div className="cr-item-b">
   <small className="cr-kind">{t.label}{i.locked?" · 🔒 access code":""}{i.timeLimit?" · "+i.timeLimit+" min":""}{d.canEdit&&i.status==="draft"?" · draft (not published)":""}{d.canEdit&&i.published===false?" · hidden":""}</small>
   {hw?(student?<button className="cr-title" onClick={onTake}>{i.title}</button>
     :d.canEdit?<a className="cr-title" href={"/s/"+code+"/classroom?tab=submissions&class="+d.course.classId+"&subject="+d.course.subjectId}>{i.title}</a>
     :<span className="cr-title">{i.title}</span>)
    :<a className="cr-title" href={i.url} target="_blank" rel="noopener noreferrer" onClick={openMaterial}>{i.title}</a>}
   {i.description&&<p className="cr-desc">{i.description.length>220?i.description.slice(0,220)+"…":i.description}</p>}
   <div className="cr-meta">
    {hw&&i.openAt&&<span><b>Opened:</b> {fmt(i.openAt)}</span>}
    {hw&&<span className={late?"cr-late":""}><b>Due:</b> {fmt(i.dueAt)}</span>}
    {hw&&i.closed&&<span><b>Closed</b></span>}
    {hw&&i.maxMarks>0&&<span>{i.maxMarks} marks</span>}
   </div>
   <div className="cr-chips">
    {d.mode!=="teacher"&&(hw
     ?<span className={"cr-chip"+(i.done?" done":late?" late":"")}>{i.done?"✓ Done: Submit"+(i.done.late?" (late)":""):late?"Overdue: Submit":"To do: Submit"}</span>
     :i.done?<button className="cr-chip done" disabled={!student||busy} onClick={()=>act({action:"complete.toggle",materialId:i.id,done:false})} title={student?"Click to undo":""}>✓ Done</button>
      :student?<button className="cr-chip btn" disabled={busy} onClick={()=>act({action:"complete.toggle",materialId:i.id,done:true})}>Mark as done</button>
      :<span className="cr-chip">To do: View</span>)}
    {i.grade&&<span className="cr-chip done">Grade: {Number(i.grade.score)} / {Number(i.grade.max)}</span>}
    {d.canEdit&&hw&&<span className="cr-chip">{i.submittedCount} submitted</span>}
    {d.canEdit&&!hw&&<span className="cr-chip">{i.doneCount} marked done</span>}
   </div>
   {d.canEdit&&<div className="cr-edit">
    <label>Move to <select className="input" disabled={busy} value={i.moduleId||""} onChange={e=>act({action:"item.place",itemType:hw?"homework":"material",itemId:i.id,moduleId:e.target.value||null},"Moved")}>
     <option value="">General</option>{d.modules.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
    {hw&&(codeEdit===null
     ?<span className="cr-code">{i.locked?<>Access code: <code>{i.accessCode}</code></>:"No access code"} <button className="button secondary small" onClick={()=>setCodeEdit(i.accessCode||"")}>{i.locked?"Change":"Add access code"}</button>
       {i.locked&&<button className="button secondary small" disabled={busy} onClick={()=>act({action:"homework.code",homeworkId:i.id,accessCode:null},"Access code removed")}>Remove</button>}</span>
     :<form className="cr-code" onSubmit={e=>{e.preventDefault();act({action:"homework.code",homeworkId:i.id,accessCode:codeEdit},"Access code saved. Give it to students when they should start.").then(()=>setCodeEdit(null));}}>
       <input className="input" aria-label="Access code" placeholder="4 to 40 characters" minLength={4} maxLength={40} value={codeEdit} onChange={e=>setCodeEdit(e.target.value)}/>
       <button className="button small" disabled={busy}>Save code</button><button type="button" className="button secondary small" onClick={()=>setCodeEdit(null)}>Cancel</button></form>)}
   </div>}
  </div>
 </div>;
}

function ModuleTools({m,act,busy,first,last}){
 const [edit,setEdit]=useState(null);
 if(edit)return <form className="cr-modform" onSubmit={e=>{e.preventDefault();act({action:"module.update",moduleId:m.id,...edit},"Module saved").then(()=>setEdit(null));}}>
  <input className="input" aria-label="Module title" maxLength={140} value={edit.title} onChange={e=>setEdit({...edit,title:e.target.value})}/>
  <textarea className="input" aria-label="Module summary" rows={2} maxLength={2000} placeholder="What students learn in this module" value={edit.summary} onChange={e=>setEdit({...edit,summary:e.target.value})}/>
  <label>Opens <input className="input" type="datetime-local" value={edit.opensAt} onChange={e=>setEdit({...edit,opensAt:e.target.value})}/></label>
  <div><button className="button small" disabled={busy}>Save</button> <button type="button" className="button secondary small" onClick={()=>setEdit(null)}>Cancel</button></div></form>;
 const local=v=>v?new Date(new Date(v).getTime()-new Date(v).getTimezoneOffset()*60000).toISOString().slice(0,16):"";
 return <div className="cr-modtools">
  <button className="button secondary small" disabled={busy||first} aria-label="Move module up" onClick={()=>act({action:"module.move",moduleId:m.id,direction:"up"})}>↑</button>
  <button className="button secondary small" disabled={busy||last} aria-label="Move module down" onClick={()=>act({action:"module.move",moduleId:m.id,direction:"down"})}>↓</button>
  <button className="button secondary small" onClick={()=>setEdit({title:m.title,summary:m.summary||"",opensAt:local(m.opensAt)})}>Edit</button>
  <button className="button secondary small" disabled={busy} onClick={()=>act({action:"module.update",moduleId:m.id,published:!m.published},m.published?"Module hidden from students":"Module shown to students")}>{m.published?"Hide":"Show"}</button>
  <button className="button secondary small" disabled={busy} onClick={()=>{if(confirm("Remove the module “"+m.title+"”? Its activities move to General and are not deleted."))act({action:"module.delete",moduleId:m.id},"Module removed");}}>Remove</button>
 </div>;
}

function TeacherBar({code,d,act,busy,classId,subjectId,call,load,setNote}){
 const [mod,setMod]=useState(null),[mat,setMat]=useState(null);
 async function addMaterial(e){
  e.preventDefault();
  try{
   const r=await call("",{api:"classroom",action:"material.create",classId,subjectId,kind:mat.kind,title:mat.title,url:mat.url,description:mat.description});
   const id=r.result?.id;
   if(id){await call("",{api:"classroom",action:"material.toggle",materialId:id,published:true});
    if(mat.moduleId)await call("",{action:"item.place",itemType:"material",itemId:id,moduleId:mat.moduleId});}
   setMat(null);setNote("Material added and published");await load();
  }catch(x){setNote(x.message);}
 }
 return <div className="cr-teacher">
  <div className="cr-tbtns">
   <button className="button small" onClick={()=>{setMod({title:"Module "+(d.modules.length+1),summary:"",opensAt:""});setMat(null);}}><Icon name="book" size={16}/> Add module</button>
   <button className="button small" onClick={()=>{setMat({kind:"link",title:"",url:"",description:"",moduleId:d.modules[d.modules.length-1]?.id||""});setMod(null);}}><Icon name="folder" size={16}/> Add video, link or document</button>
   <a className="button secondary small" href={"/s/"+code+"/classroom?tab=homework&class="+classId+"&subject="+subjectId}><Icon name="check" size={16}/> Create quiz or assignment</a>
  </div>
  <small className="muted">New quizzes and assignments appear in General. Use “Move to” to place them in a module, and “Add access code” to lock a quiz until you give students the code.</small>
  {mod&&<form className="cr-modform" onSubmit={e=>{e.preventDefault();act({action:"module.create",classId,subjectId,...mod,opensAt:mod.opensAt||null},"Module added").then(()=>setMod(null));}}>
   <input className="input" aria-label="Module title" required minLength={2} maxLength={140} value={mod.title} onChange={e=>setMod({...mod,title:e.target.value})}/>
   <textarea className="input" aria-label="Module summary" rows={2} maxLength={2000} placeholder="What students learn in this module (optional)" value={mod.summary} onChange={e=>setMod({...mod,summary:e.target.value})}/>
   <label>Opens (optional) <input className="input" type="datetime-local" value={mod.opensAt} onChange={e=>setMod({...mod,opensAt:e.target.value})}/></label>
   <div><button className="button small" disabled={busy}>Create module</button> <button type="button" className="button secondary small" onClick={()=>setMod(null)}>Cancel</button></div></form>}
  {mat&&<form className="cr-modform" onSubmit={addMaterial}>
   <select className="input" aria-label="Type" value={mat.kind} onChange={e=>setMat({...mat,kind:e.target.value})}><option value="link">Link</option><option value="video">Video</option><option value="document">Document</option></select>
   <input className="input" aria-label="Title" placeholder="Title" required minLength={3} maxLength={160} value={mat.title} onChange={e=>setMat({...mat,title:e.target.value})}/>
   <input className="input" aria-label="Web address" placeholder="https://…" type="url" required value={mat.url} onChange={e=>setMat({...mat,url:e.target.value})}/>
   <textarea className="input" aria-label="Description" rows={2} maxLength={1000} placeholder="Short description (optional)" value={mat.description} onChange={e=>setMat({...mat,description:e.target.value})}/>
   <label>Module <select className="input" value={mat.moduleId} onChange={e=>setMat({...mat,moduleId:e.target.value})}><option value="">General</option>{d.modules.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
   <div><button className="button small" disabled={busy}>Add and publish</button> <button type="button" className="button secondary small" onClick={()=>setMat(null)}>Cancel</button></div></form>}
 </div>;
}

function Participants({d}){
 const [q,setQ]=useState("");
 const list=d.participants.students.filter(s=>!q||s.name.toLowerCase().includes(q.toLowerCase())||(s.code||"").toLowerCase().includes(q.toLowerCase()));
 return <section className="ds-panel">
  <h3>Participants</h3>
  <p className="muted">{d.participants.teachers.length} teacher{d.participants.teachers.length===1?"":"s"} · {d.participants.students.length} student{d.participants.students.length===1?"":"s"}</p>
  <input className="input" aria-label="Search participants" placeholder="Search by name" value={q} onChange={e=>setQ(e.target.value)} style={{maxWidth:320,marginBottom:12}}/>
  <table className="cr-table"><thead><tr><th>Name</th>{d.canEdit&&<th>Student ID</th>}<th>Role</th></tr></thead><tbody>
   {d.participants.teachers.map((t,k)=><tr key={"t"+k}><td>{t}</td>{d.canEdit&&<td/>}<td>Teacher</td></tr>)}
   {list.map((s,k)=><tr key={k}><td>{s.name}</td>{d.canEdit&&<td>{s.code}</td>}<td>Student</td></tr>)}
  </tbody></table>
 </section>;
}

function Grades({d}){
 if(d.canEdit){
  const g=d.grades;
  return <section className="ds-panel"><h3>Gradebook</h3>
   <p className="muted">Scores marked * are not yet released to the student. Completion counts submitted work and materials the student marked as done.</p>
   {!g.items.length?<p>No quizzes or assignments yet.</p>:<div className="cr-scroll"><table className="cr-table"><thead><tr><th>Student</th>{g.items.map(i=><th key={i.id} title={i.title}>{i.title.length>22?i.title.slice(0,22)+"…":i.title}<br/><small>/{i.max}</small></th>)}<th>Course total</th><th>Completion</th></tr></thead>
    <tbody>{g.rows.map(r=><tr key={r.studentId}><td>{r.name}<br/><small className="muted">{r.code}</small></td>
     {g.items.map(i=>{const c=r.cells[i.id];return <td key={i.id}>{!c?"–":c.score==null?(c.graded?"Marked":"Submitted"):Number(c.score)+(c.released?"":"*")}{c?.late?<small className="cr-late"> late</small>:null}</td>;})}
     <td><b>{r.percent==null?"–":r.percent+"%"}</b></td><td>{r.complete}/{r.total}</td></tr>)}</tbody></table></div>}
  </section>;
 }
 const g=d.grades;
 return <section className="ds-panel"><h3>Grades{d.learner?.name&&d.mode==="parent"?" for "+d.learner.name:""}</h3>
  {!g.rows.length?<p>No graded work in this course yet.</p>:<table className="cr-table"><thead><tr><th>Grade item</th><th>Grade</th><th>Range</th><th>Percentage</th><th>Feedback</th></tr></thead>
   <tbody>{g.rows.map(r=><tr key={r.id}><td>{r.title}<br/><small className="muted">{TYPE[r.type]?.label} · due {day(r.dueAt)}</small></td>
    <td>{r.score==null?<span className="muted">{r.status}</span>:Number(r.score)}</td><td>{r.range}</td><td>{r.percent==null?"–":r.percent+" %"}</td><td>{r.feedback||""}</td></tr>)}
    {g.total&&<tr className="cr-total"><td>Course total</td><td>{g.total.score}</td><td>0 to {g.total.max}</td><td>{g.total.percent} %</td><td/></tr>}</tbody></table>}
 </section>;
}

function Activities({d,open}){
 const groups=GROUP.map(([k,l])=>[k,l,d.items.filter(i=>i.type===k)]).filter(g=>g[2].length);
 if(!groups.length)return <section className="ds-panel"><p>No activities in this course yet.</p></section>;
 return <>{groups.map(([k,l,items])=><section key={k} className="ds-panel"><h3>{l} <small className="muted">({items.length})</small></h3>
  <table className="cr-table"><thead><tr><th>Name</th>{(k==="quiz"||k==="assignment")&&<th>Due</th>}<th>Module</th>{d.mode!=="teacher"&&<th>Status</th>}{d.canEdit&&<th>Activity</th>}</tr></thead><tbody>
   {items.map(i=><tr key={i.id}><td><button className="ds-link" onClick={()=>open(i.id)}>{i.title}</button></td>
    {(k==="quiz"||k==="assignment")&&<td>{fmt(i.dueAt)}</td>}
    <td>{d.modules.find(m=>m.id===i.moduleId)?.title||"General"}</td>
    {d.mode!=="teacher"&&<td>{i.grade?"Graded "+Number(i.grade.score)+"/"+Number(i.grade.max):i.done?"Done":"To do"}</td>}
    {d.canEdit&&<td>{i.submittedCount!=null?i.submittedCount+" submitted":i.doneCount+" done"}</td>}</tr>)}
  </tbody></table></section>)}</>;
}
