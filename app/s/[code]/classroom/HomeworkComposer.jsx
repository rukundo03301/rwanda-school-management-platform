"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
import {MathField,QuestionInput} from "../learning/AssignmentTaker.jsx";

const TYPES=[
 {id:"single",label:"Multiple choice (one answer)"},{id:"multi",label:"Multiple choice (several answers)"},
 {id:"truefalse",label:"True or false"},{id:"numeric",label:"Number answer (maths)"},
 {id:"short",label:"Type a short answer"},{id:"essay",label:"Long written answer"}];
const blank=(kind="single")=>({uid:Math.random().toString(36).slice(2),kind,prompt:"",marks:1,
 options:kind==="single"||kind==="multi"?["","","",""]:[],correct:kind==="multi"?[]:kind==="single"?null:kind==="truefalse"?null:"",tolerance:""});
const fmt=d=>d?new Date(d).toLocaleString("en-RW",{timeZone:"Africa/Kigali"}):"";
const toLocalInput=iso=>{if(!iso)return "";const d=new Date(new Date(iso).getTime()+2*3600000);return d.toISOString().slice(0,16);};
const fromLocalInput=v=>v?new Date(v+":00+02:00").toISOString():"";
const fromDb=q=>({uid:q.id,kind:q.kind,prompt:q.prompt,marks:Number(q.marks),options:q.options?.length?q.options:q.kind==="single"||q.kind==="multi"?["","","",""]:[],
 correct:q.kind==="single"?q.answer_key?.index??null:q.kind==="multi"?q.answer_key?.indexes||[]:q.kind==="truefalse"?q.answer_key?.value??null:q.kind==="numeric"?String(q.answer_key?.value??""):(q.answer_key?.accepted||[]).join("\n"),
 tolerance:q.tolerance?String(q.tolerance):""});

