"use client";
import { useCallback, useEffect, useState } from "react";
import { browserSupabase } from "../../lib/client.js";
import { ALL_PERMISSIONS, ROLE_DEFAULTS } from "../../lib/access.mjs";
import { formatRwf } from "../../lib/money.mjs";
import { dueClock,kigaliDate } from "../../lib/billing-clock.mjs";
import Landing from "./Landing.jsx";
import OwnerDashboard from "./OwnerDashboard.jsx";
import { TopBar, SidebarCard, SchoolProfileForm, PlansPanel, ReportsPanel, CommunicationsPanel, HealthPanel, PayBadge, RowMenu } from "./PlatformModules.jsx";
import "./owner-dashboard.css";

const NAV = [
  ["overview","◫","Dashboard","tenants.read"],
  ["tenants","▦","Schools","tenants.read"],
  ["billing","▤","Subscriptions","billing.read"],
  ["methods","▣","Payments & Revenue","billing.methods"],
  ["staff","♧","Users & Access","staff.read"],
  ["security","⚿","Platform Settings",null],
  ["reports","▥","Reports & Analytics","tenants.read"],
  ["comms","✉","Communications","tenants.read"],
  ["tickets","◉","Support tickets","tickets.read"],
  ["health","♡","System Health","tenants.read"],
  ["audit","◷","Audit Logs","audit.read"],
];
const LIFECYCLE = {
  onboarding:["active","paused","suspended","deletion_requested"],
  active:["paused","suspended","archived","deletion_requested"],
  paused:["active","suspended","archived","deletion_requested"],
  suspended:["paused","archived","deletion_requested"],
  archived:["active","deletion_requested"],
  deletion_requested:["paused","archived"],
};
const DATE = (x) => x ? new Date(x).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—";
function Pill({children}) { return <span className={"pill "+String(children||"").toLowerCase()}>{String(children||"").replaceAll("_"," ")}</span>; }
function Empty({title,description}) { return <div className="empty"><strong>{title}</strong><div>{description}</div></div>; }
function Modal({title,onClose,children}) {
  return <div className="modal-backdrop" onClick={onClose} role="presentation"><div role="dialog" aria-modal="true" aria-label={title} className="modal" onClick={(e)=>e.stopPropagation()}><div className="panel-header"><h2>{title}</h2><button className="button secondary small" onClick={onClose}>Close</button></div>{children}</div></div>;
}
function Field({label,children}) { return <label className="field">{label}{children}</label>; }

function Login({client,onLogin}) {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [showPassword,setShowPassword]=useState(false);
  const [mode,setMode]=useState("login");
  const [authOpen,setAuthOpen]=useState(false);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [problem,setProblem]=useState("");
  function openAuth(nextMode){
    setMode(nextMode);
    setAuthOpen(true);
    setProblem("");
    setMessage("");
  }
  useEffect(()=>{
    if(!authOpen)return;
    const onEscape=(event)=>{
      if(event.key==="Escape"&&!loading)setAuthOpen(false);
    };
    window.addEventListener("keydown",onEscape);
    document.getElementById("platform-email")?.focus();
    return ()=>window.removeEventListener("keydown",onEscape);
  },[authOpen,loading]);
  async function submit(e) {
    e.preventDefault();setLoading(true);setMessage("");setProblem("");
    try {
      if(mode==="forgot"){
        const {error}=await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin+"/platform/reset-password"
        });
        if(error)throw error;
        setMessage("If this email has an account, you will receive instructions to reset your password. Check spam and your inbox.");
      } else if(mode==="signup"){
        const {error}=await client.auth.signUp({
          email:email.trim(),password,
          options:{emailRedirectTo:window.location.origin+"/platform"}
        });
        if(error)throw error;
        setMessage("If registration is eligible, check your email for confirmation. Access remains pending until the platform owner approves it.");
        setMode("login");
        setPassword("");
      } else {
        const {data,error}=await client.auth.signInWithPassword({email:email.trim(),password});
        if(error)throw error;
        onLogin(data.session);
      }
    }catch(e){setProblem(e.message||"Unable to complete authentication. Please try again.");}
    finally{setLoading(false);}
  }
  async function signInWithGoogle(){
    setProblem("");setMessage("");setLoading(true);
    try {
      const {error}=await client.auth.signInWithOAuth({
        provider:"google",
        options:{redirectTo:window.location.origin+"/platform"}
      });
      if(error)throw error;
      // Supabase initiates browser navigation to the provider.
    } catch(e){setLoading(false);setProblem(e.message||"Google sign-in is not available.");}
  }
  return <main className="shell lp">
    <Landing onLogin={()=>openAuth("login")} onSignup={()=>openAuth("signup")}/>
    {authOpen&&<div className="lp-auth-overlay" onMouseDown={event=>{if(event.target===event.currentTarget&&!loading)setAuthOpen(false);}}>
    <section className="auth-card" id="platform-sign-in" role="dialog" aria-modal="true" aria-label={mode==="signup"?"Request a platform account":mode==="forgot"?"Reset your password":"Sign in to Umurage"}>
    <button type="button" className="lp-auth-close" aria-label="Close account form" disabled={loading} onClick={()=>setAuthOpen(false)}>×</button>
    <div className="mark">R</div>
    <h1>{mode==="forgot"?"Reset your password":mode==="signup"?"Request a platform account":"Welcome back"}</h1>
    <p>{mode==="forgot"?"Enter your account email. We'll send a private password reset link.":mode==="signup"?"Only approved platform staff and the verified platform owner can use this console.":"Sign in to manage school tenants, private monthly payments, support tickets and your team."}</p>
    {problem&&<div className="notice error" role="alert">{problem}</div>}
    {message&&<div className="notice ok" role="status">{message}</div>}
    <form onSubmit={submit}>
      <Field label="Email address"><input id="platform-email" className="input" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></Field>
      {mode!=="forgot"&&<Field label="Password">
        <div className="password-row">
          <input className="input" type={showPassword?"text":"password"} required minLength={8}
            autoComplete={mode==="login"?"current-password":"new-password"} value={password}
            onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/>
          <button type="button" className="button secondary small" aria-label={showPassword?"Hide password":"Show password"} onClick={()=>setShowPassword(x=>!x)}>{showPassword?"Hide":"Show"}</button>
        </div>
      </Field>}
      <button className="button" disabled={loading} type="submit">
        {loading?"Please wait…":mode==="login"?"Sign in with email":mode==="signup"?"Request account":"Email reset instructions"}
      </button>
    </form>
    {mode==="login"&&<>
      <div className="auth-divider"><span>or</span></div>
      <button className="button secondary google-login" disabled={loading} onClick={signInWithGoogle}>
        <span aria-hidden="true" style={{fontWeight:800,color:"#4285f4",fontSize:17}}>G</span> Continue with Google
      </button>
      <div className="auth-links">
        <button className="button flat" onClick={()=>{setMode("forgot");setProblem("");setMessage("");}}>Forgot password?</button>
        <button className="button flat" onClick={()=>{setMode("signup");setProblem("");setMessage("");}}>Create staff account</button>
      </div>
    </>}
    {mode!=="login"&&<button style={{marginTop:14}} className="button flat" onClick={()=>{setMode("login");setProblem("");setMessage("");}}>← Back to sign in</button>}
    <p className="micro" style={{marginTop:22,marginBottom:0}}>Google login requires an enabled Google provider. Every account still needs approved owner or staff access. The sign-in method never grants privileges.</p>
  </section></div>}</main>;
}

