"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
const STEPS=["School identity","Logo & photos","Your homepage","School essentials","Review & launch"];
const TYPES=["nursery","primary","secondary","tvet","university","mixed"];
const LEVELS=["nursery","primary","secondary","tvet","university"];
function asForm(p={},s={}){
 return {
   schoolType:p.school_type||"primary",
   educationLevels:p.education_levels||[],
   province:p.province||"",
   district:p.district||"",
   campusName:p.campus_name||"",
   academicYear:p.academic_year||"",
   termSystem:p.term_system||"terms",
   privacyAcknowledged:!!p.privacy_acknowledged,
   tagline:s.tagline||"",
   aboutText:s.about_text||"",
   announcement:s.announcement||"",
   logoUrl:s.logo_url||"",
   heroUrl:s.hero_url||"",
   primaryColor:s.primary_color||"#204a78",
   contactEmail:s.contact_email||"",
   contactPhone:s.contact_phone||"",
   missionStatement:s.mission_statement||"",
   visionStatement:s.vision_statement||"",
   leaderName:s.leader_name||"",
   leaderTitle:s.leader_title||"",
   leaderMessage:s.leader_message||"",
   leaderPhotoUrl:s.leader_photo_url||"",
   advertisements:[0,1,2].map(i=>({title:s.advertisements?.[i]?.title||"",description:s.advertisements?.[i]?.description||"",enabled:Boolean(s.advertisements?.[i]?.enabled)}))
 };
}
function FormField({label,children}){return <label className="field">{label}{children}</label>;}
function SchoolPreview({school,form}){
 return <div className="school-live-preview" style={{"--school-color":form.primaryColor||"#204a78"}}>
   <div className="school-preview-nav">
     {form.logoUrl?<img src={form.logoUrl} alt="Current school logo" width="35" height="35" style={{objectFit:"contain"}}/>:<span>✦</span>}
     <strong>{school.name}</strong>
     <span>School Portal</span>
   </div>
   {form.heroUrl?<div className="school-preview-hero" style={{backgroundImage:"linear-gradient(90deg,#051929cc,#05192940),url("+JSON.stringify(form.heroUrl)+")"}}>
     <h3>{school.name}</h3><p>{form.tagline||"Your school's welcome message"}</p>
   </div>:<div className="school-preview-hero"><h3>{school.name}</h3><p>{form.tagline||"Your school's welcome message"}</p></div>}
   {form.announcement&&<div className="school-preview-announcement">{form.announcement}</div>}
   <div className="school-preview-about"><small>ABOUT OUR SCHOOL</small><h4>Welcome to {school.name}</h4>
     <p>{form.aboutText||"Your school's real story will appear here."}</p>
     {(form.missionStatement||form.visionStatement)&&<div className="school-mini-mission">
        {form.missionStatement&&<p><b>Mission:</b> {form.missionStatement}</p>}
        {form.visionStatement&&<p><b>Vision:</b> {form.visionStatement}</p>}
      </div>}
      {form.leaderName&&<p><b>School leadership:</b> {form.leaderName}{form.leaderTitle?" · "+form.leaderTitle:""}</p>}
      {form.advertisements?.filter(a=>a.enabled&&a.title).map((ad,i)=><div className="school-mini-ad" key={i}><b>{ad.title}</b><p>{ad.description}</p></div>)}
      <small>{form.contactEmail||form.contactPhone||"School contact information"}</small></div>
 </div>;
}
export default function SchoolSetup({code}){
 const [client,setClient]=useState(null);
 const [authReady,setAuthReady]=useState(false);
 const [session,setSession]=useState(null);
 const [loading,setLoading]=useState(true);
 const [details,setDetails]=useState(null);
 const [form,setForm]=useState(asForm());
 const [step,setStep]=useState(1);
 const [busy,setBusy]=useState(false);
 const [uploading,setUploading]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [previewOpen,setPreviewOpen]=useState(false);
 useEffect(()=>{
   const c=browserSupabase();setClient(c);
   if(!c){setAuthReady(true);return;}
   let mounted=true;
   c.auth.getSession().then(({data})=>{if(mounted){setSession(data.session);setAuthReady(true);}});
   const {data:{subscription}}=c.auth.onAuthStateChange((_event,ss)=>{if(mounted)setSession(ss);});
   return ()=>{mounted=false;subscription.unsubscribe();};
 },[]);
 const call=useCallback(async (body=null,upload=false)=>{
   if(!client)throw Error("School authentication is unavailable.");
   const {data}=await client.auth.getSession();
   if(!data?.session?.access_token)throw Error("Your session has expired. Sign in again.");
   const response=await fetch("/api/school/"+code+(upload?"/upload":""),{
      method:body?"POST":"GET",
      headers:{"Authorization":"Bearer "+data.session.access_token,...(body&&!upload?{"Content-Type":"application/json"}:{})},
      ...(body?{body:upload?body:JSON.stringify(body)}:{})
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||"School request failed");
   return result;
 },[client,code]);
 const refresh=useCallback(async()=>{
   if(!session)return;
   setLoading(true);setError("");
   try{
     const result=await call();
     setDetails(result);
     if(result.role==="school_owner"){
       setForm(asForm(result.progress,result.site));
       setStep(Math.max(1,Math.min(5,Number(result.progress?.current_step)||1)));
     }
   }catch(e){setError(e.message);}
   finally{setLoading(false);}
 },[call,session]);
 useEffect(()=>{if(authReady&&session)refresh();else if(authReady)setLoading(false);},[authReady,session,refresh]);
 async function save(nextStep=step,exit=false){
   setBusy(true);setError("");setMessage("");
   try{
     const p={
       action:"saveProfile",schoolType:form.schoolType,
       educationLevels:form.educationLevels,province:form.province,
       district:form.district,campusName:form.campusName,
       academicYear:form.academicYear,termSystem:form.termSystem,
       privacyAcknowledged:form.privacyAcknowledged,currentStep:nextStep
     };
     await call(p);
     await call({
       action:"saveSite",tagline:form.tagline,aboutText:form.aboutText,
       announcement:form.announcement,logoUrl:form.logoUrl,
       heroUrl:form.heroUrl,primaryColor:form.primaryColor,
       contactEmail:form.contactEmail,contactPhone:form.contactPhone,
       missionStatement:form.missionStatement,visionStatement:form.visionStatement,
       leaderName:form.leaderName,leaderTitle:form.leaderTitle,
       leaderMessage:form.leaderMessage,leaderPhotoUrl:form.leaderPhotoUrl,
       advertisements:form.advertisements
     });
     setStep(nextStep);setMessage("Saved successfully. Your school setup is private until publishing.");
     if(exit)window.location.assign("/s/"+code+"/login");
     return true;
   }catch(e){setError(e.message);return false;}
   finally{setBusy(false);}
 }
 async function upload(file,kind){
   if(!file)return;
   setUploading(true);setError("");
   try{
     const data=new FormData();
     data.append("kind",kind);data.append("image",file);
     const result=await call(data,true);
     setForm(prev=>({...prev,[kind==="logo"?"logoUrl":kind==="leader"?"leaderPhotoUrl":"heroUrl"]:result.url}));
     setMessage("Photo uploaded. Select Continue or Save & Exit to save it to your school profile.");
   }catch(e){setError(e.message);}
   finally{setUploading(false);}
 }
 async function finish(action){
   setBusy(true);setError("");setMessage("");
   try{
     if(action==="requestReview") {
       const saved=await save(5);
       if(!saved)return;
     }
     await call({action});
     setMessage(action==="requestReview"?"Your school setup has been submitted for platform approval. You can continue editing.":"Your school website is now published.");
     await refresh();
   }catch(e){setError(e.message);}
   finally{setBusy(false);}
 }
 async function claim(){
   setBusy(true);setError("");
   try{await call({action:"claim"});await refresh();}
   catch(e){setError(e.message);}
   finally{setBusy(false);}
 }
 const set=(key,value)=>setForm(f=>({...f,[key]:value}));
 if(!authReady||loading)return <main className="shell">Loading your school...</main>;
 if(!client)return <main className="shell"><div className="auth-card">School login is not configured yet.</div></main>;
 if(!session)return <main className="shell"><div className="auth-card"><h1>Sign in to your school</h1><p>Use the private school account your institution invited.</p><a className="button" href={"/s/"+code+"/login"}>School sign in</a></div></main>;
 if(error&&!details)return <main className="shell"><div className="auth-card"><h2>Cannot open this school</h2><div className="notice error">{error}</div><button className="button secondary" onClick={async()=>{await client.auth.signOut();window.location.assign("/s/"+code+"/login");}}>Sign out and use a different account</button></div></main>;
 if(details?.invited)return <main className="shell"><div className="auth-card">
   <div className="mark">R</div><h1>Welcome to {details.school.name}</h1>
   <p>Your school owner invitation is ready. Your Company ID and School ID have already been generated.</p>
   <p><strong>Company ID:</strong> {details.school.company_code}<br/><strong>School ID:</strong> {details.school.school_code}</p>
   {error&&<div className="notice error">{error}</div>}
   <button disabled={busy} className="button" onClick={claim}>Activate my school owner access</button>
 </div></main>;
 if(!details?.school)return <main className="shell">School details unavailable.</main>;
 const school=details.school;
 const profile=details.progress||{};
 const isActive=school.status==="active";
 return <div className="school-onboarding">
   <header className="school-onboarding-header">
     <div className="row">
       {form.logoUrl?<img src={form.logoUrl} alt="Official school logo" width="45" height="45" style={{objectFit:"contain"}}/>:<div className="mark">S</div>}
       <div><strong>{school.name}</strong><div className="micro">Your school setup workspace</div></div>
     </div>
     <div className="row"><a href={"/s/"+code} target="_blank" rel="noreferrer">School website</a>
       <button className="button secondary small" onClick={async()=>{await client.auth.signOut();window.location.assign("/s/"+code+"/login");}}>Sign out</button></div>
   </header>
   <div className="school-onboarding-body">
     <section className="school-onboarding-main">
       <div className="school-identity-strip">
         <div><small>COMPANY ID</small><div><strong>{school.company_code}</strong> <button className="button flat" onClick={()=>navigator.clipboard.writeText(school.company_code)}>Copy</button></div></div>
         <div><small>SCHOOL ID</small><div><strong>{school.school_code}</strong> <button className="button flat" onClick={()=>navigator.clipboard.writeText(school.school_code)}>Copy</button></div></div>
         <div><small>STATUS</small><div><span className="pill">{isActive?"Active":profile.review_requested_at?"Review requested":"Setup in progress"}</span></div></div>
       </div>
       <div className="school-step-header"><span>Step {step} of 5</span><strong>{STEPS[step-1]}</strong></div>
       <div className="school-step-track">{STEPS.map((v,i)=><button key={i} aria-label={"Go to "+v} disabled={busy} className={i<step?"done":""} onClick={()=>setStep(i+1)}/>)}</div>
       {error&&<div className="notice error" role="alert">{error}</div>}
       {message&&<div className="notice ok" role="status">{message}</div>}
       <div className="school-step-panel">
         {step===1&&<>
           <h1>Tell us about your school</h1><p className="muted">We generated your Company and School IDs automatically. Just confirm the real institution information.</p>
           <FormField label="Institution type"><select className="input" value={form.schoolType} onChange={e=>set("schoolType",e.target.value)}>{TYPES.map(v=><option value={v} key={v}>{v.toUpperCase()}</option>)}</select></FormField>
           <div className="grid-2">
             <FormField label="Province"><input className="input" maxLength={100} value={form.province} onChange={e=>set("province",e.target.value)} placeholder="Province"/></FormField>
             <FormField label="District"><input className="input" maxLength={100} value={form.district} onChange={e=>set("district",e.target.value)} placeholder="District"/></FormField>
           </div>
           <FormField label="Main campus name"><input className="input" maxLength={120} value={form.campusName} onChange={e=>set("campusName",e.target.value)} placeholder="Name of your school campus"/></FormField>
         </>}
         {step===2&&<>
           <h1>Make it your school</h1><p className="muted">Upload your actual official logo and campus photo. Changes appear immediately in your private preview.</p>
           <div className="grid-2">
             <FormField label="Official school logo"><input className="input" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>upload(e.target.files?.[0],"logo")}/></FormField>
             <FormField label="Campus / school photo"><input className="input" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>upload(e.target.files?.[0],"hero")}/></FormField>
           </div>
           {uploading&&<p className="micro">Processing your photo...</p>}
           <FormField label="School brand color"><input className="input" style={{maxWidth:170}} type="color" value={form.primaryColor} onChange={e=>set("primaryColor",e.target.value)}/></FormField>
           <p className="micro">Marketing photos only. Do not upload students' private documents or identifying records here.</p>
         </>}
         {step===3&&<>
           <h1>Build your homepage</h1><p className="muted">Your school gets its own public welcome page. You control the announcement and introduction.</p>
           <FormField label="Short welcome message"><input className="input" value={form.tagline} maxLength={160} onChange={e=>set("tagline",e.target.value)} placeholder="Your school's motto or welcome statement"/></FormField>
           <FormField label="About your school"><textarea className="input" value={form.aboutText} maxLength={2000} onChange={e=>set("aboutText",e.target.value)} placeholder="Tell families about your school's real mission, education and values"/></FormField>
           <FormField label="Announcement / school news (optional)"><textarea className="input" maxLength={300} value={form.announcement} onChange={e=>set("announcement",e.target.value)} placeholder="Enrollment information, important events or news"/></FormField>
           <div className="school-editor-section">
             <h2>Our mission &amp; vision</h2><p className="muted">Write your school's real mission and vision. You can leave either unpublished until approved.</p>
             <FormField label="Mission statement"><textarea className="input" maxLength={1600} value={form.missionStatement} onChange={e=>set("missionStatement",e.target.value)} placeholder="What does your school exist to accomplish?"/></FormField>
             <FormField label="Vision statement"><textarea className="input" maxLength={1600} value={form.visionStatement} onChange={e=>set("visionStatement",e.target.value)} placeholder="What future does your school aspire to build?"/></FormField>
           </div>
           <div className="school-editor-section">
             <h2>Leadership &amp; school ownership</h2><p className="muted">Introduce your actual school owner, founder, director or principal, with their approved details.</p>
             <div className="grid-2">
               <FormField label="Leader's name"><input className="input" maxLength={120} value={form.leaderName} onChange={e=>set("leaderName",e.target.value)} placeholder="Official name"/></FormField>
               <FormField label="Position or title"><input className="input" maxLength={120} value={form.leaderTitle} onChange={e=>set("leaderTitle",e.target.value)} placeholder="Founder, Director, Headteacher…"/></FormField>
             </div>
             <FormField label="Message from leadership"><textarea className="input" maxLength={1800} value={form.leaderMessage} onChange={e=>set("leaderMessage",e.target.value)} placeholder="An authentic welcome from school leadership"/></FormField>
             <FormField label="Leadership photograph (approved for publication)"><input className="input" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>upload(e.target.files?.[0],"leader")}/></FormField>
             {form.leaderPhotoUrl&&<img src={form.leaderPhotoUrl} alt="Leadership photo preview" width="90" height="105" style={{objectFit:"cover",borderRadius:9}}/>}
           </div>
           <div className="school-editor-section">
             <h2>School advertisements &amp; announcements</h2>
             <p className="muted">Promote school events, admission dates, programs or approved opportunities. These are your school's own posts, not platform billing advertisements.</p>
             {form.advertisements.map((ad,i)=><div className="school-editor-ad" key={i}>
               <label className="row" style={{fontWeight:700}}><input type="checkbox" checked={ad.enabled} onChange={e=>set("advertisements",form.advertisements.map((x,j)=>j===i?{...x,enabled:e.target.checked}:x))}/> Show announcement {i+1} on school homepage</label>
               <FormField label="Title"><input className="input" maxLength={100} value={ad.title} onChange={e=>set("advertisements",form.advertisements.map((x,j)=>j===i?{...x,title:e.target.value}:x))} placeholder="e.g. Open Day / Admissions"/></FormField>
               <FormField label="Description"><textarea className="input" maxLength={400} value={ad.description} onChange={e=>set("advertisements",form.advertisements.map((x,j)=>j===i?{...x,description:e.target.value}:x))} placeholder="What should visitors know?"/></FormField>
             </div>)}
           </div>
           <div className="grid-2">
             <FormField label="Official contact email"><input className="input" type="email" value={form.contactEmail} onChange={e=>set("contactEmail",e.target.value)}/></FormField>
             <FormField label="Telephone number"><input className="input" type="tel" value={form.contactPhone} maxLength={60} onChange={e=>set("contactPhone",e.target.value)}/></FormField>
           </div>
         </>}
         {step===4&&<>
           <h1>Set up the essentials</h1><p className="muted">Only a few choices now. Subjects, homework, grading, fees and staff can be completed when their modules are ready.</p>
           <strong style={{display:"block",marginBottom:8}}>Education levels offered</strong>
           <div className="school-levels">{LEVELS.map(level=><label key={level}><input type="checkbox" checked={form.educationLevels.includes(level)} onChange={e=>set("educationLevels",e.target.checked?[...form.educationLevels,level]:form.educationLevels.filter(v=>v!==level))}/>{level}</label>)}</div>
           <div className="grid-2">
             <FormField label="Current academic year"><input className="input" value={form.academicYear} maxLength={40} onChange={e=>set("academicYear",e.target.value)} placeholder="e.g. 2026–2027"/></FormField>
             <FormField label="Term / semester structure"><select className="input" value={form.termSystem} onChange={e=>set("termSystem",e.target.value)}><option value="terms">Terms</option><option value="semesters">Semesters</option><option value="continuous">Continuous</option></select></FormField>
           </div>
           <label className="row" style={{marginTop:18}}><input type="checkbox" checked={form.privacyAcknowledged} onChange={e=>set("privacyAcknowledged",e.target.checked)}/>I understand that my school is responsible for publishing accurate official information and protecting student privacy.</label>
         </>}
         {step===5&&<>
           <h1>Review before launch</h1><p className="muted">Your information stays private while your school is reviewed. Activating the school is handled by the platform operator.</p>
           <div className="school-review-list">
             <p><strong>School</strong><span>{school.name}</span></p>
             <p><strong>Company ID</strong><span>{school.company_code}</span></p>
             <p><strong>School ID</strong><span>{school.school_code}</span></p>
             <p><strong>Campus</strong><span>{form.campusName||"Not entered"}</span></p>
             <p><strong>Education</strong><span>{form.educationLevels.join(", ")||"Not selected"}</span></p>
             <p><strong>Mission &amp; Vision</strong><span>{form.missionStatement||form.visionStatement?"Entered":"Not yet entered"}</span></p>
             <p><strong>Leadership</strong><span>{form.leaderName||"Not yet entered"}</span></p>
             <p><strong>Active announcements</strong><span>{form.advertisements.filter(x=>x.enabled&&x.title).length}</span></p>
             <p><strong>Website identity</strong><span>{form.logoUrl?"Logo uploaded":"Text-only / no logo yet"} · {form.heroUrl?"Photo uploaded":"No campus photo yet"}</span></p>
           </div>
           <div className="row">
             <button className="button secondary" disabled={busy} onClick={()=>finish("requestReview")}>Submit school for review</button>
             {isActive&&<button className="button" disabled={busy} onClick={()=>finish("publish")}>Publish my school website</button>}
           </div>
           {profile.review_requested_at&&<div className="notice info">Your school setup was submitted for platform review. The platform owner controls activation.</div>}
         </>}
       </div>
       <div className="school-step-actions">
         <button className="button secondary" disabled={busy||step===1} onClick={()=>setStep(v=>Math.max(1,v-1))}>← Back</button>
         <div className="row"><button className="button secondary" disabled={busy||uploading} onClick={()=>save(step,true)}>Save & exit</button>
           {step<5&&<button className="button" disabled={busy||uploading} onClick={()=>save(step+1)}>Save & continue →</button>}
         </div>
       </div>
     </section>
     <aside className="school-preview-panel">
       <div className="row" style={{justifyContent:"space-between",marginBottom:14}}>
         <strong>Live homepage preview</strong>
         <button className="button secondary small" onClick={()=>setPreviewOpen(v=>!v)}>{previewOpen?"Hide":"Toggle"}</button>
       </div>
       <div className={previewOpen?"":"school-preview-mobile-hidden"}><SchoolPreview school={school} form={form}/></div>
       <p className="micro">Private visual preview. Public site appears only after approval and publication.</p>
     </aside>
   </div>
 </div>;
}
