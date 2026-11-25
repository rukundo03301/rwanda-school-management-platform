"use client";
import {useEffect,useState} from "react";
// Public front page of the Umurage platform. Pure presentation: no data, no secrets.
// The hero picture is /umurage-hero.jpg from the public folder; when it is missing the
// illustrated scene below still fills the page, so nothing looks broken.
const FEATURES=["Attendance and homework","Fees and mobile money","Report cards","Parents and teachers together"];

const CSS=[
".shell.lp{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,440px);gap:40px;align-items:center;justify-content:center;",
"padding:40px clamp(20px,6vw,90px) 150px;position:relative;overflow:hidden;",
"background:linear-gradient(180deg,#dcebff 0%,#eef5ff 55%,#f7fbff 100%)}",
".lp-scene{position:absolute;left:0;right:0;bottom:0;width:100%;height:auto;z-index:0}",
".lp-bg{position:absolute;inset:0;z-index:0;background-size:cover;background-position:center;background-repeat:no-repeat}",
".lp-bg:after{content:\"\";position:absolute;inset:0;background:linear-gradient(90deg,#ffffff00 55%,#ffffff55 100%)}",
".shell.lp.has-bg{grid-template-columns:minmax(0,1fr) minmax(320px,440px);padding-bottom:40px}",
".lp-hero>*:not(svg):not(.lp-bg),.shell.lp .auth-card{position:relative;z-index:1}",
".lp-brand{display:flex;align-items:center;gap:12px;font-weight:800;color:#12408a;font-size:15px;letter-spacing:.2px}",
".lp-brand b{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff}",
".lp-hero h2{font-size:clamp(30px,4.2vw,50px);line-height:1.08;margin:18px 0 12px;color:#0d2a5c}",
".lp-hero p.lp-sub{font-size:clamp(16px,1.6vw,19px);color:#3b5578;max-width:560px;margin:0 0 20px}",
".lp-chips{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 22px}",
".lp-chips span{background:#fff;border:1px solid #cfe0f7;color:#12408a;border-radius:999px;padding:8px 14px;font-weight:600;font-size:14px;box-shadow:0 6px 18px #1d4ed814}",
".shell.lp .auth-card{justify-self:center;width:min(400px,100%);box-shadow:0 22px 60px #1d4ed824}",
"@media(max-width:900px){.shell.lp{grid-template-columns:1fr;padding-bottom:190px}}"
].join("");

function Skyline(){
 return <svg className="lp-scene" viewBox="0 0 1200 360" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
  <defs>
   <linearGradient id="lpHill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3f8f5b"/><stop offset="1" stopColor="#2c6e46"/></linearGradient>
   <linearGradient id="lpDome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="#cfe0f7"/></linearGradient>
  </defs>
  <path d="M0 250 Q180 170 380 235 T760 215 T1200 240 V360 H0Z" fill="#7fb9d9" opacity=".55"/>
  <path d="M0 290 Q220 215 470 275 T900 255 T1200 285 V360 H0Z" fill="url(#lpHill)"/>
  <g transform="translate(600 120)">
   <path d="M-190 140 Q-190 -10 0 -10 Q190 -10 190 140Z" fill="url(#lpDome)" stroke="#8fb2dc" strokeWidth="3"/>
   <g stroke="#8fb2dc" strokeWidth="2" fill="none" opacity=".9">
    <path d="M-175 110 Q0 78 175 110"/><path d="M-160 80 Q0 48 160 80"/><path d="M-132 50 Q0 22 132 50"/><path d="M-92 24 Q0 4 92 24"/>
    <path d="M0 -10 V140"/><path d="M-70 4 Q-110 70 -118 140"/><path d="M70 4 Q110 70 118 140"/><path d="M-130 24 Q-170 80 -178 140"/><path d="M130 24 Q170 80 178 140"/>
   </g>
   <rect x="-250" y="140" width="500" height="34" rx="6" fill="#ffffff" stroke="#8fb2dc" strokeWidth="3"/>
   <g fill="#8fb2dc">{Array.from({length:14}).map((_,i)=><rect key={i} x={-232+i*35} y="148" width="16" height="18" rx="2"/>)}</g>
  </g>
  <g fill="#1f5a39">{[80,170,300,930,1040,1130].map((x,i)=><g key={x} transform={"translate("+x+" "+(285-(i%2)*8)+")"}>
   <rect x="-3" y="14" width="6" height="22" fill="#6b4a2b"/><circle cx="0" cy="8" r="22"/></g>)}</g>
 </svg>;
}

export default function Landing(){
 const [photo,setPhoto]=useState(false);
 useEffect(()=>{
  const img=new Image();
  img.onload=()=>{setPhoto(true);document.querySelector(".shell.lp")?.classList.add("has-bg");};
  img.src="/umurage-hero.jpg";
  return ()=>{document.querySelector(".shell.lp")?.classList.remove("has-bg");};
 },[]);
 return <section className="lp-hero" aria-label="About the platform">
  <style>{CSS}</style>
  {photo?<div className="lp-bg" role="img" aria-label="A family checking their child's school progress together on the Umurage platform" style={{backgroundImage:"url(/umurage-hero.jpg)"}}/>
   :<>
  <Skyline/>
  <div className="lp-brand"><b>U</b>Umurage School Management Platform</div>
  <h2>One safe place for every school, parent and child.</h2>
  <p className="lp-sub">Rwanda's school platform for attendance, homework, report cards and fees, built so each school keeps its own name, colours and private records.</p>
  <div className="lp-chips">{FEATURES.map(f=><span key={f}>{f}</span>)}</div>
   </>}
 </section>;
}
