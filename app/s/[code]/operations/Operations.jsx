"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";

// School operations workspace: maintenance, stock, assets, board of directors and social links.
// The server decides what each role may see; this page only shows what it receives.
const nice=v=>String(v||"").replace(/_/g," ").replace(/^./,c=>c.toUpperCase());
const GRID={display:"grid",gap:10,gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",alignItems:"end",margin:"12px 0"};
const TILES={width:"100%",display:"grid",gap:12,gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",margin:"16px 0"};
const TABLE={width:"100%",borderCollapse:"collapse"};
const CELL={textAlign:"left",padding:"8px 6px",borderBottom:"1px solid rgba(0,0,0,.08)",verticalAlign:"top"};

export default function Operations({code}){
 const [client,setClient]=useState(null);
 const [loading,setLoading]=useState(true);
 const [data,setData]=useState(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [tab,setTab]=useState("maintenance");
 const [busy,setBusy]=useState(false);
 const [form,setForm]=useState({});

 const call=useCallback(async(c,body)=>{
  const {data:{session}}=await c.auth.getSession();
  if(!session)throw Error("Sign in to your school first");
  const response=await fetch("/api/school/"+code+"/operations",{method:body?"POST":"GET",
    headers:{authorization:"Bearer "+session.access_token,...(body?{"content-type":"application/json"}:{})},
    body:body?JSON.stringify(body):undefined,cache:"no-store"});
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(json.error||"School operations request failed");
  return json;
 },[code]);

 const refresh=useCallback(async c=>{
  try{setData(await call(c));}catch(e){setError(e.message);}
  finally{setLoading(false);}
 },[call]);

 useEffect(()=>{
  const c=browserSupabase();setClient(c);
  if(!c){setError("School sign-in is not configured");setLoading(false);return;}
  refresh(c);
 },[refresh]);

 async function act(body,message){
  setBusy(true);setError("");setNotice("");
  try{await call(client,body);setNotice(message);setForm({});await refresh(client);}
  catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
 const val=k=>form[k]??"";

 if(loading)return <main className="shell">Opening school operations...</main>;
 if(!data)return <main className="shell"><div className="notice error" role="alert">{error||"Unable to open school operations"}</div>
   <p><a className="button secondary small" href={"/s/"+code+"/login"}>Sign in to your school</a></p></main>;

 const a=data.actor;
 const office=a.manager||a.staff;
 const tabs=[["maintenance","Maintenance"],...(office?[["stock","Stock"],["assets","Assets"]]:[]),
   ...(a.manager?[["board","Board of Directors"],["social","Social Links"]]:[])];
 const low=data.stock.filter(s=>Number(s.quantity)<=Number(s.reorder_level));
 const open=data.maintenance.filter(m=>m.status==="open"||m.status==="in_progress");
 const repair=data.assets.filter(x=>x.condition==="needs_repair"||x.condition==="out_of_service");
 const itemName=id=>data.stock.find(s=>s.id===id)?.name||"Removed item";
 const socialUrl=p=>form["social_"+p]??(data.social.find(s=>s.platform===p)?.url||"");

 return <main className="shell ops" style={{maxWidth:1080,width:"100%",display:"block",textAlign:"left",margin:"0 auto"}}>
  <style>{".ops .adm-panel{max-width:none;width:100%;box-sizing:border-box;margin:0 0 16px;text-align:left}.ops h1,.ops h2,.ops p{text-align:left}.ops label{display:grid;gap:4px;font-size:13px}.ops input,.ops select{width:100%;box-sizing:border-box;padding:8px}"}</style>
  <a href={"/s/"+code+(a.manager?"/admin":"/portal")} className="micro">{a.manager?"Back to School Administration":"Back to my school workspace"}</a>
  <h1>School Operations</h1>
  <p className="muted">{data.school.name}. Maintenance, stock, school assets{a.manager?", board of directors and social links":""}.</p>
  {!a.manager&&<p><a className="button secondary small" href={"/s/"+code+"/communications"}>School Community &amp; Timetable</a> <a className="button secondary small" href={"/s/"+code+"/password"}>Change my password</a></p>}
  {error&&<div className="notice error" role="alert">{error}</div>}
  {notice&&<div className="notice ok" role="status">{notice}</div>}
  <div style={TILES}>
   <section className="adm-panel"><strong style={{fontSize:28}}>{open.length}</strong><p className="micro">Open maintenance requests</p></section>
   {office&&<section className="adm-panel"><strong style={{fontSize:28}}>{low.length}</strong><p className="micro">Stock items to reorder</p></section>}
   {office&&<section className="adm-panel"><strong style={{fontSize:28}}>{data.assets.length}</strong><p className="micro">School assets, {repair.length} needing repair</p></section>}
   {a.manager&&<section className="adm-panel"><strong style={{fontSize:28}}>{data.boardMembers.length}</strong><p className="micro">Board members</p></section>}
  </div>
  <p>{tabs.map(([id,label])=><button key={id} type="button" className={"button small "+(tab===id?"":"secondary")} style={{marginRight:8,marginBottom:8}} onClick={()=>{setTab(id);setForm({});setNotice("");setError("");}}>{label}</button>)}</p>

  {tab==="maintenance"&&<section className="adm-panel"><h2>Maintenance</h2>
   <p className="muted">Report anything broken or unsafe. {office?"Office staff update each request until it is done.":"You can follow the requests you reported."}</p>
   <div style={GRID}>
    <label>Problem<input value={val("title")} onChange={set("title")} maxLength={140} placeholder="Broken desk in Primary 4"/></label>
    <label>Where<input value={val("location")} onChange={set("location")} maxLength={120} placeholder="Primary 4 classroom"/></label>
    <label>Priority<select value={val("priority")||"normal"} onChange={set("priority")}>{data.options.priority.map(p=><option key={p} value={p}>{nice(p)}</option>)}</select></label>
    <label>Details<input value={val("details")} onChange={set("details")} maxLength={1000}/></label>
    <button type="button" className="button small" disabled={busy} onClick={()=>act({action:"maintenance.report",title:val("title"),location:val("location"),priority:val("priority")||"normal",details:val("details")},"Maintenance request reported.")}>Report problem</button>
   </div>
   {data.maintenance.length?<div style={{overflowX:"auto"}}><table style={TABLE}><thead><tr><th style={CELL}>Problem</th><th style={CELL}>Where</th><th style={CELL}>Priority</th><th style={CELL}>Status</th>{office&&<th style={CELL}>Update</th>}</tr></thead>
    <tbody>{data.maintenance.map(m=><tr key={m.id}><td style={CELL}><strong>{m.title}</strong>{m.details&&<><br/><span className="micro">{m.details}</span></>}{m.resolution&&<><br/><span className="micro">Done: {m.resolution}</span></>}</td>
     <td style={CELL}>{m.location||"Not stated"}</td><td style={CELL}>{nice(m.priority)}</td><td style={CELL}>{nice(m.status)}<br/><span className="micro">{new Date(m.created_at).toLocaleDateString()}</span></td>
     {office&&<td style={CELL}><select value={m.status} disabled={busy} onChange={e=>act({action:"maintenance.update",requestId:m.id,status:e.target.value,resolution:m.resolution||""},"Maintenance request updated.")}>{data.options.status.map(s=><option key={s} value={s}>{nice(s)}</option>)}</select></td>}</tr>)}</tbody></table></div>
    :<div className="adm-empty"><strong>No maintenance requests</strong><p>Nothing has been reported yet.</p></div>}
  </section>}

  {tab==="stock"&&office&&<section className="adm-panel"><h2>Stock</h2>
   <p className="muted">Food, cleaning and teaching supplies. Record what is received and what is used so the store count stays true.</p>
   {a.manager&&<div style={GRID}>
    <label>Item<input value={val("name")} onChange={set("name")} maxLength={120} placeholder="Rice"/></label>
    <label>Category<select value={val("category")||"food"} onChange={set("category")}>{data.options.stock.map(p=><option key={p} value={p}>{nice(p)}</option>)}</select></label>
    <label>Unit<input value={val("unit")} onChange={set("unit")} maxLength={20} placeholder="kg"/></label>
    <label>Quantity now<input type="number" min="0" value={val("quantity")} onChange={set("quantity")}/></label>
    <label>Reorder at<input type="number" min="0" value={val("reorderLevel")} onChange={set("reorderLevel")}/></label>
    <button type="button" className="button small" disabled={busy} onClick={()=>act({action:"stock.add",name:val("name"),category:val("category")||"food",unit:val("unit"),quantity:val("quantity"),reorderLevel:val("reorderLevel")||0},"Stock item added.")}>Add stock item</button>
   </div>}
   {data.stock.length?<div style={{overflowX:"auto"}}><table style={TABLE}><thead><tr><th style={CELL}>Item</th><th style={CELL}>Category</th><th style={CELL}>In stock</th><th style={CELL}>Reorder at</th><th style={CELL}>Received or used</th></tr></thead>
    <tbody>{data.stock.map(s=><tr key={s.id}><td style={CELL}><strong>{s.name}</strong>{Number(s.quantity)<=Number(s.reorder_level)&&<><br/><span className="micro">Reorder now</span></>}</td>
     <td style={CELL}>{nice(s.category)}</td><td style={CELL}>{Number(s.quantity)} {s.unit}</td><td style={CELL}>{Number(s.reorder_level)} {s.unit}</td>
     <td style={CELL}><input type="number" style={{width:90}} aria-label={"Quantity for "+s.name} value={val("q_"+s.id)} onChange={set("q_"+s.id)}/>{" "}
      <button type="button" className="button secondary small" disabled={busy||!Number(val("q_"+s.id))} onClick={()=>act({action:"stock.move",itemId:s.id,change:Math.abs(Number(val("q_"+s.id))),note:"Received"},"Stock received.")}>Received</button>{" "}
      <button type="button" className="button secondary small" disabled={busy||!Number(val("q_"+s.id))} onClick={()=>act({action:"stock.move",itemId:s.id,change:-Math.abs(Number(val("q_"+s.id))),note:"Used"},"Stock use recorded.")}>Used</button></td></tr>)}</tbody></table></div>
    :<div className="adm-empty"><strong>No stock items yet</strong><p>The school owner or an administrator adds the first items.</p></div>}
   {data.movements.length>0&&<><h3>Latest movements</h3><ul>{data.movements.slice(0,12).map(m=><li key={m.id} className="micro">{new Date(m.created_at).toLocaleDateString()}: {itemName(m.item_id)} {Number(m.change)>0?"+":""}{Number(m.change)} {m.note||""}</li>)}</ul></>}
  </section>}

  {tab==="assets"&&office&&<section className="adm-panel"><h2>School assets</h2>
   <p className="muted">Furniture, computers, kitchen and sports equipment, with where each is kept and its condition.</p>
   {a.manager&&<div style={GRID}>
    <label>Asset code<input value={val("assetCode")} onChange={set("assetCode")} maxLength={30} placeholder="RPS-AST-001"/></label>
    <label>Name<input value={val("name")} onChange={set("name")} maxLength={120} placeholder="Pupil desks"/></label>
    <label>Category<select value={val("category")||"furniture"} onChange={set("category")}>{data.options.asset.map(p=><option key={p} value={p}>{nice(p)}</option>)}</select></label>
    <label>Location<input value={val("location")} onChange={set("location")} maxLength={120}/></label>
    <label>Date acquired<input type="date" value={val("acquiredOn")} onChange={set("acquiredOn")}/></label>
    <label>Value (RWF)<input type="number" min="0" value={val("valueRwf")} onChange={set("valueRwf")}/></label>
    <button type="button" className="button small" disabled={busy} onClick={()=>act({action:"asset.add",assetCode:val("assetCode"),name:val("name"),category:val("category")||"furniture",location:val("location"),acquiredOn:val("acquiredOn"),valueRwf:val("valueRwf"),condition:"good"},"Asset added.")}>Add asset</button>
   </div>}
   {data.assets.length?<div style={{overflowX:"auto"}}><table style={TABLE}><thead><tr><th style={CELL}>Code</th><th style={CELL}>Asset</th><th style={CELL}>Location</th><th style={CELL}>Value</th><th style={CELL}>Condition</th></tr></thead>
    <tbody>{data.assets.map(x=><tr key={x.id}><td style={CELL}>{x.asset_code}</td><td style={CELL}><strong>{x.name}</strong><br/><span className="micro">{nice(x.category)}</span></td><td style={CELL}>{x.location||"Not stated"}</td>
     <td style={CELL}>{x.value_rwf!=null?Number(x.value_rwf).toLocaleString()+" RWF":"Not recorded"}</td>
     <td style={CELL}><select value={x.condition} disabled={busy} onChange={e=>act({action:"asset.condition",assetId:x.id,condition:e.target.value},"Asset condition updated.")}>{data.options.condition.map(s=><option key={s} value={s}>{nice(s)}</option>)}</select></td></tr>)}</tbody></table></div>
    :<div className="adm-empty"><strong>No assets recorded yet</strong><p>The school owner or an administrator adds the asset register.</p></div>}
  </section>}

  {tab==="board"&&a.manager&&<section className="adm-panel"><h2>Board of Directors</h2>
   <p className="muted">Members of the school board and the record of their meetings. Visible to the school owner and administrators only.</p>
   <div style={GRID}>
    <label>Full name<input value={val("fullName")} onChange={set("fullName")} maxLength={120}/></label>
    <label>Position<input value={val("position")} onChange={set("position")} maxLength={80} placeholder="Chairperson"/></label>
    <label>Phone<input value={val("phone")} onChange={set("phone")} maxLength={30}/></label>
    <label>Term start<input type="date" value={val("termStart")} onChange={set("termStart")}/></label>
    <label>Term end<input type="date" value={val("termEnd")} onChange={set("termEnd")}/></label>
    <button type="button" className="button small" disabled={busy} onClick={()=>act({action:"board.member",fullName:val("fullName"),position:val("position"),phone:val("phone"),termStart:val("termStart"),termEnd:val("termEnd")},"Board member added.")}>Add board member</button>
   </div>
   {data.boardMembers.length?<div style={{overflowX:"auto"}}><table style={TABLE}><thead><tr><th style={CELL}>Name</th><th style={CELL}>Position</th><th style={CELL}>Phone</th><th style={CELL}>Term</th><th style={CELL}></th></tr></thead>
    <tbody>{data.boardMembers.map(m=><tr key={m.id}><td style={CELL}><strong>{m.full_name}</strong></td><td style={CELL}>{m.position}</td><td style={CELL}>{m.phone||"Not recorded"}</td><td style={CELL}>{(m.term_start||"?")+" to "+(m.term_end||"?")}</td>
     <td style={CELL}><button type="button" className="button secondary small" disabled={busy} onClick={()=>act({action:"board.member.remove",memberId:m.id},"Board member removed.")}>Remove</button></td></tr>)}</tbody></table></div>
    :<div className="adm-empty"><strong>No board members yet</strong><p>Add the chairperson first.</p></div>}
   <h3>Board meetings</h3>
   <div style={GRID}>
    <label>Date<input type="date" value={val("heldOn")} onChange={set("heldOn")}/></label>
    <label>Title<input value={val("title")} onChange={set("title")} maxLength={140} placeholder="Term 1 board meeting"/></label>
    <label>Status<select value={val("status")||"planned"} onChange={set("status")}><option value="planned">Planned</option><option value="held">Held</option></select></label>
    <label>Agenda<input value={val("agenda")} onChange={set("agenda")} maxLength={2000}/></label>
    <label>Minutes<input value={val("minutes")} onChange={set("minutes")} maxLength={6000}/></label>
    <button type="button" className="button small" disabled={busy} onClick={()=>act({action:"board.meeting",heldOn:val("heldOn"),title:val("title"),status:val("status")||"planned",agenda:val("agenda"),minutes:val("minutes")},"Board meeting recorded.")}>Record meeting</button>
   </div>
   {data.boardMeetings.length?<ul>{data.boardMeetings.map(m=><li key={m.id}><strong>{m.held_on}: {m.title}</strong> ({nice(m.status)}){m.agenda&&<><br/><span className="micro">Agenda: {m.agenda}</span></>}{m.minutes&&<><br/><span className="micro">Minutes: {m.minutes}</span></>}</li>)}</ul>
    :<p className="micro">No board meetings recorded yet.</p>}
  </section>}

  {tab==="social"&&a.manager&&<section className="adm-panel"><h2>Social links</h2>
   <p className="muted">The school's official pages. Saved links appear on the public school homepage. Clear a link and save to remove it.</p>
   {data.options.platform.map(p=><div key={p} style={GRID}>
    <label>{p==="x"?"X (Twitter)":nice(p)}<input type="url" value={socialUrl(p)} onChange={set("social_"+p)} maxLength={300} placeholder={"https://"}/></label>
    <button type="button" className="button secondary small" disabled={busy} onClick={()=>act({action:"social.set",platform:p,url:socialUrl(p)},"Social link saved.")}>Save</button>
   </div>)}
  </section>}
 </main>;
}
