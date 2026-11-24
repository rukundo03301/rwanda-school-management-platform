"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
export default function LearningResources({code}){
 const [response,setResponse]=useState(null),[error,setError]=useState(""),[grade,setGrade]=useState("all"),[subject,setSubject]=useState("all");
 const load=useCallback(async()=>{
  try{
   const c=browserSupabase();if(!c)throw Error("School login is not configured.");
   const {data:{session}}=await c.auth.getSession();
   if(!session)throw Error("Please sign in to Remezo Primary School first.");
   const r=await fetch("/api/school/"+code+"/resources",{cache:"no-store",headers:{Authorization:"Bearer "+session.access_token}});
   const d=await r.json();if(!r.ok)throw Error(d.error||"Cannot access materials.");
   setResponse(d);setError("");
  }catch(e){setError(e.message);}
 },[code]);
 useEffect(()=>{load()},[load]);
 const entries=(response?.items||[]).filter(x=>(grade==="all"||x.grade===grade)&&(subject==="all"||x.subject===subject));
 const subjects=[...new Set((response?.items||[]).map(x=>x.subject))].sort();
 return <main className="rem-resources"><header><a href={"/s/"+code+"/portal"}>← My School</a><h1>Remezo Primary School · Learning Resources</h1><p>Illustrative P3–P6 activities, paired with the official Rwanda Basic Education Board resource portals.</p></header>
 {error?<section className="rem-resource-card" role="alert">{error}<p><a href={"/s/"+code+"/login"}>School login</a></p></section>:
 !response?<p>Checking school membership and loading resources…</p>:<>
 <div className="rem-resource-toolbar"><label>Class level<select value={grade} onChange={e=>setGrade(e.target.value)}><option value="all">All levels</option>{["P3","P4","P5","P6"].map(x=><option key={x}>{x}</option>)}</select></label>
 <label>Subject<select value={subject} onChange={e=>setSubject(e.target.value)}><option value="all">All subjects</option>{subjects.map(x=><option key={x}>{x}</option>)}</select></label></div>
 <p className="rem-resource-banner">Training content is original and illustrative, not a substitute for the approved REB curriculum or official textbooks. Teachers must verify content suitability before assigning it.</p>
 <div className="rem-resource-grid">{entries.map(item=><article className="rem-resource-card" key={item.id}>
  <span className="rem-resource-level">{item.grade} · {item.subject}</span><h2>{item.title}</h2><p><strong>Learning objective:</strong> {item.learningObjective}</p>
  <h3>Classroom activities</h3><ul>{item.teacherActivities.map((t,i)=><li key={i}>{t}</li>)}</ul>
  <h3>Pupil practice</h3><p>{item.studentPractice}</p>
  <div className="rem-resource-links"><a href={item.videoSource.url} target="_blank" rel="noopener noreferrer">REB YouTube learning channel</a>
   {item.readingSources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>)}</div>
 </article>)}</div></>}
 </main>;
}
