"use client";
import {useEffect,useState} from "react";
import {usePathname} from "next/navigation";
import {browserSupabase} from "../../lib/client.js";
import {DashboardShell} from "./DashboardShell.jsx";
import {FRAMED_PAGES,PAGE_TITLE,ROLE_LABEL,primaryRole,portalNav,currentSegment} from "../../lib/portal-nav.mjs";

// Puts every module page (messages, report cards, fees, reports, admin...) inside the same
// header, sidebar and colours as the role dashboards. The role comes from the school-verified
// membership, and is remembered for ten minutes so moving between pages does not wait on the server.
const TTL=10*60*1000;
function cached(code,uid){
 try{const v=JSON.parse(sessionStorage.getItem("pf:"+code+":"+uid)||"null");return v&&Date.now()-v.t<TTL?v:null;}catch{return null;}
}
export default function PortalFrame({code,children}){
 const path=usePathname(),seg=currentSegment(path);
 const framed=FRAMED_PAGES.includes(seg);
 const [info,setInfo]=useState(null),[user,setUser]=useState(null),[signedOut,setSignedOut]=useState(false);
 useEffect(()=>{
  if(!framed)return;
  const c=browserSupabase();if(!c)return;
  let alive=true;
  c.auth.getSession().then(async({data})=>{
   const s=data.session;if(!alive)return;
   if(!s){setSignedOut(true);return;}
   setUser(s.user);
   const hit=cached(code,s.user.id);
   if(hit){setInfo(hit);return;}
   try{
    const r=await fetch("/api/school/"+code+"/access",{cache:"no-store",headers:{Authorization:"Bearer "+s.access_token}});
    if(!r.ok||!alive)return;
    const j=await r.json();
    const v={t:Date.now(),roles:j.roles||[],name:j.school?.name||"School"};
    try{sessionStorage.setItem("pf:"+code+":"+s.user.id,JSON.stringify(v));}catch{}
    if(alive)setInfo(v);
   }catch{}
  });
  return()=>{alive=false;};
 },[framed,code]);
 if(!framed)return children;
 const role=primaryRole(info?.roles);
 const nav=signedOut?[{label:"Sign in",icon:"user",href:"/s/"+code+"/login"}]:role?portalNav(role,code,seg):[{label:"Loading…",icon:"home",href:"/s/"+code+"/portal"}];
 const signOut=async()=>{const c=browserSupabase();try{await c?.auth.signOut();}catch{}try{sessionStorage.clear();}catch{}window.location.assign("/s/"+code+"/login");};
 return <DashboardShell school={{name:info?.name||"School portal",place:role?ROLE_LABEL[role]+" workspace":""}} title={PAGE_TITLE[seg]||"School"}
  nav={nav} user={{name:(user?.email||"Signed out").split("@")[0],role:role?ROLE_LABEL[role]:""}} onSignOut={signOut} portalHref={"/s/"+code+"/portal"}>
  <div className="pf-body">{children}</div></DashboardShell>;
}
