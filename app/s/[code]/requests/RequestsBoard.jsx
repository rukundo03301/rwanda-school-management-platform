"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
import {DashboardShell,Card,Icon} from "../../../ui/DashboardShell.jsx";

const when=d=>d?new Date(d).toLocaleDateString("en-GB",{timeZone:"Africa/Kigali",day:"numeric",month:"short",year:"numeric"}):"";
const rwf=v=>Number(v).toLocaleString("en-US")+" RWF";
const blank={kind:"leave",title:"",details:"",startOn:"",endOn:"",amountRwf:""};

export default function RequestsBoard({code}){
 const [client,setClient]=useState(null),[ready,setReady]=useState(false),[session,setSession]=useState(null);
 const [data,setData]=useState(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[form,setForm]=useState(blank),[note,setNote]=useState("");
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
  const r=await fetch("/api/school/"+code+"/requests",{method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+s.access_token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(j.error||"Could not load requests");
  return j;
 },[client,code]);
 const refresh=useCallback(async()=>{try{setData(await call());setError("");}catch(e){setError(e.message);}},[call]);
 useEffect(()=>{if(ready&&session)refresh();},[ready,session?.user?.id,refresh]);
 async function act(body){setBusy(true);setError("");try{await call(body);setForm(blank);setNote("");await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}
 if(!ready)return <main className="school-admin-loading">Opening requests…</main>;
 if(!session)return <main className="school-admin-loading"><h2>School login required</h2><a className="button" href={"/s/"+code+"/login"}>Sign in</a></main>;
 if(!data&&error)return <main className="school-admin-loading"><h2>Requests unavailable</h2><p role="alert">{error}</p><a href={"/s/"+code+"/home"}>Back to dashboard</a></main>;
 if(!data)return <main className="school-admin-loading">Opening requests…</main>;
 const set=k=>e=>setForm({...form,[k]:e.target.value});
 const pending=data.requests.filter(r=>r.status==="pending");
 const nav=[{label:"Dashboard",icon:"home",href:"/s/"+code+"/home"},{label:"Requests",icon:"file",active:true,badge:data.manager?pending.length:0}];
 const signOut=async()=>{await client.auth.signOut();window.location.assign("/s/"+code+"/login");};
 return <DashboardShell school={{name:"School",place:"Requests"}} title="Leave and Purchase Requests"
  user={{name:(session.user.email||"User").split("@")[0],role:data.manager?"Approver":"Staff"}} nav={nav}
  notifications={data.manager?pending.length:0} helpText="Your principal decides each request." onSignOut={signOut} portalHref={"/s/"+code+"/portal"}>
  {error&&<div className="notice error" role="alert">{error}</div>}
  <div className="ds-grid">
   <Card title="New Request" icon="plus" size="s4">
    <label>Type<select value={form.kind} onChange={set("kind")}><option value="leave">Leave</option><option value="purchase">Purchase</option></select></label>
    <label>Title<input value={form.title} onChange={set("title")} maxLength={140}/></label>
    {form.kind==="leave"?<><label>From<input type="date" value={form.startOn} onChange={set("startOn")}/></label>
     <label>To<input type="date" value={form.endOn} onChange={set("endOn")}/></label></>
     :<label>Amount (RWF)<input type="number" min="0" value={form.amountRwf} onChange={set("amountRwf")}/></label>}
    <label>Details<textarea value={form.details} onChange={set("details")} maxLength={1000} rows={3}/></label>
    <button className="button" disabled={busy} onClick={()=>act({action:"create",...form})}>{busy?"Sending…":"Send request"}</button>
   </Card>
   <Card title={data.manager?"All Requests":"My Requests"} icon="file" size="s8">
    {data.requests.length?<ul className="ds-list">{data.requests.map(r=><li key={r.id} className="ds-item">
     <span className={"ds-ico "+(r.kind==="leave"?"blue":"orange")}><Icon name={r.kind==="leave"?"calendar":"wallet"}/></span>
     <div><strong>{r.title}</strong>
      <small>{r.kind==="leave"?when(r.start_on)+" to "+when(r.end_on):rwf(r.amount_rwf)}{data.manager&&r.requester?" · "+r.requester:""} · {r.status}</small>
      {r.details&&<small>{r.details}</small>}{r.decision_note&&<small>Decision note: {r.decision_note}</small>}</div>
     {r.status==="pending"&&r.mine&&<button className="button secondary" disabled={busy} onClick={()=>act({action:"cancel",id:r.id})}>Cancel</button>}
     {r.status==="pending"&&data.manager&&!r.mine&&<span>
      <input placeholder="Note (optional)" value={note} onChange={e=>setNote(e.target.value)} maxLength={500}/>
      <button className="button" disabled={busy} onClick={()=>act({action:"decide",id:r.id,decision:"approved",note})}>Approve</button>
      <button className="button secondary" disabled={busy} onClick={()=>act({action:"decide",id:r.id,decision:"declined",note})}>Decline</button></span>}
    </li>)}</ul>:<p className="ds-empty">No requests yet.</p>}
   </Card>
  </div>
 </DashboardShell>;
}
