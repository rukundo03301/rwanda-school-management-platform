"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";

export default function FamilyDashboard({code}){
 const [client,setClient]=useState(null),[ready,setReady]=useState(false),[session,setSession]=useState(null);
 const [data,setData]=useState(null),[loading,setLoading]=useState(true),[claiming,setClaiming]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [accessRequests,setAccessRequests]=useState([]);
 useEffect(()=>{
   const c=browserSupabase();setClient(c);
   if(!c){setReady(true);setLoading(false);return;}
   let mounted=true;
   c.auth.getSession().then(({data})=>{if(mounted){setSession(data.session);setReady(true);}});
   const {data:{subscription}}=c.auth.onAuthStateChange((_e,s)=>{if(mounted)setSession(s);});
   return ()=>{mounted=false;subscription.unsubscribe();};
 },[]);
 const call=useCallback(async(body)=>{
   if(!client)throw Error("School sign-in is not configured");
   const {data:{session:s}}=await client.auth.getSession();
   if(!s)throw Error("Your school sign-in has expired");
   const response=await fetch("/api/school/"+code+"/family",{
     method:body?"POST":"GET",cache:"no-store",
     headers:{Authorization:"Bearer "+s.access_token,...(body?{"Content-Type":"application/json"}:{})},
     ...(body?{body:JSON.stringify(body)}:{})
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||"Cannot load family details");
   return result;
 },[client,code]);
 const refresh=useCallback(async()=>{
   setLoading(true);
   try{
     const d=await call();setData(d);
     const {data:{session:s}}=await client.auth.getSession();
     const res=await fetch("/api/school/"+code+"/student-access",{
       headers:{Authorization:"Bearer "+s.access_token},cache:"no-store"
     });
     if(res.ok){const a=await res.json();setAccessRequests(a.guardianApprovals||[]);}
     setError("");
   }catch(e){setError(e.message);}
   finally{setLoading(false);}
 },[call]);
 useEffect(()=>{if(ready&&session)refresh();else if(ready)setLoading(false);},[ready,session?.user?.id,refresh]);
 async function approveStudentAccount(studentId){
   setClaiming(true);setError("");setNotice("");
   try{
     const {data:{session:s}}=await client.auth.getSession();
     if(!s)throw Error("Sign in to approve student account");
     const response=await fetch("/api/school/"+code+"/student-access",{
       method:"POST",headers:{Authorization:"Bearer "+s.access_token,"Content-Type":"application/json"},
       body:JSON.stringify({action:"guardian.approve",studentId,consent:true})
     });
     const result=await response.json().catch(()=>({}));
     if(!response.ok)throw Error(result.error||"Could not approve account");
     setNotice("Student portal access approved for this child. The student may now claim it using the invited verified email.");
     setAccessRequests(v=>v.filter(x=>x.studentId!==studentId));
   }catch(e){setError(e.message);}
   finally{setClaiming(false);}
 }
 async function accept(studentId){
   setClaiming(true);setError("");setNotice("");
   try{
     await call({action:"claim",studentId,accepted:true});
     setNotice("Your verified school-family connection is now active.");
     await refresh();
   }catch(e){setError(e.message);}
   finally{setClaiming(false);}
 }
 if(!ready||loading)return <main className="school-admin-loading">Checking your school-family connections…</main>;
 if(!session)return <main className="school-admin-loading"><h1>Parent / Guardian Sign-in</h1>
   <p>Only your school's verified parent account can view a linked child.</p>
   <a className="button" href={"/s/"+code+"/login?role=parent"}>Go to School Login</a></main>;
 if(error&&!data)return <main className="school-admin-loading"><h2>Family access unavailable</h2><p role="alert">{error}</p>
   <a href={"/s/"+code+"/login?role=parent"}>Return to login</a></main>;
 if(!data)return <main className="school-admin-loading">No family records are available.</main>;
 return <main className="adm-family">
   <header className="adm-family-header"><a href={"/s/"+code}>School Homepage</a><span>Private Family Portal</span>
     <button className="button secondary small" onClick={async()=>{await client.auth.signOut();window.location.assign("/s/"+code+"/login?role=parent");}}>Sign out</button></header>
   <div className="adm-family-content">
     <p className="adm-eyebrow">PARENT / GUARDIAN · VERIFIED SCHOOL ACCESS</p>
     <h1>{data.school.name}</h1><p className="muted">Your family's school connection is protected. Only children officially linked by the school appear here.</p>
     {error&&<div className="notice error" role="alert">{error}</div>}
     {notice&&<div className="notice ok" role="status">{notice}</div>}
     {data.invitations.length>0&&<section className="adm-panel"><h2>School connection invitations</h2>
       <p className="muted">Your verified email has been invited by the school. Accept only if the school has confirmed your relationship with this child.</p>
       {data.invitations.map(i=><div key={i.studentId} className="adm-family-invite"><div>
         <strong>{i.relationship==="legal_guardian"?"Legal guardian":"Parent"} invitation</strong>
         <p className="micro">The child's identity is hidden until you accept the verified link. Invitation expires {i.expiresAt?.slice(0,10)}.</p>
       </div><button className="button" disabled={claiming} onClick={()=>accept(i.studentId)}>{claiming?"Checking…":"Accept family link"}</button></div>)}
     </section>}
     {accessRequests.length>0&&<section className="adm-panel"><h2>Approve student account access</h2>
       <p className="muted">Your school requested an independent login for the student. Only approve if you recognize the requested student email and consent to the student having personal school access.</p>
       {accessRequests.map(a=><div className="adm-family-invite" key={a.studentId}>
         <div><strong>Student portal request</strong><p className="micro">Student email: {a.studentEmail}</p>
           <p className="micro">Expires: {a.expiresAt?.slice(0,10)}</p></div>
         <button className="button" disabled={claiming} onClick={()=>approveStudentAccount(a.studentId)}>Approve this student account</button>
       </div>)}
     </section>}
     <section className="adm-panel"><h2>My linked children</h2>
       {data.children.length?<div className="adm-family-cards">{data.children.map(child=><article className="adm-family-child" key={child.id}>
         <div className="adm-child-avatar">🎓</div><div><h3>{child.name}</h3><p><strong>Student ID:</strong> {child.studentCode}</p>
         <p><strong>My relationship:</strong> {child.relationship==="legal_guardian"?"Legal guardian":"Parent"}</p>
         <p><strong>Current class:</strong> {child.className||"Not assigned"}</p>
         <a className="button secondary small" href={"/s/"+code+"/learning?as=parent&studentId="+encodeURIComponent(child.id)}>View homework &amp; attendance</a>
         </div></article>)}</div>:
         <div className="adm-empty"><strong>No linked children yet</strong><p>If your school has already verified your relationship, ask it to invite your confirmed email address. Your child will appear only after you accept the invitation.</p></div>}
     </section>
     <div className="adm-family-next"><strong>Coming in future student and parent modules</strong><p>Homework and recorded attendance are now available through each verified child’s learning page. Tuition balances, graded reports, full timetables and teacher messaging remain separate future modules.</p></div>
     <a href={"/s/"+code+"/portal?role=parent"}>Return to Parent Portal</a>
   </div>
 </main>;
}
