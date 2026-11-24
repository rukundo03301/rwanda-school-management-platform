"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
import {SCHOOL_ADMIN_ACTIONS} from "../../../../lib/school-admin-permissions.mjs";

const SECTIONS=[
 {id:"overview",name:"Overview",icon:"◫"},
 {id:"team",name:"People & Access",icon:"♙"},
 {id:"academics",name:"Academic Setup",icon:"▤"},
 {id:"activity",name:"School Activity",icon:"◷"}
];
const DATE=(v)=>v?new Date(v).toLocaleDateString("en-RW",{timeZone:"Africa/Kigali",year:"numeric",month:"short",day:"numeric"}):"—";
function Dialog({title,close,children}){
 return <div className="school-admin-modal-wrap" role="presentation" onClick={e=>{if(e.target===e.currentTarget)close();}}>
   <div role="dialog" aria-modal="true" aria-label={title} className="school-admin-modal">
     <div className="row" style={{justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
       <h2>{title}</h2><button className="button secondary small" onClick={close} aria-label="Close">✕</button>
     </div>{children}
   </div>
 </div>;
}
function Field({label,children}){return <label className="field" style={{marginBottom:15}}><strong>{label}</strong>{children}</label>}
function Empty({name,hint}){return <div className="school-admin-empty"><strong>{name}</strong><p>{hint}</p></div>}
function Permissions({value,onChange,disabled=false}) {
 return <div className="table-wrap"><table><thead>
   <tr><th>Module</th><th>Permission</th><th style={{textAlign:"center"}}>Access</th></tr>
 </thead><tbody>{SCHOOL_ADMIN_ACTIONS.map(p=><tr key={p.id}>
   <td><small>{p.group}</small></td>
   <td><strong>{p.title}</strong><div className="micro">{p.id}</div></td>
   <td><label className="switch">
     <input type="checkbox" role="switch" disabled={disabled} checked={value.includes(p.id)}
       aria-label={"Allow "+p.title}
       onChange={e=>onChange(p.id,e.target.checked)}/>
     <span className="switch-track" aria-hidden="true"/>
   </label></td></tr>)}</tbody></table></div>;
}
function Metric({title,value,description}){return <div className="school-admin-metric">
 <small>{title}</small><strong>{value}</strong><span>{description}</span></div>;}

export default function SchoolAdmin({code}){
 const [client,setClient]=useState(null);
 const [session,setSession]=useState(null);
 const [authReady,setAuthReady]=useState(false);
 const [data,setData]=useState(null);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [tab,setTab]=useState("overview");
 const [modal,setModal]=useState(null);
 const [form,setForm]=useState({});
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");

 useEffect(()=>{
   const c=browserSupabase();setClient(c);
   if(!c){setAuthReady(true);setLoading(false);return;}
   let alive=true;
   c.auth.getSession().then(({data})=>{if(alive){setSession(data?.session||null);setAuthReady(true);}});
   const {data:{subscription}}=c.auth.onAuthStateChange((_event,s)=>{if(alive)setSession(s);});
   return ()=>{alive=false;subscription.unsubscribe();};
 },[]);
 const call=useCallback(async(body)=>{
   if(!client)throw new Error("School authentication is not configured");
   const {data:{session:s}}=await client.auth.getSession();
   if(!s)throw new Error("Sign in to your school again");
   const response=await fetch("/api/school/"+code+"/admin",{
     method:body?"POST":"GET",
     headers:{"Authorization":"Bearer "+s.access_token,
       ...(body?{"Content-Type":"application/json"}:{})},
     ...(body?{body:JSON.stringify(body)}:{}),
     cache:"no-store"
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(result.error||"Unable to access school management");
   return result;
 },[client,code]);
 const reload=useCallback(async()=>{
   setLoading(true);setError("");
   try{const res=await call();setData(res);}
   catch(e){setError(e.message);}
   finally{setLoading(false);}
 },[call]);
 useEffect(()=>{if(!authReady)return;if(!session){setLoading(false);setData(null);return;}reload();},[authReady,session?.user?.id,reload]);
 const allowed=(permission)=>!!data?.actor?.isOwner||!!data?.actor?.permissions?.includes(permission);
 function open(name,payload={}){setModal(name);setForm(payload);setMessage("");setError("");}
 async function act(body){
   setBusy(true);setError("");setMessage("");
   try{
     const response=await call(body);
     setModal(null);setForm({});
     setMessage(body.action==="member.invite"?
       "Invitation saved. "+(response.result?.mailStatus==="provider_accepted"?
        "The email provider accepted the invitation.":"The recipient can use their school login link; email delivery was not confirmed."):
       "School record updated successfully.");
     await reload();
   }catch(e){setError(e.message);}
   finally{setBusy(false);}
 }
 async function signOut(){await client?.auth.signOut();window.location.assign("/s/"+code+"/login");}
 if(!authReady||loading)return <main className="school-admin-loading">Opening your school management workspace…</main>;
 if(!session)return <main className="school-admin-loading"><h2>School sign-in required</h2>
   <p>Sign in using your school-approved account.</p><a className="button" href={"/s/"+code+"/login?role=school_admin"}>Go to school sign-in</a></main>;
 if(error&&!data)return <main className="school-admin-loading"><h2>School management is unavailable</h2>
   <p role="alert">{error}</p><a href={"/s/"+code+"/portal?role=school_admin"}>Return to school portal</a>
   <button className="button secondary" onClick={signOut}>Switch account</button></main>;
 if(!data)return <main className="school-admin-loading">No school data has been loaded.</main>;

 const school=data.school,actor=data.actor,owner=actor.isOwner;
 const currentYear=data.years.find(y=>y.status==="current");
 const adminCount=data.team.filter(x=>x.role==="school_admin"&&x.active).length;
 const teacherCount=data.team.filter(x=>x.role==="teacher"&&x.active).length;
 const peopleRead=allowed("people.read"),academicRead=allowed("academics.read");

 return <div className="school-admin-shell" style={{"--school-color":school.primaryColor||"#204a78"}}>
   <aside className="school-admin-sidebar">
     <div className="school-admin-brand">
       {school.logoUrl?<img src={school.logoUrl} alt={school.name+" logo"}/>:<div className="site-icon">✦</div>}
       <div><strong>{school.name}</strong><small>School Administration</small></div>
     </div>
     <div className="school-admin-role">{owner?"School Owner":"School Administrator"}</div>
     <nav aria-label="School management sections">{SECTIONS.filter(x=>
       x.id==="overview" ||
       (x.id==="team"&&peopleRead) ||
       (x.id==="academics"&&academicRead) ||
       (x.id==="activity"&&allowed("audit.read"))).map(x=>
       <button key={x.id} onClick={()=>setTab(x.id)} className={tab===x.id?"active":""}>
         <span aria-hidden="true">{x.icon}</span>{x.name}
       </button>)}
       {(owner||["admissions.read","admissions.manage","enrollments.manage","guardians.manage"]
         .some(p=>actor.admissionsPermissions?.includes(p)))&&
         <a className="school-admin-nav-link" href={"/s/"+code+"/admissions"}><span aria-hidden="true">✧</span>Admissions & Students</a>}
       {(owner||actor.permissions?.includes("academics.manage"))&&
         <a className="school-admin-nav-link" href={"/s/"+code+"/classroom"}><span aria-hidden="true">▦</span>Classrooms & Teachers</a>}
       {(owner||actor.reportPermissions?.some(p=>["curriculum.manage","reports.read"].includes(p)))&&
         <a className="school-admin-nav-link" href={"/s/"+code+"/reports"}><span aria-hidden="true">▥</span>Curriculum & Reports</a>}
       {(owner||actor.communicationPermissions?.some(p=>["timetable.manage","announcements.manage"].includes(p)))&&
         <a className="school-admin-nav-link" href={"/s/"+code+"/communications"}><span aria-hidden="true">▣</span>School Community & Timetable</a>}
       {(owner||actor.financePermissions?.length>0)&&
         <a className="school-admin-nav-link" href={"/s/"+code+"/fees"}><span aria-hidden="true">₣</span>School Fees & RWF Finance</a>}
       {owner&&code==="RW-SCH-000004"&&<a className="school-admin-nav-link" href={"/s/"+code+"/accounts"}><span aria-hidden="true">♙</span>Training Role Accounts</a>}
       {code==="RW-SCH-000004"&&<a className="school-admin-nav-link" href={"/s/"+code+"/resources"}><span aria-hidden="true">▣</span>Learning Resources</a>}
       {owner&&code==="RW-SCH-000004"&&<a className="school-admin-nav-link" href={"/s/"+code+"/demo"}><span aria-hidden="true">◈</span>Operations Preview (Read-only)</a>}
     </nav>
     <div className="school-admin-sidebottom">
       <a href={"/s/"+code} target="_blank" rel="noreferrer">School Homepage</a>
       {owner&&<a href={"/s/"+code+"/setup"}>Edit School Website</a>}
       <button onClick={signOut}>Sign out</button>
     </div>
   </aside>
   <main className="school-admin-main">
     <header className="school-admin-top">
       <div><div className="micro">SCHOOL MANAGEMENT / {tab.toUpperCase()}</div>
         <h1>{({overview:"School overview",team:"People & access",academics:"Academic structure",activity:"School activity"})[tab]}</h1>
         <p className="muted">Your institution's private workspace. Platform-owner billing is never shown here.</p></div>
       <span className="school-admin-code">{school.code}</span>
     </header>
     {message&&<div className="notice ok" role="status">{message}</div>}
     {error&&<div className="notice error" role="alert">{error}</div>}
     {tab==="overview"&&<>
       <div className="school-admin-metrics">
         <Metric title="School status" value="Active" description="Managed by platform owner"/>
         <Metric title="Administrators listed" value={peopleRead?adminCount:"—"} description="Approved administrators"/>
         <Metric title="Teachers listed" value={peopleRead?teacherCount:"—"} description="Assigned school identities"/>
         <Metric title="Classes listed" value={academicRead?data.classes.length:"—"} description="Academic setup only"/>
       </div>
       <div className="school-admin-columns">
         <section className="panel"><h2>Getting your school ready</h2>
           <div className="school-admin-steps">
             <p><strong>1. School identity</strong><span>Logo, mission, vision, announcements and homepage.</span></p>
             <p><strong>2. Academic foundation</strong><span>Create your academic year, class names and subjects.</span></p>
             <p><strong>3. School team</strong><span>Invite school administrators, teachers and staff securely.</span></p>
             <p><strong>4. Student enrollment</strong><span>Next module; no student records are created in this release.</span></p>
           </div>
           <div className="row" style={{marginTop:15}}>
             {owner&&<a className="button secondary small" href={"/s/"+code+"/setup"}>Edit School Website</a>}
             {allowed("academics.manage")&&<button className="button small" onClick={()=>setTab("academics")}>Academic Setup</button>}
             {(owner||actor.admissionsPermissions?.some(p=>["admissions.read","admissions.manage","enrollments.manage","guardians.manage"].includes(p)))&&
               <a className="button secondary small" href={"/s/"+code+"/admissions"}>Admissions & Students</a>}
           </div>
         </section>
         <section className="panel"><h2>Current academic year</h2>
           <p className="school-admin-year">{currentYear?.name||"Not configured"}</p>
           <p className="muted">{currentYear?DATE(currentYear.starts_on)+" – "+DATE(currentYear.ends_on):"Create an academic year before adding classes."}</p>
           {allowed("academics.manage")&&<button className="button secondary small" onClick={()=>open("year")}>+ Add year</button>}
           <hr/><h3>Secure staff access</h3>
           <p className="muted">Staff permissions are assigned by the school owner. Selecting a role at login does not grant access.</p>
         </section>
       </div>
     </>}
     {tab==="team"&&peopleRead&&<>
       <div className="school-admin-section-head"><div><h2>School team</h2><p className="muted">Only people approved for this school appear here.</p></div>
         {allowed("people.invite")&&<button className="button" onClick={()=>open("invite",{role:owner?"school_admin":"teacher",permissions:[]})}>+ Invite colleague</button>}
       </div>
       <section className="panel"><div className="table-wrap"><table>
         <thead><tr><th>Account</th><th>Role</th><th>Status</th><th>Access</th><th>Actions</th></tr></thead>
         <tbody>{data.team.map(m=><tr key={m.auth_user_id+"#"+m.role}>
           <td><strong>{m.email||"Verified school member"}</strong><div className="micro">{m.auth_user_id.slice(0,8)}…</div></td>
           <td>{m.role.replaceAll("_"," ")}</td><td><span className="school-admin-state">{m.active?"Active":"Revoked"}</span></td>
           <td>{m.role==="school_admin"?(m.permissions||[]).length+" permissions":m.role==="school_owner"?"School ownership":"Role-scoped"}</td>
           <td><div className="row">
             {owner&&m.role==="school_admin"&&m.active&&<button className="button small secondary" onClick={()=>open("permissions",{member:m,permissions:[...(m.permissions||[])],reason:""})}>Edit switches</button>}
             {allowed("people.manage")&&!owner&&m.role==="school_admin"?null:
               allowed("people.manage")&&m.active&&m.role!=="school_owner"&&m.auth_user_id!==actor.id?
               <button className="button small secondary" onClick={()=>open("revoke",{member:m,reason:""})}>Revoke</button>:null}
           </div></td>
         </tr>)}</tbody>
       </table>{!data.team.length&&<Empty name="No school team yet" hint="Invite the school's verified administrators, teachers and staff."/>}</div></section>
       <section className="panel"><h2>Invitation queue</h2>
         <div className="table-wrap"><table><thead><tr><th>Email</th><th>Role</th><th>State</th><th>Expires</th></tr></thead>
         <tbody>{data.invites.map(inv=><tr key={inv.id}>
           <td>{inv.email}</td><td>{inv.role.replaceAll("_"," ")}</td><td>{inv.status}</td><td>{DATE(inv.expires_at)}</td>
         </tr>)}</tbody></table>{!data.invites.length&&<Empty name="No invitations" hint="New approved invitations will appear here."/>}</div>
       </section>
     </>}
     {tab==="academics"&&academicRead&&<>
       <div className="school-admin-section-head"><div><h2>Academic years</h2><p className="muted">Define the school's real calendar and which year is current.</p></div>
         {allowed("academics.manage")&&<button className="button" onClick={()=>open("year")}>+ Add academic year</button>}</div>
       <section className="panel"><div className="table-wrap"><table><thead><tr><th>Academic year</th><th>Start</th><th>End</th><th>Status</th><th>Action</th></tr></thead><tbody>
         {data.years.map(y=><tr key={y.id}><td><strong>{y.name}</strong></td><td>{y.starts_on}</td><td>{y.ends_on}</td>
           <td><span className="school-admin-state">{y.status}</span></td><td>{allowed("academics.manage")&&y.status==="planned"&&<button className="button small secondary" disabled={busy} onClick={()=>act({action:"academic.yearCurrent",id:y.id})}>Set current</button>}</td></tr>)}
       </tbody></table>{!data.years.length&&<Empty name="No academic years" hint="Start with the school's real academic calendar."/>}</div></section>
       <div className="school-admin-section-head"><div><h2>Classes & sections</h2><p className="muted">Create class structures before enrolling students.</p></div>
         {allowed("academics.manage")&&<button className="button" disabled={!data.years.length} onClick={()=>open("class",{yearId:currentYear?.id||data.years[0]?.id||""})}>+ Add class</button>}</div>
       <section className="panel"><div className="table-wrap"><table><thead><tr><th>Class</th><th>Level</th><th>Section</th><th>Academic year</th><th>Subjects</th></tr></thead><tbody>
         {data.classes.map(c=><tr key={c.id}><td><strong>{c.name}</strong></td><td>{c.level}</td><td>{c.section||"—"}</td>
           <td>{data.years.find(y=>y.id===c.academic_year_id)?.name||"—"}</td><td>{data.classSubjects.filter(x=>x.class_id===c.id).length}</td></tr>)}
       </tbody></table>{!data.classes.length&&<Empty name="No classes" hint="Add an academic year, then create class names and sections."/>}</div></section>
       <div className="school-admin-section-head"><div><h2>Subjects</h2><p className="muted">Define subjects once for this school, then assign them to classes.</p></div>
         <div className="row">{allowed("academics.manage")&&<><button className="button secondary" onClick={()=>open("subject")}>+ Subject</button>
           <button className="button" disabled={!data.subjects.length||!data.classes.length} onClick={()=>open("assignment",{classId:data.classes[0]?.id||"",subjectId:data.subjects[0]?.id||""})}>Assign to class</button></>}</div></div>
       <section className="panel"><div className="table-wrap"><table><thead><tr><th>Code</th><th>Subject</th><th>Assigned classes</th></tr></thead>
         <tbody>{data.subjects.map(s=><tr key={s.id}><td><kbd>{s.code}</kbd></td><td>{s.name}</td>
           <td>{data.classSubjects.filter(x=>x.subject_id===s.id).length}</td></tr>)}</tbody></table>
         {!data.subjects.length&&<Empty name="No subjects" hint="Add real subjects taught at your institution."/>}</div></section>
     </>}
     {tab==="activity"&&allowed("audit.read")&&<section className="panel"><h2>School administrative activity</h2>
       <p className="muted">This audit shows actions within this school, not your platform owner's private controls.</p>
       <div className="table-wrap"><table><thead><tr><th>When</th><th>Event</th><th>Actor</th></tr></thead><tbody>
         {data.audit.map(x=><tr key={x.id}><td>{DATE(x.created_at)}</td><td>{x.event.replaceAll("_"," ")}</td>
           <td className="micro">{x.actor_id.slice(0,8)}…</td></tr>)}</tbody></table>
         {!data.audit.length&&<Empty name="No activity recorded" hint="New school management actions will appear here."/>}</div>
     </section>}
     <p className="school-admin-footer">School-specific management · No SaaS subscription or private platform billing data · Student records are not part of Module 2.</p>
   </main>
   {modal&&<Dialog title={({invite:"Invite school colleague",permissions:"Edit administrator permissions",revoke:"Revoke school access",
     year:"Create academic year",class:"Create class",subject:"Create subject",assignment:"Assign subject to class"})[modal]} close={()=>{setModal(null);setError("");}}>
     {error&&<div className="notice error" role="alert">{error}</div>}
     {modal==="invite"&&<form onSubmit={e=>{e.preventDefault();act({action:"member.invite",email:form.email,role:form.role,permissions:form.permissions||[]});}}>
       <p className="muted">An invitation is valid for 14 days and can only be claimed by the verified recipient at this school.</p>
       <Field label="Colleague email"><input className="input" required type="email" autoComplete="email" value={form.email||""} onChange={e=>setForm({...form,email:e.target.value})}/></Field>
       <Field label="School role"><select className="input" value={form.role} onChange={e=>setForm({...form,role:e.target.value,permissions:[]})}>
         {owner&&<option value="school_admin">School Administrator</option>}
         <option value="teacher">Teacher</option><option value="staff">School Staff</option>
       </select></Field>
       {form.role==="school_admin"&&<><h3>Administrator permission table</h3>
         <Permissions value={form.permissions||[]} onChange={(permission,on)=>setForm({
           ...form,permissions:on?[...(form.permissions||[]),permission]:(form.permissions||[]).filter(x=>x!==permission)
         })}/></>}
       <div className="notice info">Requires two-factor verification. Email is sent where the authentication provider allows it; otherwise share the school's login page.</div>
       <button className="button" disabled={busy} type="submit">{busy?"Saving…":"Create verified invitation"}</button>
     </form>}
     {modal==="permissions"&&<form onSubmit={e=>{e.preventDefault();act({action:"admin.permissions",
       userId:form.member.auth_user_id,permissions:form.permissions,reason:form.reason});}}>
       <p className="muted">Change <strong>{form.member.email||"this administrator"}</strong>'s school management permissions. All changes are audited.</p>
       <Permissions value={form.permissions||[]} onChange={(permission,on)=>setForm({...form,
         permissions:on?[...(form.permissions||[]),permission]:(form.permissions||[]).filter(x=>x!==permission)
       })}/>
       <Field label="Reason for permission change"><textarea className="input" required minLength={8} maxLength={500}
         value={form.reason||""} onChange={e=>setForm({...form,reason:e.target.value})}/></Field>
       <button className="button" disabled={busy} type="submit">Save ON/OFF permissions</button>
     </form>}
     {modal==="revoke"&&<form onSubmit={e=>{e.preventDefault();act({action:"member.revoke",
       userId:form.member.auth_user_id,role:form.member.role,reason:form.reason});}}>
       <p>Revoke this person's <strong>{form.member.role.replaceAll("_"," ")}</strong> access to <strong>{school.name}</strong>?</p>
       <p className="muted">They will be denied by the school's protected APIs on their next request; this will not delete their account in any other school.</p>
       <Field label="Required reason"><textarea className="input" required minLength={8} maxLength={500}
         value={form.reason||""} onChange={e=>setForm({...form,reason:e.target.value})}/></Field>
       <button className="button danger" type="submit" disabled={busy}>Revoke access</button>
     </form>}
     {modal==="year"&&<form onSubmit={e=>{e.preventDefault();act({action:"academic.year",name:form.name,
       startsOn:form.startsOn,endsOn:form.endsOn});}}>
       <Field label="Academic year name"><input className="input" required placeholder="e.g. 2027–2028" value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
       <Field label="Start date"><input className="input" required type="date" value={form.startsOn||""} onChange={e=>setForm({...form,startsOn:e.target.value})}/></Field>
       <Field label="End date"><input className="input" required type="date" min={form.startsOn||undefined} value={form.endsOn||""} onChange={e=>setForm({...form,endsOn:e.target.value})}/></Field>
       <button className="button" type="submit" disabled={busy}>Create academic year</button>
     </form>}
     {modal==="class"&&<form onSubmit={e=>{e.preventDefault();act({action:"academic.class",yearId:form.yearId,
       name:form.name,level:form.level,section:form.section||"",capacity:form.capacity||null});}}>
       <Field label="Academic year"><select className="input" value={form.yearId} onChange={e=>setForm({...form,yearId:e.target.value})}>
         {data.years.map(y=><option key={y.id} value={y.id}>{y.name}</option>)}
       </select></Field>
       <Field label="Class name"><input className="input" required maxLength={100} placeholder="e.g. Primary 4" value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
       <Field label="Education level"><input className="input" required maxLength={100} placeholder="e.g. Primary" value={form.level||""} onChange={e=>setForm({...form,level:e.target.value})}/></Field>
       <Field label="Section (optional)"><input className="input" maxLength={50} value={form.section||""} onChange={e=>setForm({...form,section:e.target.value})}/></Field>
       <Field label="Capacity (optional)"><input className="input" type="number" min="1" max="2000" value={form.capacity||""} onChange={e=>setForm({...form,capacity:e.target.value})}/></Field>
       <button type="submit" className="button" disabled={busy}>Create class</button>
     </form>}
     {modal==="subject"&&<form onSubmit={e=>{e.preventDefault();act({action:"academic.subject",
       code:form.code,name:form.name});}}>
       <Field label="Subject code"><input className="input" required maxLength={20} placeholder="e.g. MATH" value={form.code||""} onChange={e=>setForm({...form,code:e.target.value})}/></Field>
       <Field label="Subject name"><input className="input" required maxLength={100} placeholder="Mathematics" value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
       <button type="submit" className="button" disabled={busy}>Create subject</button>
     </form>}
     {modal==="assignment"&&<form onSubmit={e=>{e.preventDefault();act({action:"academic.classSubject",
       classId:form.classId,subjectId:form.subjectId});}}>
       <Field label="Class"><select className="input" value={form.classId} onChange={e=>setForm({...form,classId:e.target.value})}>
         {data.classes.map(c=><option key={c.id} value={c.id}>{c.name} {c.section}</option>)}</select></Field>
       <Field label="Subject"><select className="input" value={form.subjectId} onChange={e=>setForm({...form,subjectId:e.target.value})}>
         {data.subjects.map(s=><option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select></Field>
       <button type="submit" className="button" disabled={busy}>Assign subject to class</button>
     </form>}
   </Dialog>}
 </div>;
}
