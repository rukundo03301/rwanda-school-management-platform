"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";

export default function TeachingAdmin({code}){
 const [client,setClient]=useState(null),[session,setSession]=useState(null);
 const [data,setData]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [assignment,setAssignment]=useState({teacherId:"",classId:"",subjectId:""});
 const [student,setStudent]=useState({studentId:"",email:""});
 useEffect(()=>{
  const c=browserSupabase();setClient(c);if(!c){setLoading(false);return;}
  c.auth.getSession().then(({data})=>setSession(data.session));
  const {data:{subscription}}=c.auth.onAuthStateChange((_event,s)=>setSession(s));
  return ()=>subscription.unsubscribe();
 },[]);
 const request=useCallback(async(body)=>{
  const {data:{session:s}}=await client.auth.getSession();
  if(!s)throw Error("Sign in to your school first");
  const res=await fetch("/api/school/"+code+"/teaching",{
   method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+s.access_token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
  const json=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(json.error||"Teaching setup unavailable");
  return json;
 },[client,code]);
 const reload=useCallback(async()=>{if(!client||!session)return;setLoading(true);
  try{setData(await request());setError("");}catch(e){setError(e.message);}
  finally{setLoading(false);}
 },[client,session?.user?.id,request]);
 useEffect(()=>{if(client&&session)reload();else if(client)setLoading(false);},[client,session?.user?.id,reload]);
 async function execute(body){
  setBusy(true);setError("");setNotice("");
  try{
   const response=await request(body);
   setNotice(body.action==="student.invite"
     ?response.result?.status==="awaiting_guardian"
       ?"Student account request saved. A verified guardian must approve before the student can sign in."
       :"Adult student invitation approved. Email delivery depends on configured provider."
     :"Assignment saved with school-level authorization.");
   await reload();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 if(!client||loading)return <main className="school-admin-loading">Opening teaching setup…</main>;
 if(!session)return <main className="school-admin-loading"><h2>School sign-in required</h2><a href={"/s/"+code+"/login?role=school_admin"}>Sign in</a></main>;
 if(!data)return <main className="school-admin-loading"><h2>Teaching setup unavailable</h2><p>{error}</p><a href={"/s/"+code+"/admin"}>Back to School Administration</a></main>;
 const validSubjects=data.classSubjects.filter(p=>p.class_id===assignment.classId);
 const selected=data.assignments.filter(a=>a.active);
 const teacher=(id)=>data.teachers.find(t=>t.auth_user_id===id)?.email||("Verified teacher "+id.slice(0,8));
 const cls=(id)=>data.classes.find(c=>c.id===id);
 const subject=(id)=>data.subjects.find(s=>s.id===id)?.name||"Subject";
 return <main className="tl-shell" style={{"--school-color":"#204a78"}}>
  <header className="tl-header"><a href={"/s/"+code+"/admin"}>← School Administration</a><strong>{data.school.name}</strong><span>Teaching Setup</span></header>
  <div className="tl-container"><p className="micro">SCHOOL MODULE 4</p><h1>Teaching & Class Assignments</h1>
   <p className="muted">Only verified school academic managers can assign teachers. Teachers see only the classes and subjects assigned here.</p>
   {error&&<div className="notice error" role="alert">{error}</div>}
   {notice&&<div className="notice ok" role="status">{notice}</div>}
   <div className="tl-grid">
    <section className="tl-panel"><h2>Assign a teacher</h2><p className="muted">Teachers must first accept their school-specific staff invitations.</p>
     <label className="field">Verified teacher<select className="input" value={assignment.teacherId} onChange={e=>setAssignment({...assignment,teacherId:e.target.value})}>
      <option value="">Choose teacher</option>{data.teachers.map(t=><option key={t.auth_user_id} value={t.auth_user_id}>{teacher(t.auth_user_id)}</option>)}
     </select></label>
     <label className="field">Class<select className="input" value={assignment.classId} onChange={e=>setAssignment({...assignment,classId:e.target.value,subjectId:""})}>
      <option value="">Choose class</option>{data.classes.map(c=><option key={c.id} value={c.id}>{c.name} {c.section}</option>)}</select></label>
     <label className="field">Subject<select className="input" value={assignment.subjectId} onChange={e=>setAssignment({...assignment,subjectId:e.target.value})}>
      <option value="">Choose subject assigned to this class</option>{validSubjects.map(c=><option key={c.subject_id} value={c.subject_id}>{subject(c.subject_id)}</option>)}</select></label>
     <button className="button" disabled={busy||!assignment.teacherId||!assignment.classId||!assignment.subjectId}
      onClick={()=>execute({action:"teacher.assign",...assignment})}>Assign with MFA</button>
    </section>
    <section className="tl-panel"><h2>Existing class assignments</h2>
     {!selected.length?<p className="muted">No teachers have been assigned yet.</p>:
     <div className="table-wrap"><table><thead><tr><th>Teacher</th><th>Class</th><th>Subject</th><th>Action</th></tr></thead><tbody>
      {selected.map(a=><tr key={a.id}><td>{teacher(a.teacher_user_id)}</td>
       <td>{cls(a.class_id)?.name||"Class"}</td><td>{subject(a.subject_id)}</td>
       <td><button className="button secondary small" disabled={busy}
        onClick={()=>{if(window.confirm("Remove this teacher's access to the assigned class and its unpublished work?"))execute({action:"teacher.unassign",assignmentId:a.id});}}>Unassign</button></td></tr>)}
     </tbody></table></div>}
    </section>
   </div>
   {data.mayManageStudent&&<section className="tl-panel" style={{marginTop:19}}>
     <h2>Student account invitations</h2>
     <p className="muted">Student access is never self-registered. A verified guardian must approve access for minors, including records with unknown dates of birth.</p>
     <div className="tl-formrow">
      <label className="field">Enrolled student<select className="input" value={student.studentId} onChange={e=>setStudent({...student,studentId:e.target.value})}>
       <option value="">Choose student</option>{data.students.map(s=><option key={s.id} value={s.id}>{s.student_code} · {s.first_name} {s.last_name}</option>)}
      </select></label>
      <label className="field">Student's own verified email<input className="input" type="email" placeholder="student@school.example" value={student.email} onChange={e=>setStudent({...student,email:e.target.value})}/></label>
      <button className="button" disabled={busy||!student.studentId||!student.email} onClick={()=>execute({action:"student.invite",...student})}>Request student access</button>
     </div>
     <div className="table-wrap"><table><thead><tr><th>Student</th><th>Email</th><th>Approval state</th><th>Expires</th></tr></thead><tbody>
      {data.invites.map(i=><tr key={i.id}><td>{data.students.find(s=>s.id===i.student_id)?.student_code||"Student"}</td>
       <td>{i.email}</td><td>{i.status.replaceAll("_"," ")}</td><td>{i.expires_at?.slice(0,10)}</td></tr>)}
     </tbody></table></div>
   </section>}
   <p className="micro">This screen contains no platform-owner payments. All entries belong to this school only.</p>
  </div>
 </main>;
}
