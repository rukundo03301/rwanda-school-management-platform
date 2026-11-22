"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
function datetime(value){return new Date(value).toLocaleString("en-RW",
 {timeZone:"Africa/Kigali",year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});}
export default function LearningDashboard({code}){
 const [client,setClient]=useState(null),[session,setSession]=useState(null),[ready,setReady]=useState(false);
 const [parent,setParent]=useState(false),[studentId,setStudentId]=useState("");
 const [data,setData]=useState(null),[invites,setInvites]=useState([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[response,setResponse]=useState({}),[tab,setTab]=useState("homework");
 useEffect(()=>{
  const qs=new URLSearchParams(window.location.search);
  setParent(qs.get("as")==="parent");setStudentId(qs.get("studentId")||"");
  const c=browserSupabase();setClient(c);
  if(!c){setReady(true);setLoading(false);return;}
  let mounted=true;
  c.auth.getSession().then(({data:r})=>{if(mounted){setSession(r.session);setReady(true);}});
  const {data:{subscription}}=c.auth.onAuthStateChange((_event,s)=>{if(mounted)setSession(s);});
  return ()=>{mounted=false;subscription.unsubscribe();};
 },[]);
 const fetchApi=useCallback(async(path,body)=>{
  const {data:{session:s}}=await client.auth.getSession();
  if(!s)throw Error("Sign in with your school-approved account");
  const res=await fetch(path,{method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+s.access_token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
  const json=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(json.error||"Cannot access school learning");
  return json;
 },[client]);
 const learningUrl="/api/school/"+code+"/learning"+(parent?"?as=parent&studentId="+encodeURIComponent(studentId):"");
 const load=useCallback(async()=>{
  if(!ready||!session||!client)return;
  setLoading(true);setError("");
  try{
   if(!parent){const i=await fetchApi("/api/school/"+code+"/student-access");setInvites(i.approvedInvites||[]);}
   setData(await fetchApi(learningUrl));
  }catch(e){setError(e.message);}
  finally{setLoading(false);}
 },[ready,session?.user?.id,client,parent,studentId,fetchApi,learningUrl]);
 useEffect(()=>{if(ready&&session&&client&&(parent?!!studentId:true))load();
  else if(ready)setLoading(false);},[ready,session?.user?.id,client,parent,studentId,load]);
 async function claimStudent(id){
  setBusy(true);setError("");
  try{
   await fetchApi("/api/school/"+code+"/student-access",{action:"student.claim",studentId:id,accepted:true});
   setInvites([]);setNotice("Your verified student account is active.");await load();
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 async function submit(h){
  setBusy(true);setError("");setNotice("");
  try{
   await fetchApi(learningUrl,{action:"homework.submit",homeworkId:h.id,responseText:response[h.id]||""});
   setNotice("Homework response submitted to your school.");await load();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 if(!ready||loading)return <main className="school-admin-loading">Opening your private learning record…</main>;
 if(!session)return <main className="school-admin-loading"><h2>School Account Required</h2>
  <p>Student accounts are issued by the school. Parents must use their verified family account.</p>
  <a className="button" href={"/s/"+code+"/login?role="+(parent?"parent":"student")}>School Sign-in</a></main>;
 if(!data)return <main className="tl-shell"><div className="tl-container">
  <a href={"/s/"+code+"/portal?role="+(parent?"parent":"student")}>← School Portal</a>
  <h1>{parent?"Child learning access":"My Student Account"}</h1>
  {error&&<div className="notice error" role="alert">{error}</div>}
  {!parent&&invites.length>0?<section className="tl-panel"><h2>Your approved school invitation</h2>
    <p>Your school and, where required, your verified guardian have approved your student account. Accept it to see only your own learning records.</p>
    {invites.map(i=><button key={i.studentId} disabled={busy} className="button"
      onClick={()=>claimStudent(i.studentId)}>Accept my school student account</button>)}
  </section>:<div className="tl-panel"><h2>Access not yet approved</h2>
   <p>{parent?"Your parent account must be linked to this exact child by the school.":"Ask your school for an approved student invitation. Minors require verified guardian approval."}</p>
  </div>}
 </div></main>;
 const canSubmit=parent||data.role==="student";
 return <main className="tl-shell">
  <header className="tl-header"><a href={"/s/"+code+"/portal?role="+(parent?"parent":"student")}>← School Portal</a>
    <strong>{data.school.name}</strong><span>{parent?"Parent View":"Student View"}</span></header>
  <div className="tl-container">
   <p className="micro">{parent?"VERIFIED GUARDIAN · LINKED CHILD ONLY":"VERIFIED STUDENT · OWN RECORD ONLY"}</p>
   <h1>{parent?data.student.name+"'s Learning":"My Learning"}</h1>
   <p className="muted"><b>{data.student.code}</b> · {data.classInfo?.name||"No current-year class"}
     {data.classInfo?.section?" · "+data.classInfo.section:""}</p>
   {error&&<div className="notice error" role="alert">{error}</div>}
   {notice&&<div className="notice ok" role="status">{notice}</div>}
   <div className="tl-statrow"><div><small>Current academic year</small><strong>{data.classInfo?.academicYear||"Not set"}</strong></div>
      <div><small>Published homework loaded</small><strong>{data.homework.length}</strong></div>
      <div><small>Attendance entries loaded</small><strong>{data.attendance.length}</strong></div>
   </div>
   <div className="tl-tabs">{[["homework","Homework"],["attendance","Attendance"],["curriculum","My Curriculum"]].map(([value,label])=>
    <button key={value} className={tab===value?"active":""} onClick={()=>setTab(value)}>{label}</button>)}</div>
   {tab==="homework"&&<div className="tl-panel"><h2>{parent?"Your child's homework":"My homework"}</h2>
    {data.homework.map(h=>{const due=new Date(h.dueAt).getTime()>Date.now();return <article className="tl-entry" key={h.id}>
      <div className="tl-itemtop"><strong>{h.title}</strong><small>{h.subject}</small></div>
      <p className="muted">Due: {datetime(h.dueAt)} {due?"":"· Deadline passed"}</p>
      <p>{h.instructions}</p>
      {h.submission?<div className="notice ok"><b>Submitted</b><p>{h.submission.response_text}</p>
        <small>Last submitted: {datetime(h.submission.submitted_at)}</small></div>:null}
      {canSubmit&&due&&<div className="tl-response">
       <label className="field">{parent?"Response on behalf of this child":"My response"}
        <textarea className="input" rows={3} maxLength={5000}
        value={response[h.id]??h.submission?.response_text??""}
        onChange={e=>setResponse(old=>({...old,[h.id]:e.target.value}))}/></label>
       <button className="button" disabled={busy||!(response[h.id]??h.submission?.response_text??"").trim()}
        onClick={()=>submit(h)}>{h.submission?"Update submission":"Submit homework"}</button>
      </div>}
     </article>})}
    {!data.homework.length&&<p className="muted">No published homework is assigned to this student's current class.</p>}
   </div>}
   {tab==="attendance"&&<div className="tl-panel"><h2>School attendance</h2>
     <p className="muted">Only attendance recorded for this student's current-year enrollment is shown.</p>
     <div className="table-wrap"><table><thead><tr><th>Date</th><th>Attendance</th></tr></thead><tbody>
      {data.attendance.map(a=><tr key={a.attendance_on}><td>{a.attendance_on}</td>
       <td><span className="tl-attendance-state">{a.attendance_status}</span></td></tr>)}
     </tbody></table></div>
     {!data.attendance.length&&<p>No attendance has been recorded yet.</p>}
   </div>}
   {tab==="curriculum"&&<div className="tl-panel"><h2>Current class and subjects</h2>
     <p>{data.classInfo?.name||"School has not assigned a current class."}</p>
     <p className="muted">These are the subjects configured by your school for your current class. A complete timetable and detailed syllabus will follow in the academic-calendar module.</p>
     <div className="tl-subjectchips">{(data.curriculum||[]).map(s=><span key={s.code}>{s.code} · {s.name}</span>)}</div>
     {!(data.curriculum||[]).length&&<p className="muted">No class subjects have been configured yet.</p>}
   </div>}
   <p className="micro">No unapproved student, grade, other family's records, or platform-owner payment information is shown.</p>
  </div>
 </main>;
}
