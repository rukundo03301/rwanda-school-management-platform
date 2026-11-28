"use client";
import "./dashboard.css";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {browserSupabase} from "../../lib/client.js";

const ICONS={
 home:["M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"],
 users:["M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z","M2 21a7 7 0 0 1 14 0","M16 4a4 4 0 0 1 0 7","M18 21a7 7 0 0 0-3-5.7"],
 book:["M2 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2z","M22 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8z"],
 check:["M9 3h6v3H9z","M7 5H5a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2","m9 14 2 2 4-4"],
 chart:["M4 20V10","M10 20V4","M16 20v-8","M22 20H2"],
 clock:["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z","M12 7v5l3 2"],
 folder:["M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"],
 chat:["M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
 calendar:["M4 6h16v15H4z","M8 3v4","M16 3v4","M4 11h16"],
 user:["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z","M4 21a8 8 0 0 1 16 0"],
 cap:["M2 9l10-5 10 5-10 5z","M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"],
 trophy:["M8 21h8","M12 17v4","M7 4h10v5a5 5 0 0 1-10 0z","M7 6H4v2a3 3 0 0 0 3 3","M17 6h3v2a3 3 0 0 1-3 3"],
 wrench:["M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z"],
 box:["M21 8l-9-5-9 5 9 5z","M3 8v8l9 5 9-5V8","M12 13v8"],
 megaphone:["M3 11v3l12 5V6z","M15 8c3 0 5 1.5 5 4s-2 4-5 4"],
 file:["M6 3h8l5 5v13H6z","M14 3v5h5"],
 gear:["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z","M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"],
 wallet:["M3 7a2 2 0 0 1 2-2h13v4","M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z","M16 14h2"],
 play:["M7 4l13 8-13 8z"],
 help:["M4 14v-2a8 8 0 0 1 16 0v2","M4 14h3v5H4z","M17 14h3v5h-3z"],
 building:["M4 21V5l8-2v18","M12 9h8v12","M7 9h2M7 13h2M15 13h2M15 17h2"],
 bolt:["M13 2L4 14h7l-1 8 9-12h-7z"],
 plus:["M12 5v14M5 12h14"],
 alert:["M12 3l10 18H2z","M12 10v5","M12 18h.01"],
 mail:["M3 5h18v14H3z","m3 7 9 6 9-6"],
 search:["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z","m21 21-4.3-4.3"],
 bell:["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9","M10.3 21a1.94 1.94 0 0 0 3.4 0"],
 menu:["M4 6h16M4 12h16M4 18h16"],
 down:["m6 9 6 6 6-6"]
};
export function Icon({name,size=20}){
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{(ICONS[name]||ICONS.file).map((d,i)=><path key={i} d={d}/>)}</svg>;
}
export function greeting(date=new Date()){
 const h=Number(new Intl.DateTimeFormat("en-GB",{hour:"numeric",hour12:false,timeZone:"Africa/Kigali"}).format(date));
 return h<12?"Good morning":h<17?"Good afternoon":"Good evening";
}
export function todayLabel(date=new Date()){
 return new Intl.DateTimeFormat("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric",timeZone:"Africa/Kigali"}).format(date);
}
export function initials(name){return String(name||"?").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join("")||"?";}
// A stat opens the page behind its number when given href or onClick.
export function Stat({icon,tone="blue",value,label,href,onClick}){
 const body=<><div className={"ds-ico "+tone}><Icon name={icon} size={24}/></div>
  <div><strong>{value}</strong><span>{label}</span></div></>;
 if(href)return <Link href={href} className="ds-stat ds-go" aria-label={label+": "+value}>{body}</Link>;
 if(onClick)return <button type="button" className="ds-stat ds-go" onClick={onClick} aria-label={label+": "+value}>{body}</button>;
 return <div className="ds-stat">{body}</div>;
}
// A list row that opens its record.
export function Item({href,onClick,children}){
 if(href)return <li><Link href={href} className="ds-item ds-go">{children}</Link></li>;
 if(onClick)return <li><button type="button" className="ds-item ds-go" onClick={onClick}>{children}</button></li>;
 return <li className="ds-item">{children}</li>;
}
const when=at=>{if(!at)return "";const d=new Date(at),m=Math.round((Date.now()-d.getTime())/60000);
 if(m>=0&&m<60)return m<=1?"just now":m+" min ago";if(m>=0&&m<1440)return Math.round(m/60)+" h ago";
 return d.toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"Africa/Kigali"});};
