"use client";
import {useEffect,useState} from "react";
import {Card,Icon} from "../../../ui/DashboardShell.jsx";

const AUD=[["all","Everyone in the school"],["parents","All parents"],["teachers","All teachers"],["staff","All staff"],["students","All students"],["class","One class (students and their parents)"]];
const rwf=v=>Number(v||0).toLocaleString("en-US")+" RWF";

async function token(client){const {data:{session}}=await client.auth.getSession();if(!session)throw Error("Sign in again to continue");return session.access_token;}

// Send an announcement from the dashboard: choose who receives it.
export function SendNotice({client,code,classes=[]}){
 const blank={audience:"all",classId:"",title:"",text:""};
 const [f,setF]=useState(blank),[msg,setMsg]=useState(null),[busy,setBusy]=useState(false);
 async function send(e){
  e.preventDefault();setBusy(true);setMsg(null);
  try{
   const r=await fetch("/api/school/"+code+"/communications",{method:"POST",headers:{Authorization:"Bearer "+await token(client),"Content-Type":"application/json"},
    body:JSON.stringify({action:"announcement.publish",audience:f.audience,classId:f.audience==="class"?f.classId:undefined,title:f.title,text:f.text})});
   const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||"The announcement could not be sent");
   setMsg({ok:true,t:"Sent to "+(f.audience==="class"?(classes.find(c=>c.id===f.classId)?.name||"the class"):AUD.find(a=>a[0]===f.audience)[1].toLowerCase())+"."});setF(blank);
   window.dispatchEvent(new Event("ds-notes-refresh"));
  }catch(x){setMsg({ok:false,t:x.message});}finally{setBusy(false);}
 }
 return <Card title="Send an Announcement" icon="megaphone" link={<a href={"/s/"+code+"/communications?tab=announcements"}>All notices →</a>}>
  <form className="ox-form" onSubmit={send}>
   <label>Who should receive it<select className="input" value={f.audience} onChange={e=>setF({...f,audience:e.target.value})}>{AUD.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
   {f.audience==="class"&&<label>Class<select className="input" required value={f.classId} onChange={e=>setF({...f,classId:e.target.value})}><option value="">Choose a class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
   <label>Title<input className="input" required minLength={3} maxLength={160} placeholder="Example: School closed on Friday" value={f.title} onChange={e=>setF({...f,title:e.target.value})}/></label>
   <label>Message<textarea className="input" required minLength={3} maxLength={4000} rows={3} value={f.text} onChange={e=>setF({...f,text:e.target.value})}/></label>
   <button className="button" disabled={busy}>{busy?"Sending…":"Send announcement"}</button>
   {msg&&<small className={msg.ok?"ox-ok":"ox-err"} role={msg.ok?"status":"alert"}>{msg.t}</small>}
  </form>
 </Card>;
}

// A short profit summary for the owner, from the Money and Profit page.
export function ProfitCard({client,code}){
 const [d,setD]=useState(null),[hide,setHide]=useState(false);
 useEffect(()=>{let ok=true;(async()=>{try{const r=await fetch("/api/school/"+code+"/money",{headers:{Authorization:"Bearer "+await token(client)},cache:"no-store"});
  if(!r.ok){if(ok)setHide(true);return;}const j=await r.json();if(ok)setD(j);}catch{if(ok)setHide(true);}})();return ()=>{ok=false;};},[client,code]);
 if(hide)return null;
 const t=d?.totals;
 return <Card title="Profit this Year" icon="chart" link={<a href={"/s/"+code+"/money"}>Open →</a>}>
  {!t?<p className="ds-empty">Loading…</p>:<div className="ox-pl">
   <a href={"/s/"+code+"/money?tab=pnl"} className="ox-pl-row in"><span>Money in</span><b>{rwf(t.income)}</b></a>
   <a href={"/s/"+code+"/money?tab=expenses"} className="ox-pl-row out"><span>Expenses</span><b>{rwf(t.costs-t.salaries)}</b></a>
   <a href={"/s/"+code+"/money?tab=payroll"} className="ox-pl-row sal"><span>Salaries</span><b>{rwf(t.salaries)}</b></a>
   <a href={"/s/"+code+"/money?tab=pnl"} className={"ox-pl-row "+(t.profit>=0?"pro":"loss")}><span>{t.profit>=0?"Profit":"Loss"}</span><b>{rwf(t.profit)}</b></a>
   {d.pendingExpenses>0&&<a href={"/s/"+code+"/money?tab=expenses"} className="ox-pend"><Icon name="alert" size={16}/>{d.pendingExpenses} expense{d.pendingExpenses===1?"":"s"} waiting for your approval</a>}
  </div>}
 </Card>;
}
