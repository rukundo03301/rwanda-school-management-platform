"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
import {initialTab} from "../../../../lib/portal-nav.mjs";
import useTabParam from "../../../ui/useTabParam.js";
import {Item,DashboardShell,Stat,Ring,Bar,Card,Icon,greeting,todayLabel} from "../../../ui/DashboardShell.jsx";

const rwf=v=>v===null||v===undefined||v===""?"—":Number(v).toLocaleString("en-US")+" RWF";
const pct=(a,b)=>b?Math.round(100*a/b):null;
const when=d=>d?new Date(d).toLocaleDateString("en-GB",{timeZone:"Africa/Kigali",day:"numeric",month:"short",year:"numeric"}):"";
const tones=["blue","purple","orange","green","pink","red"];

export default function RoleHome({code}){
 const [client,setClient]=useState(null),[ready,setReady]=useState(false),[session,setSession]=useState(null);
 const [d,setD]=useState(null),[loading,setLoading]=useState(true),[section,setSection]=useState(()=>initialTab(typeof window==="undefined"?"":location.search,["overview","finance","inventory","board","staff"],null)),[search,setSearch]=useState("");
 useTabParam(["overview","finance","inventory","board","staff"],setSection);
 useEffect(()=>{
  const c=browserSupabase();setClient(c);
  if(!c){setReady(true);setLoading(false);return;}
  let alive=true;
  c.auth.getSession().then(({data})=>{if(alive){setSession(data.session);setReady(true);}});
  const {data:{subscription}}=c.auth.onAuthStateChange((_e,s)=>{if(alive)setSession(s);});
  return ()=>{alive=false;subscription.unsubscribe();};
 },[]);
 const load=useCallback(async()=>{
  setLoading(true);
  try{
   const {data:{session:s}}=await client.auth.getSession();
   const h={Authorization:"Bearer "+s.access_token};
   const get=async p=>{try{const r=await fetch("/api/school/"+code+"/"+p,{cache:"no-store",headers:h});return r.ok?await r.json():null;}catch{return null;}};
   const [access,overview,fees,ops,com,cls]=await Promise.all(["access","overview","fees","operations","communications","classroom"].map(get));
   setD({access,overview,fees,ops,com,cls});
  }finally{setLoading(false);}
 },[client,code]);
 useEffect(()=>{if(ready&&session)load();else if(ready)setLoading(false);},[ready,session?.user?.id,load]);
 if(!ready||loading)return <main className="school-admin-loading">Opening your school dashboard…</main>;
 if(!session)return <main className="school-admin-loading"><h2>School login required</h2>
  <a className="button" href={"/s/"+code+"/login"}>Sign in</a></main>;
 const roles=d?.access?.roles||[];
 const owner=roles.includes("school_owner"),admin=roles.includes("school_admin"),staff=roles.includes("staff");
 if(!d?.access||(!owner&&!admin&&!staff))return <main className="school-admin-loading"><h2>Dashboard not available</h2>
  <p>This dashboard is for the school owner, principal and school staff.</p><a href={"/s/"+code+"/portal"}>Back to portal</a></main>;
 const perms=d.fees?.actor?.permissions||[];
 const manager=owner||admin;
 const bursar=!manager&&perms.length>0;
 const role=owner?"School Owner":admin?"Principal":bursar?"Bursar":"School Staff";
 const title=owner?"School Owner Dashboard":admin?"Principal Dashboard":bursar?"Bursar Dashboard":"Staff Workspace";
 const sections=manager?["overview","finance","inventory","board"]:bursar?["finance","inventory","staff"]:["staff","inventory"];
 const cur=sections.includes(section)?section:sections[0];
 const school={name:d.access.school?.name||"School",logoUrl:d.fees?.school?.logoUrl||d.cls?.school?.logo||null};
 const ov=d.overview,fs=d.fees?.summary,ops=d.ops,com=d.com;
 const stock=ops?.stock||[],assets=ops?.assets||[],maint=ops?.maintenance||[];
 const lowStock=stock.filter(s=>Number(s.quantity)<=Number(s.reorder_level));
 const openMaint=maint.filter(m=>m.status==="open"||m.status==="in_progress");
 const assetValue=assets.reduce((a,x)=>a+Number(x.value_rwf||0),0);
 const needRepair=assets.filter(a=>a.condition==="needs_repair"||a.condition==="out_of_service");
 const notices=(com?.announcements||[]).slice(0,4);
 const events=(com?.events||[]).filter(e=>new Date(e.ends_at)>=new Date()).slice(0,4);
 const collectedPct=fs?pct(Number(fs.collected_rwf),Number(fs.invoiced_rwf)):null;
 const attPct=ov?.attendance?.total?pct((ov.attendance.present||0)+(ov.attendance.late||0),ov.attendance.total):null;
 const pupils=new Map((d.fees?.pupils||[]).map(p=>[p.id,p.name]));
 const overdue=(d.fees?.invoices||[]).filter(i=>i.balances?.overdue).slice(0,6);
 const pendingClaims=(d.fees?.payments||[]).filter(p=>p.status==="pending");
 const recentPaid=(d.fees?.payments||[]).filter(p=>p.status==="posted").slice(0,5);
 const link=(p,t)=><a href={"/s/"+code+"/"+p}>{t} →</a>;
 const goto=(s)=>()=>setSection(s);
 const nav=[
  ...(manager?[{label:"Dashboard",icon:"home",active:cur==="overview",onClick:goto("overview")}]:[{label:bursar?"Dashboard":"Dashboard",icon:"home",active:cur===sections[0],onClick:goto(sections[0])}]),
  ...(manager||bursar?[{label:"Fees & Finance",icon:"wallet",active:cur==="finance",onClick:goto("finance")}]:[]),
  {label:"Inventory & Assets",icon:"box",active:cur==="inventory",onClick:goto("inventory")},
  ...(manager?[{label:"Board of Directors",icon:"building",active:cur==="board",onClick:goto("board")}]:[]),
  ...(manager?[{label:"Students & Admissions",icon:"users",href:"/s/"+code+"/admissions"},
   {label:"Classes & Teachers",icon:"book",href:"/s/"+code+"/classroom"},
   {label:"Reports & Curriculum",icon:"chart",href:"/s/"+code+"/reports"},
   {label:"Term Reports",icon:"file",href:"/s/"+code+"/term-reports"},
   ...((d.access.levels||[]).includes("nursery")?[{label:"Early Years Observations",icon:"users",href:"/s/"+code+"/nursery"}]:[])]:[]),
  {label:"Learning Library",icon:"folder",href:"/s/"+code+"/resources"},
  {label:"Messages & Notices",icon:"chat",href:"/s/"+code+"/communications"},
  {label:"School Operations",icon:"wrench",href:"/s/"+code+"/operations"},
  {label:"Leave & Purchase Requests",icon:"file",href:"/s/"+code+"/requests"},
  ...(manager?[{label:"Administration",icon:"gear",href:"/s/"+code+"/admin"}]:[]),
 ];
 const first=(d.access.authEmail||"").split("@")[0];
 const signOut=async()=>{await client.auth.signOut();window.location.assign("/s/"+code+"/login");};
 const q=search.toLowerCase();
 const NoData=({t})=><p className="ds-empty">{t}</p>;
 const pn=(ov?.platformNotices||[]).slice(0,3);
 const PlatformNotices=pn.length?<Card title="From the Umurage platform" icon="megaphone" size="s6">
  <ul className="ds-list">{pn.map(n=><Item key={n.id} href={"/s/"+code+"/communications?tab=announcements"}><span className="ds-ico blue"><Icon name="megaphone"/></span><div><strong>{n.title}</strong><small>{n.body}</small></div></Item>)}</ul></Card>:null;
 const Notices=<Card title="School Notices" icon="megaphone" size="s6" link={link("communications","All notices")}>
  {notices.length?<ul className="ds-list">{notices.map(n=><Item key={n.id} href={"/s/"+code+"/communications?tab=announcements&notice="+n.id}><span className="ds-ico purple"><Icon name="megaphone"/></span>
   <div><strong>{n.title}</strong><small>{when(n.published_at)}</small></div></Item>)}</ul>:<NoData t="No notices have been published."/>}</Card>;
 const Events=<Card title="Upcoming Events" icon="calendar" size="s6" link={link("communications","All events")}>
  {events.length?<ul className="ds-list">{events.map(e=><Item key={e.id} href={"/s/"+code+"/communications?tab=calendar"}><span className="ds-ico orange"><Icon name="calendar"/></span>
   <div><strong>{e.title}</strong><small>{when(e.starts_at)}{e.location?" · "+e.location:""}</small></div></Item>)}</ul>:<NoData t="No upcoming events."/>}</Card>;
 const Maint=<Card title="Maintenance Requests" icon="wrench" size="s6" link={link("operations","Open operations")}>
  {openMaint.length?<ul className="ds-list">{openMaint.slice(0,5).map(m=><Item key={m.id} href={"/s/"+code+"/operations?request="+m.id}><span className={"ds-ico "+(m.priority==="urgent"?"red":"orange")}><Icon name="wrench"/></span>
   <div><strong>{m.title}</strong><small>{m.location||"School"} · {m.priority} · {m.status.replace("_"," ")}</small></div></Item>)}</ul>:<NoData t="No open maintenance requests."/>}</Card>;
 const Low=<Card title="Low Stock" icon="alert" size="s6" link={link("operations","Manage stock")}>
  {lowStock.length?<ul className="ds-list">{lowStock.slice(0,6).map(s=><Item key={s.id} href={"/s/"+code+"/operations"}><span className="ds-ico red"><Icon name="alert"/></span>
   <div><strong>{s.name}</strong><small>{Number(s.quantity)} {s.unit} left · reorder at {Number(s.reorder_level)}</small></div></Item>)}</ul>
   :<NoData t={stock.length?"Every stock item is above its reorder level.":"No stock items have been recorded yet."}/>}</Card>;
 return <DashboardShell code={code} school={{...school,place:role}} title={title}
  user={{name:first||role,role}} nav={nav} notifications={manager?(fs?.pending_claims||0)+openMaint.length:openMaint.length}
  onBell={goto(manager||bursar?"finance":"inventory")}
  onSearch={s=>{setSearch(s);setSection("inventory");}} searchPlaceholder="Search stock and assets…"
  helpText="Contact the platform support team." onSignOut={signOut} portalHref={"/s/"+code+"/portal"}>
  <section className="ds-banner"><div><h2>{greeting()}, {first}!</h2>
   <p>{manager?"Here is how "+school.name+" is doing today.":"Your school duties and tools in one place."}</p></div>
   <div className="ds-chips"><span className="ds-chip"><Icon name="calendar" size={18}/>{todayLabel()}</span>
    {ov?.year&&<span className="ds-chip blue">{ov.year.name}</span>}</div></section>

  {cur==="overview"&&<div className="ds-grid">
   <div className="ds-span8" style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:14,alignContent:"start"}}>
    <div className="ds-stats" style={{margin:0}}>
     <Stat icon="cap" tone="blue" value={ov?ov.people.students:"—"} label="Students enrolled" href={"/s/"+code+"/admissions"}/>
     <Stat icon="users" tone="purple" value={ov?.people.teachers??"—"} label="Teachers" href={"/s/"+code+"/admin"}/>
     <Stat icon="book" tone="orange" value={ov?ov.classes.length:"—"} label="Active classes" href={"/s/"+code+"/admin"}/>
     <Stat icon="user" tone="green" value={ov?.people.guardians??"—"} label="Parent links" href={"/s/"+code+"/admissions"}/>
    </div>
    <div className="ds-grid" style={{margin:0}}>
     <Card title="Students per Class" icon="users" size="s6" link={link("admissions","Students")}>
      {ov?.classes?.length?<div className="ds-bars">{ov.classes.slice(0,8).map((c,i)=>
       <Bar key={c.id} label={c.name+" ("+c.students+(c.capacity?"/"+c.capacity:"")+")"} value={c.capacity?pct(c.students,c.capacity):pct(c.students,Math.max(...ov.classes.map(x=>x.students),1))} color={["#3b8df0","#1fa64a","#f59e0b","#8b5cf6"][i%4]} href={"/s/"+code+"/admissions"}/>)}</div>
       :<NoData t="No classes are set up for the current year."/>}
     </Card>
     <Card title="Attendance, last 30 days" icon="clock" size="s6" link={link("classroom?tab=attendance","Attendance")}>
      {ov?.attendance?.total?<div className="ds-split"><Ring value={attPct} label="Present" href={"/s/"+code+"/classroom?tab=attendance"}/>
       <div className="ds-legend"><div><i className="ds-dot" style={{background:"#1fa64a"}}/>Present<b>{ov.attendance.present}</b></div>
        <div><i className="ds-dot" style={{background:"#f59e0b"}}/>Late<b>{ov.attendance.late}</b></div>
        <div><i className="ds-dot" style={{background:"#e5322d"}}/>Absent<b>{ov.attendance.absent}</b></div></div></div>
       :<NoData t="No attendance has been recorded in the last 30 days."/>}
     </Card>
    </div>
    <div className="ds-grid" style={{margin:0}}>
     <Card title="Fee Collection" icon="wallet" size="s6" link={link("fees","Open fees")}>
      {fs?<div className="ds-split"><Ring value={collectedPct} label="Collected" href={"/s/"+code+"/fees"}/>
       <div className="ds-legend"><div>Invoiced<b>{rwf(fs.invoiced_rwf)}</b></div><div>Collected<b>{rwf(fs.collected_rwf)}</b></div>
        <div>Outstanding<b>{rwf(fs.outstanding_rwf)}</b></div></div></div>
       :<NoData t="Fee totals are not available to this account."/>}
     </Card>
     <Card title="Homework Activity" icon="check" size="s6" link={link("classroom","Open classes")}>
      {ov?.homework?<div className="ds-legend"><div>Homework published<b>{ov.homework.published??"—"}</b></div>
       <div>Submissions received<b>{ov.homework.submitted??"—"}</b></div><div>Graded by teachers<b>{ov.homework.graded??"—"}</b></div></div>:<NoData t="Not available."/>}
     </Card>
    </div>
    <div className="ds-grid" style={{margin:0}}>{Maint}{Low}</div>
   </div>
   <div className="ds-span4" style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:14,alignContent:"start"}}>
    {PlatformNotices}{Notices}{Events}
    <Card title="Quick Actions" icon="bolt"><div className="ds-actions">
     <a className="ds-action blue" href={"/s/"+code+"/admissions"}>Admissions</a>
     <a className="ds-action green" href={"/s/"+code+"/communications"}>Post a notice</a>
     <a className="ds-action orange" href={"/s/"+code+"/fees"}>Record fees</a>
     <a className="ds-action blue" href={"/s/"+code+"/reports"}>Report cards</a></div></Card>
   </div>
  </div>}

  {cur==="finance"&&<div className="ds-grid">
   <div className="ds-stats" style={{gridColumn:"1/-1",margin:0}}>
    <Stat icon="wallet" tone="blue" value={fs?rwf(fs.invoiced_rwf):"—"} label="Total invoiced" href={"/s/"+code+"/fees"}/>
    <Stat icon="check" tone="green" value={fs?rwf(fs.collected_rwf):"—"} label="Collected" href={"/s/"+code+"/fees"}/>
    <Stat icon="alert" tone="orange" value={fs?rwf(fs.outstanding_rwf):"—"} label="Outstanding" href={"/s/"+code+"/fees"}/>
    <Stat icon="clock" tone="red" value={fs?rwf(fs.overdue_rwf):"—"} label="Overdue" href={"/s/"+code+"/fees"}/>
   </div>
   {!fs&&<div className="ds-panel" style={{gridColumn:"1/-1"}}><h3>Finance totals are not available</h3><p>Your account does not have finance reporting rights. The school owner can grant them.</p></div>}
   {fs&&<>
   <Card title="Collection Progress" icon="chart" size="s4"><div className="ds-split"><Ring value={collectedPct} label="Collected" href={"/s/"+code+"/fees"}/>
    <div className="ds-legend"><div>Issued invoices<b>{fs.issued_invoices}</b></div><div>Waived<b>{rwf(fs.waived_rwf)}</b></div>
    <div>As of<b>{when(fs.as_of)}</b></div></div></div></Card>
   <Card title="Payments Awaiting Approval" icon="clock" size="s4" link={link("fees","Review")}>
    {pendingClaims.length?<ul className="ds-list">{pendingClaims.slice(0,5).map(p=><Item key={p.id} href={"/s/"+code+"/fees"}><span className="ds-ico orange"><Icon name="wallet"/></span>
     <div><strong>{rwf(p.amount_rwf)}</strong><small>{p.method} · {when(p.proposed_at)}</small></div></Item>)}</ul>
     :<NoData t={fs.pending_claims?fs.pending_claims+" claim(s) are waiting for review.":"No payments are waiting for approval."}/>}</Card>
   <Card title="Overdue Invoices" icon="alert" size="s4" link={link("fees","All invoices")}>
    {overdue.length?<ul className="ds-list">{overdue.map(i=><Item key={i.id} href={"/s/"+code+"/fees"}><span className="ds-ico red"><Icon name="alert"/></span>
     <div><strong>{pupils.get(i.student_id)||"Pupil"}</strong><small>{rwf(i.balances.balance_rwf)} due {when(i.due_on)}</small></div></Item>)}</ul>
     :<NoData t="No overdue invoices."/>}</Card>
   <Card title="Recent Payments" icon="check" size="s6">
    {recentPaid.length?<ul className="ds-list">{recentPaid.map(p=><Item key={p.id} href={"/s/"+code+"/fees"}><span className="ds-ico green"><Icon name="check"/></span>
     <div><strong>{rwf(p.amount_rwf)}</strong><small>{p.method} · paid {when(p.paid_on)}</small></div></Item>)}</ul>:<NoData t="No payments have been posted yet."/>}</Card>
   <Card title="Finance Tools" icon="bolt" size="s6"><div className="ds-actions">
    <a className="ds-action blue" href={"/s/"+code+"/fees"}>Open School Fees</a>
    <a className="ds-action green" href={"/s/"+code+"/fees"}>Record a payment</a></div>
    <p className="ds-empty">Mobile money collections are not connected yet; payments are recorded and approved by the school.</p></Card>
   </>}
  </div>}

  {cur==="inventory"&&<div className="ds-grid">
   <div className="ds-stats" style={{gridColumn:"1/-1",margin:0}}>
    <Stat icon="box" tone="blue" value={stock.length} label="Stock items" href={"/s/"+code+"/operations"}/>
    <Stat icon="alert" tone="red" value={lowStock.length} label="Low stock" href={"/s/"+code+"/operations"}/>
    <Stat icon="building" tone="purple" value={assets.length} label="Assets" href={"/s/"+code+"/operations"}/>
    <Stat icon="wallet" tone="green" value={assetValue?rwf(assetValue):"—"} label="Recorded asset value" href={"/s/"+code+"/operations"}/>
   </div>
   {Low}{Maint}
   <Card title="Assets Needing Attention" icon="wrench" size="s6">
    {needRepair.length?<ul className="ds-list">{needRepair.slice(0,6).map(a=><Item key={a.id} href={"/s/"+code+"/operations"}><span className="ds-ico red"><Icon name="wrench"/></span>
     <div><strong>{a.name}</strong><small>{a.asset_code} · {a.location||"No location"} · {a.condition.replace("_"," ")}</small></div></Item>)}</ul>:<NoData t="No asset is marked as needing repair."/>}</Card>
   <Card title="Recent Stock Movements" icon="box" size="s6">
    {(ops?.movements||[]).length?<ul className="ds-list">{ops.movements.slice(0,6).map(m=><Item key={m.id} href={"/s/"+code+"/operations"}><span className={"ds-ico "+(Number(m.change)<0?"orange":"green")}><Icon name="box"/></span>
     <div><strong>{stock.find(s=>s.id===m.item_id)?.name||"Stock item"} {Number(m.change)>0?"+":""}{Number(m.change)}</strong><small>{m.note||"Stock update"} · {when(m.created_at)}</small></div></Item>)}</ul>:<NoData t="No stock movements recorded yet."/>}</Card>
   <Card title={"Stock List"+(q?" · matching “"+search+"”":"")} icon="box" size="s6" link={link("operations","Update stock")}>
    {(()=>{const rows=stock.filter(s=>!q||(s.name+" "+s.category).toLowerCase().includes(q));
     return rows.length?<table className="ds-table"><thead><tr><th>Item</th><th>Qty</th><th>Reorder</th></tr></thead>
      <tbody>{rows.slice(0,12).map(s=><tr key={s.id}><td>{s.name}</td><td>{Number(s.quantity)} {s.unit}</td><td>{Number(s.reorder_level)}</td></tr>)}</tbody></table>
      :<NoData t="No stock items to show."/>;})()}</Card>
   <Card title={"Asset Register"+(q?" · matching “"+search+"”":"")} icon="building" size="s6" link={link("operations","Update assets")}>
    {(()=>{const rows=assets.filter(a=>!q||(a.name+" "+a.asset_code+" "+a.category).toLowerCase().includes(q));
     return rows.length?<table className="ds-table"><thead><tr><th>Code</th><th>Asset</th><th>Condition</th></tr></thead>
      <tbody>{rows.slice(0,12).map(a=><tr key={a.id}><td>{a.asset_code}</td><td>{a.name}</td><td>{a.condition.replace("_"," ")}</td></tr>)}</tbody></table>
      :<NoData t="No assets to show."/>;})()}</Card>
  </div>}

  {cur==="board"&&<div className="ds-grid">
   <div className="ds-stats" style={{gridColumn:"1/-1",margin:0}}>
    <Stat icon="building" tone="blue" value={(ops?.boardMembers||[]).length} label="Board members" href={"/s/"+code+"/operations"}/>
    <Stat icon="calendar" tone="purple" value={(ops?.boardMeetings||[]).length} label="Meetings recorded" href={"/s/"+code+"/operations"}/>
    <Stat icon="cap" tone="green" value={ov?ov.people.students:"—"} label="Students enrolled" href={"/s/"+code+"/admissions"}/>
    <Stat icon="wallet" tone="orange" value={fs?(collectedPct===null?"—":collectedPct+"%"):"—"} label="Fees collected" href={"/s/"+code+"/fees"}/>
   </div>
   <Card title="Board Members" icon="users" size="s6" link={link("operations","Manage board")}>
    {(ops?.boardMembers||[]).length?<ul className="ds-list">{ops.boardMembers.map((m,i)=><Item key={m.id} href={"/s/"+code+"/operations"}><span className={"ds-ico "+tones[i%tones.length]}><Icon name="user"/></span>
     <div><strong>{m.full_name}</strong><small>{m.position}{m.term_end?" · term ends "+when(m.term_end):""}</small></div></Item>)}</ul>
     :<NoData t="No board members have been recorded yet."/>}</Card>
   <Card title="Board Meetings" icon="calendar" size="s6">
    {(ops?.boardMeetings||[]).length?<ul className="ds-list">{ops.boardMeetings.slice(0,6).map(m=><Item key={m.id} href={"/s/"+code+"/operations"}><span className="ds-ico purple"><Icon name="calendar"/></span>
     <div><strong>{m.title}</strong><small>{when(m.held_on)} · {m.status}</small></div></Item>)}</ul>:<NoData t="No board meetings have been recorded yet."/>}</Card>
   <Card title="School at a Glance" icon="chart" size="s6"><div className="ds-split"><Ring value={attPct} label="Attendance" href={"/s/"+code+"/classroom?tab=attendance"}/>
    <div className="ds-bars"><Bar label="Fees collected" value={collectedPct} color="#1fa64a" href={"/s/"+code+"/fees"}/>
     <Bar label="Attendance (30 days)" value={attPct} color="#3b8df0" href={"/s/"+code+"/classroom?tab=attendance"}/>
     <Bar label="Homework graded" value={ov?.homework?.submitted?pct(ov.homework.graded,ov.homework.submitted):null} color="#f59e0b" href={"/s/"+code+"/classroom?tab=submissions"}/></div></div></Card>
   <Card title="Assets and Maintenance" icon="wrench" size="s6"><div className="ds-legend"><div>Recorded asset value<b>{assetValue?rwf(assetValue):"—"}</b></div>
    <div>Assets needing repair<b>{needRepair.length}</b></div><div>Open maintenance requests<b>{openMaint.length}</b></div></div></Card>
  </div>}

  {cur==="staff"&&<div className="ds-grid">
   <div className="ds-stats" style={{gridColumn:"1/-1",margin:0}}>
    <Stat icon="wrench" tone="orange" value={openMaint.length} label="Open maintenance requests" href={"/s/"+code+"/operations"}/>
    <Stat icon="alert" tone="red" value={lowStock.length} label="Low stock items" href={"/s/"+code+"/operations"}/>
    <Stat icon="megaphone" tone="purple" value={notices.length} label="Recent notices" href={"/s/"+code+"/communications?tab=announcements"}/>
    <Stat icon="calendar" tone="blue" value={events.length} label="Upcoming events" href={"/s/"+code+"/communications?tab=calendar"}/>
   </div>
   {PlatformNotices}{Maint}{Low}{Notices}{Events}
  </div>}
 </DashboardShell>;
}
