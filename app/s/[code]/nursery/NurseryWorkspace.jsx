"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
import {Card} from "../../../ui/DashboardShell.jsx";
import "../classroom/curriculum-library.css";

const AREA_LABEL={language_communication:"Language and communication",numeracy_early_math:"Numeracy and early math",
 social_emotional:"Social and emotional development",physical_health:"Physical development and health",
 creative_arts_culture:"Creative arts and culture",environment_science:"Environment and science"};
const DESC_LABEL={developing:"Developing",secure:"Secure",extending:"Extending"};
const STATUS_LABEL={draft:"Waiting for approval",approved:"Approved, ready to publish",published:"Published to parents",withdrawn:"Withdrawn"};
const today=()=>new Date().toLocaleDateString("en-CA",{timeZone:"Africa/Kigali"});
const when=d=>d?new Date(d+"T00:00:00Z").toLocaleDateString("en-GB",{timeZone:"UTC",day:"numeric",month:"short"}):"";

export default function NurseryWorkspace({code}){
 const [client,setClient]=useState(null),[ready,setReady]=useState(false),[session,setSession]=useState(null);
 const [data,setData]=useState(null),[error,setError]=useState(""),[note,setNote]=useState(""),[busy,setBusy]=useState(false);
 const [classId,setClassId]=useState(""),[studentId,setStudentId]=useState("");
 const [obs,setObs]=useState({area:"language_communication",descriptor:"secure",date:today(),comment:""});
 const [term,setTerm]=useState(3),[summaries,setSummaries]=useState({}),[teacherComment,setTeacherComment]=useState("");
 const [headComment,setHeadComment]=useState({});
 useEffect(()=>{
  const c=browserSupabase();setClient(c);
  if(!c){setReady(true);return;}
  let alive=true;
  c.auth.getSession().then(({data:x})=>{if(alive){setSession(x.session);setReady(true);}});
  const {data:{subscription}}=c.auth.onAuthStateChange((_e,s)=>{if(alive)setSession(s);});
  return ()=>{alive=false;subscription.unsubscribe();};
 },[]);
 const call=useCallback(async body=>{
  const {data:{session:s}}=await client.auth.getSession();
  if(!s)throw Error("Your school sign-in has expired");
  const r=await fetch("/api/school/"+code+"/nursery",{method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+s.access_token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(j.error||"Could not load nursery records");
  return j;
 },[client,code]);
 const refresh=useCallback(async()=>{try{setData(await call());setError("");}catch(e){setError(e.message);}},[call]);
 useEffect(()=>{if(ready&&session)refresh();},[ready,session?.user?.id,refresh]);
 useEffect(()=>{if(data?.classes?.length&&!data.classes.some(c=>c.id===classId))setClassId(data.classes[0].id);},[data,classId]);
 const kids=useMemo(()=>(data?.roster||[]).filter(r=>r.classId===classId).sort((a,b)=>a.name.localeCompare(b.name)),[data,classId]);
 useEffect(()=>{if(kids.length&&!kids.some(k=>k.studentId===studentId))setStudentId(kids[0].studentId);},[kids,studentId]);
 const childObs=useMemo(()=>(data?.observations||[]).filter(o=>o.student_id===studentId),[data,studentId]);
 const report=useMemo(()=>(data?.reports||[]).find(r=>r.student_id===studentId&&r.term_number===term),[data,studentId,term]);
 useEffect(()=>{
  if(report){setSummaries(report.area_summaries||{});setTeacherComment(report.teacher_comment||"");}
  else{setSummaries({});setTeacherComment("");}
 },[report?.id,studentId,term]);

 async function act(body,after){setBusy(true);setError("");setNote("");try{await call(body);await refresh();if(after)after();}catch(e){setError(e.message);}finally{setBusy(false);}}
 function suggest(){
  const next={};
  for(const a of data.areas){
   const rows=childObs.filter(o=>o.learning_area===a).slice(0,2);
   next[a]=rows.length?rows.map(o=>(o.comment||DESC_LABEL[o.descriptor])+" ("+when(o.observed_on)+")").join(" ").slice(0,600):"";
  }
  setSummaries(next);setNote("Suggested from the two latest observations in each area. Edit before saving.");
 }

 if(!ready)return <main className="school-admin-loading">Opening nursery workspace…</main>;
 if(!session)return <main className="school-admin-loading"><h2>School login required</h2><a className="button" href={"/s/"+code+"/login"}>Sign in</a></main>;
 if(!data&&error)return <main className="school-admin-loading"><h2>Nursery workspace unavailable</h2><p role="alert">{error}</p><a href={"/s/"+code+"/home"}>Back to dashboard</a></main>;
 if(!data)return <main className="school-admin-loading">Opening nursery workspace…</main>;
 if(!data.classes.length)return <Card title="Nursery" icon="users" size="s12"><p className="ds-empty">No nursery classes are assigned to you yet. The school administrator assigns classes under Classes and Teachers.</p></Card>;
 const locked=report&&report.status!=="draft";
 const queue=(data.reports||[]).filter(r=>r.status==="draft"||r.status==="approved");
 const nameOf=id=>(data.roster.find(r=>r.studentId===id)||{}).name||"Child";
 return <>
  {error&&<div className="notice error" role="alert">{error}</div>}
  {note&&<div className="notice" role="status">{note}</div>}
  <div className="tb-bar"><div className="tb-row"><span className="tb-label">Class</span><div className="tb-chips">
   {data.classes.map(c=><button key={c.id} className={"tb-chip"+(c.id===classId?" on":"")} onClick={()=>setClassId(c.id)}>{c.name}{c.section?" · "+c.section:""}</button>)}
  </div></div>
  <div className="tb-row"><span className="tb-label">Child</span><div className="tb-chips">
   {kids.map(k=><button key={k.studentId} className={"tb-chip"+(k.studentId===studentId?" on":"")} onClick={()=>setStudentId(k.studentId)}>{k.name}</button>)}
  </div></div><div className="tb-meta">{kids.length} children in this class</div></div>
  {data.role.teacher&&studentId&&<div className="ds-grid">
   <Card title={"Record an observation · "+nameOf(studentId)} icon="plus" size="s4">
    <label>Learning area<select value={obs.area} onChange={e=>setObs({...obs,area:e.target.value})}>
     {data.areas.map(a=><option key={a} value={a}>{AREA_LABEL[a]}</option>)}</select></label>
    <label>What did you see?<div className="tb-chips">{data.descriptors.map(d=>
     <button key={d} type="button" className={"tb-chip"+(obs.descriptor===d?" on":"")} onClick={()=>setObs({...obs,descriptor:d})}>{DESC_LABEL[d]}</button>)}</div></label>
    <label>Date<input type="date" value={obs.date} max={today()} onChange={e=>setObs({...obs,date:e.target.value})}/></label>
    <label>Short note<textarea rows={3} maxLength={500} value={obs.comment} onChange={e=>setObs({...obs,comment:e.target.value})} placeholder="For example: counted to ten with the blocks, helped a friend tidy up."/></label>
    <button className="button" disabled={busy} onClick={()=>act({action:"observation.record",classId,studentId,area:obs.area,descriptor:obs.descriptor,date:obs.date,comment:obs.comment},()=>{setObs({...obs,comment:""});setNote("Observation saved.");})}>{busy?"Saving…":"Save observation"}</button>
   </Card>
   <Card title="Recent observations" icon="file" size="s4">
    {childObs.length?<ul className="ds-list">{childObs.slice(0,12).map(o=><li key={o.id} className="ds-item"><div>
     <strong>{AREA_LABEL[o.learning_area]}</strong><small>{when(o.observed_on)} · {DESC_LABEL[o.descriptor]}{o.comment?" · "+o.comment:""}</small></div></li>)}</ul>
     :<p className="ds-empty">No observations yet for this child.</p>}
   </Card>
   <Card title={"Progress report · Term "+term} icon="file" size="s4">
    <label>Term<select value={term} onChange={e=>setTerm(Number(e.target.value))}>{[1,2,3].map(t=><option key={t} value={t}>Term {t}</option>)}</select></label>
    {report&&<p><strong>{STATUS_LABEL[report.status]}</strong></p>}
    <button className="button secondary" disabled={locked} onClick={suggest}>Suggest from observations</button>
    {data.areas.map(a=><label key={a}>{AREA_LABEL[a]}<textarea rows={2} maxLength={600} disabled={locked} value={summaries[a]||""} onChange={e=>setSummaries({...summaries,[a]:e.target.value})}/></label>)}
    <label>Teacher comment<textarea rows={3} maxLength={1500} disabled={locked} value={teacherComment} onChange={e=>setTeacherComment(e.target.value)}/></label>
    <button className="button" disabled={busy||locked} onClick={()=>act({action:"report.save",classId,studentId,term,areaSummaries:summaries,teacherComment},()=>setNote("Draft saved and sent for approval."))}>{busy?"Saving…":"Save draft for approval"}</button>
   </Card>
  </div>}
  {data.role.manager&&<Card title="Reports waiting for you" icon="check" size="s12">
   {queue.length?<ul className="ds-list">{queue.map(r=><li key={r.id} className="ds-item"><div>
    <strong>{nameOf(r.student_id)} · Term {r.term_number}</strong><small>{STATUS_LABEL[r.status]}</small>
    {data.areas.filter(a=>r.area_summaries?.[a]).map(a=><small key={a} style={{display:"block",marginTop:4}}><b>{AREA_LABEL[a]}:</b> {r.area_summaries[a]}</small>)}
    {r.teacher_comment&&<small style={{display:"block",marginTop:6}}><b>Teacher comment:</b> {r.teacher_comment}</small>}
    {r.headteacher_comment&&<small style={{display:"block",marginTop:4}}><b>Headteacher comment:</b> {r.headteacher_comment}</small>}</div>
    {r.status==="draft"&&<span><input style={{minWidth:220}} placeholder="Headteacher comment" maxLength={1500} value={headComment[r.id]||""} onChange={e=>setHeadComment({...headComment,[r.id]:e.target.value})}/>
     <button className="button" disabled={busy} onClick={()=>act({action:"report.approve",reportId:r.id,headteacherComment:headComment[r.id]||""},()=>setNote("Report approved."))}>Approve</button></span>}
    {r.status==="approved"&&data.role.owner&&<button className="button" disabled={busy} onClick={()=>act({action:"report.publish",reportId:r.id},()=>setNote("Report published to the child's parents."))}>Publish to parents</button>}
    {r.status==="approved"&&!data.role.owner&&<small>Only the school owner can publish.</small>}
   </li>)}</ul>:<p className="ds-empty">No reports are waiting.</p>}
  </Card>}
 </>;
}
