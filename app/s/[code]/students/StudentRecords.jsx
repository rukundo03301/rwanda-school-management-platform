"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {useRouter,useSearchParams} from "next/navigation";
import {browserSupabase} from "../../../../lib/client.js";
import {Icon} from "../../../ui/DashboardShell.jsx";
import "./students.css";

// Student Records: every pupil's school fees and the school checklist (uniform, card, exam papers...)
// on one page. The list shows who is complete; opening a pupil shows everything about them.
const CAT={uniform:["Uniform","#7c3aed"],card:["Student card","#0891b2"],materials:["Books and materials","#0d9488"],exam:["Exam papers","#c2410c"],fees:["Other payment","#15803d"],other:["Other","#64748b"]};
const LEVEL={all:"All levels",nursery:"Nursery",primary:"Primary",secondary:"Secondary",tvet:"TVET",university:"University"};
const STATUS={done:["Done","ok"],missing:["Missing","miss"],waived:["Not needed","na"]};
const rwf=v=>Number(v||0).toLocaleString("en-US")+" RWF";

export default function StudentRecords({code}){
 const sp=useSearchParams(),router=useRouter();
 const studentId=sp.get("student")||"";
 const [client,setClient]=useState(null),[d,setD]=useState(null),[one,setOne]=useState(null),[err,setErr]=useState(""),[note,setNote]=useState(null),[busy,setBusy]=useState(false);
 useEffect(()=>{setClient(browserSupabase());},[]);
 const call=useCallback(async(body,query="")=>{
  const {data:{session}}=await client.auth.getSession();
  if(!session)throw Error("Your school sign-in has expired. Sign in again.");
  const r=await fetch("/api/school/"+code+"/student-records"+query,{method:body?"POST":"GET",cache:"no-store",headers:{Authorization:"Bearer "+session.access_token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||"Request failed");return j;
 },[client,code]);
 const load=useCallback(async()=>{
  try{const [all,me]=await Promise.all([call(),studentId?call(null,"?student="+encodeURIComponent(studentId)):Promise.resolve(null)]);setD(all);setOne(me);setErr("");}
  catch(e){setErr(e.message);}
 },[call,studentId]);
 useEffect(()=>{if(client)load();},[client,load]);
 const act=useCallback(async(body,ok)=>{setBusy(true);setNote(null);
  try{const j=await call(body);await load();if(ok)setNote({ok:true,text:typeof ok==="function"?ok(j.result):ok});return j;}
  catch(e){setNote({ok:false,text:e.message});return null;}finally{setBusy(false);}},[call,load]);
 const go=id=>{setNote(null);router.push("/s/"+code+"/students"+(id?"?student="+id:""),{scroll:true});};
 if(err&&!d)return <section className="ds-panel"><h3>Student records are not available</h3><p role="alert">{err}</p></section>;
 if(!d)return <section className="ds-panel"><p>Loading student records…</p></section>;
 return <div className="sr-wrap">
  {note&&<div className={"notice "+(note.ok?"info":"error")} role={note.ok?"status":"alert"}>{note.text}</div>}
  {studentId&&one?.student?<Portfolio code={code} d={d} s={one.student} act={act} busy={busy} back={()=>go("")}/>:<List d={d} open={go} act={act} busy={busy}/>}
 </div>;
}

function Progress({done,total}){
 const pct=total?Math.round(done*100/total):100;
 return <div className="sr-prog" title={done+" of "+total}><i style={{width:pct+"%",background:pct===100?"#16a34a":pct>=50?"#f59e0b":"#dc2626"}}/><span>{total?done+"/"+total:"No items"}</span></div>;
}

function List({d,open,act,busy}){
 const [q,setQ]=useState(""),[cls,setCls]=useState("all"),[show,setShow]=useState("all"),[setup,setSetup]=useState(!d.items.length&&d.can.manage);
 const list=d.students.filter(s=>(cls==="all"||s.classId===cls)&&(!q||(s.name+" "+s.code).toLowerCase().includes(q.toLowerCase()))
  &&(show==="all"||(show==="fees"&&s.fees&&s.fees.balance>0)||(show==="late"&&s.fees&&s.fees.overdue>0)||(show==="missing"&&s.done<s.total)||(show==="complete"&&s.done===s.total&&(!s.fees||s.fees.balance===0))));
 const complete=d.students.filter(s=>s.done===s.total&&(!s.fees||s.fees.balance===0)).length;
 const missing=d.students.filter(s=>s.done<s.total).length;
 const owing=d.students.filter(s=>s.fees&&s.fees.balance>0).length;
 const late=d.students.filter(s=>s.fees&&s.fees.overdue>0).length;
 return <>
  <header className="sr-head"><div><h2>Student Records</h2><p>Open any pupil to see their school fees and whether they have brought everything on the school checklist{d.year?" for "+d.year.name:""}.</p></div>
   {d.can.manage&&<button className="button secondary" onClick={()=>setSetup(x=>!x)}><Icon name="check" size={16}/> {setup?"Close checklist setup":"Set up the checklist"}</button>}</header>
  <div className="sr-stats">
   <button className={"sr-stat teal"+(show==="all"?" on":"")} onClick={()=>setShow("all")}><b>{d.students.length}</b><small>Students</small></button>
   <button className={"sr-stat green"+(show==="complete"?" on":"")} onClick={()=>setShow("complete")}><b>{complete}</b><small>Everything complete</small></button>
   <button className={"sr-stat orange"+(show==="missing"?" on":"")} onClick={()=>setShow("missing")}><b>{missing}</b><small>Missing checklist items</small></button>
   {d.can.finance&&<button className={"sr-stat red"+(show==="late"?" on":"")} onClick={()=>setShow("late")}><b>{late}</b><small>Fees past due</small></button>}
   {d.can.finance&&<button className={"sr-stat blue"+(show==="fees"?" on":"")} onClick={()=>setShow("fees")}><b>{owing}</b><small>Still owe fees</small></button>}
  </div>
  {setup&&<Setup d={d} act={act} busy={busy}/>}
  <section className="ds-panel">
   <div className="sr-filters"><input className="input" placeholder="Search name or student ID" aria-label="Search students" value={q} onChange={e=>setQ(e.target.value)}/>
    <select className="input" aria-label="Class" value={cls} onChange={e=>setCls(e.target.value)}><option value="all">All classes</option>{d.classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
    <span className="muted">{list.length} shown</span></div>
   <table className="sr-table"><thead><tr><th>Student</th><th>Class</th><th>Checklist</th>{d.can.finance&&<th>Fees still owed</th>}<th/></tr></thead><tbody>
    {list.slice(0,400).map(s=><tr key={s.id} className="sr-rowlink" onClick={()=>open(s.id)}>
     <td><b>{s.name}</b><br/><small className="muted">{s.code}</small></td><td>{s.className}</td><td><Progress done={s.done} total={s.total}/></td>
     {d.can.finance&&<td>{s.fees.balance>0?<span className={s.fees.overdue>0?"sr-owe late":"sr-owe"}>{rwf(s.fees.balance)}{s.fees.overdue>0?" · past due":""}</span>:<span className="sr-paid">Paid</span>}</td>}
     <td><button className="button secondary small" onClick={e=>{e.stopPropagation();open(s.id);}}>Open</button></td></tr>)}
   </tbody></table>
   {!list.length&&<p className="muted">No students match.</p>}
   {list.length>400&&<p className="muted">Showing the first 400. Search or choose a class to narrow the list.</p>}
  </section>
 </>;
}

function Setup({d,act,busy}){
 const blank={name:"",category:"uniform",price:"",levelBand:"all"};
 const [f,setF]=useState(blank),[bulk,setBulk]=useState(null);
 const counts=useMemo(()=>{const m={};for(const s of d.students)for(const id of s.missing)m[id]=(m[id]||0)+1;return m;},[d.students]);
 return <section className="ds-panel sr-setup">
  <h3>School checklist</h3>
  <p className="muted">List what every pupil must bring or buy. Each pupil's page then shows a tick box for each item.</p>
  <form className="sr-form" onSubmit={async e=>{e.preventDefault();if(await act({action:"item.add",...f},"Added \""+f.name+"\" to the checklist"))setF(blank);}}>
   <label>Item<input className="input" maxLength={120} placeholder="School uniform (2 sets)" value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label>
   <label>Type<select className="input" value={f.category} onChange={e=>setF({...f,category:e.target.value})}>{d.options.categories.map(c=><option key={c} value={c}>{CAT[c][0]}</option>)}</select></label>
   <label>For<select className="input" value={f.levelBand} onChange={e=>setF({...f,levelBand:e.target.value})}>{d.options.levels.map(l=><option key={l} value={l}>{LEVEL[l]||l}</option>)}</select></label>
   <label>Price if the school sells it (RWF)<input className="input" type="number" min={0} value={f.price} onChange={e=>setF({...f,price:e.target.value})}/></label>
   <button className="button" disabled={busy||f.name.trim().length<2}>Add item</button>
  </form>
  {!d.items.length?<p className="muted">No items yet. Common ones: school uniform, sports kit, student card, exam papers, reams of paper, exercise books, mattress (boarding).</p>:
  <table className="sr-table"><thead><tr><th>Item</th><th>Type</th><th>For</th><th>Price</th><th>Still missing</th><th/></tr></thead><tbody>
   {d.items.map(i=><tr key={i.id}><td><b>{i.name}</b></td><td><span className="sr-cat" style={{background:CAT[i.category][1]+"1f",color:CAT[i.category][1]}}>{CAT[i.category][0]}</span></td><td>{LEVEL[i.level_band]}</td>
    <td>{i.price_rwf!=null?rwf(i.price_rwf):"-"}</td><td>{counts[i.id]||0} pupils</td>
    <td className="sr-acts"><button className="button secondary small" onClick={()=>setBulk({item:i,classId:"",picked:{}})}>Tick for a class</button>
     <button className="button secondary small" disabled={busy} onClick={()=>act({action:"item.remove",itemId:i.id},"Removed \""+i.name+"\"")}>Remove</button></td></tr>)}
  </tbody></table>}
  {bulk&&<div className="sr-bulk">
   <div className="sr-filters"><b>{bulk.item.name}: tick the pupils who have it</b>
    <select className="input" aria-label="Class" value={bulk.classId} onChange={e=>setBulk({...bulk,classId:e.target.value,picked:{}})}><option value="">Choose a class</option>{d.classes.filter(c=>bulk.item.level_band==="all"||c.levelBand===bulk.item.level_band).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
    <button className="button secondary small" onClick={()=>setBulk(null)}>Close</button></div>
   {bulk.classId&&(()=>{const kids=d.students.filter(s=>s.classId===bulk.classId);const pickedIds=Object.keys(bulk.picked).filter(k=>bulk.picked[k]);
    return <><div className="sr-kids">{kids.map(s=>{const has=!s.missing.includes(bulk.item.id);return <label key={s.id} className={has?"has":""}><input type="checkbox" disabled={has} checked={has||!!bulk.picked[s.id]} onChange={e=>setBulk({...bulk,picked:{...bulk.picked,[s.id]:e.target.checked}})}/>{s.name}{has&&<small> (done)</small>}</label>;})}</div>
     <div className="sr-filters"><button className="button secondary small" onClick={()=>setBulk({...bulk,picked:Object.fromEntries(kids.filter(s=>s.missing.includes(bulk.item.id)).map(s=>[s.id,true]))})}>Select all missing</button>
      <button className="button" disabled={busy||!pickedIds.length} onClick={async()=>{if(await act({action:"mark",itemId:bulk.item.id,studentIds:pickedIds,status:"done"},r=>bulk.item.name+": ticked for "+r.count+" pupils"))setBulk({...bulk,picked:{}});}}>Save {pickedIds.length||""} ticks</button></div></>;})()}
  </div>}
 </section>;
}

function Portfolio({code,d,s,act,busy,back}){
 const items=new Map(d.items.map(i=>[i.id,i]));
 const pct=s.total?Math.round(s.done*100/s.total):100;
 const f=s.fees;
 const allGood=s.done===s.total&&(!f||f.balance===0);
 return <>
  <button className="sr-back" onClick={back}><Icon name="down" size={16}/> All students</button>
  <section className={"sr-hero "+(allGood?"good":"todo")}>
   <span className="sr-avatar">{s.name.split(/\s+/).map(x=>x[0]).slice(0,2).join("")}</span>
   <div><h2>{s.name}</h2><p>{s.code} · {s.className}{s.dateOfBirth?" · Born "+new Date(s.dateOfBirth).toLocaleDateString("en-GB"):""}</p></div>
   <div className="sr-verdict">{allGood?<><Icon name="check"/> Everything is complete</>:<><Icon name="alert"/> {[s.done<s.total?(s.total-s.done)+" checklist item"+(s.total-s.done===1?"":"s")+" missing":null,f&&f.balance>0?rwf(f.balance)+" fees owed":null].filter(Boolean).join(" · ")}</>}</div>
  </section>
  <div className="sr-grid">
   <section className="ds-panel sr-card fees"><h3><Icon name="wallet"/> School fees</h3>
    {!f?<p className="muted">Fee amounts are shown to the owner and to staff with finance rights.</p>:<>
     <div className="sr-money"><div><small>Billed</small><b>{rwf(f.billed)}</b></div><div><small>Paid</small><b className="pos">{rwf(f.paid)}</b></div><div><small>Still owed</small><b className={f.balance>0?"neg":"pos"}>{rwf(f.balance)}</b></div></div>
     {f.overdue>0&&<p className="sr-alert">{rwf(f.overdue)} is past the due date.</p>}
     {f.invoices?.length?<table className="sr-table"><thead><tr><th>Bill</th><th>Due</th><th>Amount</th><th>Owed</th></tr></thead><tbody>
      {f.invoices.map(x=><tr key={x.id}><td>{x.description}<br/><small className="muted">{x.number}{x.term?" · "+x.term:""}</small></td><td>{new Date(x.dueOn).toLocaleDateString("en-GB")}</td><td>{rwf(x.amount)}</td>
       <td>{x.balance===0?<span className="sr-paid">Paid</span>:<span className={"sr-owe"+(x.late?" late":"")}>{rwf(x.balance)}</span>}</td></tr>)}
     </tbody></table>:<p className="muted">No fee bills for this pupil yet.</p>}
     <a className="button secondary small" href={"/s/"+code+"/home?tab=finance"}>Open fees and payments</a></>}
   </section>
   <section className="ds-panel sr-card check"><h3><Icon name="check"/> School checklist <span className="sr-pct">{pct}%</span></h3>
    {!s.checklist.length?<p className="muted">The school has no checklist items for this level yet.{d.can.manage?" Use \"Set up the checklist\" on the list of students.":""}</p>:
    <ul className="sr-checks">{s.checklist.map(c=>{const it=items.get(c.itemId);if(!it)return null;return <li key={c.itemId} className={STATUS[c.status][1]}>
     <div><b>{it.name}</b><small style={{color:CAT[it.category][1]}}>{CAT[it.category][0]}{it.price_rwf!=null?" · "+rwf(it.price_rwf):""}</small>{c.updatedAt&&c.status!=="missing"&&<small className="muted">Updated {new Date(c.updatedAt).toLocaleDateString("en-GB")}</small>}</div>
     {d.can.mark?<div className="sr-seg" role="group" aria-label={it.name}>{Object.entries(STATUS).map(([k,[l]])=><button key={k} className={c.status===k?"on "+STATUS[k][1]:""} disabled={busy||c.status===k} onClick={()=>act({action:"mark",itemId:c.itemId,studentId:s.id,status:k},it.name+": "+l.toLowerCase())}>{l}</button>)}</div>
      :<span className={"sr-badge "+STATUS[c.status][1]}>{STATUS[c.status][0]}</span>}
    </li>;})}</ul>}
   </section>
   <section className="ds-panel sr-card fam"><h3><Icon name="users"/> Parents and guardians</h3>
    {s.guardians?.length?<ul className="sr-plain">{s.guardians.map((g,i)=><li key={i}><b>{g.name}</b><small className="muted"> {g.relationship}{g.email?" · "+g.email:""}</small></li>)}</ul>:<p className="muted">No parent account is linked yet. Link one in Students and Admissions.</p>}
   </section>
  </div>
 </>;
}
