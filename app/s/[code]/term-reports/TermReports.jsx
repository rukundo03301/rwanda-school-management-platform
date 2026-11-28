"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
import {TEMPLATE_LABEL,NURSERY_AREAS,NURSERY_DESCRIPTORS,COMPETENCE,cleanContent,contentProblems} from "../../../../lib/report-templates.mjs";
import TermReportView from "../../../ui/TermReportView.jsx";
const LEVEL={nursery:"Nursery",primary:"Primary",secondary:"Secondary",tvet:"TVET",university:"University"};
const STATUS={draft:"Draft",submitted:"Waiting for review",reviewed:"Reviewed, waiting for approval",approved:"Approved, ready to publish",published:"Published to family",returned:"Returned to teacher"};
const PERM_LABEL={"reports.review":"Review","reports.approve":"Approve","reports.publish":"Publish"};
const inp={className:"input"};

function blankContent(level,subjects){
 if(level==="nursery")return {areas:Object.fromEntries(NURSERY_AREAS.map(([k])=>[k,{descriptor:"",summary:""}])),attendance:{}};
 if(level==="primary"||level==="secondary")return {subjects:subjects.map(name=>({name,continuous:"",exam:"",comment:""})),conduct:"",attendance:{}};
 if(level==="tvet")return {modules:subjects.map(name=>({name,competence:"",hours:"",comment:""})),attendance:{}};
 return {courses:subjects.map(name=>({code:"",name,credits:"",mark:""})),attendance:{}};
}