function QuestionEditor({q,n,count,set,remove,dup,move}){
 const up=patch=>set({...q,...patch});
 const changeKind=k=>up({...blank(k),uid:q.uid,prompt:q.prompt,marks:q.marks});
 return <li className="cr-lesson" style={{listStyle:"none",padding:14,display:"grid",gap:10}}>
  <div style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center",justifyContent:"space-between"}}>
   <strong>Question {n}</strong>
   <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
    <select className="input" aria-label={"Type of question "+n} value={q.kind} onChange={e=>changeKind(e.target.value)}>{TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select>
    <label style={{display:"flex",gap:4,alignItems:"center"}}>Marks <input className="input" style={{width:70}} type="number" min="0.5" max="100" step="0.5" value={q.marks} onChange={e=>up({marks:e.target.value})}/></label>
    <button type="button" className="button secondary small" disabled={n===1} onClick={()=>move(-1)} aria-label="Move up">↑</button>
    <button type="button" className="button secondary small" disabled={n===count} onClick={()=>move(1)} aria-label="Move down">↓</button>
    <button type="button" className="button secondary small" onClick={dup}>Copy</button>
    <button type="button" className="button secondary small" onClick={remove}>Delete</button></div></div>
  <MathField multiline rows={2} label={"Question "+n+" text"} value={q.prompt} onChange={v=>up({prompt:v})} placeholder="Type the question. Use the symbol keys for maths such as ½, √, ², ×, ÷."/>
  {(q.kind==="single"||q.kind==="multi")&&<div style={{display:"grid",gap:6}}>
   <small className="muted">{q.kind==="single"?"Tick the one correct choice.":"Tick every correct choice."}</small>
   {q.options.map((o,i)=><div key={i} style={{display:"flex",gap:8,alignItems:"center"}}>
    {q.kind==="single"
     ?<input type="radio" aria-label={"Choice "+(i+1)+" is correct"} name={"c"+q.uid} checked={q.correct===i} onChange={()=>up({correct:i})}/>
     :<input type="checkbox" aria-label={"Choice "+(i+1)+" is correct"} checked={q.correct.includes(i)} onChange={e=>up({correct:e.target.checked?[...q.correct,i]:q.correct.filter(x=>x!==i)})}/>}
    <MathField value={o} maxLength={300} label={"Choice "+(i+1)} placeholder={"Choice "+String.fromCharCode(65+i)} onChange={v=>up({options:q.options.map((x,j)=>j===i?v:x)})}/>
    <button type="button" className="button secondary small" disabled={q.options.length<=2} aria-label={"Remove choice "+(i+1)}
     onClick={()=>up({options:q.options.filter((_,j)=>j!==i),correct:q.kind==="single"?(q.correct===i?null:q.correct>i?q.correct-1:q.correct):q.correct.filter(x=>x!==i).map(x=>x>i?x-1:x)})}>✕</button></div>)}
   {q.options.length<8&&<button type="button" className="button secondary small" style={{justifySelf:"start"}} onClick={()=>up({options:[...q.options,""]})}>+ Add choice</button>}</div>}
  {q.kind==="truefalse"&&<div style={{display:"flex",gap:16}}><small className="muted">Correct answer:</small>
   {[true,false].map(v=><label key={String(v)} style={{display:"flex",gap:6}}><input type="radio" name={"tf"+q.uid} checked={q.correct===v} onChange={()=>up({correct:v})}/>{v?"True":"False"}</label>)}</div>}
  {q.kind==="numeric"&&<div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
   <label>Correct number <input className="input" inputMode="decimal" value={q.correct} onChange={e=>up({correct:e.target.value})} placeholder="e.g. 12.5"/></label>
   <label>Allowed difference (optional) <input className="input" inputMode="decimal" value={q.tolerance} onChange={e=>up({tolerance:e.target.value})} placeholder="0"/></label></div>}
  {q.kind==="short"&&<label>Accepted answers, one per line (leave empty to mark by hand)
   <textarea className="input" rows={2} value={q.correct} onChange={e=>up({correct:e.target.value})} placeholder={"Kigali\nKigali city"}/></label>}
  {q.kind==="essay"&&<small className="muted">You will mark this answer yourself.</small>}
 </li>;
}

function Review({code,homeworkId,onBack,call,onChanged}){
 const [d,setD]=useState(null),[err,setErr]=useState(""),[note,setNote]=useState(""),[mark,setMark]=useState(null),[busy,setBusy]=useState(false);
 const load=useCallback(()=>call(null,"?homeworkId="+homeworkId).then(setD).catch(e=>setErr(e.message)),[call,homeworkId]);
 useEffect(()=>{load();},[load]);
 if(!d)return <section className="cr-panel"><p>{err||"Loading submissions…"}</p></section>;
 const {homework:h,questions,submissions,students}=d;
 const total=questions.reduce((s,q)=>s+Number(q.marks),0);
 const subOf=id=>submissions.find(s=>s.student_id===id);
 async function act(body,ok){setBusy(true);setErr("");setNote("");try{const r=await call(body);setNote(ok(r.result));await load();onChanged?.();}catch(e){setErr(e.message);}finally{setBusy(false);}}
 const ungradedAuto=submissions.filter(s=>!s.graded_at&&questions.every(q=>s.answers?.m?.[q.id]!==undefined)).length;
 const unreleased=submissions.filter(s=>s.graded_at&&!s.released_at).length;
 return <section className="cr-panel">
  <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
   <div><h2 style={{margin:0}}>{h.title}</h2><small className="muted">{submissions.length} of {students.length} submitted · {total} marks · due {fmt(h.due_at)}</small></div>
   <button className="button secondary" onClick={onBack}>Back</button></div>
  {err&&<div className="notice error" role="alert">{err}</div>}{note&&<div className="notice info" role="status">{note}</div>}
  <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"12px 0"}}>
   <button className="button secondary" disabled={busy||!ungradedAuto} onClick={()=>act({action:"grade.approveAuto",homeworkId},r=>r.graded+" auto-marked submissions approved")}>Approve auto-marked ({ungradedAuto})</button>
   <button className="button" disabled={busy||!unreleased} onClick={()=>confirm("Release results to "+unreleased+" students and their parents?")&&act({action:"grade.release",homeworkId},r=>r.released+" results released")}>Release results ({unreleased})</button></div>
  <div className="table-wrap"><table><thead><tr><th>Student</th><th>Status</th><th>Auto marks</th><th>Final</th><th></th></tr></thead><tbody>
   {students.map(s=>{const sub=subOf(s.id);return <tr key={s.id}><td><strong>{s.name}</strong><br/><small>{s.code}</small></td>
    <td>{sub?(sub.graded_at?(sub.released_at?"Released":"Marked, not released"):"Needs marking")+(sub.is_late?" · late":""):"Not submitted"}</td>
    <td>{sub?Number(sub.auto_score||0)+" / "+total:"—"}</td><td>{sub?.graded_at?Number(sub.score)+" / "+Number(sub.max_score):"—"}</td>
    <td>{sub&&<button className="button secondary small" onClick={()=>setMark({sub,name:s.name,marks:Object.fromEntries(questions.map(q=>[q.id,sub.answers?.m?.[q.id]??""])),feedback:sub.feedback||""})}>Mark</button>}</td></tr>;})}
  </tbody></table>{!students.length&&<p className="muted">No students are enrolled in this class.</p>}</div>
  {mark&&<div className="cr-modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)setMark(null);}}><div className="cr-modal" role="dialog" aria-modal="true" aria-label="Mark homework">
   <div className="cr-modal-top"><h2>{mark.name}</h2><button className="button secondary small" onClick={()=>setMark(null)} aria-label="Close">✕</button></div>
   <ol style={{paddingLeft:18,display:"grid",gap:14}}>{questions.map(q=>{const a=mark.sub.answers?.a?.[q.id];
    const shown=a===undefined?"(no answer)":q.kind==="single"?q.options[a]:q.kind==="multi"?(a||[]).map(i=>q.options[i]).join(", "):q.kind==="truefalse"?(a?"True":"False"):String(a);
    const key=q.kind==="single"?q.options[q.answer_key?.index]:q.kind==="multi"?(q.answer_key?.indexes||[]).map(i=>q.options[i]).join(", "):q.kind==="truefalse"?(q.answer_key?.value?"True":"False"):q.kind==="numeric"?String(q.answer_key?.value):(q.answer_key?.accepted||[]).join(" / ");
    return <li key={q.id}><strong style={{whiteSpace:"pre-wrap"}}>{q.prompt}</strong>
     <p style={{margin:"4px 0",whiteSpace:"pre-wrap"}}>Student answer: {shown}</p>{key&&<small className="muted">Answer key: {key}</small>}
     <div><label>Mark (max {Number(q.marks)}) <input className="input" style={{width:90}} type="number" min="0" max={q.marks} step="0.5" value={mark.marks[q.id]} onChange={e=>setMark({...mark,marks:{...mark.marks,[q.id]:e.target.value}})}/></label></div></li>;})}</ol>
   <label>Feedback to the student<textarea className="input" maxLength={2000} value={mark.feedback} onChange={e=>setMark({...mark,feedback:e.target.value})}/></label>
   <button className="button" disabled={busy} onClick={async()=>{await act({action:"grade.save",homeworkId,submissionId:mark.sub.id,marks:mark.marks,feedback:mark.feedback},()=>"Marks saved");setMark(null);}}>Save marks</button>
  </div></div>}
 </section>;
}

