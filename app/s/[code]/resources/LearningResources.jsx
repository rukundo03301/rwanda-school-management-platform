"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
const LEVEL={nursery:"Nursery",primary:"Primary",secondary:"Secondary",tvet:"TVET",university:"University"};
const EMPTY={classId:"",subjectId:"",title:"",language:"English",objective:"",teacherSteps:"",studentSteps:"",materials:"",minutes:20};

// The learning library for every school: activities built into the platform for the levels the
// school offers, and activities the school's own teachers write and publish.
export default function LearningResources({code}){
 const [data,setData]=useState(null),[error,setError]=useState(""),[note,setNote]=useState("");
 const [level,setLevel]=useState("all"),[subject,setSubject]=useState("all"),[source,setSource]=useState("all");
 const [form,setForm]=useState(null),[busy,setBusy]=useState(false);
 const call=useCallback(async(body)=>{
  const c=browserSupabase();if(!c)throw Error("School login is not configured.");
  const {data:{session}}=await c.auth.getSession();
  if(!session)throw Error("Please sign in to your school first.");
  const r=await fetch("/api/school/"+code+"/resources",{method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+session.access_token,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
  const d=await r.json();if(!r.ok)throw Error(d.error||"Cannot open the learning library.");
  return d;
 },[code]);
 const load=useCallback(async()=>{try{setData(await call());setError("");}catch(e){setError(e.message);}},[call]);
 useEffect(()=>{load();},[load]);
 const act=async(body,done)=>{setBusy(true);setNote("");try{await call(body);setNote(done);setForm(null);await load();}catch(e){setNote(e.message);}finally{setBusy(false);}};
 if(error)return <main className="rem-resources"><section className="rem-resource-card" role="alert">{error}<p><a href={"/s/"+code+"/login"}>School login</a></p></section></main>;
 if(!data)return <main className="rem-resources"><p>Opening the learning library…</p></main>;
 const all=[...data.items.map(i=>({...i,source:"platform"})),...data.schoolItems.map(i=>({...i,source:"school",grade:i.className}))];
 const levels=[...new Set(all.map(i=>i.level).filter(Boolean))];
 const subjects=[...new Set(all.filter(i=>level==="all"||i.level===level).map(i=>i.subject).filter(Boolean))].sort();
 const shown=all.filter(i=>(level==="all"||i.level===level)&&(subject==="all"||i.subject===subject)&&(source==="all"||i.source===source));
 const subjectsFor=data.form.subjects.filter(s=>!form?.classId||s.classes.includes(form.classId));
 return <main className="rem-resources">
  <header><h1>{data.school} · Learning Library</h1>
   <p>Activities built into the platform for the levels your school offers{data.levels.length?" ("+data.levels.map(l=>LEVEL[l]||l).join(", ")+")":""}, plus activities your own teachers publish.</p></header>
  <div className="rem-resource-toolbar">
   <label>Level<select value={level} onChange={e=>{setLevel(e.target.value);setSubject("all");}}><option value="all">All levels</option>{levels.map(l=><option key={l} value={l}>{LEVEL[l]||l}</option>)}</select></label>
   <label>Subject or learning area<select value={subject} onChange={e=>setSubject(e.target.value)}><option value="all">All</option>{subjects.map(s=><option key={s}>{s}</option>)}</select></label>
   <label>Source<select value={source} onChange={e=>setSource(e.target.value)}><option value="all">All activities</option><option value="platform">Platform library</option><option value="school">Our school</option></select></label>
   {data.canAdd&&<button className="button" type="button" onClick={()=>setForm(form?null:{...EMPTY,classId:data.form.classes[0]?.id||""})}>{form?"Close":"+ Add activity"}</button>}
  </div>
  {note&&<p className="rem-resource-banner" role="status">{note}</p>}
  {form&&<form className="rem-resource-card" onSubmit={e=>{e.preventDefault();}}>
   <h2>New learning activity</h2>
   {!data.form.classes.length?<p>No classes are assigned to you yet. The school administrator assigns classes under Classes and Teachers.</p>:<>
   <label>Class<select required value={form.classId} onChange={e=>setForm({...form,classId:e.target.value,subjectId:""})}>{data.form.classes.map(c=><option key={c.id} value={c.id}>{c.name}{c.level?" ("+(LEVEL[c.level]||c.level)+")":""}</option>)}</select></label>
   <label>Subject<select required value={form.subjectId} onChange={e=>setForm({...form,subjectId:e.target.value})}><option value="" disabled>Choose a subject</option>{subjectsFor.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
   <label>Title<input className="input" required minLength={3} maxLength={160} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
   <label>Language<select value={form.language} onChange={e=>setForm({...form,language:e.target.value})}>{data.form.languages.map(l=><option key={l}>{l}</option>)}</select></label>
   <label>Learning objective<textarea className="input" maxLength={600} value={form.objective} onChange={e=>setForm({...form,objective:e.target.value})}/></label>
   <label>Classroom steps for the teacher<textarea className="input" maxLength={3000} value={form.teacherSteps} onChange={e=>setForm({...form,teacherSteps:e.target.value})}/></label>
   <label>Practice for learners or home<textarea className="input" maxLength={3000} value={form.studentSteps} onChange={e=>setForm({...form,studentSteps:e.target.value})}/></label>
   <label>Materials needed<input className="input" maxLength={1000} value={form.materials} onChange={e=>setForm({...form,materials:e.target.value})}/></label>
   <label>Minutes<input className="input" type="number" min={5} max={120} value={form.minutes} onChange={e=>setForm({...form,minutes:Number(e.target.value)})}/></label>
   <div className="rem-resource-links">
    <button className="button secondary" type="button" disabled={busy} onClick={()=>act({action:"activity.create",...form,publish:false},"Draft saved. Only you and school leaders can see it.")}>Save draft</button>
    <button className="button" type="button" disabled={busy} onClick={()=>act({action:"activity.create",...form,publish:true},"Activity published to the school library.")}>Publish to school</button>
   </div></>}
  </form>}
  {!shown.length&&<p className="ds-empty">No activities match these filters yet.{data.canAdd?" Use Add activity to share one with your school.":""}</p>}
  <div className="rem-resource-grid">{shown.map(item=>item.source==="platform"?
   <article className="rem-resource-card" key={item.id}>
    <span className="rem-resource-level">{LEVEL[item.level]||item.level} · {item.grade} · {item.subject}</span><h2>{item.title}</h2>
    <p><strong>Learning objective:</strong> {item.learningObjective}</p>
    <h3>Classroom activities</h3><ul>{item.teacherActivities.map((t,i)=><li key={i}>{t}</li>)}</ul>
    <h3>Practice</h3><p>{item.studentPractice}</p>
    <div className="rem-resource-links">{item.sources.map(s=><a key={s.url+s.label} href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>)}</div>
   </article>:
   <article className="rem-resource-card" key={item.id}>
    <span className="rem-resource-level">Our school · {item.className} · {item.subject}{item.status!=="published"?" · Draft":""}</span><h2>{item.title}</h2>
    {item.learningObjective&&<p><strong>Learning objective:</strong> {item.learningObjective}</p>}
    {item.teacherSteps&&<><h3>Classroom steps</h3><p style={{whiteSpace:"pre-wrap"}}>{item.teacherSteps}</p></>}
    {item.studentSteps&&<><h3>Practice</h3><p style={{whiteSpace:"pre-wrap"}}>{item.studentSteps}</p></>}
    {item.materials&&<p><strong>Materials:</strong> {item.materials}</p>}
    <p><small>{item.language} · {item.minutes} minutes</small></p>
    {item.canManage&&<div className="rem-resource-links">
     {item.status!=="published"&&<button className="button small" type="button" disabled={busy} onClick={()=>act({action:"activity.status",id:item.id,status:"published"},"Activity published.")}>Publish</button>}
     {item.status==="published"&&<button className="button small secondary" type="button" disabled={busy} onClick={()=>act({action:"activity.status",id:item.id,status:"draft"},"Activity moved back to draft.")}>Unpublish</button>}
     <button className="button small secondary" type="button" disabled={busy} onClick={()=>act({action:"activity.status",id:item.id,status:"archived"},"Activity removed from the library.")}>Remove</button>
    </div>}
   </article>)}</div>
 </main>;
}
