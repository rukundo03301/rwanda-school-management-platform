"use client";
import {useState} from "react";

// Public Umurage welcome artwork. Preserve the entire composition rather than
// cropping the embedded title, family or connected school feature panels.
const FEATURES=["Attendance and homework","Fees and mobile money","Report cards","Parents and teachers together"];

const CSS=`
.shell.lp{
  display:flex;
  flex-direction:column;
  justify-content:flex-start;
  align-items:stretch;
  gap:clamp(20px,2.5vw,36px);
  min-height:100vh;
  min-height:100svh;
  width:100%;
  padding:clamp(18px,3vw,44px) clamp(12px,3vw,48px) clamp(32px,5vw,72px);
  overflow-x:clip;
  background:linear-gradient(180deg,#e9f2ff 0%,#f5f9ff 65%,#eaf2ff 100%);
}
.shell.lp .lp-hero{
  width:min(100%,1400px);
  min-width:0;
  margin:0 auto;
  display:flex;
  flex-direction:column;
  gap:18px;
}
.lp-topline{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:16px;
  flex-wrap:wrap;
}
.lp-brand{
  display:flex;
  gap:12px;
  align-items:center;
  min-width:0;
  color:#153b75;
  font-size:clamp(16px,1.5vw,21px);
  font-weight:800;
  letter-spacing:-.025em;
  line-height:1.25;
}
.lp-brand-mark{
  flex:none;
  display:grid;
  place-items:center;
  width:44px;
  height:44px;
  border-radius:14px;
  background:linear-gradient(135deg,#347bf0,#194ea8);
  color:#fff;
  box-shadow:0 8px 20px rgba(42,102,189,.2);
  font-weight:900;
}
.lp-signin-jump{
  flex:none;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-height:44px;
  padding:10px 18px;
  color:#1b56a4;
  background:rgba(255,255,255,.92);
  border:1px solid #c6daf5;
  border-radius:999px;
  text-decoration:none;
  font-weight:800;
}
.lp-signin-jump:hover,.lp-signin-jump:focus-visible{
  background:#e2eeff;
  outline-offset:3px;
}
.lp-hero-art{
  display:block;
  width:100%;
  margin:0;
  border:1px solid rgba(169,196,234,.65);
  border-radius:clamp(14px,2vw,25px);
  overflow:hidden;
  background:#eaf2ff;
  box-shadow:0 18px 48px rgba(45,84,142,.10);
}
.lp-hero-image{
  display:block;
  width:100%;
  height:auto;
  max-width:100%;
  object-fit:contain;
  object-position:center;
}
.lp-fallback{
  position:relative;
  display:grid;
  align-content:center;
  min-height:min(60vh,540px);
  padding:clamp(28px,5vw,80px);
  background:radial-gradient(circle at 50% 70%,#c3e1ff,#eef6ff 65%,#f8fbff);
}
.lp-fallback h2{
  color:#143f7b;
  font-size:clamp(28px,4.5vw,55px);
  line-height:1.12;
  max-width:750px;
}
.lp-fallback p{
  font-size:clamp(15px,1.7vw,19px);
  max-width:600px;
  color:#496481;
}
.lp-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.lp-chips span{
  border-radius:999px;
  background:#fff;
  color:#225ca8;
  padding:9px 13px;
  border:1px solid #cadcf5;
  font-size:12px;
  font-weight:700;
}
.lp-below{
  display:flex;
  align-items:center;
  justify-content:space-between;
  flex-wrap:wrap;
  gap:10px;
  color:#526b90;
  font-size:13px;
}
.lp-below p{margin:0}
.shell.lp > .auth-card{
  position:relative;
  z-index:1;
  align-self:flex-end;
  justify-self:auto;
  width:min(440px,100%);
  margin:0 max(0px,calc((100vw - 1500px)/2)) 0 0;
  padding:clamp(20px,2.4vw,34px);
  background:#fff;
  border:1px solid #d5e4f8;
  border-radius:22px;
  box-shadow:0 24px 65px rgba(28,73,139,.16);
  scroll-margin-top:24px;
}
@media(max-width:760px){
  .shell.lp{
    gap:19px;
    padding:14px 12px 34px;
  }
  .shell.lp .lp-hero{gap:12px}
  .lp-brand{font-size:15px}
  .lp-brand-mark{width:38px;height:38px;border-radius:11px}
  .lp-signin-jump{font-size:12px;padding:9px 13px}
  .lp-hero-art{border-radius:14px}
  .lp-below{font-size:12px}
  .shell.lp > .auth-card{
    align-self:center;
    width:min(440px,100%);
    margin:0;
    border-radius:18px;
  }
}
@media(max-width:400px){
  .lp-brand{font-size:13px}
  .lp-topline{align-items:flex-start}
  .lp-signin-jump{width:100%}
}
`;

export default function Landing(){
 const [imageFailed,setImageFailed]=useState(false);
 return <section className="lp-hero" aria-label="About the Umurage School Management Platform">
  <style>{CSS}</style>
  <div className="lp-topline">
   <div className="lp-brand"><span className="lp-brand-mark" aria-hidden="true">U</span><span>Umurage School Management Platform</span></div>
   <a className="lp-signin-jump" href="#platform-sign-in">Go to secure sign in ↓</a>
  </div>
  <figure className="lp-hero-art">
   {!imageFailed
    ? <img
       className="lp-hero-image"
       src="/umurage-hero.jpg"
       alt="Umurage School Management Platform: a family sitting together with connected panels for attendance, academic progress, school information, fees, announcements, and messages."
       width="1536"
       height="1024"
       loading="eager"
       fetchPriority="high"
       decoding="async"
       onError={()=>setImageFailed(true)}
      />
    : <div className="lp-fallback">
       <h2>One safe place for every school, parent and child.</h2>
       <p>Rwanda's school platform for attendance, homework, report cards and fees, built so every school keeps its own identity and private records.</p>
       <div className="lp-chips">{FEATURES.map(f=><span key={f}>{f}</span>)}</div>
      </div>}
  </figure>
  <div className="lp-below">
   <p>One connected platform for schools, families, teachers and students.</p>
   <p>Your secure sign-in is just below ↓</p>
  </div>
 </section>;
}
