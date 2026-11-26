// Platform Owner Dashboard. Every number comes from the platform's own records; nothing here is sample data.
import {PROVINCE_LABEL,LEVEL_LABEL,PayBadge} from "./PlatformModules.jsx";
import {paymentClock,DUE_SOON_DAYS} from "../../lib/report-data.js";
import {RWANDA_DISTRICTS,DISTRICT_PROVINCE,districtKey,MAP_W,MAP_H} from "../../lib/rwanda-geo.js";
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const nf=(n)=>Number(n||0).toLocaleString("en-US");
const rwf=(n)=>"RWF "+nf(n);
function lastTwelve(){
 const out=[];const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-11);
 for(let i=0;i<12;i++){out.push({key:d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"),label:MONTHS[d.getMonth()]});d.setMonth(d.getMonth()+1);}
 return out;
}
function ago(iso){
 const s=Math.max(0,(Date.now()-new Date(iso).getTime())/1000);
 if(s<90)return "just now";if(s<5400)return Math.round(s/60)+" min ago";
 if(s<129600)return Math.round(s/3600)+" hours ago";return Math.round(s/86400)+" days ago";
}
const day=(x)=>x?new Date(x).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"";
function Ico({d,size=26}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d.map((p,i)=><path key={i} d={p}/>)}</svg>;}
const I={
 school:["M4 21V5l8-2v18","M12 9h8v12","M7 9h2M7 13h2M15 13h2M15 17h2"],
 users:["M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z","M2 21a7 7 0 0 1 14 0","M16 4a4 4 0 0 1 0 7","M18 21a7 7 0 0 0-3-5.7"],
 cap:["M2 9l10-5 10 5-10 5z","M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"],
 board:["M4 4h16v10H4z","M8 18h8","M12 14v4"],
 coins:["M12 3c-5 0-8 1.5-8 3.5S7 10 12 10s8-1.500 8-3.500S17 3 12 3z","M4 6.500v5C4 13.500 7 15 12 15s8-1.500 8-3.500v-5","M4 11.500v5C4 18.500 7 20 12 20s8-1.500 8-3.500v-5"],
 plus:["M12 5v14M5 12h14"],mail:["M3 5h18v14H3z","m3 7 9 6 9-6"],gear:["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z","M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"],
 clock:["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z","M12 7v5l3 2"],check:["M5 13l4 4L19 7"]
};
const CSS=[
".od{display:grid;gap:16px}.od *{box-sizing:border-box}",
".od-hero{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:16px}",
".od-welcome{border-radius:20px;background:linear-gradient(120deg,#dbeafe,#eff6ff);padding:20px 24px;border:1px solid #c9dcfb}",
".od-welcome h2{margin:0 0 6px;font-size:26px;color:#12408a}.od-welcome p{margin:0;color:#35557f}",
".od-quick{border-radius:20px;background:#fff;border:1px solid #d6e6fb;padding:14px 16px}",
".od-quick h3{margin:0 0 10px;font-size:17px;color:#12306a}.od-qgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}",
".od-qgrid button{display:grid;justify-items:center;gap:6px;border:1px solid #d6e6fb;background:#f6faff;color:#12408a;border-radius:14px;padding:10px 4px;font-weight:700;font-size:12px;cursor:pointer}",
".od-qgrid button.pri{background:#2563eb;color:#fff;border-color:#2563eb}",
".od-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}",
".od-stat{display:flex;align-items:center;gap:12px;border-radius:18px;padding:14px;border:1px solid #d6e6fb;background:#fff}",
".od-stat .ic{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;flex:none}",
".od-stat small{display:block;color:#475f86;font-size:13px}.od-stat strong{font-size:24px;color:#0d2a5c;line-height:1.1;word-break:break-word}",
".od-stat:nth-child(1) .ic{background:#dbeafe;color:#1d4ed8}.od-stat:nth-child(2) .ic{background:#dcfce7;color:#15803d}.od-stat:nth-child(3) .ic{background:#ede9fe;color:#6d28d9}.od-stat:nth-child(4) .ic{background:#fef3c7;color:#b45309}.od-stat:nth-child(5) .ic{background:#dbeafe;color:#1d4ed8}",
".od-row2{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:16px}",
".od-row3{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}",
".od-row4{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:16px}",
".od-card{background:#fff;border:1px solid #d6e6fb;border-radius:20px;padding:16px 18px;box-shadow:0 10px 26px #1d4ed80f;min-width:0}",
".od-card h3{margin:0 0 12px;font-size:17px;color:#12306a;display:flex;align-items:center;justify-content:space-between;gap:8px}",
".od-card h3 button{border:0;background:none;color:#1d4ed8;font-weight:800;font-size:13px;cursor:pointer}",
".od-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:#475f86;margin:0 0 6px}.od-legend i{display:inline-block;width:10px;height:10px;border-radius:99px;margin-right:5px}",
".od-chart{width:100%;height:auto;display:block}",
".od-list{display:grid;gap:8px}.od-item{display:flex;justify-content:space-between;gap:10px;align-items:center;border-radius:12px;background:#f4f8ff;padding:9px 12px;font-weight:700;color:#12306a}",
".od-badge{border-radius:99px;padding:2px 10px;font-size:12px;font-weight:800;color:#fff;background:#2563eb}",
".od-tiles{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.od-tile{border-radius:14px;padding:12px;text-align:center;font-weight:700;color:#12306a}.od-tile b{display:block;font-size:26px}",
".od-bar{display:grid;gap:3px;margin:0 0 10px;font-size:13px;color:#1f3358}.od-bar span{display:flex;justify-content:space-between}.od-bar i{display:block;height:7px;border-radius:99px;background:#e3edfb;overflow:hidden}.od-bar u{display:block;height:100%;background:#2563eb;border-radius:99px}",
".od-big{font-size:28px;font-weight:900;color:#12408a;margin:4px 0}.od-up{display:inline-block;border-radius:99px;padding:2px 10px;font-size:12px;font-weight:800;background:#dcfce7;color:#15803d}.od-down{background:#fee2e2;color:#b91c1c}",
".od-health{display:grid;gap:8px}.od-health div{display:flex;justify-content:space-between;align-items:center;font-weight:700;color:#12306a;font-size:14px}.od-ok{background:#dcfce7;color:#15803d;border-radius:99px;padding:3px 12px;font-size:12px;font-weight:800}.od-warn{background:#fef3c7;color:#b45309}",
".od-act{display:grid;gap:8px}.od-act div{display:flex;justify-content:space-between;gap:10px;font-size:14px;color:#1f3358;border-bottom:1px solid #eef3fb;padding:6px 0}.od-act small{color:#5b7196;white-space:nowrap}",
".od-table{width:100%;border-collapse:collapse;font-size:14px}.od-table th{text-align:left;color:#475f86;font-size:12px;padding:6px 8px;border-bottom:1px solid #e5eefb}.od-table td{padding:9px 8px;border-bottom:1px solid #f0f5fc;color:#12306a;font-weight:600}",
".od-empty{color:#5b7196;font-size:14px;padding:6px 0}",
"@media(max-width:1200px){.od-stats{grid-template-columns:repeat(3,1fr)}.od-row3{grid-template-columns:repeat(2,1fr)}}",
"@media(max-width:900px){.od-hero,.od-row2,.od-row4{grid-template-columns:1fr}.od-stats{grid-template-columns:repeat(2,1fr)}.od-row3{grid-template-columns:1fr}}"
].join("");

const k0=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const LEVEL_TONE=[["#fdf2f8","#be185d"],["#eff6ff","#1d4ed8"],["#ecfdf5","#15803d"],["#f5f3ff","#6d28d9"]];
function RwandaMap({byDistrict,onPick}){
 const max=Math.max(1,...Object.values(byDistrict).map(x=>x.length));
 const shade=n=>n?"rgba(37,99,235,"+(0.28+0.72*n/max).toFixed(2)+")":"#d6e4fa";
 return <svg className="od-mapsvg" viewBox={"0 0 "+MAP_W+" "+MAP_H} role="img" aria-label="Map of Rwanda districts shaded by number of schools">
  {RWANDA_DISTRICTS.map(d=>{const list=byDistrict[d.n]||[];return <path key={d.n} d={d.d} fill={shade(list.length)} stroke="#fff" strokeWidth="2.500" strokeLinejoin="round" style={{cursor:list.length?"pointer":"default"}} onClick={()=>list.length&&onPick(list[0])}><title>{d.n}{" - "+list.length+" school(s)"+(list.length?": "+list.map(s=>s.name).join(", "):"")}</title></path>;})}
  {RWANDA_DISTRICTS.map(d=>{const n=(byDistrict[d.n]||[]).length;return n?<g key={"c"+d.n} pointerEvents="none"><circle cx={d.x} cy={d.y} r="19" fill="#fff" stroke="#1d4ed8" strokeWidth="4"/><text x={d.x} y={d.y+8} textAnchor="middle" fontSize="24" fontWeight="800" fill="#1d4ed8">{n}</text></g>:null;})}
 </svg>;
}
function Growth({months,schools,students,revenue}){
 const W=560,H=210,L=34,R=18,T=12,B=26,w=W-L-R,h=H-T-B;
 const mx=(a)=>Math.max(1,...a);const ms=mx(schools),mt=mx(students),mr=mx(revenue);
 const x=(i)=>L+(w/12)*(i+0.5);const y=(v,m)=>T+h-(v/m)*h;
 const line=(a,m)=>a.map((v,i)=>(i?"L":"M")+x(i).toFixed(1)+" "+y(v,m).toFixed(1)).join(" ");
 return <svg className="od-chart" viewBox={"0 0 "+W+" "+H} role="img" aria-label="Platform growth over the last 12 months">
  {[0,1,2,3].map(i=><line key={i} x1={L} x2={W-R} y1={T+(h/3)*i} y2={T+(h/3)*i} stroke="#e5eefb"/>)}
  {schools.map((v,i)=><rect key={i} x={x(i)-11} y={y(v,ms)} width="22" height={Math.max(0,T+h-y(v,ms))} rx="4" fill="#2563eb"/>)}
  <path d={line(students,mt)} fill="none" stroke="#16a34a" strokeWidth="2.500"/>
  <path d={line(revenue,mr)} fill="none" stroke="#f97316" strokeWidth="2.500"/>
  {months.map((m,i)=><text key={m.key} x={x(i)} y={H-8} textAnchor="middle" fontSize="11" fill="#475f86">{m.label}</text>)}
  <text x="4" y={T+8} fontSize="10" fill="#475f86">{ms}</text><text x="4" y={T+h} fontSize="10" fill="#475f86">0</text>
 </svg>;
}

export default function OwnerDashboard({data,canBilling,canCreate,go,onAddSchool}){
 const tenants=data.tenants||[];const t=data.totals||{};const ps=data.platformStats||{};const stats=data.schoolStats||{};
 const students=Object.values(stats).reduce((a,s)=>a+(s.students||0),0);
 const months=lastTwelve();
 const cum=(rows,get)=>months.map(m=>rows.filter(r=>get(r)&&get(r).slice(0,7)<=m.key).length);
 const schoolsSeries=cum(tenants,(r)=>r.created_at);
 const sbm=ps.studentsByMonth||{};let run=0;const before=Object.keys(sbm).filter(k=>k<months[0].key).reduce((a,k)=>a+sbm[k],0);run=before;
 const studentsSeries=months.map(m=>{run+=sbm[m.key]||0;return run;});
 const pays=(data.manualPayments||[]).filter(p=>p.state==="recorded");
 const revSeries=months.map(m=>pays.filter(p=>String(p.paid_on).slice(0,7)===m.key).reduce((a,p)=>a+Number(p.amount_rwf||0),0));
 const thisM=revSeries[11],lastM=revSeries[10];
 const change=lastM>0?Math.round(100*(thisM-lastM)/lastM):null;
 const terms=data.feeTerms||[];
 const statusRows=[["Onboarding",t.onboarding,"#fff7ed","#c2410c"],["Active",t.active,"#ecfdf5","#15803d"],["Paused",t.paused,"#eff6ff","#1d4ed8"],["Suspended",t.suspended,"#fef2f2","#b91c1c"]];
 const prov={none:0};Object.keys(PROVINCE_LABEL).forEach(k=>prov[k]=0);const byDistrict={};
 tenants.forEach(x=>{const dk=districtKey(x.district);const pv=x.province&&k0(prov,x.province)?x.province:(dk?DISTRICT_PROVINCE[dk]:null);
  if(dk)(byDistrict[dk]=byDistrict[dk]||[]).push(x);if(pv)prov[pv]+=1;else prov.none+=1;});
 const lvl={none:0};Object.keys(LEVEL_LABEL).forEach(k=>lvl[k]=0);tenants.forEach(x=>{if(x.education_level&&k0(lvl,x.education_level))lvl[x.education_level]+=1;else lvl.none+=1;});
 const clock=paymentClock(tenants,data.feeTerms).filter(c=>c.state!=="ok"&&c.state!=="not_set");
 const plans=data.plans||[];const noPlan=tenants.filter(x=>!x.plan_code).length;const hl=data.health;
 const recent=tenants.slice(0,3);
 const audit=(data.audit||[]).slice(0,4);
 return <div className="od"><style>{CSS}</style>
  <div className="od-hero">
   <div className="od-welcome"><h2>Welcome, Platform Owner</h2><p>Here is what is happening across all schools on Umurage today.</p><p className="od-statusline">{nf(t.active)} active, {nf(t.onboarding)} onboarding, {nf(t.paused)} paused, {nf(t.suspended)} suspended, {nf(t.archived)} archived</p></div>
   <div className="od-quick"><h3>Quick Actions</h3><div className="od-qgrid">
    {canCreate&&<button className="pri" onClick={onAddSchool}><Ico d={I.plus}/>Add School</button>}
    <button onClick={()=>go("billing")}><Ico d={I.clock}/>Subscriptions</button>
    <button onClick={()=>go("staff")}><Ico d={I.users}/>Invite User</button>
    <button onClick={()=>go("security")}><Ico d={I.gear}/>Platform Settings</button>
   </div></div>
  </div>
  <div className="od-stats">
   <div className="od-stat"><span className="ic"><Ico d={I.school}/></span><div><small>Total Schools</small><strong>{nf(t.tenants)}</strong></div></div>
   <div className="od-stat"><span className="ic"><Ico d={I.users}/></span><div><small>Total Users</small><strong>{nf(ps.users)}</strong></div></div>
   <div className="od-stat"><span className="ic"><Ico d={I.cap}/></span><div><small>Total Students</small><strong>{nf(students)}</strong></div></div>
   <div className="od-stat"><span className="ic"><Ico d={I.board}/></span><div><small>Total Teachers</small><strong>{nf(ps.teachers)}</strong></div></div>
   <div className="od-stat"><span className="ic"><Ico d={I.coins}/></span><div><small>Total Revenue</small><strong>{canBilling?rwf(t.manualCollectedRwf):"Restricted"}</strong></div></div>
  </div>
  <div className="od-row2">
   <div className="od-card"><h3>Platform Growth (Last 12 Months)</h3>
    <div className="od-legend"><span><i style={{background:"#2563eb"}}/>Schools ({nf(t.tenants)})</span><span><i style={{background:"#16a34a"}}/>Students ({nf(students)})</span>{canBilling&&<span><i style={{background:"#f97316"}}/>Revenue RWF</span>}</div>
    <Growth months={months} schools={schoolsSeries} students={studentsSeries} revenue={canBilling?revSeries:months.map(()=>0)}/></div>
   <div className="od-card"><h3>Schools Distribution (Rwanda) <button onClick={()=>go("reports")}>Reports</button></h3>
    <div className="od-map"><RwandaMap byDistrict={byDistrict} onPick={()=>go("tenants")}/>
     <div className="od-list">{Object.entries(PROVINCE_LABEL).map(([k,v])=><div key={k} className="od-item"><span>{v}</span><span className="od-badge">{nf(prov[k])}</span></div>)}
      {prov.none>0&&<div className="od-item"><span>Province not set</span><span className="od-badge" style={{background:"#64748b"}}>{nf(prov.none)}</span></div>}</div></div>
    <div className="od-empty">Shaded by schools per district. Set a school's district from Schools, School profile. Boundaries: geoBoundaries, CC BY 4.0.</div></div>
  </div>
  <div className="od-row3">
   <div className="od-card"><h3>Schools by Education Level</h3>
    <div className="od-tiles">{Object.entries(LEVEL_LABEL).map(([k,v],i)=><div key={k} className="od-tile" style={{background:LEVEL_TONE[i][0],color:LEVEL_TONE[i][1]}}><b>{nf(lvl[k])}</b>{v}</div>)}</div>
    {lvl.none>0&&<div className="od-empty">{lvl.none} school(s) have no level set.</div>}</div>
   <div className="od-card"><h3>Subscription Plans <button onClick={()=>go("billing")}>Plans</button></h3>
    {plans.length?<>{plans.filter(p=>p.active).map((p,i)=>{const n=tenants.filter(x=>x.plan_code===p.code).length;const pct=tenants.length?Math.round(100*n/tenants.length):0;
     return <div key={p.code} className="od-bar"><span><b>{p.name}</b><b>{pct}%</b></span><i><u style={{width:pct+"%",background:["#2563eb","#16a34a","#7c3aed","#f97316"][i%4]}}/></i><small>{n} school(s){p.monthly_fee_rwf==null?"":" - "+rwf(p.monthly_fee_rwf)+" a month"}</small></div>;})}
     {noPlan>0&&<div className="od-empty">{noPlan} school(s) have no plan set.</div>}</>
     :<div className="od-empty">Plans appear once the latest database update is applied.</div>}</div>
   <div className="od-card"><h3>Revenue Overview <button onClick={()=>go("billing")}>Open</button></h3>
    {canBilling?<><div className="od-big">{rwf(t.manualCollectedRwf)}</div>
     {change===null?<span className="od-up" style={{background:"#eef3fb",color:"#475f86"}}>No earlier month to compare</span>:<span className={"od-up"+(change<0?" od-down":"")}>{change>=0?"+":""}{change}% vs last month</span>}
     <div className="od-empty">This month: {rwf(thisM)}</div>
     <div className="od-empty">Expected each month: {rwf(t.monthlyExpectedRwf)}. Past due: {nf(t.pastDue)}. Due today: {nf(t.dueToday)}.</div></>
     :<div className="od-empty">Restricted</div>}</div>
   <div className="od-card"><h3>System Health <button onClick={()=>go("health")}>Details</button></h3><div className="od-health">
    <div>Platform status<span className="od-ok">Operational</span></div>
    <div>Database<span className={"od-ok"+(hl&&!hl.database.ok?" od-bad":"")}>{hl&&!hl.database.ok?"Problem":"Healthy"}</span></div>
    <div>File storage<span className={"od-ok"+(hl&&!hl.storage.ok?" od-bad":"")}>{hl&&!hl.storage.ok?"Problem":"Healthy"}</span></div>
    <div>Backups<span className="od-ok od-warn">Not verified</span></div>
    <div>Open support tickets<span className={"od-ok"+(t.ticketsOpen>0?" od-warn":"")}>{nf(t.ticketsOpen)}</span></div>
   </div></div>
  </div>
  {canBilling&&<div className="od-card"><h3>Payment Clock <button onClick={()=>go("billing")}>Subscriptions</button></h3>
   {clock.length?<div className="od-act">{clock.slice(0,6).map(c=><div key={c.id}><span><b>{c.name}</b><br/><small>Monthly {rwf(c.amount)}, due {c.due}</small></span><PayBadge due={c.due}/></div>)}</div>
    :<div className="od-empty">No school is past due or due within {DUE_SOON_DAYS} days.</div>}
   {clock.length>6&&<div className="od-empty">And {clock.length-6} more. Open Subscriptions to see all.</div>}</div>}
  <div className="od-row4">
   <div className="od-card"><h3>Recent Platform Activity <button onClick={()=>go("audit")}>View All</button></h3>
    {audit.length?<div className="od-act">{audit.map(a=><div key={a.id}><span>{String(a.event).replace(/[._]/g," ")}</span><small>{ago(a.created_at)}</small></div>)}</div>:<div className="od-empty">No activity to show.</div>}</div>
   <div className="od-card"><h3>Recently Added Schools <button onClick={()=>go("tenants")}>View All</button></h3>
    {recent.length?<table className="od-table"><thead><tr><th>School Name</th><th>Level</th><th>Location</th><th>Plan</th><th>Joined</th></tr></thead>
     <tbody>{recent.map(r=><tr key={r.id}><td>{r.name}</td><td>{LEVEL_LABEL[r.education_level]||"Not set"}</td><td>{r.district?r.district+", ":""}{PROVINCE_LABEL[r.province]||"Not set"}</td><td>{(plans.find(p=>p.code===r.plan_code)||{}).name||"No plan"}</td><td>{day(r.created_at)}</td></tr>)}</tbody></table>
     :<div className="od-empty">Registered schools will appear here.</div>}</div>
  </div>
 </div>;
}
