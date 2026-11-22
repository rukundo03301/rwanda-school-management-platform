"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
import {ADMISSIONS_ACTIONS} from "../../../../lib/school-admissions-permissions.mjs";

const TABS=[
 {id:"overview",label:"Overview"},
 {id:"applications",label:"Applications"},
 {id:"students",label:"Student Registry"},
 {id:"guardians",label:"Verified Families"},
 {id:"access",label:"Access Controls"}
];
function TextField({label,children}){return <label className="field adm-field"><span>{label}</span>{children}</label>}
function Empty({title,subtitle}){return <div className="adm-empty"><strong>{title}</strong><p>{subtitle}</p></div>}
function Modal({title,onClose,children}){return <div className="adm-modal-wrap" role="presentation" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
 <section className="adm-modal" role="dialog" aria-modal="true" aria-label={title}>
  <div className="adm-modal-head"><h2>{title}</h2><button className="button secondary small" onClick={onClose} aria-label="Close form">✕</button></div>
  {children}
 </section></div>}
function Pill({value}){return <span className={"adm-pill adm-pill-"+(value||"unknown")}>{(value||"unknown").replaceAll("_"," ")}</span>}
function Card({label,count,detail}){return <div className="adm-metric"><small>{label}</small><strong>{count}</strong><span>{detail}</span></div>}