function Rows({list,cols,onChange,addLabel,blank}){
 const set=(i,k,v)=>onChange(list.map((r,j)=>j===i?{...r,[k]:v}:r));
 return <div><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{cols.map(c=><th key={c.k} style={{textAlign:"left",padding:4}}>{c.l}</th>)}<th/></tr></thead>
  <tbody>{list.map((r,i)=><tr key={i}>{cols.map(c=><td key={c.k} style={{padding:4}}>{c.opts?<select {...inp} value={r[c.k]||""} onChange={e=>set(i,c.k,e.target.value)}><option value="">Choose</option>{c.opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
   :<input {...inp} type={c.num?"number":"text"} min={c.num?0:undefined} max={c.max} step="any" value={r[c.k]??""} onChange={e=>set(i,c.k,e.target.value)}/>}</td>)}
   <td><button type="button" className="button small secondary" onClick={()=>onChange(list.filter((_,j)=>j!==i))}>Remove</button></td></tr>)}</tbody></table>
  <button type="button" className="button small secondary" onClick={()=>onChange([...list,{...blank}])}>{addLabel}</button></div>;
}

function ReportForm({level,content,setContent}){
 const c=content;
 if(level==="nursery")return <div>{NURSERY_AREAS.map(([k,l])=><fieldset key={k} style={{border:"1px solid #dbe4f0",borderRadius:8,margin:"8px 0",padding:10}}><legend><strong>{l}</strong></legend>
  <select {...inp} value={c.areas[k].descriptor} onChange={e=>setContent({...c,areas:{...c.areas,[k]:{...c.areas[k],descriptor:e.target.value}}})}><option value="">Choose progress</option>{NURSERY_DESCRIPTORS.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select>
  <textarea {...inp} maxLength={600} placeholder="What the child can do and what comes next" value={c.areas[k].summary} onChange={e=>setContent({...c,areas:{...c.areas,[k]:{...c.areas[k],summary:e.target.value}}})}/></fieldset>)}</div>;
 if(level==="primary"||level==="secondary")return <><Rows list={c.subjects} onChange={v=>setContent({...c,subjects:v})} addLabel="+ Add subject" blank={{name:"",continuous:"",exam:"",comment:""}}
   cols={[{k:"name",l:"Subject"},{k:"continuous",l:"Continuous %",num:1,max:100},{k:"exam",l:"Exam %",num:1,max:100},{k:"comment",l:"Comment"}]}/>
  <label>Conduct<input {...inp} maxLength={300} value={c.conduct||""} onChange={e=>setContent({...c,conduct:e.target.value})}/></label></>;
 if(level==="tvet")return <Rows list={c.modules} onChange={v=>setContent({...c,modules:v})} addLabel="+ Add module" blank={{name:"",competence:"",hours:"",comment:""}}
   cols={[{k:"name",l:"Module"},{k:"competence",l:"Result",opts:COMPETENCE},{k:"hours",l:"Practical hours",num:1,max:2000},{k:"comment",l:"Comment"}]}/>;
 return <Rows list={c.courses} onChange={v=>setContent({...c,courses:v})} addLabel="+ Add course" blank={{code:"",name:"",credits:"",mark:""}}
   cols={[{k:"code",l:"Code"},{k:"name",l:"Course"},{k:"credits",l:"Credits",num:1,max:60},{k:"mark",l:"Mark %",num:1,max:100}]}/>;
}

export default function TermReports({code}){
 const [data,setData]=useState(null),[error,setError]=useState(""),[note,setNote]=useState(""),[busy,setBusy]=useState(false);
 // Links from notifications: ?tab=queue&report=… or ?tab=write&class=…&term=…&student=…
 const deep=useRef(typeof window==="undefined"?{}:Object.fromEntries(new URLSearchParams(location.search)));
 const [tab,setTab]=useState(""),[classId,setClassId]=useState(deep.current.class||""),[term,setTerm]=useState(()=>[1,2,3].includes(Number(deep.current.term))?Number(deep.current.term):1),[open,setOpen]=useState(null);
 const [content,setContent]=useState(null),[comment,setComment]=useState(""),[filter,setFilter]=useState("submitted"),[stepText,setStepText]=useState({});
 const call=useCallback(async(body,query="")=>{
  const c=browserSupabase();const {data:{session}}=await c.auth.getSession();
  if(!session)throw Error("Please sign in to your school first.");
  const r=await fetch("/api/school/"+code+"/term-reports"+query,{method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+session.access_token,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
  const d=await r.json();if(!r.ok)throw Error(d.error||"Request failed");return d;
 },[code]);
 const load=useCallback(async()=>{
  try{const d=await call(null,classId?"?classId="+classId+"&term="+term:"?term="+term);setData(d);setError("");
   const want=deep.current.tab,ok={write:d.me.teacher,queue:d.me.perms.length>0,roles:d.me.owner};
   setTab(t=>t||(want&&ok[want]?want:d.me.teacher?"write":d.me.perms.length?"queue":"roles"));
   if(want==="queue"&&deep.current.report){const q=(d.queue||[]).find(x=>x.id===deep.current.report);if(q)setFilter(q.status);}
   if(!classId&&d.classes[0])setClassId(d.classes[0].id);}catch(e){setError(e.message);}
 },[call,classId,term]);
 useEffect(()=>{load();},[load]);
 useEffect(()=>{if(!note)return;const t=setTimeout(()=>setNote(""),8000);return()=>clearTimeout(t);},[note]);
 useEffect(()=>{if(open)setTimeout(()=>document.getElementById("tr-form")?.scrollIntoView({behavior:"smooth",block:"start"}),50);},[open]);
 const act=async(body,done)=>{setBusy(true);setNote("");try{await call(body);setNote(done);await load();return true;}catch(e){setNote(e.message);return false;}finally{setBusy(false);}};
 if(error)return <main className="rem-resources"><section className="rem-resource-card" role="alert">{error}<p><button type="button" className="button" onClick={()=>{setError("");load();}}>Try again</button></p></section></main>;
 if(!data)return <main className="rem-resources"><p>Opening term reports…</p></main>;
 const cv=data.classView,level=cv?.level;
 if(deep.current.student&&cv&&cv.id===classId&&!deep.current.opened){const s=cv.students.find(x=>x.id===deep.current.student);deep.current.opened=true;
  if(s)setTimeout(()=>openStudent(s),0);}
 const openStudent=s=>{setOpen(s.id);setNote("");const r=s.report;setComment(r?.teacher_comment||"");
  const base=blankContent(level,cv.subjects);setContent(r?{...base,...r.content}:base);};
 const editable=r=>!r||r.status==="draft"||r.status==="returned";
 const queue=(data.queue||[]).filter(q=>filter==="all"||q.status===filter);
 const can=p=>data.me.perms.includes(p);
 const tabs=[data.me.teacher&&["write","Write reports"],data.me.perms.length&&["queue","Review, approve and publish"],data.me.owner&&["roles","Who can do what"]].filter(Boolean);
 return <main className="rem-resources">
  <header><h1>Term Reports</h1><p>Teachers draft reports for their classes. The report template follows each class's education level. The people the school owner chooses review, approve and publish them to families.</p></header>
  <div className="rem-resource-toolbar">{tabs.map(([k,l])=><button key={k} type="button" className={"button"+(tab===k?"":" secondary")} onClick={()=>{setTab(k);setNote("");}}>{l}</button>)}</div>
  {note&&<p className="rem-resource-banner" role="status" style={{position:"fixed",right:24,bottom:24,zIndex:50,maxWidth:420,margin:0,display:"flex",gap:12,alignItems:"flex-start",boxShadow:"0 8px 24px rgba(20,40,80,.2)"}}><span style={{flex:1}}>{note}</span><button type="button" className="button small secondary" aria-label="Dismiss message" onClick={()=>setNote("")}>Close</button></p>}

  {tab==="write"&&<section>
   <div className="rem-resource-toolbar">
    <label>Class<select value={classId} onChange={e=>{setClassId(e.target.value);setOpen(null);}}>{data.classes.map(c=><option key={c.id} value={c.id}>{c.name} ({LEVEL[c.level]||"level not set"})</option>)}</select></label>
    <label>Term<select value={term} onChange={e=>{setTerm(Number(e.target.value));setOpen(null);}}>{[1,2,3].map(t=><option key={t} value={t}>Term {t}</option>)}</select></label>
   </div>
   {cv&&!level&&<p className="rem-resource-banner">This class has no education level yet. Ask the school administrator to set it under Administration, Academic Setup.</p>}
   {cv&&level&&<><p><strong>Template:</strong> {TEMPLATE_LABEL[level]}</p>
    <div className="table-wrap"><table><thead><tr><th>Student</th><th>Status</th><th/></tr></thead><tbody>{cv.students.map(s=><tr key={s.id}>
     <td>{s.name}</td><td>{s.report?STATUS[s.report.status]:"Not started"}</td>
     <td><button type="button" className="button small" onClick={()=>openStudent(s)}>{editable(s.report)?(s.report?"Continue":"Write report"):"View"}</button></td></tr>)}</tbody></table></div>
    {open&&content&&(()=>{const s=cv.students.find(x=>x.id===open);const r=s.report;
     return <section id="tr-form" className="rem-resource-card" style={{marginTop:16,scrollMarginTop:80}}>
      <h2>{s.name} · Term {term}</h2>
      {r?.status==="returned"&&<p className="rem-resource-banner">Returned to you: {r.return_reason}</p>}
      {editable(r)?<>
       <ReportForm level={level} content={content} setContent={setContent}/>
       <div className="rem-resource-toolbar"><label>Days present<input {...inp} type="number" min={0} value={content.attendance?.present??""} onChange={e=>setContent({...content,attendance:{...content.attendance,present:e.target.value}})}/></label>
        <label>School days<input {...inp} type="number" min={0} value={content.attendance?.total??""} onChange={e=>setContent({...content,attendance:{...content.attendance,total:e.target.value}})}/></label></div>
       <label>Teacher comment<textarea {...inp} maxLength={1500} value={comment} onChange={e=>setComment(e.target.value)}/></label>
       {(()=>{const p=contentProblems(level,content);return p.length?<div className="rem-resource-banner" role="alert" style={{borderColor:"#dc2626",color:"#991b1b"}}><strong>Please correct before saving:</strong><ul style={{margin:"6px 0 0 18px"}}>{p.map(x=><li key={x}>{x}</li>)}</ul></div>:null;})()}
       <div className="rem-resource-links">
        <button type="button" className="button secondary" disabled={busy||contentProblems(level,content).length>0} onClick={()=>act({action:"save",classId,studentId:s.id,term,content,teacherComment:comment},"Draft saved.")}>Save draft</button>
        <button type="button" className="button" disabled={busy||contentProblems(level,content).length>0} onClick={async()=>{if(await act({action:"save",classId,studentId:s.id,term,content,teacherComment:comment,submit:true},"Report submitted for review."))setOpen(null);}}>Submit for review</button>
        <button type="button" className="button secondary" onClick={()=>setOpen(null)}>Close</button>
       </div>
       <h3>Preview</h3><TermReportView report={{template:level,content:cleanContent(level,content,[]),teacher_comment:comment,term_number:term}} student={s.name}/>
      </>:<><TermReportView report={{...r,term_number:term}} student={s.name}/><button type="button" className="button secondary" onClick={()=>setOpen(null)}>Close</button></>}
     </section>;})()}
   </>}
  </section>}

  {tab==="queue"&&<section>
   <div className="rem-resource-toolbar"><label>Show<select value={filter} onChange={e=>setFilter(e.target.value)}>
    {["submitted","reviewed","approved","returned","published","all"].map(s=><option key={s} value={s}>{s==="all"?"All":STATUS[s]} ({(data.queue||[]).filter(q=>s==="all"||q.status===s).length})</option>)}</select></label></div>
   {!queue.length&&<p className="ds-empty">No reports in this list.</p>}
   {queue.map(q=><details key={q.id} id={"rep-"+q.id} open={q.id===deep.current.report||undefined} ref={el=>{if(el&&q.id===deep.current.report&&!deep.current.scrolled){deep.current.scrolled=true;setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"start"}),100);}}} className="rem-resource-card" style={{marginBottom:10,scrollMarginTop:80,...(q.id===deep.current.report?{outline:"3px solid #f5b400"}:{})}}>
    <summary><strong>{q.student}</strong> · {q.className} · Term {q.term_number} · {LEVEL[q.template]} · {STATUS[q.status]}</summary>
    <TermReportView report={q} student={q.student} className={q.className}/>
    {q.return_reason&&q.status==="returned"&&<p>Returned: {q.return_reason}</p>}
    <label>Comment or reason<textarea {...inp} maxLength={1500} value={stepText[q.id]||""} onChange={e=>setStepText({...stepText,[q.id]:e.target.value})}/></label>
    <div className="rem-resource-links">
     {q.status==="submitted"&&can("reports.review")&&<button type="button" className="button" disabled={busy} onClick={()=>act({action:"advance",reportId:q.id,step:"review",comment:stepText[q.id]||""},"Report reviewed.")}>Mark reviewed</button>}
     {["submitted","reviewed"].includes(q.status)&&can("reports.approve")&&<button type="button" className="button" disabled={busy} onClick={()=>act({action:"advance",reportId:q.id,step:"approve",comment:stepText[q.id]||""},"Report approved. The comment is printed as the headteacher comment.")}>Approve</button>}
     {q.status==="approved"&&can("reports.publish")&&<button type="button" className="button" disabled={busy} onClick={()=>act({action:"advance",reportId:q.id,step:"publish"},"Report published. The family can now read it.")}>Publish to family</button>}
     {["submitted","reviewed","approved"].includes(q.status)&&(can("reports.review")||can("reports.approve"))&&<button type="button" className="button secondary" disabled={busy} onClick={()=>act({action:"advance",reportId:q.id,step:"return",comment:stepText[q.id]||""},"Report returned to the teacher.")}>Return to teacher</button>}
     {q.status==="published"&&can("reports.publish")&&<button type="button" className="button secondary" disabled={busy} onClick={()=>act({action:"advance",reportId:q.id,step:"withdraw",comment:stepText[q.id]||""},"Report withdrawn and returned to the teacher.")}>Withdraw</button>}
    </div>
   </details>)}
  </section>}

  {tab==="roles"&&data.members&&<section>
   <p>Choose who may review, approve and publish term reports. You, the owner, can always do all three. Teachers always draft reports for the classes they teach.</p>
   <div className="table-wrap"><table><thead><tr><th>Person</th><th>Role</th>{Object.values(PERM_LABEL).map(l=><th key={l}>{l}</th>)}<th/></tr></thead>
    <tbody>{data.members.map(m=><RoleRow key={m.id} m={m} busy={busy} onSave={p=>act({action:"roles",userId:m.id,permissions:p},"Saved for "+(m.name||m.email)+".")}/>)}</tbody></table></div>
  </section>}
 </main>;
}

function RoleRow({m,busy,onSave}){
 const [p,setP]=useState(m.permissions);
 const roleName={school_admin:"Principal",teacher:"Teacher",staff:"Staff"}[m.role]||m.role;
 return <tr><td>{m.name||m.email}<br/><small>{m.name?m.email:""}</small></td><td>{roleName}</td>
  {Object.keys(PERM_LABEL).map(k=><td key={k}><input type="checkbox" aria-label={PERM_LABEL[k]+" for "+(m.name||m.email)} checked={p.includes(k)} onChange={e=>setP(e.target.checked?[...p,k]:p.filter(x=>x!==k))}/></td>)}
  <td><button type="button" className="button small" disabled={busy||JSON.stringify([...p].sort())===JSON.stringify([...m.permissions].sort())} onClick={()=>onSave(p)}>Save</button></td></tr>;
}
