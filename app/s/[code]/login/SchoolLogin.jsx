"use client";
import {useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
import {SCHOOL_ROLES,validSchoolRole,schoolPortalPath} from "../../../../lib/school-roles.mjs";

export default function SchoolLogin({code,name,logo,color,unavailable}) {
 const [client,setClient]=useState(null);
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [mode,setMode]=useState("login");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [role,setRole]=useState(null);
 const [signedIn,setSignedIn]=useState(false);
 useEffect(()=>{
   const qs=new URLSearchParams(window.location.search);
   const intended=qs.get("role");
   if(validSchoolRole(intended))setRole(intended);
   const c=browserSupabase();setClient(c);
   if(!c)return;
   c.auth.getSession().then(({data})=>{
     if(data?.session)setSignedIn(true);
   });
 },[code]);
 async function submit(e){
   e.preventDefault();setBusy(true);setError("");setMessage("");
   try{
     if(!client)throw Error("School sign-in is not configured");
     if(mode==="login"&&!role)throw Error("Choose your school role before signing in");
     if(mode==="forgot"){
       const {error}=await client.auth.resetPasswordForEmail(email.trim(),{
         redirectTo:window.location.origin+"/s/"+code+"/reset-password"
       });
       if(error)throw error;
       setMessage("If the account exists, we have emailed recovery instructions.");
     } else {
       const {error}=await client.auth.signInWithPassword({email:email.trim(),password});
       if(error)throw error;
       window.location.assign(schoolPortalPath(code,role));
     }
   }catch(e){setError(e.message||"Sign-in failed");}
   finally{setBusy(false);}
 }
 async function google(){
   setError("");setBusy(true);
   if(!role){setError("Choose your school role first");setBusy(false);return;}
   const {error}=await client.auth.signInWithOAuth({
     provider:"google",options:{redirectTo:window.location.origin+schoolPortalPath(code,role)}
   });
   if(error){setError(error.message);setBusy(false);}
 }
 return <main className="school-auth" style={{"--school-color":/^#[0-9a-f]{6}$/i.test(color||"")?color:"#204a78"}}>
   <section className="school-auth-side"><div className="school-auth-hero">
     <span className="site-eyebrow">Your school. Your community.</span>
     <h1>{name}</h1><p>A private school workspace built around your institution's identity.</p>
     <a href={"/s/"+code}>Visit school website</a>
   </div></section>
   <section className="school-auth-panel"><div className="school-auth-card">
     <div className="row" style={{marginBottom:20}}>
       {logo?<img src={logo} alt={name+" official logo"} width="62" height="62" style={{objectFit:"contain"}}/>:<div className="site-icon">✦</div>}
       <div><strong>{name}</strong><div className="micro">Secure School Portal</div></div>
     </div>
     <h2>{mode==="login"?"Choose your school role":"Reset your password"}</h2>
     {mode==="login"&&!signedIn&&<>
       <p className="muted">Select how you belong to this school. Your verified account and approved school membership determine what you may actually access.</p>
       <div className="school-role-options login-roles" role="group" aria-label="Choose school login role">
         {SCHOOL_ROLES.map(r=><button key={r.id} type="button"
           aria-pressed={role===r.id} className={role===r.id?"school-role-choice selected":"school-role-choice"}
           onClick={()=>{setRole(r.id);setError("");}}>
           <span aria-hidden="true">{r.icon}</span><strong>{r.label}</strong>
           <small>{r.description}</small>
         </button>)}
       </div>
     </>}
     <p className="muted">Only people verified and invited by this school can access its private workspace.</p>
     {unavailable&&<div className="notice error">This school is currently unavailable. Contact its administrator.</div>}
     {error&&<div className="notice error">{error}</div>}
     {message&&<div className="notice ok">{message}</div>}
     {signedIn&&mode==="login"?<div className="notice info">
       <strong>You're already signed in.</strong>
       <p>Select an authorized school role above to continue. You can switch accounts if this is not your intended identity.</p>
       <div className="row"><button className="button" type="button" disabled={!role} onClick={()=>window.location.assign(schoolPortalPath(code,role))}>Continue to selected workspace</button>
         <button className="button secondary" type="button" onClick={async()=>{await client.auth.signOut();setSignedIn(false);}}>Use another account</button></div>
     </div>:<form onSubmit={submit}>
       <label className="field">Email address<input className="input" required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
       {mode==="login"&&<label className="field">Password<input className="input" required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>}
       <button className="button" type="submit" disabled={!client||busy||unavailable||(mode==="login"&&!role)} style={{width:"100%"}}>{busy?"Please wait…":mode==="login"?"Sign in to your school":"Email reset link"}</button>
     </form>
     {mode==="login"&&<>
       <div className="auth-divider"><span>or</span></div>
       <button className="button secondary" style={{width:"100%"}} disabled={!client||busy||unavailable||!role} onClick={google}>Continue with Google</button>
     </>}
     <div className="auth-links">
       <button className="button flat" onClick={()=>{setMode(mode==="login"?"forgot":"login");setError("");setMessage("");}}>{mode==="login"?"Forgot password?":"Back to sign in"}</button>
     </div>
     <p className="micro" style={{marginTop:18}}>Roles are approved by your school. School owners can complete setup now; teacher, staff, parent and student dashboards are being developed in separate modules.</p>
   </div></section>
 </main>;
}
