"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";

function TinyEmpty({text}){return <div className="learn-empty">{text}</div>}
export default function StudentLearning({code}){
 const [client,setClient]=useState(null),[ready,setReady]=useState(false),[session,setSession]=useState(null);
 const [view,setView]=useState("student"),[childId,setChildId]=useState(null);
 const [data,setData]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [writing,setWriting]=useState(null),[text,setText]=useState("");
 const [section,setSection]=useState("homework");
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const family=params.get("view")==="family";
  setView(family?"family":"student");
  setChildId(family?params.get("studentId"):null);
  const c=browserSupabase();setClient(c);
  if(!c){setReady(true);setLoading(false);return;}
  let alive=true;
  c.auth.getSession().then(({data})=>{if(alive){setSession(data.session);setReady(true);}});
  const {data:{subscription}}=c.auth.onAuthStateChange((_e,s)=>{if(alive)setSession(s);});
  return ()=>{alive=false;subscription.unsubscribe();};
 },[]);
 const request=useCallback(async(body)=>{
  if(!client)throw Error("School login is not configured");
  const {data:{session:current}}=await client.auth.getSession();
  if(!current)throw Error("Your school session expired. Sign in again");
  const query=view==="family"?"?view=family&studentId="+encodeURIComponent(childId||""):"?view=student";
  const res=await fetch("/api/school/"+code+"/learning"+query,{
   method:body?"POST":"GET",cache:"no-store",
   headers:{"Authorization":"Bearer "+current.access_token,
     ...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
  const response=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(response.error||"School learning request failed");
  return response;
 },[client,code,view,childId]);
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  try{setData(await request());}catch(e){setError(e.message);}
  finally{setLoading(false);}
 },[request]);
 useEffect(()=>{if(ready&&session&&view==="student"||ready&&session&&view==="family"&&childId)refresh();
   else if(ready&&!session)setLoading(false);
 },[ready,session?.user?.id,view,childId,refresh]);
 async function act(payload){
  setBusy(true);setError("");setNotice("");
  try{
   await request(payload);
   setNotice(payload.action==="student.claim"?"Your verified school account is now connected.":"Your homework response was saved.");
   setWriting(null);setText("");
   await refresh();
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 if(!ready||loading)return <main className="learn-loading">Opening your secure school learning portal…</main>;
 if(!session)return <main className="learn-loading"><h1>Sign in to your school</h1>
   <a className="button" href={"/s/"+code+"/login?role="+(view==="family"?"parent":"student")}>School Login</a></main>;
 if(error&&!data)return <main className="learn-loading"><h2>Learning access unavailable</h2><p role="alert">{error}</p>
  <a href={"/s/"+code+"/portal?role="+(view==="family"?"parent":"student")}>Back to School Portal</a></main>;
 if(!data)return <main className="learn-loading">Learning records are unavailable.</main>;
 const school=data.school;
 const family=view==="family";
 const hasAccess=family||data.accessReady;
 const tasks=data.homework||[],lessons=data.lessons||[],attendance=data.attendance||[],submissions=data.submissions||[];
 const subMap=new Map(submissions.map(s=>[s.homework_id,s]));
 const subjectName=(id)=>data.subjects?.find(s=>s.id===(data.assignments?.find(a=>a.id===id)?.subject_id))?.name||"Class subject";
 const tabs=["homework","lessons","attendance"];
 return <main className="learn-shell" style={{"--school-color":school.primaryColor||"#204a78"}}>
   <header className="learn-header"><a href={"/s/"+code}>School Homepage</a><div className="row" style={{gap:9,alignItems:"center"}}>{school.logoUrl&&<img src={school.logoUrl} alt={school.name+" official logo"} style={{height:42,width:42,objectFit:"contain"}}/>}<strong>{school.name}</strong></div>
     <div><a href={"/s/"+code+"/portal?role="+(family?"parent":"student")}>My Portal</a>
     {family&&<a href={"/s/"+code+"/family"}>My Children</a>}</div></header>
   <section className="learn-container">
     <div className="learn-head"><span>{family?"PARENT / GUARDIAN VIEW":"STUDENT LEARNING"}</span>
       <h1>{family?"My Child's Learning":"My Schoolwork"}</h1>
       <p>{family?"Read-only lesson, homework and attendance information for your verified child.":"Only work assigned to your own verified student account is shown."}</p>
     </div>
     {error&&<div className="notice error" role="alert">{error}</div>}
     {notice&&<div className="notice ok" role="status">{notice}</div>}
     {!hasAccess?<section className="learn-panel"><h2>School-approved account required</h2>
       <p>Student accounts are not created automatically. School staff must confirm that a guardian has authorized this account, and the student must sign in with the exact approved email.</p>
       {data.invitations?.map(inv=><div className="learn-invite" key={inv.student_id}><div>
         <strong>School invitation ready</strong><p>Identity hidden until confirmation. Expires {inv.expires_at?.slice(0,10)}.</p>
       </div><button className="button" disabled={busy} onClick={()=>act({action:"student.claim",studentId:inv.student_id,accepted:true})}>Accept Student Invitation</button></div>)}
       {!data.invitations?.length&&<TinyEmpty text="No approved invitation for this account. Ask your school to verify and invite you."/ >}
     </section>:<>
       <div className="learn-profile">
         <div className="learn-avatar" aria-hidden="true">🎓</div><div><small>{school.name} · {data.currentYear?.name||"Academic year not set"}</small>
           <h2>{data.student?.name||"School Student"}</h2>
           <p>{data.student?.studentCode||"Verified school account"} · {data.classRoom?data.classRoom.name+(data.classRoom.section?" · "+data.classRoom.section:""):"Class not assigned"}</p>
         </div>
       </div>
       <div className="learn-metrics"><div><small>Homework</small><strong>{tasks.length}</strong><span>Current-year tasks</span></div>
         <div><small>Lessons</small><strong>{lessons.length}</strong><span>Published by teachers</span></div>
         <div><small>Attendance entries</small><strong>{attendance.length}</strong><span>Recent records</span></div></div>
       {!data.classRoom&&<div className="notice info">Your school has not yet set an active enrollment in its current academic year.</div>}
       <nav className="learn-tabs" aria-label="Learning sections">{tabs.map(t=><button key={t} className={section===t?"selected":""} onClick={()=>setSection(t)}>{t==="homework"?"Homework":t==="lessons"?"Lessons & Curriculum":"Attendance"}</button>)}</nav>
       {section==="homework"&&<section className="learn-panel"><h2>{family?"Assigned Homework":"My Homework"}</h2>
         {tasks.map(h=><article className="learn-task" key={h.id}><div><strong>{h.title}</strong>
           <span className="learn-due">Due {h.due_on}</span></div><p>{h.instructions}</p>
           {!family&&<div className="learn-task-footer"><span>{subMap.has(h.id)?"Submitted":"Not submitted"}</span>
             <button className="button secondary small" disabled={busy||h.due_on<new Date().toLocaleDateString("sv-SE",{timeZone:"Africa/Kigali"})} onClick={()=>{setWriting(h.id);setText(subMap.get(h.id)?.response_text||"");}}>{subMap.has(h.id)?"Edit Response":"Submit Response"}</button></div>}
           {!family&&writing===h.id&&<form onSubmit={e=>{e.preventDefault();act({action:"homework.submit",homeworkId:h.id,responseText:text});}} className="learn-response">
             <label>My answer<textarea required maxLength={5000} className="input" rows={5} value={text} onChange={e=>setText(e.target.value)}/></label>
             <div className="row"><button type="submit" disabled={busy} className="button">Submit homework</button>
               <button type="button" className="button secondary" onClick={()=>{setWriting(null);setText("");}}>Cancel</button></div>
           </form>}
         </article>)}
         {!tasks.length&&<TinyEmpty text="No homework has been published for your current class yet."/>}
       </section>}
       {section==="lessons"&&<section className="learn-panel"><h2>My Lessons</h2>
         {lessons.map(l=><article className="learn-task" key={l.id}><div><strong>{l.title}</strong><span>{l.lesson_on}</span></div>
           <p>{l.content}</p></article>)}
         {!lessons.length&&<TinyEmpty text="Your teachers have not published lessons here yet."/>}
         <p className="micro">Formal full curriculum maps and daily timetables will follow in a dedicated academic scheduling module.</p>
       </section>}
       {section==="attendance"&&<section className="learn-panel"><h2>School Attendance</h2>
         <div className="table-wrap"><table><thead><tr><th>Date</th><th>Attendance</th></tr></thead><tbody>
           {attendance.map(a=><tr key={a.id}><td>{a.attendance_on}</td><td><strong>{a.state}</strong></td></tr>)}
         </tbody></table></div>{!attendance.length&&<TinyEmpty text="Your teacher has not entered attendance records for this year yet."/>}
         <p className="micro">Attendance questions or corrections should be reviewed by your school.</p>
       </section>}
       {data.limited&&<p className="micro">This view shows only recent records; pagination will be added before large-school release.</p>}
     </>}
     <footer className="learn-footer">School-specific, verified access · No public child records · School fee balances, report cards, grading and teacher messages are future modules.</footer>
   </section>
 </main>;
}