export default function AdmissionsDashboard({code}){
 const [client,setClient]=useState(null),[ready,setReady]=useState(false),[session,setSession]=useState(null);
 const [data,setData]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [tab,setTab]=useState("overview"),[modal,setModal]=useState(null),[form,setForm]=useState({});
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [filter,setFilter]=useState("all");
 useEffect(()=>{
  const c=browserSupabase();setClient(c);
  if(!c){setReady(true);setLoading(false);return;}
  let alive=true;
  c.auth.getSession().then(({data:r})=>{if(alive){setSession(r.session);setReady(true);}});
  const {data:{subscription}}=c.auth.onAuthStateChange((_event,value)=>{if(alive)setSession(value);});
  return ()=>{alive=false;subscription.unsubscribe();};
 },[]);
 const api=useCallback(async (body)=>{
   if(!client)throw Error("School sign-in is unavailable");
   const {data:{session:current}}=await client.auth.getSession();
   if(!current)throw Error("Sign in to your school again");
   const response=await fetch("/api/school/"+code+"/admissions",{
     method:body?"POST":"GET",cache:"no-store",
     headers:{Authorization:"Bearer "+current.access_token,
       ...(body?{"Content-Type":"application/json"}:{})},
     ...(body?{body:JSON.stringify(body)}:{})
   });
   const json=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(json.error||"School admissions request failed");
   return json;
 },[client,code]);
 const refresh=useCallback(async()=>{
   setLoading(true);
   try{setData(await api());setError("");}
   catch(e){setError(e.message);}
   finally{setLoading(false);}
 },[api]);
 useEffect(()=>{if(ready&&session)refresh();else if(ready){setData(null);setLoading(false);}},[ready,session?.user?.id,refresh]);
 const allowed=(permission)=>data?.actor?.isOwner||
  data?.actor?.admissionsPermissions?.includes(permission)||
  (permission==="admissions.read"&&["admissions.manage","enrollments.manage","guardians.manage"]
    .some(p=>data?.actor?.admissionsPermissions?.includes(p)));
 const open=(name,fields={})=>{setModal(name);setForm(fields);setError("");setNotice("");};
 async function submit(body){
   setBusy(true);setError("");setNotice("");
   try{
     const result=await api(body);
     setModal(null);setForm({});
     setNotice(body.action==="application.review"&&body.decision==="admit"?
       "Admission approved. Student ID and class enrollment created together.":
       body.action==="guardian.invite"?
       "Guardian invitation recorded. "+(result.result?.mailStatus==="provider_accepted"?
        "Email provider accepted invitation; delivery not yet verified.":
        "Email was not confirmed. The verified family can sign in using the school link."):
       "School admissions record saved successfully.");
     await refresh();
   }catch(e){setError(e.message);}
   finally{setBusy(false);}
 }
 if(!ready||loading)return <main className="school-admin-loading">Loading your school's admissions…</main>;
 if(!session)return <main className="school-admin-loading"><h2>Sign in to your school</h2><a className="button" href={"/s/"+code+"/login?role=school_admin"}>School Login</a></main>;
 if(error&&!data)return <main className="school-admin-loading"><h2>Admissions unavailable</h2><p role="alert">{error}</p><a href={"/s/"+code+"/admin"}>Back to school</a></main>;
 if(!data)return <main className="school-admin-loading">School admissions are not available.</main>;
 const school=data.school;
 const counts={applications:data.applications.length,pending:data.applications.filter(a=>["submitted","under_review"].includes(a.status)).length,
   admitted:data.students.length,family:data.guardianLinks.filter(l=>l.active).length};
 const years=data.years||[],classes=data.classes||[];
 const applications=(data.applications||[]).filter(a=>filter==="all"||a.status===filter);
 const activeStudents=(data.students||[]).filter(s=>s.status==="active");
 const applicantsYear=(app)=>years.find(y=>y.id===app.academic_year_id)?.name||"Academic year";
 const classLabel=(cls)=>cls?cls.name+(cls.section?" · "+cls.section:""):"Class not available";
 const studentEnrollment=(studentId)=>data.enrollments.find(e=>e.student_id===studentId&&e.status==="active");
 const allowedTabs=TABS.filter(t=>t.id==="overview"||
   (t.id==="access"&&data.actor.isOwner)||
   (t.id==="guardians"&&allowed("guardians.manage"))||
   (["applications","students"].includes(t.id)&&allowed("admissions.read")));
 return <main className="adm-shell">
   <header className="adm-header">
    <div className="adm-brand">
      {school.logoUrl?<img src={school.logoUrl} width="52" height="52" alt={school.name+" logo"}/>:<div className="adm-brand-mark">✦</div>}
      <div><strong>{school.name}</strong><small>Student Admissions & Enrollment</small></div>
    </div>
    <div className="adm-links"><a href={"/s/"+code+"/admin"}>School Administration</a><a href={"/s/"+code}>Official Website</a></div>
   </header>
   <div className="adm-layout">
    <aside className="adm-side">
      <p className="adm-side-label">SCHOOL OPERATIONS</p>
      {allowedTabs.map(t=><button key={t.id} className={tab===t.id?"selected":""} onClick={()=>{setTab(t.id);setError("");}}>{t.label}</button>)}
      <div className="adm-side-foot">
        <small>School ID</small><strong>{school.code}</strong>
        <p>Only verified, approved school staff can read child records.</p>
      </div>
    </aside>
    <section className="adm-content">
      <div className="adm-heading"><span className="adm-eyebrow">ACADEMIC MANAGEMENT / MODULE 3</span>
        <h1>{({overview:"Admissions & Enrollment",applications:"Applications",students:"Student Registry",
          guardians:"Verified Family Connections",access:"Admissions Access Controls"})[tab]}</h1>
        <p>Manage real applications and enrollment securely within {school.name}.</p>
      </div>
      {notice&&<div className="notice ok" role="status">{notice}</div>}
      {error&&<div className="notice error" role="alert">{error}</div>}
      {tab==="overview"&&<>
        <div className="adm-metrics">
          <Card label="Loaded applications" count={allowed("admissions.read")?counts.applications:"—"} detail="Recent 250 records maximum"/>
          <Card label="Awaiting decision" count={allowed("admissions.read")?counts.pending:"—"} detail="Submitted or under review"/>
          <Card label="Loaded students" count={allowed("admissions.read")?counts.admitted:"—"} detail="Recent 250 records maximum"/>
          <Card label="Loaded family links" count={allowed("guardians.manage")?counts.family:"—"} detail="Recent 250 records maximum"/>
        </div>
        <div className="adm-two-cols"><article className="adm-panel">
          <h2>How a student joins your school</h2>
          <div className="adm-flow">
            <p><b>01</b><span><strong>Receive application</strong> Record the child's details and intended academic year.</span></p>
            <p><b>02</b><span><strong>Review</strong> Confirm eligibility and choose a class in the same school and academic year.</span></p>
            <p><b>03</b><span><strong>Admit & enroll</strong> Student ID and class placement are created together only when approved.</span></p>
            <p><b>04</b><span><strong>Verify parent</strong> School checks family relationship, invites the correct email, and parent accepts it.</span></p>
          </div>
          {allowed("admissions.manage")&&<button className="button" onClick={()=>open("newApplication",{yearId:years.find(y=>y.status==="current")?.id||years[0]?.id||""})}>+ Register Application</button>}
        </article><article className="adm-panel"><h2>Ready for admissions?</h2>
          <p>{!years.length?"Set up an academic year first in School Administration.":years.length+" academic year(s) available."}</p>
          <p>{!classes.length?"Create class sections before admitting applicants.":classes.length+" class section(s) configured."}</p>
          <div className="adm-explain">You won't find fabricated student profiles, parents, attendance, or grades. Every record begins with real school approval.</div>
          <a className="button secondary" href={"/s/"+code+"/admin"}>Open Academic Setup</a>
        </article></div>
      </>}
      {tab==="applications"&&allowed("admissions.read")&&<>
        <div className="adm-section-title"><div><h2>Admission applications</h2><p>Applications are not student records until an authorized decision.</p></div>
          {allowed("admissions.manage")&&<button className="button" disabled={!years.length} onClick={()=>open("newApplication",{yearId:years.find(y=>y.status==="current")?.id||years[0]?.id||""})}>+ New Application</button>}</div>
        <div className="adm-filter"><label>Filter status <select className="input" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All applications</option><option value="submitted">Submitted</option><option value="under_review">Under review</option><option value="admitted">Admitted</option><option value="rejected">Rejected</option></select></label></div>
        <article className="adm-panel"><div className="table-wrap"><table><thead><tr>
          <th>Application ID</th><th>Applicant</th><th>Academic year</th><th>Status</th><th>Submitted</th><th>Actions</th>
        </tr></thead><tbody>{applications.map(a=><tr key={a.id}>
          <td><kbd>{a.application_code}</kbd></td>
          <td><strong>{a.first_name} {a.last_name}</strong></td>
          <td>{applicantsYear(a)}</td><td><Pill value={a.status}/></td>
          <td>{a.submitted_at?.slice(0,10)}</td>
          <td>{allowed("admissions.manage")&&["submitted","under_review"].includes(a.status)&&<button className="button secondary small" onClick={()=>open("review",{application:a,decision:"under_review",classId:classes.find(c=>c.academic_year_id===a.academic_year_id&&c.status==="active")?.id||""})}>Review</button>}</td>
        </tr>)}</tbody></table>{!applications.length&&<Empty title="No matching applications" subtitle="Start with a real student application. No example children have been inserted."/>}</div></article>
      </>}
      {tab==="students"&&allowed("admissions.read")&&<>
        <div className="adm-section-title"><div><h2>Student registry</h2><p>Students appear after an approved admission and class enrollment.</p></div></div>
        <article className="adm-panel"><div className="table-wrap"><table><thead><tr><th>Student ID</th><th>Student</th><th>Class</th><th>Status</th><th>Family links</th><th>Actions</th></tr></thead><tbody>
        {data.students.map(s=>{const e=studentEnrollment(s.id),cls=e?classes.find(c=>c.id===e.class_id):null;
          const links=data.guardianLinks.filter(g=>g.student_id===s.id&&g.active).length;
          return <tr key={s.id}><td><kbd>{s.student_code}</kbd></td>
          <td><strong>{s.first_name} {s.last_name}</strong></td><td>{cls?classLabel(cls):"Not assigned"}</td>
          <td><Pill value={s.status}/></td><td>{allowed("guardians.manage")?links+" verified":"Restricted"}</td>
          <td>{allowed("guardians.manage")&&s.status==="active"&&<button className="button secondary small" onClick={()=>open("inviteGuardian",{student:s,relationship:"parent",verificationAttested:false})}>Link Guardian</button>}</td>
          </tr>})}
        </tbody></table>{!data.students.length&&<Empty title="No enrolled students" subtitle="Approve an application into a real class to create the first Student ID."/>}</div></article>
      </>}
      {tab==="guardians"&&allowed("guardians.manage")&&<>
        <div className="adm-section-title"><div><h2>Verified family relationships</h2><p>Parent access requires both school verification and an email-confirmed guardian account.</p></div>
          <button className="button" disabled={!activeStudents.length} onClick={()=>open("inviteGuardian",{student:activeStudents[0],relationship:"parent",verificationAttested:false})}>+ Invite Guardian</button></div>
        <article className="adm-panel"><h3>Guardian invitations</h3><div className="table-wrap"><table><thead><tr><th>Student</th><th>Guardian email</th><th>Relationship</th><th>Status</th><th>Expires</th></tr></thead><tbody>
          {data.guardianInvites.map(g=><tr key={g.id}><td>{data.students.find(x=>x.id===g.student_id)?.student_code||"Student"}</td>
          <td>{g.email}</td><td>{g.relationship.replaceAll("_"," ")}</td><td><Pill value={g.status}/></td><td>{g.expires_at?.slice(0,10)}</td></tr>)}
        </tbody></table>{!data.guardianInvites.length&&<Empty title="No family invitations yet" subtitle="Invite a guardian only after verifying the relationship with the school."/>}</div></article>
        <article className="adm-panel"><h3>Approved guardian links</h3><div className="table-wrap"><table><thead><tr><th>Student</th><th>Guardian account</th><th>Relationship</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {data.guardianLinks.map(g=><tr key={g.student_id+g.auth_user_id}>
           <td>{data.students.find(x=>x.id===g.student_id)?.student_code||"Student"}</td>
           <td><span className="micro">{g.auth_user_id.slice(0,8)}…</span></td>
           <td>{g.relationship.replaceAll("_"," ")}</td><td><Pill value={g.active?"active":"revoked"}/></td>
           <td>{g.active&&<button className="button secondary small" onClick={()=>open("revokeGuardian",{link:g,reason:""})}>Revoke link</button>}</td>
          </tr>)}
        </tbody></table>{!data.guardianLinks.length&&<Empty title="No verified guardian links" subtitle="A family link appears only after the invited parent accepts it."/>}</div></article>
      </>}
      {tab==="access"&&data.actor.isOwner&&<>
        <div className="adm-section-title"><div><h2>Administrator admissions permissions</h2><p>Only you as this school's owner may grant these privileges.</p></div></div>
        <article className="adm-panel"><div className="table-wrap"><table><thead><tr><th>Administrator</th><th>Allowed permissions</th><th>Actions</th></tr></thead><tbody>
          {data.adminGrants.map(a=><tr key={a.userId}><td><strong>{a.email||"Verified school administrator"}</strong><div className="micro">{a.userId.slice(0,8)}…</div></td>
            <td>{a.permissions.length?a.permissions.join(", "):"None"}</td>
            <td><button className="button secondary small" onClick={()=>open("permissions",{admin:a,permissions:[...a.permissions],reason:""})}>Manage switches</button></td>
          </tr>)}</tbody></table>{!data.adminGrants.length&&<Empty title="No local administrators" subtitle="Invite administrators in School Administration before assigning admissions access."/>}</div></article>
      </>}
      <footer className="adm-footer">Private school data · Strict tenant boundaries · No platform subscription or payment details · No public child application form in this module</footer>
    </section>
   </div>
   {modal&&<Modal title={({newApplication:"Register a new application",review:"Review student application",inviteGuardian:"Invite verified guardian",revokeGuardian:"Revoke guardian relationship",permissions:"Administrator Admissions Permissions"})[modal]} onClose={()=>{setModal(null);setError("");}}>
      {error&&<div className="notice error" role="alert">{error}</div>}
      {modal==="newApplication"&&<form onSubmit={e=>{e.preventDefault();submit({action:"application.submit",firstName:form.firstName,lastName:form.lastName,dateOfBirth:form.dateOfBirth||null,yearId:form.yearId});}}>
        <p className="muted">School staff records a real applicant. This does not enroll them or notify parents.</p>
        <div className="adm-field-grid">
         <TextField label="First name"><input className="input" required maxLength={90} value={form.firstName||""} onChange={e=>setForm({...form,firstName:e.target.value})}/></TextField>
         <TextField label="Last name"><input className="input" required maxLength={90} value={form.lastName||""} onChange={e=>setForm({...form,lastName:e.target.value})}/></TextField>
        </div>
        <TextField label="Date of birth (optional)"><input className="input" type="date" max={new Date().toISOString().slice(0,10)} value={form.dateOfBirth||""} onChange={e=>setForm({...form,dateOfBirth:e.target.value})}/></TextField>
        <TextField label="Academic year"><select className="input" required value={form.yearId||""} onChange={e=>setForm({...form,yearId:e.target.value})}><option value="">Choose academic year</option>{years.filter(y=>y.status!=="closed").map(y=><option key={y.id} value={y.id}>{y.name}</option>)}</select></TextField>
        <button type="submit" className="button" disabled={busy||!form.yearId}>{busy?"Saving…":"Submit application"}</button>
      </form>}
      {modal==="review"&&<form onSubmit={e=>{e.preventDefault();submit({action:"application.review",
        applicationId:form.application.id,decision:form.decision,classId:form.decision==="admit"?form.classId:null});}}>
        <p className="muted"><strong>{form.application.first_name} {form.application.last_name}</strong> · {form.application.application_code}</p>
        <TextField label="Decision"><select className="input" value={form.decision} onChange={e=>setForm({...form,decision:e.target.value})}>
          <option value="under_review">Mark under review</option><option value="admit" disabled={!allowed("enrollments.manage")}>Admit into a class</option><option value="reject">Reject application</option>
        </select></TextField>
        {form.decision==="admit"&&<TextField label="Class in the requested academic year"><select required className="input" value={form.classId||""} onChange={e=>setForm({...form,classId:e.target.value})}>
          <option value="">Select class</option>
          {classes.filter(c=>c.academic_year_id===form.application.academic_year_id&&c.status==="active").map(c=><option key={c.id} value={c.id}>{classLabel(c)}</option>)}
        </select></TextField>}
        {form.decision==="admit"&&<div className="notice info">Admission and Student ID creation happen together only if this class belongs to the correct school/year and has capacity. Requires MFA.</div>}
        {form.decision==="reject"&&<div className="notice info">Rejection does not create a student record. This action cannot be casually undone in this version.</div>}
        <button className="button" disabled={busy||(form.decision==="admit"&&!form.classId)} type="submit">Confirm decision</button>
      </form>}
      {modal==="inviteGuardian"&&<form onSubmit={e=>{e.preventDefault();submit({action:"guardian.invite",studentId:form.student?.id,email:form.email,
        relationship:form.relationship,verificationAttested:form.verificationAttested});}}>
        <p className="muted">A parent cannot see a child's records by knowing their name. The school must verify the relationship and the guardian must accept a confirmed-email invitation.</p>
        <TextField label="Enrolled student"><select className="input" value={form.student?.id||""} onChange={e=>setForm({...form,student:activeStudents.find(st=>st.id===e.target.value)})}>{activeStudents.map(st=><option key={st.id} value={st.id}>{st.student_code} · {st.first_name} {st.last_name}</option>)}</select></TextField>
        <TextField label="Verified guardian email"><input type="email" className="input" required value={form.email||""} onChange={e=>setForm({...form,email:e.target.value})}/></TextField>
        <TextField label="Relationship"><select className="input" value={form.relationship||"parent"} onChange={e=>setForm({...form,relationship:e.target.value})}><option value="parent">Parent</option><option value="legal_guardian">Legal Guardian</option></select></TextField>
        <label className="adm-attest"><input type="checkbox" required checked={!!form.verificationAttested} onChange={e=>setForm({...form,verificationAttested:e.target.checked})}/>
          I confirm that school personnel checked this person's right to access this child's school information through an approved offline process.</label>
        <div className="notice info">Do not upload ID documents or child photos here. This confirmation is logged. Requires MFA.</div>
        <button type="submit" className="button" disabled={busy||!form.student?.id||!form.verificationAttested}>Send family invitation</button>
      </form>}
      {modal==="revokeGuardian"&&<form onSubmit={e=>{e.preventDefault();submit({action:"guardian.revoke",studentId:form.link.student_id,
        userId:form.link.auth_user_id,reason:form.reason});}}>
        <p>Revoke access for this guardian and this child only. Other authorized children remain linked.</p>
        <TextField label="Reason for removal"><textarea required minLength={8} maxLength={500} className="input" value={form.reason||""} onChange={e=>setForm({...form,reason:e.target.value})}/></TextField>
        <button type="submit" disabled={busy} className="button danger">Revoke guardian link</button>
      </form>}
      {modal==="permissions"&&<form onSubmit={e=>{e.preventDefault();submit({action:"admissions.permissions",userId:form.admin.userId,
        permissions:form.permissions,reason:form.reason});}}>
        <p className="muted">Grant admissions access only when necessary. Permissions do not affect this person's membership at another school.</p>
        <div className="table-wrap"><table><thead><tr><th>Module</th><th>Permission</th><th style={{textAlign:"center"}}>ON / OFF</th></tr></thead><tbody>
          {ADMISSIONS_ACTIONS.map(permission=><tr key={permission.id}><td>{permission.group}</td><td>{permission.label}<div className="micro">{permission.id}</div></td>
            <td><label className="switch"><input type="checkbox" role="switch" aria-label={permission.label}
             checked={(form.permissions||[]).includes(permission.id)}
             onChange={e=>setForm(old=>({...old,permissions:e.target.checked?
               [...old.permissions,permission.id]:old.permissions.filter(x=>x!==permission.id)}))}/>
            <span className="switch-track" aria-hidden="true"/></label></td>
          </tr>)}</tbody></table></div>
        <TextField label="Reason for access change"><textarea className="input" required minLength={8} maxLength={500} value={form.reason||""} onChange={e=>setForm({...form,reason:e.target.value})}/></TextField>
        <button type="submit" className="button" disabled={busy}>Save permissions with MFA</button>
      </form>}
   </Modal>}
 </main>;
}