function PermissionToggleTable({permissions,onChange,disabled=false}) {
  return <div className="table-wrap">
    <table className="permission-table">
      <thead><tr><th>Module</th><th>Permission</th><th style={{textAlign:"center"}}>Access</th></tr></thead>
      <tbody>{ALL_PERMISSIONS.map(permission=><tr key={permission}>
        <td>{permission.split(".")[0].replace("billing","Payments").replace("tenants","Tenants").replace("tickets","Support").replace("staff","Staff").replace("audit","Audit")}</td>
        <td>{({ "tenants.read":"View tenants and IDs","tenants.create":"Register new school","tenants.lifecycle":"Pause / activate tenants","tickets.read":"View support tickets","tickets.manage":"Manage and assign tickets","billing.read":"View RWF revenue","billing.methods":"Configure payment methods","staff.read":"View team directory","staff.manage":"Manage staff (owner approval still required)","audit.read":"View audit records" })[permission]||permission}
          <div className="micro">{permission}</div></td>
        <td style={{textAlign:"center"}}>
          <label className="switch">
            <input type="checkbox" disabled={disabled} checked={permissions.includes(permission)} onChange={e=>onChange(permission,e.target.checked)} aria-label={"Allow "+permission}/>
            <span className="switch-track" aria-hidden="true"/>
          </label>
        </td>
      </tr>)}</tbody>
    </table>
  </div>;
}