export default function HomeworkComposer({code,classId,subjects,assignments,classLabel,subjectLabel,homework,onChanged}){
 const [view,setView]=useState("list"),[f,setF]=useState(null),[qs,setQs]=useState([]),[start,setStart]=useState({n:5,kind:"single"});
 const [err,setErr]=useState(""),[note,setNote]=useState(""),[busy,setBusy]=useState(false),[review,setReview]=useState(null),[preview,setPreview]=useState(false);
 const call=useCallback(async(body,query="")=>{
  const c=browserSupabase();const {data:{session}}=await c.auth.getSession();
  if(!session)throw Error("Sign in again to continue");
  const r=await fetch("/api/school/"+code+"/assignments"+query,{method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+session.access_token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(j.error||"Request failed");return j;
 },[code]);
 const mine=assignments.filter(a=>a.class_id===classId);
 const list=homework.filter(h=>h.class_id===classId);
 const total=qs.reduce((s,q)=>s+(Number(q.marks)||0),0);
 const newForm=()=>{setF({id:null,title:"",objectives:"",instructions:"",subjectId:mine[0]?.subject_id||"",dueLocal:"",releaseLocal:"",latePolicy:"accept_flag",resultsRelease:"manual"});setQs([]);setErr("");setNote("");setPreview(false);setView("edit");};
 async function edit(h){
  setBusy(true);setErr("");
  try{const d=await call(null,"?homeworkId="+h.id);const x=d.homework;
   setF({id:x.id,title:x.title,objectives:x.objectives||"",instructions:x.instructions,subjectId:x.subject_id,dueLocal:toLocalInput(x.due_at),releaseLocal:toLocalInput(x.release_at),latePolicy:x.late_policy,resultsRelease:x.results_release});
   setQs(d.questions.map(fromDb));setPreview(false);setView("edit");}
  catch(e){setErr(e.message);}finally{setBusy(false);}
 }
 const payload=()=>({action:"hw.save",homeworkId:f.id,classId,subjectId:f.subjectId,title:f.title,instructions:f.instructions,objectives:f.objectives,
  dueAt:fromLocalInput(f.dueLocal),releaseAt:fromLocalInput(f.releaseLocal)||null,latePolicy:f.latePolicy,resultsRelease:f.resultsRelease,
  questions:qs.map(q=>({kind:q.kind,prompt:q.prompt,marks:q.marks,options:q.options,correct:q.correct,tolerance:q.tolerance}))});
 async function save(publish){
  setBusy(true);setErr("");setNote("");
  try{
   if(!f.dueLocal)throw Error("Choose a deadline");
   const r=await call(payload());
   if(publish){await call({action:"hw.publish",homeworkId:r.result.id});setNote("Homework published to the class.");setView("list");}
   else{setF({...f,id:r.result.id});setNote("Draft saved.");}
   await onChanged?.();
  }catch(e){setErr(e.message);}finally{setBusy(false);}
 }
 async function quick(body,ok){setBusy(true);setErr("");setNote("");try{await call(body);setNote(ok);await onChanged?.();}catch(e){setErr(e.message);}finally{setBusy(false);}}
 const setQ=(i,q)=>setQs(a=>a.map((x,j)=>j===i?q:x));
 if(review)return <Review code={code} homeworkId={review} call={call} onChanged={onChanged} onBack={()=>setReview(null)}/>;
 if(view==="edit"&&f)return <section className="cr-panel" aria-label="Homework composer">
  <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
   <h2 style={{margin:0}}>{f.id?"Edit homework draft":"New homework or quiz"} · {classLabel(classId)}</h2>
   <button className="button secondary" onClick={()=>{setView("list");setNote("");}}>Cancel</button></div>
  <div style={{display:"grid",gap:12,marginTop:12}}>
   <label><strong>Title</strong><input className="input" maxLength={180} value={f.title} onChange={e=>setF({...f,title:e.target.value})} placeholder="e.g. Fractions quiz"/></label>
   <label><strong>Subject</strong><select className="input" value={f.subjectId} onChange={e=>setF({...f,subjectId:e.target.value})}>{mine.map(a=><option key={a.subject_id} value={a.subject_id}>{subjectLabel(a.subject_id)}</option>)}</select></label>
   <label><strong>Topic or learning goal (optional)</strong><input className="input" maxLength={2000} value={f.objectives} onChange={e=>setF({...f,objectives:e.target.value})}/></label>
   <label><strong>Instructions for students</strong><textarea className="input" rows={3} maxLength={5000} value={f.instructions} onChange={e=>setF({...f,instructions:e.target.value})} placeholder="Tell students what to do"/></label>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
    <label><strong>Deadline (Rwanda time)</strong><input className="input" type="datetime-local" value={f.dueLocal} onChange={e=>setF({...f,dueLocal:e.target.value})}/></label>
    <label><strong>Show to students from (optional)</strong><input className="input" type="datetime-local" value={f.releaseLocal} onChange={e=>setF({...f,releaseLocal:e.target.value})}/></label>
    <label><strong>After the deadline</strong><select className="input" value={f.latePolicy} onChange={e=>setF({...f,latePolicy:e.target.value})}><option value="accept_flag">Accept, mark as late</option><option value="reject">Do not accept answers</option></select></label>
    <label><strong>Results</strong><select className="input" value={f.resultsRelease} onChange={e=>setF({...f,resultsRelease:e.target.value})}><option value="manual">I release results myself</option><option value="auto">Show as soon as I mark</option></select></label></div></div>
  <h3 style={{marginTop:18}}>Questions {qs.length>0&&<small className="muted">· {qs.length} questions · {total} marks</small>}</h3>
  {!qs.length&&<div className="cr-info" style={{display:"grid",gap:10}}>
   <strong>How many questions do you want?</strong>
   <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"end"}}>
    <label>Number of questions <input className="input" type="number" min="1" max="100" style={{width:100}} value={start.n} onChange={e=>setStart({...start,n:e.target.value})}/></label>
    <label>Start each as <select className="input" value={start.kind} onChange={e=>setStart({...start,kind:e.target.value})}>{TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
    <button className="button" type="button" onClick={()=>{const n=Math.max(1,Math.min(100,Math.floor(Number(start.n))||1));setQs(Array.from({length:n},()=>blank(start.kind)));}}>Create question slots</button></div>
   <small className="muted">You can change the type of any question, add more, copy, reorder, or delete them afterwards.</small></div>}
  {preview?<ol style={{paddingLeft:20,display:"grid",gap:16}}>{qs.map((q,i)=><li key={q.uid}><strong style={{whiteSpace:"pre-wrap"}}>{q.prompt||"(no text yet)"}</strong> <small className="muted">{q.marks} marks</small>
   <div style={{marginTop:6}}><QuestionInput q={{id:q.uid,kind:q.kind,options:q.options.map(o=>o||"…"),prompt:q.prompt}} value={undefined} onChange={()=>{}} disabled/></div></li>)}</ol>
  :<ol style={{padding:0,display:"grid",gap:12}}>{qs.map((q,i)=><QuestionEditor key={q.uid} q={q} n={i+1} count={qs.length} set={x=>setQ(i,x)}
    remove={()=>setQs(a=>a.filter((_,j)=>j!==i))} dup={()=>setQs(a=>[...a.slice(0,i+1),{...q,uid:Math.random().toString(36).slice(2)},...a.slice(i+1)])}
    move={d=>setQs(a=>{const b=[...a];const j=i+d;if(j<0||j>=b.length)return a;[b[i],b[j]]=[b[j],b[i]];return b;})}/>)}</ol>}
  {qs.length>0&&!preview&&qs.length<100&&<div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"12px 0"}}>
   <button type="button" className="button secondary" onClick={()=>setQs(a=>[...a,blank(a[a.length-1]?.kind||"single")])}>+ Add another question</button></div>}
  {err&&<div className="notice error" role="alert">{err}</div>}{note&&<div className="notice info" role="status">{note}</div>}
  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
   <button className="button secondary" disabled={!qs.length} onClick={()=>setPreview(p=>!p)}>{preview?"Back to editing":"Preview as student"}</button>
   <button className="button secondary" disabled={busy||!qs.length} onClick={()=>save(false)}>Save draft</button>
   <button className="button" disabled={busy||!qs.length} onClick={()=>confirm("Publish to the class now?")&&save(true)}>Save and publish</button></div>
 </section>;
 return <section className="cr-panel"><div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}><h2 style={{margin:0}}>Homework and quizzes</h2>
  <button className="button" disabled={!mine.length} onClick={newForm}>+ Create homework or quiz</button></div>
  {err&&<div className="notice error" role="alert">{err}</div>}{note&&<div className="notice info" role="status">{note}</div>}
  <div className="cr-card-grid" style={{marginTop:12}}>{list.map(h=>{const due=new Date(h.due_at);return <article key={h.id} className="cr-lesson">
   <div className="cr-card-header"><span className="cr-tag">{subjectLabel(h.subject_id)}</span><span className="cr-status">{h.status}</span></div>
   <h3>{h.title}</h3><small>Due: {fmt(h.due_at)}{h.release_at&&new Date(h.release_at)>new Date()?" · shows from "+fmt(h.release_at):""}</small>
   <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
    {h.status==="draft"&&<button className="button secondary small" disabled={busy} onClick={()=>edit(h)}>Edit</button>}
    {h.status==="draft"&&<button className="button small" disabled={busy} onClick={()=>confirm("Publish to the class now?")&&quick({action:"hw.publish",homeworkId:h.id},"Published.")}>Publish</button>}
    {h.status==="published"&&<button className="button secondary small" disabled={busy} onClick={()=>{const v=prompt("New deadline in Rwanda time, format 2026-12-05 17:00");if(!v)return;const iso=fromLocalInput(v.trim().replace(" ","T"));if(!iso||isNaN(Date.parse(iso)))return setErr("Use the format 2026-12-05 17:00");quick({action:"hw.extend",homeworkId:h.id,dueAt:iso},"Deadline extended.");}}>Extend deadline</button>}
    {h.status==="published"&&<button className="button secondary small" disabled={busy} onClick={()=>confirm("Close submissions?")&&quick({action:"hw.close",homeworkId:h.id},"Closed.")}>Close</button>}
    {h.status==="closed"&&<button className="button secondary small" disabled={busy} onClick={()=>{const v=prompt("Reopen until (Rwanda time) 2026-12-05 17:00");if(!v)return;const iso=fromLocalInput(v.trim().replace(" ","T"));if(!iso||isNaN(Date.parse(iso)))return setErr("Use the format 2026-12-05 17:00");quick({action:"hw.reopen",homeworkId:h.id,dueAt:iso},"Reopened.");}}>Reopen</button>}
    {h.status!=="draft"&&<button className="button small" onClick={()=>setReview(h.id)}>Submissions and marking</button>}
    <button className="button secondary small" disabled={busy} onClick={()=>quick({action:"hw.duplicate",homeworkId:h.id},"Copied as a new draft.")}>Duplicate</button></div></article>;})}</div>
  {!list.length&&<div className="cr-empty"><strong>No homework yet</strong><p>Create your first homework or quiz for this class.</p></div>}
 </section>;
}
