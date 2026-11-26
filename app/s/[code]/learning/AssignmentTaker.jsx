"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";

export const MATH_KEYS=["+","−","×","÷","=","≠","<",">","≤","≥","²","³","√","∛","π","½","¼","¾","%","°","∞","(",")","^","/"];
export function MathField({value,onChange,multiline=false,placeholder,disabled,label,maxLength=2000,rows=3}){
 const ref=useRef(null),[open,setOpen]=useState(false);
 const insert=(sym)=>{
  const el=ref.current;const v=value||"";
  const a=el?.selectionStart??v.length,b=el?.selectionEnd??v.length;
  const next=(v.slice(0,a)+sym+v.slice(b)).slice(0,maxLength);
  onChange(next);
  requestAnimationFrame(()=>{if(el){el.focus();const pos=Math.min(a+sym.length,next.length);el.setSelectionRange(pos,pos);}});
 };
 const Tag=multiline?"textarea":"input";
 return <div style={{width:"100%"}}>
  <Tag ref={ref} className="input" aria-label={label} placeholder={placeholder} disabled={disabled} maxLength={maxLength}
   {...(multiline?{rows}:{type:"text"})} style={{width:"100%"}} value={value||""}
   onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),150)} onChange={e=>onChange(e.target.value)}/>
  {open&&!disabled&&<div role="toolbar" aria-label="Math symbols" style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
   {MATH_KEYS.map(k=><button type="button" key={k} className="button secondary small" aria-label={"Insert "+k}
    style={{minWidth:34,padding:"4px 8px"}} onMouseDown={e=>e.preventDefault()} onClick={()=>insert(k)}>{k}</button>)}
  </div>}
 </div>;
}
export function QuestionInput({q,value,onChange,disabled}){
 const name="q-"+q.id;
 if(q.kind==="single")return <div role="radiogroup" aria-label={q.prompt} style={{display:"grid",gap:6}}>
  {q.options.map((o,i)=><label key={i} style={{display:"flex",gap:8,alignItems:"center"}}>
   <input type="radio" name={name} disabled={disabled} checked={value===i} onChange={()=>onChange(i)}/>{o}</label>)}</div>;
 if(q.kind==="multi"){
  const cur=Array.isArray(value)?value:[];
  return <div style={{display:"grid",gap:6}}><small className="muted">Choose every correct answer.</small>
   {q.options.map((o,i)=><label key={i} style={{display:"flex",gap:8,alignItems:"center"}}>
    <input type="checkbox" disabled={disabled} checked={cur.includes(i)}
     onChange={e=>onChange(e.target.checked?[...cur,i].sort((a,b)=>a-b):cur.filter(x=>x!==i))}/>{o}</label>)}</div>;
 }
 if(q.kind==="truefalse")return <div role="radiogroup" aria-label={q.prompt} style={{display:"flex",gap:16}}>
  {[true,false].map(v=><label key={String(v)} style={{display:"flex",gap:8,alignItems:"center"}}>
   <input type="radio" name={name} disabled={disabled} checked={value===v} onChange={()=>onChange(v)}/>{v?"True":"False"}</label>)}</div>;
 if(q.kind==="essay")return <MathField multiline rows={6} maxLength={5000} label="Your answer" disabled={disabled} value={value} onChange={onChange} placeholder="Write your answer"/>;
 return <MathField label="Your answer" maxLength={500} disabled={disabled} value={value} onChange={onChange}
  placeholder={q.kind==="numeric"?"Type a number":"Type your answer"}/>;
}
const fmt=d=>new Date(d).toLocaleString("en-RW",{timeZone:"Africa/Kigali"});
export default function AssignmentTaker({code,homeworkId,onDone,onClose}){
 const [data,setData]=useState(null),[answers,setAnswers]=useState({}),[err,setErr]=useState(""),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
 const [endsAt,setEndsAt]=useState(null),[left,setLeft]=useState(null);
 const call=useCallback(async(body)=>{
  const c=browserSupabase();const {data:{session}}=await c.auth.getSession();
  if(!session)throw Error("Sign in again to continue");
  const r=await fetch("/api/school/"+code+"/assignments"+(body?"":"?as=student&homeworkId="+homeworkId),{method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+session.access_token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(j.error||"Request failed");return j;
 },[code,homeworkId]);
 useEffect(()=>{call().then(j=>{setData(j);setAnswers(j.submission?j.submission.answers:j.draft||{});
  const lim=j.homework.time_limit_minutes;if(lim&&j.startedAt&&!j.submission){const skew=Date.now()-new Date(j.serverNow).getTime();setEndsAt(new Date(j.startedAt).getTime()+lim*60000+skew);}}).catch(e=>setErr(e.message));},[call]);
 useEffect(()=>{if(!endsAt)return;const t=setInterval(()=>setLeft(Math.max(0,Math.round((endsAt-Date.now())/1000))),1000);return ()=>clearInterval(t);},[endsAt]);
 useEffect(()=>{if(left===0&&data&&!data.submission&&!autoSent.current){autoSent.current=true;setBusy(true);call({action:"submit",homeworkId,answers}).then(async()=>{await onDone?.();onClose();}).catch(e=>{setErr(e.message);setBusy(false);});}});
 const autoSent=useRef(false);
 async function startQuiz(){setBusy(true);setErr("");try{await call({action:"start",homeworkId});const j=await call();setData(j);const skew=Date.now()-new Date(j.serverNow).getTime();setEndsAt(new Date(j.startedAt).getTime()+j.homework.time_limit_minutes*60000+skew);}catch(e){setErr(e.message);}finally{setBusy(false);}}
 const dirty=useRef(false);
 const set=(id,v)=>{dirty.current=true;setAnswers(a=>({...a,[id]:v}));};
 useEffect(()=>{
  if(!data||data.submission)return;
  const t=setInterval(()=>{if(dirty.current){dirty.current=false;call({action:"draft.save",homeworkId,answers}).then(()=>setMsg("Draft saved")).catch(()=>setMsg("Could not save draft. Check your connection."));}},8000);
  return ()=>clearInterval(t);
 },[data,answers,call,homeworkId]);
 if(err&&!data)return <section className="ds-panel"><p role="alert">{err}</p><button className="button secondary" onClick={onClose}>Back</button></section>;
 if(!data)return <section className="ds-panel"><p>Opening homework…</p></section>;
 const {homework:h,questions,submission:sub}=data;
 const timed=Boolean(h.time_limit_minutes);const notStarted=timed&&!sub&&!data.startedAt&&!endsAt;
 const clock=left===null?"":Math.floor(left/60)+":"+String(left%60).padStart(2,"0");
 const late=Date.now()>new Date(h.due_at).getTime();
 async function save(){setBusy(true);setErr("");try{await call({action:"draft.save",homeworkId,answers});setMsg("Draft saved");dirty.current=false;}catch(e){setErr(e.message);}finally{setBusy(false);}}
 async function submit(){
  const left=questions.filter(q=>answers[q.id]===undefined||answers[q.id]===""||(Array.isArray(answers[q.id])&&!answers[q.id].length)).length;
  if(left&&!confirm(left+" question"+(left===1?" is":"s are")+" unanswered. Submit anyway? You cannot change answers after submitting."))return;
  if(!left&&!confirm("Submit your answers now? You cannot change them after submitting."))return;
  setBusy(true);setErr("");
  try{await call({action:"submit",homeworkId,answers});setMsg("Homework submitted.");await onDone?.();onClose();}
  catch(e){setErr(e.message);}finally{setBusy(false);}
 }
 return <section className="ds-panel" aria-label={h.title}>
  <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
   <div><h3 style={{margin:0}}>{h.title}</h3><small className="muted">Due {fmt(h.due_at)}{late&&!sub?" · deadline passed":""}</small></div>
   <button className="button secondary small" onClick={onClose}>Back to homework</button></div>
  {h.objectives&&<p><strong>Goal:</strong> {h.objectives}</p>}
  <p style={{whiteSpace:"pre-wrap"}}>{h.instructions}</p>
  {sub&&<div className="notice info">{sub.released?(sub.score!=null?"Your score: "+Number(sub.score)+" / "+Number(sub.maxScore):"Marked"):"Submitted. Your teacher has not released results yet."}{sub.isLate?" · submitted late":""}
   {sub.released&&sub.feedback&&<p style={{marginBottom:0}}><strong>Teacher feedback:</strong> {sub.feedback}</p>}</div>}
  {late&&!sub&&h.late_policy==="reject"&&<div className="notice error">The deadline has passed. This homework no longer accepts answers.</div>}
  {timed&&!sub&&<div className="notice info" role="timer"><strong>Timed quiz: {h.time_limit_minutes} minutes.</strong>{endsAt?" Time left: "+clock+". Your answers are sent automatically when time ends.":" The timer starts when you press Start and cannot be paused."}</div>}
  {notStarted&&<button className="button" disabled={busy} onClick={startQuiz}>Start quiz</button>}
  {!notStarted&&<ol style={{paddingLeft:20,display:"grid",gap:18}}>
   {questions.map(q=><li key={q.id}><div style={{display:"flex",justifyContent:"space-between",gap:8}}>
    <strong style={{whiteSpace:"pre-wrap"}}>{q.prompt}</strong><small className="muted">{q.marks} mark{q.marks===1?"":"s"}</small></div>
    <div style={{marginTop:8}}><QuestionInput q={q} value={answers[q.id]} onChange={v=>set(q.id,v)} disabled={!!sub||(late&&h.late_policy==="reject")}/></div>
    {sub?.released&&sub.marks[q.id]!==undefined&&<small className="muted">You scored {sub.marks[q.id]} / {q.marks}</small>}</li>)}
  </ol>}
  {err&&<div className="notice error" role="alert">{err}</div>}{msg&&!err&&<small className="muted" role="status">{msg}</small>}
  {!sub&&!notStarted&&!(late&&h.late_policy==="reject")&&<div style={{display:"flex",gap:8,marginTop:12}}>
   <button className="button secondary" disabled={busy} onClick={save}>Save draft</button>
   <button className="button" disabled={busy} onClick={submit}>{late?"Submit late":"Submit homework"}</button></div>}
 </section>;
}
