"use client";
import {useState} from "react";

// Single-screen Umurage hero. Show the exact user-provided artwork, unmodified.
// Authentication opens only from the top-right navigation.
const CSS=`
.shell.lp{
  --lp-header-height:84px;
  position:relative;
  display:block;
  width:100%;
  min-width:0;
  height:100vh;
  height:100dvh;
  min-height:0;
  padding:0;
  margin:0;
  overflow:hidden;
  isolation:isolate;
  background:#eaf2ff;
}
.shell.lp .lp-hero{
  position:absolute;
  inset:0;
  display:block;
  width:100%;
  height:100%;
  overflow:hidden;
  z-index:0;
  background:#e9f2ff;
}
.lp-hero-picture{
  position:absolute;
  inset:0;
  z-index:1;
  width:100%;
  height:100%;
  overflow:hidden;
}
.lp-hero-image{
  display:block;
  width:100%;
  height:100%;
  max-width:none;
  object-fit:cover;
  object-position:center center;
}
.lp-hero-shade{
  position:absolute;
  inset:0;
  z-index:2;
  pointer-events:none;
  background:linear-gradient(180deg,rgba(244,249,255,.10),transparent 19%,transparent 84%,rgba(217,232,255,.13));
}
.lp-topbar{
  position:absolute;
  z-index:10;
  top:0;
  left:0;
  right:0;
  min-height:var(--lp-header-height);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:16px;
  padding:12px clamp(15px,3vw,50px);
  background:linear-gradient(180deg,rgba(250,252,255,.97),rgba(247,251,255,.91));
  border-bottom:1px solid rgba(193,215,245,.88);
  box-shadow:0 4px 20px rgba(29,79,150,.06);
}
.lp-brand{
  display:flex;
  gap:12px;
  align-items:center;
  min-width:0;
  color:#153b75;
  font-size:clamp(16px,1.6vw,22px);
  font-weight:800;
  letter-spacing:-.025em;
  line-height:1.25;
}
.lp-brand-mark{
  flex:none;
  display:grid;
  place-items:center;
  width:45px;
  height:45px;
  border-radius:13px;
  color:#fff;
  background:linear-gradient(140deg,#3378e8,#184aab);
  font-weight:900;
  font-size:19px;
  box-shadow:0 8px 20px rgba(37,94,172,.17);
}
.lp-auth-nav{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:10px;
  flex:none;
}
.lp-auth-nav button{
  min-height:44px;
  padding:10px 20px;
  border-radius:11px;
  font-size:14px;
  font-weight:800;
  border:1px solid #bcd2f1;
  color:#1b56a4;
  background:#fff;
  box-shadow:0 5px 18px rgba(39,92,166,.08);
}
.lp-auth-nav button.lp-signup{
  background:#3378e8;
  color:#fff;
  border-color:#3378e8;
}
.lp-auth-nav button:hover{filter:brightness(.96)}
.lp-auth-nav button:focus-visible{outline:3px solid #78a9f8;outline-offset:3px}
.lp-fallback{
  width:100%;
  height:100%;
  padding:clamp(22px,6vw,80px);
  display:flex;
  justify-content:center;
  align-items:center;
  flex-direction:column;
  text-align:center;
  background:radial-gradient(circle at center,#cae3ff,#f0f7ff 72%);
}
.lp-fallback h2{
  color:#153b75;
  font-size:clamp(28px,4vw,54px);
  line-height:1.12;
  max-width:750px;
}
.lp-fallback p{
  color:#496481;
  font-size:clamp(15px,1.6vw,19px);
  max-width:600px;
}
.shell.lp .lp-auth-overlay{
  position:fixed;
  z-index:30;
  inset:0;
  display:flex;
  align-items:flex-start;
  justify-content:flex-end;
  overflow-y:auto;
  padding:calc(var(--lp-header-height) + 16px) clamp(12px,3vw,50px) 24px;
  background:rgba(12,32,62,.35);
  backdrop-filter:blur(3px);
}
.shell.lp .lp-auth-overlay .auth-card{
  width:min(440px,100%);
  max-height:calc(100dvh - var(--lp-header-height) - 30px);
  overflow-y:auto;
  position:relative;
  margin:0;
  flex:none;
  background:#fff;
  border:1px solid #d3e1f4;
  border-radius:22px;
  padding:clamp(20px,2.4vw,32px);
  box-shadow:0 30px 85px rgba(17,49,102,.28);
}
.lp-auth-close{
  position:absolute;
  right:18px;
  top:17px;
  border:1px solid #d1dfef;
  background:#f4f8ff;
  color:#234773;
  width:36px;
  height:36px;
  border-radius:10px;
  font-size:22px;
  display:grid;
  place-items:center;
}
.lp-auth-close:focus-visible{outline:3px solid #78a9f8;outline-offset:3px}
@media(max-width:620px){
  .shell.lp{--lp-header-height:112px}
  .lp-topbar{align-content:center;align-items:center;flex-wrap:wrap;gap:9px;padding:10px 14px}
  .lp-brand{font-size:15px;flex:1 1 100%}
  .lp-brand-mark{width:34px;height:34px;border-radius:9px;font-size:16px}
  .lp-auth-nav{margin-left:auto;gap:8px}
  .lp-auth-nav button{min-height:38px;padding:7px 15px;font-size:12px}
  .shell.lp .lp-auth-overlay{justify-content:center;padding:calc(var(--lp-header-height) + 8px) 10px 12px}
  .shell.lp .lp-auth-overlay .auth-card{max-height:calc(100dvh - var(--lp-header-height) - 20px);border-radius:16px}
}
@media(max-height:560px) and (min-width:621px){
  .shell.lp{--lp-header-height:64px}
  .lp-topbar{padding-block:7px}
  .lp-brand-mark{width:36px;height:36px}
  .shell.lp .lp-auth-overlay{padding-top:calc(var(--lp-header-height) + 6px)}
}
`;

export default function Landing({onLogin,onSignup}){
 const [imageFailed,setImageFailed]=useState(false);
 return <>
  <style>{CSS}</style>
  <section className="lp-hero" aria-label="Umurage School Management Platform welcome image">
    <div className="lp-hero-picture">
      {!imageFailed
       ? <img
           className="lp-hero-image"
           src="/umurage-hero-original.webp"
           width="1269"
           height="952"
           alt="Umurage School Management Platform illustration with a family and school progress, attendance, fee, announcement and messaging panels."
           loading="eager"
           fetchPriority="high"
           decoding="async"
           onError={()=>setImageFailed(true)}
         />
       : <div className="lp-fallback">
          <h2>One connected school platform for every family.</h2>
          <p>School progress, attendance, homework, fees and communication in one secure place.</p>
         </div>}
    </div>
    <div className="lp-hero-shade" aria-hidden="true"/>
  </section>
  <header className="lp-topbar">
    <div className="lp-brand"><span className="lp-brand-mark" aria-hidden="true">U</span><span>Umurage School Management Platform</span></div>
    <nav className="lp-auth-nav" aria-label="Platform account">
      <button type="button" onClick={onLogin}>Log In</button>
      <button type="button" className="lp-signup" onClick={onSignup}>Sign Up</button>
    </nav>
  </header>
 </>;
}
