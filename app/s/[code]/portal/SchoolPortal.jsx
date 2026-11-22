"use client";
import {useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
import {SCHOOL_ROLES,validSchoolRole,roleDetail,schoolPortalPath} from "../../../../lib/school-roles.mjs";

export default function SchoolPortal({code}) {
 const [client,setClient]=useState(null);
 const [loading,setLoading]=useState(true);
 const [role,setRole]=useState("school_owner");
 const [access,setAccess]=useState(null);
 const [error,setError]=useState("");

 useEffect(()=>{
   const params=new URLSearchParams(window.location.search);
   const requested=params.get("role");
   setRole(validSchoolRole(requested)?requested:"school_owner");
   const c=browserSupabase();
   setClient(c);
   if(!c){setError("School authentication is not configured");setLoading(false);return;}
   let mounted=true;
   async function verify(){
     try{
       const {data:{session}}=await c.auth.getSession();
       if(!session){if(mounted){setAccess(null);setLoading(false);}return;}
       const response=await fetch("/api/school/"+code+"/access",{
         headers:{authorization:"Bearer "+session.access_token},cache:"no-store"
       });
       const data=await response.json();
       if(!response.ok)throw new Error(data.error||"School access check failed");
       if(mounted)setAccess(data);
     }catch(err){if(mounted)setError(err.message||"Unable to verify school access");}
     finally{if(mounted)setLoading(false);}
   }
   verify();
   return ()=>{mounted=false;};
 },[code]);

 const option=roleDetail(role)||SCHOOL_ROLES[0];
 const allowed=access?.roles?.includes(role)===true;
 const ownerPending=role==="school_owner"&&access?.ownerInvitePending===true;
 return <main className="school-role-landing">
   <section className="school-role-card">
     <a href={"/s/"+code} className="micro">← School homepage</a>
     <div className="row" style={{marginTop:20,marginBottom:16}}>
       <div className="site-icon" aria-hidden="true">{option.icon}</div>
       <div><h1 style={{fontSize:25}}>{access?.school?.name||"School Portal"}</h1>
         <span className="micro">{option.label} access</span></div>
     </div>
     {loading?<p className="muted">Checking your school's approved permissions…</p>:
       error?<div className="notice error" role="alert">{error}</div>:
       !access?<div className="notice info">Please sign in with your school's verified account before opening a workspace.
         <p><a className="button" href={"/s/"+code+"/login?role="+role}>Sign in as {option.label}</a></p>
       </div>:
       allowed?<div className="notice ok">
         <strong>Identity and school role verified.</strong>
         <p>{role==="school_owner"
           ?"You can continue your institution's setup and manage its website."
           :"Your school role is recognized. Its dedicated dashboard will open when that module has been released."}</p>
         {role==="school_owner"?<a className="button" href={"/s/"+code+"/setup"}>Open School Owner Setup</a>:
           <p><strong>Workspace under development.</strong> Classes, child records, fees and reports are not available through this placeholder.</p>}
       </div>:
       ownerPending?<div className="notice info">
         <strong>Your school-owner invitation is pending acceptance.</strong>
         <p>Accept the verified invitation to activate your owner membership.</p>
         <a className="button" href={"/s/"+code+"/setup"}>Accept school-owner invitation</a>
       </div>:
       <div className="notice error"><strong>This role is not approved for your account.</strong>
         <p>Choosing a role on a login screen does not give access. Contact your school administrator for a verified invitation and assignment.</p>
       </div>}
     <div className="school-role-switch">
       <h2>Choose your school role</h2>
       <p className="muted">This changes where you want to go; it never changes your permission.</p>
       <div className="school-role-options">
         {SCHOOL_ROLES.map(x=><a key={x.id}
           className={x.id===role?"school-role-choice selected":"school-role-choice"}
           href={schoolPortalPath(code,x.id)}>
           <span aria-hidden="true">{x.icon}</span><strong>{x.label}</strong>
         </a>)}
       </div>
     </div>
     <div className="row" style={{justifyContent:"space-between",marginTop:20}}>
       <a href={"/s/"+code+"/login"}>Back to school sign-in</a>
       {client&&<button className="button secondary small" onClick={async()=>{
         await client.auth.signOut();window.location.assign("/s/"+code+"/login");
       }}>Sign out / Switch account</button>}
     </div>
   </section>
 </main>;
}
