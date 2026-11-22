"use client";
import { useCallback, useEffect, useState } from "react";
import { browserSupabase } from "../../lib/client.js";
import { ALL_PERMISSIONS, ROLE_DEFAULTS } from "../../lib/access.mjs";
import { formatRwf } from "../../lib/money.mjs";
import { dueClock,kigaliDate } from "../../lib/billing-clock.mjs";

const NAV = [
  ["overview","◫","Overview","tenants.read"],
  ["tenants","▦","Tenants","tenants.read"],
  ["tickets","◉","Support tickets","tickets.read"],
  ["billing","▤","Monthly payment clock","billing.read"],
  ["methods","▣","Payment channels","billing.methods"],
  ["staff","♧","My staff","staff.read"],
  ["audit","◷","Audit log","audit.read"],
  ["security","⚿","Security",null],
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
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [problem,setProblem]=useState("");
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
  return <main className="shell"><div className="auth-card">
    <div className="mark">R</div>
    <h1>{mode==="forgot"?"Reset your password":mode==="signup"?"Request a platform account":"Welcome back"}</h1>
    <p>{mode==="forgot"?"Enter your account email. We'll send a private password reset link.":mode==="signup"?"Only approved platform staff and the verified platform owner can use this console.":"Sign in to manage school tenants, subscriptions, support tickets and your team."}</p>
    {problem&&<div className="notice error" role="alert">{problem}</div>}
    {message&&<div className="notice ok" role="status">{message}</div>}
    <form onSubmit={submit}>
      <Field label="Email address"><input className="input" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></Field>
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
  </div></main>;
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
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState("all");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const [mfa,setMfa]=useState(null);

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

  function open(mode,payload={}){setModal(mode);setForm(payload);setError("");setNotice("");}
  async function action(body,endpoint="/api/platform"){
    setBusy(true);setError("");setNotice("");
    try{await api(body,endpoint);setModal(null);setForm({});await refresh();setNotice("Change saved and verified by the API.");}
    catch(e){setError(e.message); }
    finally{setBusy(false);}
  }
  const allowed=(permission)=>Boolean(data?.actor?.isOwner || data?.actor?.permissions?.includes(permission));
  const tenants=(data?.tenants||[]).filter(t=>{
    const search=[t.name,t.school_code,t.owner_email,t.platform_companies?.name,t.platform_companies?.company_code].join(" ").toLowerCase();
    return search.includes(query.trim().toLowerCase()) && (filter==="all"||t.status===filter);
  });

  if(loading)return <main className="shell">Loading secure account...</main>;
  if(!client)return <main className="shell"><div className="auth-card"><h1>Setup required</h1><p>Provide the Supabase URL and publishable key in the deployment environment. No records are available until secure connection is configured.</p></div></main>;
  if(!session)return <Login client={client} onLogin={setSession}/>;
  if(!data&& !error)return <main className="shell">Checking your access...</main>;
  if(error&&!data)return <main className="shell"><div className="auth-card"><h1>Console unavailable</h1><div className="notice error">{error}</div><button className="button" onClick={refresh}>Try again</button><button style={{marginTop:10}} className="button secondary" onClick={()=>client.auth.signOut()}>Sign out</button></div></main>;
  if(data.needsApproval)return <main className="shell"><div className="auth-card"><div className="mark">R</div><h1>Access pending</h1><p>This account has no approved platform-owner or staff permissions. Selecting a role does not grant access.</p><RequestAccess onSubmit={(reason)=>action({reason},"/api/platform/request-access")} busy={busy}/>{error&&<div className="notice error">{error}</div>}{notice&&<div className="notice ok">{notice}</div>}<button className="button secondary" onClick={()=>client.auth.signOut()}>Sign out</button></div></main>;

  return <div className="dashboard">
    <aside className="sidebar">
      <div className="brand"><div className="mark">R</div><div><strong>Rwanda Education</strong><small>Platform control center</small></div></div>
      <nav className="nav" aria-label="Management">
        {NAV.filter((item)=>!item[3]||allowed(item[3])).map(([id,icon,label])=>
          <button key={id} className={tab===id?"active":""} onClick={()=>{setTab(id);setNotice("");setError("");}}><span className="nav-icon">{icon}</span>{label}</button>)}
      </nav>
      <div className="sidebar-foot">Production controls require verified permissions.<br/>All financial values shown in RWF.</div>
    </aside>
    <main className="main">
      <div className="topbar">
        <div><strong>Platform Administration</strong><div className="micro">Rwanda School Management Platform</div></div>
        <div className="context"><div className="avatar">{(data.actor.email||"U")[0].toUpperCase()}</div><div><strong style={{fontSize:12}}>{data.actor.email}</strong><div className="micro">{data.actor.isOwner?"Platform Owner":data.actor.role}</div></div><button className="button secondary small" onClick={()=>client.auth.signOut()}>Sign out</button></div>
      </div>
      {error&&<div style={{marginTop:20}} className="notice error" role="alert">{error}<button className="button flat" onClick={()=>setError("")}>Dismiss</button></div>}
      {notice&&<div style={{marginTop:20}} className="notice ok" role="status">{notice}</div>}
      {tab==="overview"&&<>
        <Header title="Your platform at a glance" description="Private tenant management and manually recorded monthly school fees." action={allowed("tenants.create")?<button className="button" onClick={()=>open("newTenant")}>+ Register school</button>:null}/>
        <div className="cards">
          <Metric label="Total schools" value={data.totals.tenants}/>
          <Metric label="Active schools" value={data.totals.active}/>
          <Metric label="Paused / suspended" value={data.totals.paused+data.totals.suspended}/>
          <Metric label="Open support tickets" value={data.totals.ticketsOpen}/>
        </div>
        {allowed("billing.read")&&<>
          <div className="cards">
            <Metric label="Manually recorded receipts" value={formatRwf(data.totals.manualCollectedRwf||0)}/>
            <Metric label="Monthly fees expected" value={formatRwf(data.totals.monthlyExpectedRwf||0)}/>
            <Metric label="Past-due schools" value={data.totals.pastDue||0}/>
            <Metric label="Due today" value={data.totals.dueToday||0}/>
          </div>
          {(data.totals.pastDue>0||data.totals.dueToday>0)&&<div className="notice error">Attention: {data.totals.pastDue} school(s) past due and {data.totals.dueToday} due today. <button className="button small secondary" onClick={()=>setTab("billing")}>Open private monthly clock</button></div>}
        </>}
        <div className="panel"><div className="panel-header"><h2>Recent schools</h2><button className="button secondary small" onClick={()=>setTab("tenants")}>Manage all tenants</button></div><TenantTable tenants={(data.tenants||[]).slice(0,5)} feeTerms={data.feeTerms||[]} canManage={allowed("tenants.lifecycle")} canRecord={allowed("billing.record")} canBrand={allowed("tenants.brand")} onState={(t)=>open("state",{tenant:t})} onPaid={(t)=>open("paid",{tenant:t,paidOn:kigaliDate(),amountRwf:data.feeTerms.find(f=>f.school_id===t.id)?.monthly_fee_rwf||""})} onTerms={(t)=>open("terms",{tenant:t,monthlyAmountRwf:data.feeTerms.find(f=>f.school_id===t.id)?.monthly_fee_rwf||"",firstDueOn:data.feeTerms.find(f=>f.school_id===t.id)?.next_due_on||kigaliDate()})} onBrand={(t)=>open("brand",{tenant:t,...siteForm(data.sites.find(x=>x.school_id===t.id))})}/></div>
        <div className="notice info">Monthly amounts and countdowns belong only to authorized platform staff. Schools do not see this billing ledger. These records represent what you entered manually, not verified bank or Mobile Money balances.</div>
      </>}
      {tab==="tenants"&&<>
        <Header title="Tenants" description="Each school has a separate School ID and Company ID." action={allowed("tenants.create")?<button className="button" onClick={()=>open("newTenant")}>+ Register school</button>:null}/>
        <div className="panel">
          <div className="panel-header"><div className="row"><input aria-label="Search tenants" className="input" style={{width:260}} placeholder="Search school, ID or owner" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Tenant status" className="input" style={{width:150}} value={filter} onChange={e=>setFilter(e.target.value)}>{["all",...Object.keys(LIFECYCLE)].map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></div><span className="muted">{tenants.length} results</span></div>
          <TenantTable tenants={tenants} feeTerms={data.feeTerms||[]} canManage={allowed("tenants.lifecycle")} canRecord={allowed("billing.record")} canBrand={allowed("tenants.brand")} onState={(t)=>open("state",{tenant:t})} onPaid={(t)=>open("paid",{tenant:t,paidOn:kigaliDate(),amountRwf:data.feeTerms.find(f=>f.school_id===t.id)?.monthly_fee_rwf||""})} onTerms={(t)=>open("terms",{tenant:t,monthlyAmountRwf:data.feeTerms.find(f=>f.school_id===t.id)?.monthly_fee_rwf||"",firstDueOn:data.feeTerms.find(f=>f.school_id===t.id)?.next_due_on||kigaliDate()})} onBrand={(t)=>open("brand",{tenant:t,...siteForm(data.sites.find(x=>x.school_id===t.id))})}/>
          {(data.totals.tenants>=200)&&<p className="micro">Showing latest 200 tenants. Server pagination is required before large-scale production use.</p>}
        </div>
      </>}
      {tab==="tickets"&&<>
        <Header title="Support tickets" description="Track school problems, assignment and resolution." action={allowed("tickets.manage")?<button className="button" onClick={()=>open("newTicket")}>+ New ticket</button>:null}/>
        <div className="panel"><div className="table-wrap"><table><thead><tr><th>Ticket</th><th>School</th><th>Priority</th><th>Status</th><th>Opened</th><th>Assigned</th><th>Action</th></tr></thead><tbody>
          {(data.tickets||[]).map(t=><tr key={t.id}><td><strong>{t.title}</strong><div className="micro" style={{whiteSpace:"normal",maxWidth:290}}>{t.description}</div></td><td>{data.tenants.find(s=>s.id===t.school_id)?.name||"School"}</td><td><Pill>{t.priority}</Pill></td><td><Pill>{t.status}</Pill></td><td>{DATE(t.created_at)}</td><td>{allowed("staff.read")&&allowed("tickets.manage")?<select className="input" aria-label="Assign ticket" value={t.assigned_to||""} disabled={busy} onChange={e=>action({action:"ticket.assign",id:t.id,assigneeId:e.target.value})}><option value="">Unassigned</option>{data.staff.filter(p=>p.active&&p.permissions.includes("tickets.manage")).map(p=><option key={p.auth_user_id} value={p.auth_user_id}>{p.email}</option>)}</select>:(t.assigned_to?"Assigned":"Unassigned")}</td><td>{allowed("tickets.manage")?<select className="input" aria-label="Change ticket status" value={t.status} onChange={e=>action({action:"ticket.update",id:t.id,status:e.target.value})} disabled={busy}>{["open","in_progress","resolved"].map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select>:"View only"}</td></tr>)}
        </tbody></table>{!data.tickets.length&&<Empty title="No support tickets" description="School issues and their resolution history will appear here."/>}</div></div>
      </>}
      {tab==="billing"&&<>
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
              <td>{fee?.next_due_on||"—"}</td><td><Pill>{clock.state==="overdue"?"Past due":clock.state==="due_today"?"Due today":clock.state==="upcoming"?"Up to date":"Not set"}</Pill><div className="micro">{clock.label}</div></td>
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
        <Header title="Platform staff access" description="Approve staff and grant only the permissions they need."/>
        {data.actor.isOwner&&<div className="panel"><div className="panel-header"><h2>Access requests</h2><span className="micro">{data.requests.length} pending</span></div>
          {(data.requests||[]).map(r=><div key={r.id} className="panel" style={{background:"#f8fafc",marginBottom:9}}><div className="row" style={{justifyContent:"space-between"}}><div><strong>{r.email}</strong><p className="section-subtitle">{r.reason}</p></div><button className="button small" onClick={()=>open("approveStaff",{request:r,role:"support",permissions:[...ROLE_DEFAULTS.support]})}>Review access</button></div></div>)}
          {!data.requests.length&&<Empty title="No pending requests" description="Staff register and request access; only you can approve their permissions."/>}
        </div>}
        <div className="panel"><div className="panel-header"><h2>Approved platform staff</h2></div><div className="table-wrap"><table><thead><tr><th>Staff account</th><th>Role</th><th>Permissions</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.staff.map(s=><tr key={s.auth_user_id}><td>{s.email}</td><td>{s.role}</td><td style={{whiteSpace:"normal",maxWidth:280}}>{s.permissions.join(", ")||"None"}</td><td><Pill>{s.active?"active":"disabled"}</Pill></td><td>{data.actor.isOwner&&s.active?<div className="row"><button className="button small secondary" onClick={()=>open("editStaff",{staff:s,role:s.role,permissions:[...s.permissions]})}>Access table</button><button className="button small secondary" onClick={()=>open("disableStaff",{staff:s})}>Revoke</button></div>:"—"}</td></tr>)}</tbody></table>{!data.staff.length&&<Empty title="No staff accounts" description="You are the verified platform owner. Approve access requests when you add your team."/>}</div></div>
      </>}
      {tab==="audit"&&<>
        <Header title="Audit history" description="Trace platform-wide actions and permissions changes."/>
        <div className="panel"><div className="table-wrap"><table><thead><tr><th>When</th><th>Action</th><th>Actor ID</th><th>Resource</th></tr></thead><tbody>{data.audit.map(a=><tr key={a.id}><td>{DATE(a.created_at)}</td><td>{a.event}</td><td><kbd>{a.actor_id?.slice(0,13)}…</kbd></td><td><kbd>{a.resource_id?.slice(0,13)||"—"}</kbd></td></tr>)}</tbody></table>{!data.audit.length&&<Empty title="No recorded activity" description="Auditable platform operations will appear here."/>}</div></div>
      </>}
      {tab==="security"&&<>
        <Header title="Account security" description="Important actions require verified identity and two-factor authentication."/>
        <div className="panel stacked">
          <h2>Secure your platform owner account</h2><p className="muted">Enrolling a time-based authenticator is recommended. Approving staff, setting a default payment method and requesting school deletion require an MFA-verified session.</p>
          <div className="row"><button className="button" onClick={async()=>{setError("");try{const r=await client.auth.mfa.enroll({factorType:"totp",friendlyName:"Rwanda Platform Owner"});if(r.error)throw r.error;setMfa(r.data);}catch(e){setError(e.message);}}}>Set up authenticator</button><button className="button secondary" onClick={async()=>{setError("");try{const r=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(r.error)throw r.error;setNotice("Current level: "+r.data.currentLevel+"; next level: "+r.data.nextLevel);}catch(e){setError(e.message);}}}>Check MFA status</button><button className="button secondary" onClick={async()=>{setError("");try{const r=await client.auth.mfa.listFactors();if(r.error)throw r.error;const factor=r.data?.totp?.find(f=>f.status==="verified");if(!factor)throw new Error("No verified authenticator yet. Choose Set up authenticator first.");setMfa({id:factor.id,mode:"challenge"});setNotice("");}catch(e){setError(e.message);}}}>Verify authenticator to unlock sensitive actions</button></div>
          {mfa?.totp&&<MfaVerify mfa={mfa} client={client} setMfa={setMfa} setNotice={setNotice} setError={setError}/>}
        </div>
      </>}
    </main>
    {modal&&<Modal title={modalTitle(modal)} onClose={()=>setModal(null)}>
      {modal==="newTenant"&&<form onSubmit={e=>{e.preventDefault();action({action:"tenant.create",companyName:form.companyName,schoolName:form.schoolName,ownerEmail:form.ownerEmail});}}>
        <p className="muted">The platform will automatically generate a unique Company ID and School ID. School access remains in onboarding until approved.</p>
        <Field label="Company or school group"><input className="input" required maxLength={120} value={form.companyName||""} onChange={e=>setForm({...form,companyName:e.target.value})}/></Field>
        <Field label="Official school name"><input className="input" required maxLength={120} value={form.schoolName||""} onChange={e=>setForm({...form,schoolName:e.target.value})}/></Field>
        <Field label="School owner's email"><input className="input" type="email" required value={form.ownerEmail||""} onChange={e=>setForm({...form,ownerEmail:e.target.value})}/></Field>
        <div className="modal-footer"><button type="submit" className="button" disabled={busy}>Register school</button></div>
      </form>}
      {modal==="state"&&<form onSubmit={e=>{e.preventDefault();action({action:"tenant.state",id:form.tenant.id,status:form.status,reason:form.reason,confirmSchoolCode:form.confirmSchoolCode});}}>
        <p className="muted">{form.tenant.name} · <kbd>{form.tenant.school_code}</kbd></p>
        <p>Current state: <Pill>{form.tenant.status}</Pill></p>
        <Field label="Change tenant status"><select className="input" required value={form.status||""} onChange={e=>setForm({...form,status:e.target.value})}><option value="">Select action</option>{(LIFECYCLE[form.tenant.status]||[]).map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></Field>
        <Field label="Reason for change"><textarea className="input" minLength={8} required placeholder="Explain why this tenant should change status" value={form.reason||""} onChange={e=>setForm({...form,reason:e.target.value})}/></Field>
        {form.status==="deletion_requested"&&<div className="notice error">This creates a deletion review request only. Data is not permanently deleted. MFA is required.<Field label={"Type School ID exactly: "+form.tenant.school_code}><input className="input" value={form.confirmSchoolCode||""} onChange={e=>setForm({...form,confirmSchoolCode:e.target.value})} required/></Field></div>}
        <div className="modal-footer"><button className="button" disabled={busy||!form.status||(form.status==="deletion_requested"&&form.confirmSchoolCode!==form.tenant.school_code)} type="submit">Confirm change</button></div>
      </form>}
      {modal==="newTicket"&&<form onSubmit={e=>{e.preventDefault();action({action:"ticket.create",schoolId:form.schoolId,title:form.title,description:form.description});}}>
        <Field label="School"><select required className="input" value={form.schoolId||""} onChange={e=>setForm({...form,schoolId:e.target.value})}><option value="">Select school</option>{(data.tenants||[]).map(t=><option key={t.id} value={t.id}>{t.name} ({t.school_code})</option>)}</select></Field>
        <Field label="Issue title"><input required maxLength={160} className="input" value={form.title||""} onChange={e=>setForm({...form,title:e.target.value})}/></Field>
        <Field label="Description"><textarea required className="input" value={form.description||""} onChange={e=>setForm({...form,description:e.target.value})}/></Field>
        <div className="modal-footer"><button type="submit" disabled={busy} className="button">Create ticket</button></div>
      </form>}
      {modal==="newMethod"&&<form onSubmit={e=>{e.preventDefault();action({action:"method.create",label:form.label,type:form.type});}}>
        <p className="muted">Adding a method does not connect an actual payment provider. It starts disabled until you approve it.</p>
        <Field label="Method name"><input required maxLength={80} className="input" placeholder="e.g. MTN Mobile Money" value={form.label||""} onChange={e=>setForm({...form,label:e.target.value})}/></Field>
        <Field label="Method type"><select required className="input" value={form.type||""} onChange={e=>setForm({...form,type:e.target.value})}><option value="">Select</option><option value="mobile_money">Mobile Money</option><option value="bank">Bank transfer</option><option value="card">Bank card</option><option value="other">Other</option></select></Field>
        <div className="modal-footer"><button type="submit" disabled={busy} className="button">Add method</button></div>
      </form>}
      {modal==="approveStaff"&&<form onSubmit={e=>{e.preventDefault();action({action:"staff.approve",id:form.request.id,role:form.role,permissions:form.permissions});}}>
        <p className="muted">Approving <strong>{form.request.email}</strong>. Only grant the access this colleague needs; two-factor authentication is required.</p>
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
function MfaVerify({mfa,client,setMfa,setNotice,setError}) {
  const [code,setCode]=useState("");
  return <div className="panel" style={{background:"#f8fafc"}}><h3 style={{fontSize:14,marginBottom:8}}>{mfa.mode==="challenge"?"Verify your sign-in":"Scan with your authenticator app"}</h3>
    {mfa.totp?.qr_code&&<img src={mfa.totp.qr_code} width="160" height="160" alt="Authenticator QR code" style={{maxWidth:"100%"}}/>}
    <p className="micro">{mfa.mode==="challenge"?"Open your authenticator app and enter the current six-digit code.":"Scan the QR image or enter its secret in your authenticator app. Never share this code."}</p>
    <Field label="One-time verification code"><input className="input" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)}/></Field>
    <button className="button" onClick={async()=>{try{const r=await client.auth.mfa.challengeAndVerify({factorId:mfa.id,code});if(r.error)throw r.error;setMfa(null);setNotice(mfa.mode==="challenge"?"Your identity is verified for MFA-protected actions.":"Authenticator activated. Your account now supports MFA-protected actions.");}catch(e){setError(e.message);}}}>{mfa.mode==="challenge"?"Verify sign-in":"Verify and activate MFA"}</button>
  </div>;
}
function Metric({label,value}){return <div className="card"><div className="label">{label}</div><div className="value">{value??"—"}</div></div>;}
function Header({title,description,action}){return <div className="header"><div><h1>{title}</h1><p>{description}</p></div>{action}</div>;}
function siteForm(site) {
  return {tagline:site?.tagline||"",aboutText:site?.about_text||"",
    announcement:site?.announcement||"",logoUrl:site?.logo_url||"",
    heroUrl:site?.hero_url||"",primaryColor:site?.primary_color||"#204a78",
    contactEmail:site?.contact_email||"",contactPhone:site?.contact_phone||"",isPublished:Boolean(site?.is_published)};
}
function TenantTable({tenants,feeTerms=[],canManage,canRecord,canBrand,onState,onPaid,onTerms,onBrand}) {
  return <div className="table-wrap"><table>
    <thead><tr><th>School</th><th>Company ID</th><th>School ID</th><th>Owner contact</th><th>Status</th><th>Next monthly due</th><th>Actions</th></tr></thead>
    <tbody>{tenants.map(t=>{const terms=feeTerms.find(f=>f.school_id===t.id);const clock=dueClock(terms?.next_due_on);
      return <tr key={t.id}><td><strong>{t.name}</strong><div className="micro">{t.platform_companies?.name||"—"}</div></td>
        <td><kbd>{t.platform_companies?.company_code||"—"}</kbd></td><td><kbd>{t.school_code}</kbd></td><td>{t.owner_email}</td>
        <td><Pill>{t.status}</Pill></td><td>{terms?.next_due_on||"—"}<div className="micro">{clock.label}</div></td>
        <td><div className="row">
          {canManage&&<button className="button secondary small" onClick={()=>onState(t)}>Manage status</button>}
          {canRecord&&<><button className="button secondary small" onClick={()=>onTerms(t)}>Set fee</button><button disabled={!terms?.monthly_fee_rwf} className="button small" onClick={()=>onPaid(t)}>Mark paid</button></>}
          {canBrand&&<button className="button secondary small" onClick={()=>onBrand(t)}>School site</button>}
          <a href={"/s/"+t.school_code} target="_blank" rel="noreferrer">Preview</a>
        </div></td>
      </tr>})}</tbody>
    </table>{!tenants.length&&<Empty title="No schools found" description="Your real registered tenants will appear here. Register the first school to begin."/>}</div>;
}
function modalTitle(mode){return ({newTenant:"Register a new school",state:"Manage tenant lifecycle",newTicket:"Open a support ticket",newMethod:"Add payment option",approveStaff:"Review staff permissions",editStaff:"Edit staff access",disableStaff:"Revoke staff access"})[mode]||"Manage";}
