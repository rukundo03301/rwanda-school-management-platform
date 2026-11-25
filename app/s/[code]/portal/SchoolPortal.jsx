"use client";
import {useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
import {SCHOOL_ROLES,validSchoolRole,roleDetail,schoolPortalPath,approvedSchoolRoles,resolveSchoolRole,schoolWorkspacePath} from "../../../../lib/school-roles.mjs";

export default function SchoolPortal({code}) {
 const [client,setClient]=useState(null);
 const [loading,setLoading]=useState(true);
 const [role,setRole]=useState(null);
 const [access,setAccess]=useState(null);
 const [error,setError]=useState("");
 const [pendingRoles,setPendingRoles]=useState([]);
 const [claimBusy,setClaimBusy]=useState(false);

 useEffect(()=>{
   const params=new URLSearchParams(window.location.search);
   const requested=params.get("role");
   // URL role is a hint, never authorization; the server supplies approved roles.
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
       const invitationRes=await fetch("/api/school/"+code+"/invitation",{
         headers:{authorization:"Bearer "+session.access_token},cache:"no-store"
       });
       let invited=[];
       if(invitationRes.ok){
         const pending=await invitationRes.json();
         invited=(pending.roles||[]).filter(validSchoolRole);
         if(mounted)setPendingRoles(invited);
       }
       const assigned=approvedSchoolRoles(data.roles);
       const chosen=resolveSchoolRole(assigned,requested);
       if(mounted){setAccess(data);setRole(chosen||(!assigned.length?(data.ownerInvitePending?"school_owner":invited[0]||null):null));}
       // A single approved role goes directly to the corresponding actual dashboard.
       // Multi-role accounts must choose among ONLY their verified roles.
       if(chosen&&mounted){
         let destination=chosen==="school_owner"&&data.school.status==="onboarding"?"/s/"+code+"/setup":schoolWorkspacePath(code,chosen);
     // Owners, principals and school staff start on their own dashboard.
     if(chosen==="school_admin"||chosen==="staff"||(chosen==="school_owner"&&data.school.status!=="onboarding"))destination="/s/"+code+"/home";
         window.location.replace(destination);
       }
     }catch(err){if(mounted)setError(err.message||"Unable to verify school access");}
     finally{if(mounted)setLoading(false);}
   }
   verify();
   return ()=>{mounted=false;};
 },[code]);

 async function claimStaffInvitation(){
   if(!client)return;
   setClaimBusy(true);setError("");
   try{
     const {data:{session}}=await client.auth.getSession();
     if(!session)throw Error("Sign in to accept your school invitation");
     const headers={authorization:"Bearer "+session.access_token,"Content-Type":"application/json"};
     const accepted=await fetch("/api/school/"+code+"/invitation",{
       method:"POST",headers,body:JSON.stringify({action:"claim",role})
     });
     const output=await accepted.json().catch(()=>({}));
     if(!accepted.ok)throw Error(output.error||"Could not claim school role");
     const response=await fetch("/api/school/"+code+"/access",{
       headers:{authorization:"Bearer "+session.access_token},cache:"no-store"
     });
     const accessResult=await response.json();
     if(!response.ok)throw Error(accessResult.error||"Could not verify new access");
     setAccess(accessResult);setPendingRoles(previous=>previous.filter(x=>x!==role));
   }catch(e){setError(e.message||"Invitation claim failed");}
   finally{setClaimBusy(false);}
 }
 const option=roleDetail(role);
 const authorized=approvedSchoolRoles(access?.roles);
 const allowed=access?.roles?.includes(role)===true;
 const ownerPending=role==="school_owner"&&access?.ownerInvitePending===true;
 const staffInvitePending=role!=="school_owner"&&pendingRoles.includes(role);
 return <main className="school-role-landing">
   <section className="school-role-card">
     <a href={"/s/"+code} className="micro">← School homepage</a>
     <div className="row" style={{marginTop:20,marginBottom:16}}>
       <div className="site-icon" aria-hidden="true">{option?.icon||"🏫"}</div>
       <div><h1 style={{fontSize:25}}>{access?.school?.name||"School Portal"}</h1>
         <span className="micro">{option?.label||"Verified school membership"}</span></div>
     </div>
     {loading?<p className="muted">Checking your school's approved permissions…</p>:
       error?<div className="notice error" role="alert">{error}</div>:
       !access?<div className="notice info">Please sign in with your school's verified account before opening a workspace.
         <p><a className="button" href={"/s/"+code+"/login"}>Sign in to your school</a></p>
       </div>:
       authorized.length>1&&!role?<div className="notice info"><strong>You have more than one approved role.</strong><p>Choose the workspace assigned to you by this school.</p><div className="school-role-options">{authorized.map(r=><a key={r} className="school-role-choice" href={schoolPortalPath(code,r)}><span aria-hidden="true">{roleDetail(r)?.icon}</span><strong>{roleDetail(r)?.label}</strong></a>)}</div></div>:
       allowed?<div className="notice ok">
         <strong>Identity and school role verified.</strong>
         <p>{role==="school_owner"
           ?"Your school's management and website setup are available."
           :role==="school_admin"
             ?"Your administrator role has been verified. Your permissions are enforced on every school-management request."
             :role==="teacher"?"Your teaching workspace is ready for your approved class assignments.":
              role==="student"?"Your school-approved learning account can access its own classwork.":
              "Your role is recognized. Open School Notices and Calendar to get started."}</p>
         {role==="school_owner"?<div className="row">
           <a className="button" href={"/s/"+code+"/admin"}>Open School Administration</a>
           <a className="button secondary" href={"/s/"+code+"/setup"}>Manage School Website</a>
           <a className="button secondary" href={"/s/"+code+"/classroom"}>Manage Classrooms</a>
           <a className="button secondary" href={"/s/"+code+"/reports"}>Curriculum & Reports</a>
           <a className="button secondary" href={"/s/"+code+"/communications"}>School Community</a>
           <a className="button secondary" href={"/s/"+code+"/fees"}>School Fees & RWF Finance</a>
<a className="button secondary" href={"/s/"+code+"/security"}>Two-step verification</a>
         </div>:role==="school_admin"?<div className="row">
            <a className="button" href={"/s/"+code+"/admin"}>Open Administrator Dashboard</a>
            <a className="button secondary" href={"/s/"+code+"/reports"}>Curriculum & Reports (if authorized)</a>
            <a className="button secondary" href={"/s/"+code+"/communications"}>School Communications</a>
            <a className="button secondary" href={"/s/"+code+"/fees"}>School Finances (if authorized)</a>
<a className="button secondary" href={"/s/"+code+"/security"}>Two-step verification</a>
           </div>:
           role==="parent"?<div className="row">
            <a className="button" href={"/s/"+code+"/family"}>See My Verified Children</a>
            <a className="button secondary" href={"/s/"+code+"/report-card"}>Approved School Reports</a>
            <a className="button secondary" href={"/s/"+code+"/communications"}>Family Timetable & Messages</a>
            <a className="button secondary" href={"/s/"+code+"/fees"}>My Children's School Fees</a>
           </div>:
           role==="teacher"?<div className="row">
            <a className="button" href={"/s/"+code+"/classroom"}>Open My Teaching Workspace</a>
            <a className="button secondary" href={"/s/"+code+"/reports"}>Enter Assessment Marks</a>
            <a className="button secondary" href={"/s/"+code+"/communications"}>Timetable & Parent Messages</a>
           </div>:
           role==="student"?<div className="row">
            <a className="button" href={"/s/"+code+"/learning"}>Open My Learning Workspace</a>
            <a className="button secondary" href={"/s/"+code+"/report-card"}>View Approved Reports</a>
            <a className="button secondary" href={"/s/"+code+"/communications"}>Class Timetable & Announcements</a>
           </div>:
           <div><a className="button" href={"/s/"+code+"/communications"}>School Notices and Calendar</a>
            <a className="button secondary" href={"/s/"+code+"/fees"}>RWF Financial Workspace (if authorized)</a>
            <a className="button secondary" href={"/s/"+code+"/operations"}>Operations, Stock & Board</a></div>}
       </div>:
       staffInvitePending?<div className="notice info">
         <strong>Verified school invitation available</strong>
         <p>Your school invited you as {option?.label}. This invitation is tied to your verified email address, not the role button you clicked.</p>
         <button className="button" disabled={claimBusy} onClick={claimStaffInvitation}>
           {claimBusy?"Verifying…":"Accept "+option?.label+" invitation"}
         </button>
       </div>:
       ownerPending?<div className="notice info">
         <strong>Your school-owner invitation is pending acceptance.</strong>
         <p>Accept the verified invitation to activate your owner membership.</p>
         <a className="button" href={"/s/"+code+"/setup"}>Accept school-owner invitation</a>
       </div>:
       <div className="notice error"><strong>This role is not approved for your account.</strong>
         <p>Choosing a role on a login screen does not give access. Contact your school administrator for a verified invitation and assignment.</p>
         {role==="parent"&&<p><a className="button secondary" href={"/s/"+code+"/family"}>Check My Family Invitation</a></p>}
         {role==="student"&&<p><a className="button secondary" href={"/s/"+code+"/learning"}>Check My Student Invitation</a></p>}
       </div>}
     {authorized.length>1&&<div className="school-role-switch">
       <h2>My approved school roles</h2>
       <p className="muted">Only roles assigned by your school administrator appear here.</p>
       <div className="school-role-options">
         {authorized.map(id=><a key={id}
           className={id===role?"school-role-choice selected":"school-role-choice"}
           href={schoolPortalPath(code,id)}>
           <span aria-hidden="true">{roleDetail(id)?.icon}</span><strong>{roleDetail(id)?.label}</strong>
         </a>)}
       </div>
     </div>}
     <div className="row" style={{justifyContent:"space-between",marginTop:20}}>
       <a href={"/s/"+code+"/login"}>Back to school sign-in</a>
       {client&&<button className="button secondary small" onClick={async()=>{
         await client.auth.signOut();window.location.assign("/s/"+code+"/login");
       }}>Sign out / Switch account</button>}
     </div>
   </section>
 </main>;
}