export default function PlatformPage() {
  const [client,setClient]=useState(null);
  const [session,setSession]=useState(null);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("overview");
  const [data,setData]=useState(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState("all");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const [purgePreview,setPurgePreview]=useState(null);

  useEffect(()=>{ const c=browserSupabase(); setClient(c); if(!c)setLoading(false); },[]);

  useEffect(()=>{
    if(!client){return;}
    let mounted=true;
    client.auth.getSession().then(({data})=>{if(mounted){setSession(data.session);setLoading(false);}});
    const {data:{subscription}}=client.auth.onAuthStateChange((_event,newSession)=>setSession(newSession));
    return ()=>{mounted=false;subscription.unsubscribe();};
  },[client]);

  const api=useCallback(async (body=null,endpoint="/api/platform")=>{
    const {data:sessionData}=await client.auth.getSession();
    const token=sessionData?.session?.access_token;
    if(!token)throw new Error("Please sign in again.");
    const response=await fetch(endpoint,{
      method:body?"POST":"GET",
      headers:{"Authorization":"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
      ...(body?{body:JSON.stringify(body)}:{})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error||"Request failed.");
    return result;
  },[client]);

  const refresh=useCallback(async()=>{
    try{const result=await api();setData(result);setError("");}
    catch(e){setError(e.message);setData(null);}
  },[api]);
  useEffect(()=>{if(session)refresh();else setData(null);},[session,refresh]);

  function open(mode,payload={}){
    setModal(mode);setForm(payload);setPurgePreview(null);setError("");setNotice("");
  }
  async function previewPurge(tenant){
    setBusy(true);setError("");setNotice("");
    try{
      const response=await api({action:"tenant.purge.preview",schoolId:tenant.id});
      setPurgePreview(response.result);
      setForm({tenant,confirmSchoolCode:"",confirmPhrase:"",reason:"",acknowledge:false});
      setModal("purge");
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  }
  async function openTicketHistory(ticket){
setBusy(true);setError("");setNotice("");
try{
const response=await api({action:"ticket.history",id:ticket.id});
setForm({ticket,history:response.result||[]});
setModal("ticketHistory");
}catch(e){setError(e.message);}
finally{setBusy(false);}
}
async function action(body,endpoint="/api/platform"){
    setBusy(true);setError("");setNotice("");
    try{
      const output=await api(body,endpoint);
      setModal(null);setForm({});setPurgePreview(null);
      await refresh();
      setNotice(body.action==="tenant.purge"?
        "Deletion verified: School "+(output.result?.school_code||"")+
        " and its school-scoped database rows were removed. Uploaded school files removed: "+
        (output.result?.storage_objects_removed??0)+
        ". Shared user accounts and provider backups follow separate retention rules.":
        body.action==="tenant.demo.create"?
        "Fictional demo school created: "+(output.result?.school_code||"")+
        (output.result?.demo_logo_uploaded?
         ". Its sample logo was uploaded into tenant-owned Storage.":
         ". The sample logo was not uploaded; you can add one in School Site.")+
        " Open Tenant Management to preview it and test permanent deletion.":
        "Change saved and verified by the API.");
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  }
  async function uploadBrandImage(file,kind) {
    if(!file)return;
    if(!form.tenant?.id){setError("Choose a school first.");return;}
    setUploading(true);setError("");
    try{
      const {data:sessionData}=await client.auth.getSession();
      const token=sessionData?.session?.access_token;
      if(!token)throw new Error("Sign in to upload");
      const fd=new FormData();
      fd.append("schoolId",form.tenant.id);
      fd.append("kind",kind);
      fd.append("image",file);
      const response=await fetch("/api/platform/upload",{
        method:"POST",headers:{"Authorization":"Bearer "+token},body:fd
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error||"Upload failed");
      setForm(current=>({...current,[kind==="logo"?"logoUrl":"heroUrl"]:body.url}));
      setNotice("Image uploaded. Save the school site details to publish changes.");
    }catch(e){setError(e.message);}
    finally{setUploading(false);}
  }
  const allowed=(permission)=>Boolean(data?.actor?.isOwner || data?.actor?.permissions?.includes(permission));
  const tenants=(data?.tenants||[]).filter(t=>{
    const search=[t.name,t.school_code,t.owner_email,t.platform_companies?.name,t.platform_companies?.company_code].join(" ").toLowerCase();
    return search.includes(query.trim().toLowerCase()) && (filter==="all"||t.status===filter);
  });

  const openProfile=(t)=>open("profile",{tenant:t,province:t.province||"",district:t.district||"",educationLevel:t.education_level||"",planCode:t.plan_code||""});
  if(loading)return <main className="shell">Loading secure account...</main>;
  if(!client)return <main className="shell"><div className="auth-card"><h1>Setup required</h1><p>Provide the Supabase URL and publishable key in the deployment environment. No records are available until secure connection is configured.</p></div></main>;
  if(!session)return <Login client={client} onLogin={setSession}/>;
  if(!data&& !error)return <main className="shell">Checking your access...</main>;
  if(error&&!data)return <main className="shell"><div className="auth-card"><h1>Console unavailable</h1><div className="notice error">{error}</div><button className="button" onClick={refresh}>Try again</button><button style={{marginTop:10}} className="button secondary" onClick={()=>client.auth.signOut()}>Sign out</button></div></main>;
  if(data.needsApproval&&data.schools?.length){if(typeof window!=="undefined")window.location.replace("/s/"+data.schools[0].code+"/portal");return <main className="shell">Opening your school...</main>;}
  if(data.needsApproval)return <main className="shell"><div className="auth-card"><div className="mark">R</div><h1>Access pending</h1><p>This account has no approved platform-owner or staff permissions. Selecting a role does not grant access.</p><RequestAccess onSubmit={(reason)=>action({reason},"/api/platform/request-access")} busy={busy}/>{error&&<div className="notice error">{error}</div>}{notice&&<div className="notice ok">{notice}</div>}<button className="button secondary" onClick={()=>client.auth.signOut()}>Sign out</button></div></main>;

  return <div className="dashboard">
    <aside className="sidebar">
      <div className="brand"><div className="mark">R</div><div><strong>Umurage</strong><small>School Management Platform</small></div></div>
      <nav className="nav" aria-label="Management">
        {NAV.filter((item)=>!item[3]||allowed(item[3])).map(([id,icon,label])=>
          <button key={id} className={tab===id?"active":""} onClick={()=>{setTab(id);setNotice("");setError("");}}><span className="nav-icon">{icon}</span>{label}</button>)}
      </nav>
      <SidebarCard/>
    </aside>
    <main className="main">
      <TopBar data={data} onGo={(id)=>{setTab(id);setNotice("");setError("");}} onPick={(h)=>{setTab(h.tab);if(h.tab==="tenants")setQuery(h.query);}} onSignOut={()=>client.auth.signOut()}/>
      {error&&<div style={{marginTop:20}} className="notice error" role="alert">{error}<button className="button flat" onClick={()=>setError("")}>Dismiss</button></div>}
      {notice&&<div style={{marginTop:20}} className="notice ok" role="status">{notice}</div>}
      {tab==="overview"&&<OwnerDashboard data={data} canBilling={allowed("billing.read")} canCreate={allowed("tenants.create")} go={(id)=>{setTab(id);setNotice("");setError("");}} onAddSchool={()=>open("newTenant")}/>}
      {tab==="reports"&&<ReportsPanel data={data} canSave={allowed("tenants.read")} canDelete={allowed("tenants.lifecycle")} busy={busy} onAct={action}/>}
      {tab==="comms"&&<CommunicationsPanel data={data} canManage={allowed("tickets.manage")} busy={busy} onSend={action}/>}
      {tab==="health"&&<HealthPanel data={data} onRefresh={refresh}/>}
      {tab==="tenants"&&<>
        <Header title="Schools" description="Every school on the platform, where it is, and when its next monthly payment is due." action={allowed("tenants.create")?<div className="row">
          {data.actor.isOwner&&<button className="button secondary" disabled={busy}
           onClick={()=>open("demo")}>+ Create Mockup School</button>}
          <button className="button secondary" onClick={()=>open("addSchool")}>+ School in existing company</button>
          <button className="button" onClick={()=>open("newTenant")}>+ Register school</button>
        </div>:null}/>
        <div className="panel">
          <div className="panel-header"><div className="row"><input aria-label="Search tenants" className="input" style={{width:260}} placeholder="Search school, ID or owner" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Tenant status" className="input" style={{width:150}} value={filter} onChange={e=>setFilter(e.target.value)}>{["all",...Object.keys(LIFECYCLE)].map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></div><span className="muted">{tenants.length} results</span></div>
          <TenantTable onProfile={openProfile} stats={data.schoolStats||{}} tenants={tenants} feeTerms={data.feeTerms||[]} canManage={allowed("tenants.lifecycle")} canRecord={allowed("billing.record")} canBrand={allowed("tenants.brand")} canPurge={data.actor.isOwner} onPurge={previewPurge} onState={(t)=>open("state",{tenant:t})} onPaid={(t)=>open("paid",{tenant:t,paidOn:kigaliDate(),amountRwf:data.feeTerms.find(f=>f.school_id===t.id)?.monthly_fee_rwf||""})} onTerms={(t)=>open("terms",{tenant:t,monthlyAmountRwf:data.feeTerms.find(f=>f.school_id===t.id)?.monthly_fee_rwf||"",firstDueOn:data.feeTerms.find(f=>f.school_id===t.id)?.next_due_on||kigaliDate()})} onBrand={(t)=>open("brand",{tenant:t,...siteForm(data.sites.find(x=>x.school_id===t.id))})}/>
          {(data.totals.tenants>=200)&&<p className="micro">Showing latest 200 tenants. Server pagination is required before large-scale production use.</p>}
        </div>
      </>}
      {tab==="tickets"&&<>
        <Header title="Support tickets" description="Track school problems, assignment and resolution." action={allowed("tickets.manage")?<button className="button" onClick={()=>open("newTicket")}>+ New ticket</button>:null}/>
        <div className="panel"><div className="table-wrap"><table><thead><tr><th>Ticket</th><th>School</th><th>Priority</th><th>Status</th><th>Opened</th><th>Assigned</th><th>Action</th></tr></thead><tbody>
          {(data.tickets||[]).map(t=><tr key={t.id}><td><strong>{t.title}</strong><div className="micro" style={{whiteSpace:"normal",maxWidth:290}}>{t.description}</div><button type="button" className="button flat" disabled={busy} onClick={()=>openTicketHistory(t)}>View history</button></td><td>{data.tenants.find(s=>s.id===t.school_id)?.name||"School"}</td><td>{allowed("tickets.manage")?<select className="input" aria-label="Change ticket priority" value={t.priority} disabled={busy} onChange={e=>action({action:"ticket.priority",id:t.id,priority:e.target.value})}>{["low","normal","urgent"].map(p=><option key={p} value={p}>{p}</option>)}</select>:<Pill>{t.priority}</Pill>}</td><td><Pill>{t.status}</Pill></td><td>{DATE(t.created_at)}</td><td>{allowed("staff.read")&&allowed("tickets.manage")?<select className="input" aria-label="Assign ticket" value={t.assigned_to||""} disabled={busy} onChange={e=>action({action:"ticket.assign",id:t.id,assigneeId:e.target.value})}><option value="">Unassigned</option>{data.staff.filter(p=>p.active&&p.permissions.includes("tickets.manage")).map(p=><option key={p.auth_user_id} value={p.auth_user_id}>{p.email}</option>)}</select>:(t.assigned_to?"Assigned":"Unassigned")}</td><td>{allowed("tickets.manage")?<select className="input" aria-label="Change ticket status" value={t.status} onChange={e=>action({action:"ticket.update",id:t.id,status:e.target.value})} disabled={busy}>{["open","in_progress","resolved"].map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select>:"View only"}</td></tr>)}
        </tbody></table>{!data.tickets.length&&<Empty title="No support tickets" description="School issues and their resolution history will appear here."/>}</div></div>
      </>}
      {tab==="billing"&&<>
        <PlansPanel plans={data.plans||[]} tenants={data.tenants||[]} isOwner={Boolean(data.actor.isOwner)} busy={busy} onSave={action}/>
        <Header title="Private monthly payment clock" description="Record what you received offline. No subscription checkout, no automated charges, and no billing details visible to schools."/>
        <div className="cards">
          <Metric label="Total manually recorded" value={formatRwf(data.totals.manualCollectedRwf||0)}/>
          <Metric label="Monthly fees expected" value={formatRwf(data.totals.monthlyExpectedRwf||0)}/>
          <Metric label="Past-due schools" value={data.totals.pastDue||0}/>
          <Metric label="Due today" value={data.totals.dueToday||0}/>
        </div>
        <div className="panel"><div className="panel-header"><h2>School payment countdowns</h2><span className="micro">Calendar dates in Rwanda time</span></div>
          <div className="table-wrap"><table><thead><tr><th>School</th><th>Monthly amount</th><th>Last paid</th><th>Next due</th><th>Countdown</th><th>Owner actions</th></tr></thead><tbody>
          {(data.tenants||[]).map(t=>{const fee=data.feeTerms.find(f=>f.school_id===t.id);const clock=dueClock(fee?.next_due_on);
            return <tr key={t.id}><td><strong>{t.name}</strong><div className="micro">{t.school_code}</div></td>
              <td>{fee?formatRwf(fee.monthly_fee_rwf):"Not configured"}</td><td>{fee?.last_paid_on||"—"}</td>
              <td>{fee?.next_due_on||"—"}</td><td><PayBadge due={fee?.next_due_on}/><div className="micro">{clock.label}</div></td>
              <td>{allowed("billing.record")&&<div className="row"><button className="button small secondary" onClick={()=>open("terms",{tenant:t,monthlyAmountRwf:fee?.monthly_fee_rwf||"",firstDueOn:fee?.next_due_on||kigaliDate()})}>Set fee</button>
                <button className="button small" disabled={!fee?.monthly_fee_rwf} onClick={()=>open("paid",{tenant:t,paidOn:kigaliDate(),amountRwf:fee?.monthly_fee_rwf||""})}>Mark paid</button></div>}</td></tr>})}
          </tbody></table>{!data.tenants.length&&<Empty title="No schools" description="Register a school first; only you can set its monthly fee and record payments."/>}</div>
        </div>
        <div className="panel"><div className="panel-header"><h2>Manual payment history</h2><span className="micro">Most recent 300 entries · corrections are preserved</span></div>
          <div className="table-wrap"><table><thead><tr><th>School</th><th>Paid date</th><th>Amount</th><th>How received</th><th>Reference</th><th>Entry status</th><th></th></tr></thead><tbody>
          {(data.manualPayments||[]).map(p=><tr key={p.id}>
            <td>{data.tenants.find(t=>t.id===p.school_id)?.name||"School"}</td><td>{p.paid_on}</td>
            <td>{formatRwf(p.amount_rwf)}</td><td>{p.method.replaceAll("_"," ")}</td><td>{p.reference||"—"}</td><td><Pill>{p.state}</Pill></td>
            <td>{data.actor.isOwner&&p.state==="recorded"&&<button className="button small secondary" onClick={()=>open("voidPayment",{payment:p})}>Correct</button>}</td>
          </tr>)}
          </tbody></table>{!data.manualPayments.length&&<Empty title="No manual receipts" description="Once you mark a school paid, the record and new due date will appear here."/>}</div>
        </div>
        <div className="notice info">A payment is marked paid only when you explicitly record it. It never automatically charges a tenant. If your client has made a partial payment, don't mark the month paid until you receive the full required amount.</div>
      </>}
      {tab==="methods"&&<>
        <Header title="Accepted payment methods" description="Internal payment channel labels for your manual payment records." action={<button className="button" onClick={()=>open("newMethod")}>+ Add method</button>}/>
        <div className="notice info">These controls manage payment-method options only. They do not create MTN MoMo or bank integrations, move funds, or change a bank account.</div>
        <div className="panel"><div className="table-wrap"><table><thead><tr><th>Method</th><th>Type</th><th>Enabled</th><th>Default</th><th>Actions</th></tr></thead><tbody>
          {data.methods.map(m=><tr key={m.id}><td><strong>{m.label}</strong></td><td>{m.type.replaceAll("_"," ")}</td><td><Pill>{m.enabled?"active":"disabled"}</Pill></td><td>{m.is_default?"Default":"—"}</td><td><div className="row"><button className="button small secondary" disabled={busy} onClick={()=>action({action:"method.toggle",id:m.id,enabled:!m.enabled})}>{m.enabled?"Disable":"Enable"}</button>{!m.is_default&&<button className="button small secondary" disabled={busy} onClick={()=>action({action:"method.default",id:m.id})}>Make default</button>}</div></td></tr>)}
          </tbody></table>{!data.methods.length&&<Empty title="No payment methods configured" description="Add labels such as MTN Mobile Money or bank transfer. Provider integrations must be completed separately."/>}</div></div>
      </>}
      {tab==="staff"&&<>
        <Header title="Platform staff access" description="Approve staff and grant only the permissions they need." action={data.actor.isOwner?<button className="button" onClick={()=>open("inviteStaff",{role:"support",permissions:[...ROLE_DEFAULTS.support]})}>+ Invite staff</button>:null}/>
        {data.actor.isOwner&&<div className="panel"><div className="panel-header"><h2>Access requests</h2><span className="micro">{data.requests.length} pending</span></div>
          {(data.requests||[]).map(r=><div key={r.id} className="panel" style={{background:"#f8fafc",marginBottom:9}}><div className="row" style={{justifyContent:"space-between"}}><div><strong>{r.email}</strong><p className="section-subtitle">{r.reason}</p></div><button className="button small" onClick={()=>open("approveStaff",{request:r,role:"support",permissions:[...ROLE_DEFAULTS.support]})}>Review access</button></div></div>)}
          {!data.requests.length&&<Empty title="No pending requests" description="Staff register and request access; only you can approve their permissions."/>}
        </div>}
        <div className="panel"><div className="panel-header"><h2>Approved platform staff</h2></div><div className="table-wrap"><table><thead><tr><th>Staff account</th><th>Role</th><th>Permissions</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.staff.map(s=><tr key={s.auth_user_id}><td>{s.email}</td><td>{s.role}</td><td style={{whiteSpace:"normal",maxWidth:280}}>{s.permissions.join(", ")||"None"}</td><td><Pill>{s.active?"active":"disabled"}</Pill></td><td>{data.actor.isOwner&&s.active?<div className="row"><button className="button small secondary" onClick={()=>open("editStaff",{staff:s,role:s.role,permissions:[...s.permissions]})}>Access table</button><button className="button small secondary" onClick={()=>open("disableStaff",{staff:s})}>Revoke</button></div>:"—"}</td></tr>)}</tbody></table>{!data.staff.length&&<Empty title="No staff accounts" description="You are the verified platform owner. Approve access requests when you add your team."/>}</div></div>
      </>}
      {tab==="audit"&&<>
        <Header title="Audit history" description="Trace platform-wide actions and permissions changes."/>
        <div className="panel"><div className="table-wrap"><table><thead><tr><th>When</th><th>Action</th><th>Actor ID</th><th>Resource</th><th>Details</th></tr></thead><tbody>{data.audit.map(a=><tr key={a.id}><td>{DATE(a.created_at)}</td><td>{a.event}</td><td><kbd>{a.actor_id?.slice(0,13)}…</kbd></td><td><kbd>{a.resource_id?.slice(0,13)||"—"}</kbd></td><td style={{whiteSpace:"normal",maxWidth:340}}>{Object.entries(a.metadata||{}).map(([k,v])=>k.replaceAll("_"," ")+": "+(v&&typeof v==="object"?JSON.stringify(v):String(v))).join(", ")||"—"}</td></tr>)}</tbody></table>{!data.audit.length&&<Empty title="No recorded activity" description="Auditable platform operations will appear here."/>}</div></div>
      </>}
      {tab==="security"&&<>
        <Header title="Account security" description="Platform access is controlled by identity, roles and permissions."/>
        <div className="panel stacked">
          <h2>Your secure platform account</h2>
          <p className="muted">Sign in with your verified account email and password. The Platform Owner console, school information and staff privileges remain limited to verified authorized accounts.</p>
          <p className="muted">Platform operations retain owner-only rules, scoped staff permissions, audit history and explicit confirmation for deletion. Additional verification will be introduced in a future security release.</p>
        </div>
      </>}
    </main>
    {modal&&<Modal title={modalTitle(modal)} onClose={()=>setModal(null)}>
{error&&<div className="notice error" role="alert">{error}</div>}
      {modal==="demo"&&<div className="tenant-purge-body">
        <p><strong>Mockup School: Kigali Learning Academy · DEMO</strong></p>
        <p>This creates a fictional, clearly labeled sample institution with a unique Company ID and School ID, branded public homepage, school owner access, one demo student, class, subject, timetable, homework, attendance, sample RWF invoice, and school announcement. It will not send invitation emails or collect real money.</p>
        <p className="notice info">Requires your verified platform-owner session. The sample is created in your connected environment only when you confirm.</p>
        <div className="modal-footer"><button className="button" disabled={busy}
          onClick={()=>action({action:"tenant.demo.create"})}>Create fictional demo tenant</button></div>
      </div>}
      {modal==="purge"&&purgePreview&&<form className="tenant-purge-body"
        onSubmit={e=>{e.preventDefault();action({
         action:"tenant.purge",schoolId:form.tenant.id,
         confirmSchoolCode:form.confirmSchoolCode,
         confirmPhrase:form.confirmPhrase,reason:form.reason
        });}}>
        <p className="notice error"><strong>PERMANENT DELETION — NOT ARCHIVE</strong> This destroys the selected school's live tenant records and uploaded school files. It cannot be undone from the application.</p>
        <p><strong>{purgePreview.school_name}</strong> · <kbd>{purgePreview.school_code}</kbd>
          {purgePreview.is_demo?" · FICTIONAL DEMO":""}</p>
        <div className="cards">
          <Metric label="School-scoped database tables" value={purgePreview.school_scoped_tables}/>
          <Metric label="School records to remove" value={purgePreview.tenant_rows}/>
          <Metric label="Uploaded school files" value={purgePreview.stored_files}/>
          <Metric label="Other schools in company" value={purgePreview.other_schools_in_company}/>
        </div>
        {purgePreview.legal_hold&&<p className="notice error">
          This school has a legal hold and cannot be deleted.</p>}
        <div className="table-wrap tenant-purge-inventory"><table>
          <thead><tr><th>School data category</th><th>Records</th></tr></thead>
          <tbody>{Object.entries(purgePreview.rows_by_table||{}).filter(([_,count])=>Number(count)>0)
            .sort((a,b)=>b[1]-a[1]).map(([table,count])=>
              <tr key={table}><td>{table.replaceAll("_"," ")}</td><td>{count}</td></tr>)}</tbody>
        </table></div>
        <div className="notice info">
          Deletion removes this tenant's records across admissions, students, staff memberships,
          curricula, timetables, messages, reports, invoices, payments, receipts, and branding files.
          It preserves other schools and shared Supabase login accounts.
          Backups, independently hosted images and already delivered external emails cannot be
          immediately erased through this control.
        </div>
        <Field label="Reason for permanent deletion (at least 12 characters)">
          <textarea className="input" required minLength={12} maxLength={480}
            placeholder="Explain why this school should be permanently removed"
            value={form.reason||""} onChange={e=>setForm({...form,reason:e.target.value})}/>
        </Field>
        <Field label={"Type this School ID exactly: "+purgePreview.school_code}>
          <input className="input" required autoComplete="off"
            value={form.confirmSchoolCode||""}
            onChange={e=>setForm({...form,confirmSchoolCode:e.target.value})}/>
        </Field>
        <Field label='Type exactly: DELETE ALL SCHOOL DATA'>
          <input className="input" required autoComplete="off" placeholder="DELETE ALL SCHOOL DATA"
            value={form.confirmPhrase||""}
            onChange={e=>setForm({...form,confirmPhrase:e.target.value})}/>
        </Field>
        <label className="row"><input type="checkbox"
          checked={Boolean(form.acknowledge)}
          onChange={e=>setForm({...form,acknowledge:e.target.checked})}/>
          <span>I understand this deletes the school and its data, not only its tenant listing.</span>
        </label>
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={()=>setModal(null)}>Cancel</button>
          <button type="submit" className="button danger" disabled={
            busy||purgePreview.legal_hold||!form.acknowledge||
            form.confirmSchoolCode!==purgePreview.school_code||
            form.confirmPhrase!=="DELETE ALL SCHOOL DATA"||(form.reason||"").trim().length<12
          }>Permanently delete school and verify wipe</button>
{!busy&&!purgePreview.legal_hold&&(!form.acknowledge||form.confirmSchoolCode!==purgePreview.school_code||form.confirmPhrase!=="DELETE ALL SCHOOL DATA"||(form.reason||"").trim().length<12)&&<p className="micro" style={{width:"100%",textAlign:"right",margin:"6px 0 0"}}>To enable deletion: give a reason of at least 12 characters, type the School ID and the phrase exactly, and tick the box.</p>}
        </div>
      </form>}
      {modal==="profile"&&<SchoolProfileForm form={form} setForm={setForm} plans={data.plans||[]} busy={busy} onSubmit={()=>action({action:"school.profile",schoolId:form.tenant.id,province:form.province,district:form.district,educationLevel:form.educationLevel,planCode:form.planCode})}/>}
      {modal==="newTenant"&&<form onSubmit={e=>{e.preventDefault();action({action:"tenant.create",companyName:form.companyName,schoolName:form.schoolName,ownerEmail:form.ownerEmail});}}>
        <p className="muted">The platform will automatically generate a unique Company ID and School ID. School access remains in onboarding until approved.</p>
        <Field label="Company or school group"><input className="input" required maxLength={120} value={form.companyName||""} onChange={e=>setForm({...form,companyName:e.target.value})}/></Field>
        <Field label="Official school name"><input className="input" required maxLength={120} value={form.schoolName||""} onChange={e=>setForm({...form,schoolName:e.target.value})}/></Field>
        <Field label="School owner's email"><input className="input" type="email" required value={form.ownerEmail||""} onChange={e=>setForm({...form,ownerEmail:e.target.value})}/></Field>
        <div className="modal-footer"><button type="submit" className="button" disabled={busy}>Register school</button></div>
      </form>}
      {modal==="inviteSchoolOwner"&&<div>
        <p>Invite the owner of <strong>{form.tenant.name}</strong> to their own branded school setup.</p>
        <p className="micro">Invitation will be sent to {form.tenant.owner_email}. Existing verified users may sign in with their current account without a new invitation email.</p>
        <div className="notice info">Sending the invitation requires your role authorization-authenticated platform-owner session. The school owner will not receive access to your platform billing or other schools.</div>
        <div className="modal-footer"><button className="button" disabled={busy} onClick={()=>action({action:"school.inviteOwner",schoolId:form.tenant.id})}>Email school owner</button></div>
      </div>}
      {modal==="addSchool"&&<form onSubmit={e=>{e.preventDefault();action({action:"tenant.addSchool",companyId:form.companyId,schoolName:form.schoolName,ownerEmail:form.ownerEmail});}}>
        <p className="muted">A second school shares its company's existing Company ID, while receiving its own new School ID.</p>
        <Field label="Existing school company"><select className="input" required value={form.companyId||""} onChange={e=>setForm({...form,companyId:e.target.value})}><option value="">Choose existing company</option>{[...new Map(data.tenants.map(t=>[t.company_id,{id:t.company_id,name:t.platform_companies?.name||"Company",code:t.platform_companies?.company_code||""}])).values()].map(c=><option key={c.id} value={c.id}>{c.name} · {c.code}</option>)}</select></Field>
        <Field label="New school name"><input className="input" required maxLength={120} value={form.schoolName||""} onChange={e=>setForm({...form,schoolName:e.target.value})}/></Field>
        <Field label="School owner's email"><input className="input" required type="email" value={form.ownerEmail||""} onChange={e=>setForm({...form,ownerEmail:e.target.value})}/></Field>
        <div className="modal-footer"><button className="button" disabled={busy} type="submit">Create school under company</button></div>
      </form>}
      {modal==="terms"&&<form onSubmit={e=>{e.preventDefault();action({action:"fee.terms",schoolId:form.tenant.id,monthlyAmountRwf:Number(form.monthlyAmountRwf),firstDueOn:form.firstDueOn});}}>
        <p className="muted">Private monthly fee terms for <strong>{form.tenant.name}</strong>. Schools never see these internal settings.</p>
        <Field label="Monthly fee (RWF)"><input className="input" type="number" min="0" step="1" required value={form.monthlyAmountRwf??""} onChange={e=>setForm({...form,monthlyAmountRwf:e.target.value})}/></Field>
        <Field label="First monthly due date"><input className="input" type="date" required value={form.firstDueOn||""} onChange={e=>setForm({...form,firstDueOn:e.target.value})}/></Field>
        <p className="micro">After recording a payment, changing the monthly fee will preserve the payment history and the current next due date.</p>
        <div className="modal-footer"><button className="button" disabled={busy} type="submit">Save private fee settings</button></div>
      </form>}
      {modal==="paid"&&<form onSubmit={e=>{e.preventDefault();action({action:"fee.paid",schoolId:form.tenant.id,amountRwf:Number(form.amountRwf),paidOn:form.paidOn,method:form.method||"mobile_money",reference:form.reference||"",notes:form.notes||""});}}>
        <p className="muted">Confirm that you personally received payment from <strong>{form.tenant.name}</strong>. This does not collect money or notify the school.</p>
        <Field label="Amount actually received (RWF)"><input className="input" type="number" min="1" step="1" required value={form.amountRwf??""} onChange={e=>setForm({...form,amountRwf:e.target.value})}/></Field>
        <Field label="Date payment received"><input className="input" type="date" required max={kigaliDate()} value={form.paidOn||""} onChange={e=>setForm({...form,paidOn:e.target.value})}/></Field>
        <Field label="How you received payment"><select className="input" value={form.method||"mobile_money"} onChange={e=>setForm({...form,method:e.target.value})}><option value="mobile_money">Mobile Money</option><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="other">Other</option></select></Field>
        <Field label="Reference (optional)"><input className="input" maxLength={120} value={form.reference||""} onChange={e=>setForm({...form,reference:e.target.value})}/></Field>
        <Field label="Private notes (optional)"><textarea className="input" maxLength={500} value={form.notes||""} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
        <div className="notice info">When you mark paid, the next due date becomes one calendar month after the received date. The receipt stays in your private audit ledger.</div>
        <div className="modal-footer"><button type="submit" className="button" disabled={busy}>Confirm paid and restart clock</button></div>
      </form>}
      {modal==="voidPayment"&&<form onSubmit={e=>{e.preventDefault();action({action:"fee.void",id:form.payment.id,reason:form.reason});}}>
        <p>Correct a mistaken manual payment entry. The original entry will remain visible in your audit ledger.</p>
        <Field label="Why should this payment entry be corrected?"><textarea className="input" required minLength={8} value={form.reason||""} onChange={e=>setForm({...form,reason:e.target.value})}/></Field>
        <div className="modal-footer"><button type="submit" className="button danger" disabled={busy}>Void mistaken entry</button></div>
      </form>}
      {modal==="brand"&&<form onSubmit={e=>{e.preventDefault();action({
          action:"tenant.brand",schoolId:form.tenant.id,tagline:form.tagline,aboutText:form.aboutText,announcement:form.announcement,
          logoUrl:form.logoUrl,heroUrl:form.heroUrl,primaryColor:form.primaryColor,contactEmail:form.contactEmail,
          contactPhone:form.contactPhone,isPublished:form.isPublished
        });}}>
        <p className="muted">The school will have its own logo, photographs and welcome page. Preview the school site before publishing.</p>
        <Field label="School logo"><input className="input" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>uploadBrandImage(e.target.files?.[0],"logo")}/></Field>
        {form.logoUrl&&<img src={form.logoUrl} alt="Uploaded school logo preview" style={{height:90,width:90,objectFit:"contain"}}/>}
        <Field label="Homepage hero/campus photo"><input className="input" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>uploadBrandImage(e.target.files?.[0],"hero")}/></Field>
        {form.heroUrl&&<img src={form.heroUrl} alt="Uploaded campus photo preview" style={{height:110,width:"100%",objectFit:"cover",borderRadius:8}}/>}
        <Field label="School tagline"><input className="input" maxLength={160} value={form.tagline||""} onChange={e=>setForm({...form,tagline:e.target.value})}/></Field>
        <Field label="Welcome / About text"><textarea className="input" maxLength={2000} value={form.aboutText||""} onChange={e=>setForm({...form,aboutText:e.target.value})}/></Field>
        <Field label="Homepage announcement (optional)"><textarea className="input" maxLength={300} value={form.announcement||""} onChange={e=>setForm({...form,announcement:e.target.value})}/></Field>
        <Field label="Primary brand color"><input className="input" type="color" value={form.primaryColor||"#204a78"} onChange={e=>setForm({...form,primaryColor:e.target.value})}/></Field>
        <Field label="Official school email"><input className="input" type="email" value={form.contactEmail||""} onChange={e=>setForm({...form,contactEmail:e.target.value})}/></Field>
        <Field label="Official school telephone"><input className="input" type="tel" maxLength={60} value={form.contactPhone||""} onChange={e=>setForm({...form,contactPhone:e.target.value})}/></Field>
        <label className="row" style={{marginBottom:14}}><input type="checkbox" checked={Boolean(form.isPublished)} onChange={e=>setForm({...form,isPublished:e.target.checked})}/> Publish the public school homepage when school is active</label>
        <div className="row"><a href={"/s/"+form.tenant.school_code} target="_blank" rel="noreferrer">Preview website</a><small className="micro">Live view uses the last saved version.</small></div>
        <div className="modal-footer"><button disabled={busy||uploading} type="submit" className="button">{uploading?"Uploading…":"Save school website"}</button></div>
      </form>}
      {modal==="inviteStaff"&&<form onSubmit={e=>{e.preventDefault();action({action:"staff.invite",email:form.email,role:form.role,permissions:form.permissions});}}>
        <p className="muted">Invite a staff member. They must verify their identity; their permissions are yours to control.</p>
        <Field label="Staff email"><input className="input" type="email" required value={form.email||""} onChange={e=>setForm({...form,email:e.target.value})}/></Field>
        <Field label="Staff role"><select className="input" value={form.role} onChange={e=>setForm({...form,role:e.target.value,permissions:[...ROLE_DEFAULTS[e.target.value]]})}>{Object.keys(ROLE_DEFAULTS).map(role=><option key={role} value={role}>{role}</option>)}</select></Field>
        <PermissionToggleTable permissions={form.permissions} onChange={(p,enabled)=>setForm({...form,permissions:enabled?[...form.permissions,p]:form.permissions.filter(x=>x!==p)})}/>
        <div className="modal-footer"><button type="submit" disabled={busy} className="button">Send staff invitation</button></div>
      </form>}
            {modal==="state"&&<form onSubmit={e=>{e.preventDefault();action({action:"tenant.state",id:form.tenant.id,status:form.status,reason:form.reason,confirmSchoolCode:form.confirmSchoolCode});}}>
        <p className="muted">{form.tenant.name} · <kbd>{form.tenant.school_code}</kbd></p>
        <p>Current state: <Pill>{form.tenant.status}</Pill></p>
        <Field label="Change tenant status"><select className="input" required value={form.status||""} onChange={e=>setForm({...form,status:e.target.value})}><option value="">Select action</option>{(LIFECYCLE[form.tenant.status]||[]).map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></Field>
        <Field label="Reason for change"><textarea className="input" minLength={8} required placeholder="Explain why this tenant should change status" value={form.reason||""} onChange={e=>setForm({...form,reason:e.target.value})}/></Field>
        {form.status==="deletion_requested"&&<div className="notice error">This creates a deletion review request only. Data is not permanently deleted. role authorization is required.<Field label={"Type School ID exactly: "+form.tenant.school_code}><input className="input" value={form.confirmSchoolCode||""} onChange={e=>setForm({...form,confirmSchoolCode:e.target.value})} required/></Field></div>}
        <div className="modal-footer"><button className="button" disabled={busy||!form.status||(form.status==="deletion_requested"&&form.confirmSchoolCode!==form.tenant.school_code)} type="submit">Confirm change</button></div>
      </form>}
      {modal==="ticketHistory"&&<div>
<p className="muted"><strong>{form.ticket.title}</strong> · opened {DATE(form.ticket.created_at)}</p>
<div className="table-wrap"><table><thead><tr><th>When (Kigali)</th><th>Event</th><th>Details</th></tr></thead><tbody>
{(form.history||[]).map(h=><tr key={h.id}><td>{new Date(h.created_at).toLocaleString("en-GB",{timeZone:"Africa/Kigali"})}</td><td>{h.event.replace("ticket.","").replaceAll("_"," ")}</td><td style={{whiteSpace:"normal"}}>{Object.entries(h.metadata||{}).filter(([k])=>k!=="school_id").map(([k,v])=>k.replaceAll("_"," ")+": "+String(v)).join(", ")||"—"}</td></tr>)}
</tbody></table>{!(form.history||[]).length&&<Empty title="No recorded history" description="Changes to this ticket will be listed here."/>}</div>
</div>}
{modal==="newTicket"&&<form onSubmit={e=>{e.preventDefault();action({action:"ticket.create",schoolId:form.schoolId,title:form.title,description:form.description,priority:form.priority||"normal"});}}>
        <Field label="School"><select required className="input" value={form.schoolId||""} onChange={e=>setForm({...form,schoolId:e.target.value})}><option value="">Select school</option>{(data.tenants||[]).map(t=><option key={t.id} value={t.id}>{t.name} ({t.school_code})</option>)}</select></Field>
        <Field label="Issue title"><input required maxLength={160} className="input" value={form.title||""} onChange={e=>setForm({...form,title:e.target.value})}/></Field>
        <Field label="Description"><textarea required className="input" value={form.description||""} onChange={e=>setForm({...form,description:e.target.value})}/></Field>
<Field label="Priority"><select className="input" value={form.priority||"normal"} onChange={e=>setForm({...form,priority:e.target.value})}><option value="low">Low</option><option value="normal">Normal</option><option value="urgent">Urgent</option></select></Field>
        <div className="modal-footer"><button type="submit" disabled={busy} className="button">Create ticket</button></div>
      </form>}
      {modal==="newMethod"&&<form onSubmit={e=>{e.preventDefault();action({action:"method.create",label:form.label,type:form.type});}}>
        <p className="muted">Adding a method does not connect an actual payment provider. It starts disabled until you approve it.</p>
        <Field label="Method name"><input required maxLength={80} className="input" placeholder="e.g. MTN Mobile Money" value={form.label||""} onChange={e=>setForm({...form,label:e.target.value})}/></Field>
        <Field label="Method type"><select required className="input" value={form.type||""} onChange={e=>setForm({...form,type:e.target.value})}><option value="">Select</option><option value="mobile_money">Mobile Money</option><option value="bank">Bank transfer</option><option value="card">Bank card</option><option value="other">Other</option></select></Field>
        <div className="modal-footer"><button type="submit" disabled={busy} className="button">Add method</button></div>
      </form>}
      {modal==="approveStaff"&&<form onSubmit={e=>{e.preventDefault();action({action:"staff.approve",id:form.request.id,role:form.role,permissions:form.permissions});}}>
        <p className="muted">Approving <strong>{form.request.email}</strong>. Only grant the access this colleague needs; appropriate authorization is required.</p>
        <Field label="Staff role"><select className="input" value={form.role} onChange={e=>setForm({...form,role:e.target.value,permissions:[...ROLE_DEFAULTS[e.target.value]]})}>{Object.keys(ROLE_DEFAULTS).map(role=><option key={role} value={role}>{role}</option>)}</select></Field>
        <div style={{fontWeight:700,marginBottom:8}}>Access permissions — switch ON to allow</div>
        <PermissionToggleTable permissions={form.permissions} onChange={(p,enabled)=>setForm({...form,permissions:enabled?[...form.permissions,p]:form.permissions.filter(x=>x!==p)})}/>
        <div className="modal-footer"><button type="submit" className="button" disabled={busy}>Approve staff access</button></div>
      </form>}
      {modal==="editStaff"&&<form onSubmit={e=>{e.preventDefault();action({action:"staff.permissions",id:form.staff.auth_user_id,role:form.role,permissions:form.permissions,reason:form.reason});}}>
        <p className="muted">Edit <strong>{form.staff.email}</strong>. Toggle each permission ON or OFF. The change takes effect on the person's next protected API request.</p>
        <Field label="Staff role"><select className="input" value={form.role} onChange={e=>setForm({...form,role:e.target.value,permissions:[...ROLE_DEFAULTS[e.target.value]]})}>{Object.keys(ROLE_DEFAULTS).map(role=><option key={role} value={role}>{role}</option>)}</select></Field>
        <PermissionToggleTable permissions={form.permissions} onChange={(p,enabled)=>setForm({...form,permissions:enabled?[...form.permissions,p]:form.permissions.filter(x=>x!==p)})}/>
        <Field label="Reason for permission change"><textarea required minLength={8} maxLength={500} className="input" value={form.reason||""} onChange={e=>setForm({...form,reason:e.target.value})} placeholder="For example: New support duties"/></Field>
        <div className="notice info">Saving requires the platform owner's multifactor-authenticated session. Every change is audited.</div>
        <div className="modal-footer"><button type="submit" className="button" disabled={busy}>Save permissions</button></div>
      </form>}
            {modal==="disableStaff"&&<div><p>Revoke platform access for <strong>{form.staff.email}</strong>? Existing sessions will be denied on their next server request.</p><div className="modal-footer"><button className="button danger" disabled={busy} onClick={()=>action({action:"staff.disable",id:form.staff.auth_user_id})}>Revoke access</button></div></div>}
    </Modal>}
  </div>;
}
function RequestAccess({onSubmit,busy}) {
  const [reason,setReason]=useState("");
  return <form onSubmit={e=>{e.preventDefault();onSubmit(reason);}}><Field label="Request a staff invitation or access approval"><textarea className="input" required minLength={10} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Your role and why the platform owner should grant access"/></Field><button className="button" disabled={busy} type="submit">Request access</button></form>;
}
function Metric({label,value}){return <div className="card"><div className="label">{label}</div><div className="value">{value??"—"}</div></div>;}
function Header({title,description,action}){return <div className="header"><div><h1>{title}</h1><p>{description}</p></div>{action}</div>;}
function siteForm(site) {
  return {tagline:site?.tagline||"",aboutText:site?.about_text||"",
    announcement:site?.announcement||"",logoUrl:site?.logo_url||"",
    heroUrl:site?.hero_url||"",primaryColor:site?.primary_color||"#204a78",
    contactEmail:site?.contact_email||"",contactPhone:site?.contact_phone||"",isPublished:Boolean(site?.is_published)};
}
function TenantTable({tenants,feeTerms=[],stats={},onProfile,canManage,canRecord,canBrand,
  canInvite,canPurge,onInvite,onPurge,onState,onPaid,onTerms,onBrand}) {
  const prov={kigali:"Kigali City",northern:"Northern Province",southern:"Southern Province",eastern:"Eastern Province",western:"Western Province"};
  const lvl={nursery:"Nursery",primary:"Primary",secondary:"Secondary",college:"College / University"};
  return <div className="table-wrap pm-nowrap"><table>
    <thead><tr><th>School</th><th>Location, level and plan</th><th>Status</th><th>Students and health</th><th>Next monthly payment</th><th>Actions</th></tr></thead>
    <tbody>{tenants.map(t=>{const terms=feeTerms.find(f=>f.school_id===t.id);
      const h=stats[t.id];
      return <tr key={t.id}><td><strong>{t.name}</strong>
        {t.is_demo&&<span className="badge" style={{marginLeft:8}}>DEMO · SYNTHETIC</span>}
        <div className="micro"><kbd>{t.school_code}</kbd> {t.owner_email}</div></td>
        <td>{[t.district,prov[t.province]].filter(Boolean).join(", ")||<span className="micro">Location not set</span>}<div className="micro">{lvl[t.education_level]||"Level not set"}{t.plan_code?" · "+t.plan_code:""}</div></td>
        <td><Pill>{t.status}</Pill></td>
        <td>{h?<div><strong>{h.students}</strong> students<div className="micro">{h.marked?Math.round(100*h.present/h.marked)+"% present (30 days)":"No attendance yet"}</div><div className="micro">{h.invoiced?Math.round(100*h.collected/h.invoiced)+"% fees collected":"No invoices yet"}</div></div>:"—"}</td>
        <td>{terms?.next_due_on?<><PayBadge due={terms.next_due_on}/><div className="micro">{terms.next_due_on}</div></>:<span className="pm-badge none">No fee set</span>}</td>
        <td><div className="row"><a className="button small" href={"/s/"+t.school_code+"/login"} target="_blank" rel="noreferrer">Open school</a>
          <RowMenu items={[
            canManage&&{label:"School profile",onClick:()=>onProfile(t)},
            canManage&&{label:"Manage status",onClick:()=>onState(t)},
            canRecord&&{label:"Set monthly fee",onClick:()=>onTerms(t)},
            canRecord&&{label:"Mark paid",disabled:!terms?.monthly_fee_rwf,onClick:()=>onPaid(t)},
            canBrand&&{label:"School website and branding",onClick:()=>onBrand(t)},
            canInvite&&!t.is_demo&&{label:"Invite school owner",onClick:()=>onInvite(t)},
            {label:"Preview public site",href:"/s/"+t.school_code},
            canPurge&&{label:"Permanently delete",danger:true,disabled:t.legal_hold,title:t.legal_hold?"Deletion blocked: legal hold":"Permanently remove school and data",onClick:()=>onPurge(t)}
          ]}/></div></td>
      </tr>})}</tbody>
    </table>{!tenants.length&&<Empty title="No schools found" description="Your real registered tenants will appear here. Register the first school to begin."/>}</div>;
}
function modalTitle(mode){return ({profile:"School profile",newTenant:"Register a new school",demo:"Create a mockup school",purge:"Permanently wipe school tenant",addSchool:"Add school to a company",terms:"Monthly payment terms",paid:"Record monthly payment",voidPayment:"Correct payment entry",brand:"School website & branding",inviteStaff:"Invite platform staff",inviteSchoolOwner:"Invite verified school owner",state:"Manage tenant lifecycle",newTicket:"Open a support ticket",ticketHistory:"Ticket history",newMethod:"Add payment option",approveStaff:"Review staff permissions",editStaff:"Edit staff access",disableStaff:"Revoke staff access"})[mode]||"Manage";}