// The bell lists what needs this person's attention; every entry opens the page that resolves it.
function Bell({code,count=0,onBell,light}){
 const [open,setOpen]=useState(false),[items,setItems]=useState(null),[err,setErr]=useState(""),ref=useRef(null);
 const load=async()=>{
  if(!code)return;
  try{const c=browserSupabase();const {data}=await c.auth.getSession();if(!data.session)return;
   const r=await fetch("/api/school/"+code+"/notifications",{cache:"no-store",headers:{Authorization:"Bearer "+data.session.access_token}});
   const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||"Notifications could not load");setItems(j.items||[]);setErr("");}
  catch(e){setErr(e.message);}
 };
 useEffect(()=>{load();const t=setInterval(load,60000);const f=()=>load();window.addEventListener("focus",f);window.addEventListener("ds-notes-refresh",f);
  return()=>{clearInterval(t);window.removeEventListener("focus",f);window.removeEventListener("ds-notes-refresh",f);};},[code]);
 // After an entry is opened, the page it opens marks it handled; refresh the list shortly after.
 const opened=()=>{setOpen(false);setTimeout(load,2500);setTimeout(load,7000);};
 useEffect(()=>{if(!open)return;const f=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
  document.addEventListener("mousedown",f);return()=>document.removeEventListener("mousedown",f);},[open]);
 const n=code?(items?items.length:0):count;
 return <div className="ds-bellwrap" ref={ref}>
  <button className="ds-bell" aria-haspopup="menu" aria-expanded={open} aria-label={"Notifications"+(n?" ("+n+")":"")}
   onClick={()=>{if(!code){onBell?.();return;}setOpen(o=>!o);if(!open)load();}}><Icon name="bell" size={24}/>{n>0&&<b>{n>99?"99+":n}</b>}</button>
  {open&&<div className="ds-notes" role="menu">
   <header><strong>Notifications</strong>{onBell&&<button type="button" onClick={()=>{setOpen(false);onBell();}}>View all</button>}</header>
   {err&&<p className="ds-empty">{err} <button type="button" className="ds-link" onClick={load}>Try again</button></p>}
   {!err&&items&&!items.length&&<p className="ds-empty">You are all caught up.</p>}
   {!err&&!items&&<p className="ds-empty">Loading…</p>}
   {items&&items.length>0&&<ul>{items.map(i=><li key={i.id}><Link role="menuitem" href={i.href} onClick={opened}>
    <span className={"ds-ico "+(i.tone||"blue")}><Icon name="bell" size={16}/></span>
    <span><strong>{i.title}</strong><small>{i.detail}</small><em>{when(i.at)}</em></span></Link></li>)}</ul>}
  </div>}
 </div>;
}
export function Ring({value,label="Present",color,href,onClick}){
 const v=Math.max(0,Math.min(100,Number(value)||0));
 const ring=<div className="ds-ring" style={{"--v":v,...(color?{"--c":color}:{})}}>
  <div><span><strong>{value===null||value===undefined?"—":Math.round(v)+"%"}</strong>{label}</span></div></div>;
 const aria="Open "+label.toLowerCase()+" details";
 if(href)return <Link href={href} className="ds-go ds-ringlink" aria-label={aria}>{ring}</Link>;
 if(onClick)return <button type="button" className="ds-go ds-ringlink" onClick={onClick} aria-label={aria}>{ring}</button>;
 return ring;
}
export function Bar({label,value,color="#1fa64a",href}){
 const v=value===null||value===undefined?null:Math.max(0,Math.min(100,value));
 const bar=<div className="ds-bar"><span><b style={{fontWeight:500}}>{label}</b><b>{v===null?"—":Math.round(v)+"%"}</b></span>
  <i><u style={{width:(v||0)+"%",background:color}}/></i></div>;
 return href?<Link href={href} className="ds-go" style={{display:"block",background:"transparent",borderRadius:8}}>{bar}</Link>:bar;
}
export function Card({title,icon,link,size="",children}){
 return <section className={"ds-card "+size}><h3>{icon&&<Icon name={icon}/>}{title}{link}</h3>{children}</section>;
}
// Grouped menus show only the group names; opening a group shows its pages, one group at a time,
// so the sidebar stays short. The group holding the current page opens by itself.
function SideNav({nav,onPick}){
 const [here,setHere]=useState("");
 useEffect(()=>{const f=()=>setHere(window.location.pathname+window.location.search);f();window.addEventListener("popstate",f);return()=>window.removeEventListener("popstate",f);},[]);
 const strip=h=>String(h||"").split("?")[0];
 const flagged=nav.findIndex(n=>n.active);
 const exact=nav.findIndex(n=>n.href&&n.href===here);
 const loose=nav.findIndex(n=>n.href&&!n.href.includes("?")&&strip(n.href)===strip(here));
 const activeIdx=flagged>=0?flagged:exact>=0?exact:loose;
 const grouped=nav.some(n=>n.group);
 const [openGroup,setOpenGroup]=useState(null);
 const activeGroup=activeIdx>=0?nav[activeIdx].group:null;
 useEffect(()=>{if(activeGroup)setOpenGroup(activeGroup);},[activeGroup]);
 const link=(n,i,sub)=>{
  const on=i===activeIdx;
  const body=<><span className={"ds-navico"+(n.tone?" t-"+n.tone:"")+(sub?" sm":"")}><Icon name={n.icon} size={sub?16:20}/></span><span className="ds-navtext">{n.label}{!grouped&&n.hint&&<small>{n.hint}</small>}</span>{n.badge>0&&<span className="ds-badge">{n.badge}</span>}</>;
  const cls=(on?"on":"")+(sub?" ds-sub":"");
  return n.href
   ?<Link key={n.label} href={n.href} prefetch title={n.hint||undefined} className={cls} onClick={()=>{setHere(n.href);onPick();}}>{body}</Link>
   :<button key={n.label} title={n.hint||undefined} className={cls} onClick={()=>{n.onClick?.();onPick();}}>{body}</button>;
 };
 if(!grouped)return <nav className="ds-nav" aria-label="Sections">{nav.map((n,i)=>link(n,i,false))}</nav>;
 const groups=[];for(const [i,n] of nav.entries()){let g=groups.find(x=>x.name===n.group);if(!g)groups.push(g={name:n.group,icon:n.groupIcon||n.icon,tone:n.tone,items:[]});g.items.push([n,i]);}
 return <nav className="ds-nav ds-acc" aria-label="Sections">{groups.map(g=>{
  if(g.items.length===1)return link(g.items[0][0],g.items[0][1],false);
  const open=openGroup===g.name,has=g.items.some(([,i])=>i===activeIdx);
  return <div key={g.name} className={"ds-grp"+(open?" open":"")}>
   <button type="button" className={"ds-grphead"+(has?" has":"")} aria-expanded={open} onClick={()=>setOpenGroup(open?null:g.name)}>
    <span className={"ds-navico"+(g.tone?" t-"+g.tone:"")}><Icon name={g.icon}/></span><span className="ds-navtext">{g.name}</span><span className="ds-chev"><Icon name="down" size={16}/></span></button>
   {open&&<div className="ds-grpbody">{g.items.map(([n,i])=>link(n,i,true))}</div>}
  </div>;})}</nav>;
}
export function DashboardShell({school,code,title,subtitle,nav,user,notifications=0,onBell,onSearch,searchPlaceholder="Search…",helpTitle="Need Help?",helpText,onSignOut,portalHref,children}){
 const [open,setOpen]=useState(false);
 const [menu,setMenu]=useState(false);
 const [q,setQ]=useState("");
 return <div className={"ds-app"+(open?" open":"")}>
  <header className="ds-brand">
   {school?.logoUrl?<img src={school.logoUrl} alt={school.name+" logo"}/>:<span className="ds-crest" aria-hidden="true">{initials(school?.name)}</span>}
   <div><strong>{school?.name||"School"}</strong>{school?.place&&<small>{school.place}</small>}</div>
  </header>
  <div className="ds-top">
   <button className="ds-burger" aria-label="Menu" onClick={()=>setOpen(o=>!o)}><Icon name="menu" size={26}/></button>
   <h1>{title}{subtitle&&<span className="ds-sub">{subtitle}</span>}</h1>
   {onSearch&&<form className="ds-search" role="search" onSubmit={e=>{e.preventDefault();onSearch(q.trim());}}>
    <Icon name="search" size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder={searchPlaceholder} aria-label="Search"/></form>}
   <div style={onSearch?undefined:{marginLeft:"auto"}}><Bell code={code} count={notifications} onBell={onBell}/></div>
   <div className="ds-user"><button onClick={()=>setMenu(m=>!m)} aria-haspopup="menu" aria-expanded={menu}>
     <span className="ds-avatar">{initials(user?.name)}</span>
     <span><strong>{user?.name}</strong><small>{user?.role}</small></span><Icon name="down" size={16}/></button>
    {menu&&<div className="ds-menu" role="menu">
     {portalHref&&<a href={portalHref} role="menuitem">School portal</a>}
     <button role="menuitem" onClick={onSignOut}>Sign out</button></div>}
   </div>
  </div>
  <aside className="ds-side">
   <SideNav nav={nav} onPick={()=>setOpen(false)}/>
   {helpText&&<div className="ds-help"><Icon name="help" size={30}/><div><strong>{helpTitle}</strong>{helpText}</div></div>}
  </aside>
  <main className="ds-main">{children}</main>
 </div>;
}
