"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";

export default function FamilyDashboard({code}){
 const [client,setClient]=useState(null),[ready,setReady]=useState(false),[session,setSession]=useState(null);
 const [data,setData]=useState(null),[loading,setLoading]=useState(true),[claiming,setClaiming]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
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
   try{setData(await call());setError("");}catch(e){setError(e.message);}
   finally{setLoading(false);}
 },[call]);
 useEffect(()=>{if(ready&&session)refresh();else if(ready)setLoading(false);},[ready,session?.user?.id,refresh]);
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
     {data.children.length>0&&<div style={{display:"grid",gap:12,gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",margin:"16px 0"}}>
       <section className="adm-panel"><strong style={{fontSize:28}}>{data.children.length}</strong><p className="micro">Children at this school</p></section>
       <section className="adm-panel"><strong style={{fontSize:28}}>{data.children.reduce((n,c)=>n+(c.homework||[]).filter(h=>!h.submittedAt).length,0)}</strong><p className="micro">Homework not yet submitted</p></section>
       <section className="adm-panel"><strong style={{fontSize:28}}>{(()=>{const r=data.children.reduce((n,c)=>n+(c.attendance?.recorded||0),0);const p=data.children.reduce((n,c)=>n+(c.attendance?.present||0)+(c.attendance?.late||0),0);return r?Math.round(100*p/r)+"%":"—";})()}</strong><p className="micro">Days attended (present or late)</p></section>
       <section className="adm-panel"><strong style={{fontSize:28}}>{data.children.reduce((n,c)=>n+(c.homework||[]).filter(h=>h.score!==null&&h.score!==undefined).length,0)}</strong><p className="micro">Homework graded</p></section>
     </div>}
     <section className="adm-panel"><h2>My linked children</h2>
       {data.children.length?<div className="adm-family-cards">{data.children.map(child=><article className="adm-family-child" key={child.id}>
         <div className="adm-child-avatar">🎓</div><div><h3>{child.name}</h3><p><strong>Student ID:</strong> {child.studentCode}</p>
         <p><strong>My relationship:</strong> {child.relationship==="legal_guardian"?"Legal guardian":"Parent"}</p>
         <p><strong>Current class:</strong> {child.className||"Not assigned"}</p>
         <p><strong>Attendance:</strong> {child.attendance?.recorded?child.attendance.present+" present, "+child.attendance.absent+" absent, "+child.attendance.late+" late out of "+child.attendance.recorded+" days recorded":"Not recorded yet"}</p>
         <p><strong>Homework</strong></p>
         {child.homework?.length?<ul className="adm-child-homework">{child.homework.map(h=><li key={h.id}><strong>{h.title}</strong>{h.subject?" · "+h.subject:""}<br/><span className="micro">{h.dueAt?"Due "+new Date(h.dueAt).toLocaleDateString():"No due date"} · {h.submittedAt?(h.isLate?"Submitted late":"Submitted"):"Not submitted"}{h.score!==null&&h.maxScore!==null?" · Grade "+h.score+"/"+h.maxScore:""}</span>{h.feedback&&<span className="micro"><br/>Teacher feedback: {h.feedback}</span>}</li>)}</ul>:<p className="micro">No homework published for this class yet.</p>}
         </div></article>)}</div>:
         <div className="adm-empty"><strong>No linked children yet</strong><p>If your school has already verified your relationship, ask it to invite your confirmed email address. Your child will appear only after you accept the invitation.</p></div>}
     </section>
     <div className="adm-family-next"><strong>Your daily school dashboard</strong>
       <p>View your linked children's homework deadlines, school-recorded attendance, class timetable, events, approved announcements and private teacher conversations in the new School Community workspace. School fees and payment references are available in the separate RWF finance workspace.</p>
       <a className="button" href={"/s/"+code+"/communications"}>Open My Family School Day</a>
     </div>
     <div className="row">
      <a className="button secondary" href={"/s/"+code+"/report-card"}>View Approved Child Reports</a>
      {code==="RW-SCH-000004"&&<a className="button secondary" href={"/s/"+code+"/resources"}>Family Learning Resources</a>}
      <a className="button secondary" href={"/s/"+code+"/communications"}>Messages & School Timetable</a>
      <a className="button secondary" href={"/s/"+code+"/fees"}>My Children's School Fees</a>
      <a href={"/s/"+code+"/portal?role=parent"}>Return to Parent Portal</a>
     </div>
   </div>
 </main>;
}
