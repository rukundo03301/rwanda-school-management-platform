"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
import {displayRwf,FEE_CATEGORIES,PAYMENT_METHODS,FINANCE_RIGHTS,
 REVIEW_EVIDENCE} from "../../../../lib/school-fees.mjs";

const LABELS={mtn_momo:"MTN MoMo",airtel_money:"Airtel Money",
 bank_transfer:"Bank transfer",cash:"Cash",other:"Other"};
const cap=s=>s?s.replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase()):"—";
const showDate=s=>s?new Date(s).toLocaleDateString("en-RW",
 {timeZone:"Africa/Kigali",year:"numeric",month:"short",day:"numeric"}):"—";
const dueDate=s=>s||"—";
const kigaliDate=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Kigali",
 year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const STAGES=[
 {id:"overview",label:"Finance Overview"},
 {id:"catalog",label:"Fee Schedules"},
 {id:"invoices",label:"Student Invoices"},
 {id:"payments",label:"Payment Review"},
 {id:"receipts",label:"Receipts"},
 {id:"family",label:"My Children & Fees"},
 {id:"access",label:"Finance Permissions"}
];
function Field({label,children}){return <label className="fee-field">
 <strong>{label}</strong>{children}</label>}
function Empty({title,description}){return <section className="fee-empty">
 <strong>{title}</strong><p>{description}</p></section>}
function Dialog({title,onClose,children}){return <div className="fee-backdrop"
 onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
 <section className="fee-dialog" role="dialog" aria-modal="true" aria-label={title}>
  <header><h2>{title}</h2><button type="button" className="button small secondary"
   aria-label="Close" onClick={onClose}>✕</button></header>{children}</section></div>}
function Total({title,value,desc}){return <div className="fee-total">
 <small>{title}</small><strong>{displayRwf(value||"0")}</strong><span>{desc}</span></div>}
function Status({invoice}){return <span className={"fee-status "+
 (invoice.status==="cancelled"?"muted":invoice.balances.fully_paid?"paid":
 invoice.balances.overdue?"overdue":"open")}>
 {invoice.status==="cancelled"?"Cancelled":invoice.balances.fully_paid?"Settled / Credited":
 invoice.balances.overdue?"Overdue":"Outstanding"}</span>}
export default function SchoolFees({code}){
 const [client,setClient]=useState(null),[ready,setReady]=useState(false);
 const [session,setSession]=useState(null),[loading,setLoading]=useState(true);
 const [data,setData]=useState(null),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [tab,setTab]=useState("overview"),[modal,setModal]=useState(null);
 const [form,setForm]=useState({}),[busy,setBusy]=useState(false);
 const [selectedReceipt,setSelectedReceipt]=useState("");
 const [search,setSearch]=useState(""),[invoiceStatus,setInvoiceStatus]=useState("all");
 useEffect(()=>{
  const c=browserSupabase();setClient(c);
  if(!c){setReady(true);setLoading(false);return;}
  let active=true;
  c.auth.getSession().then(({data:r})=>{if(active){setSession(r.session);setReady(true);}});
  const {data:{subscription}}=c.auth.onAuthStateChange((_e,s)=>{if(active)setSession(s);});
  return ()=>{active=false;subscription.unsubscribe();};
 },[]);
 const api=useCallback(async body=>{
  if(!client)throw Error("School financial access is not configured");
  const {data:{session:s}}=await client.auth.getSession();
  if(!s)throw Error("School login expired. Sign in again");
  const res=await fetch("/api/school/"+code+"/fees",{
   method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+s.access_token,
    ...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
  const result=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(result.error||"School finance request failed");
  return result;
 },[client,code]);
 const reload=useCallback(async()=>{
  setLoading(true);
  try{setData(await api());setError("");}
  catch(e){setError(e.message);}
  finally{setLoading(false);}
 },[api]);
 useEffect(()=>{if(ready&&session)reload();else if(ready){setLoading(false);setData(null);}},
  [ready,session?.user?.id,reload]);
 const open=(type,f={})=>{setModal(type);setForm(f);setError("");setNotice("");};
 const close=()=>{setModal(null);setError("");};
 async function action(body,msg="School financial record saved."){
  setBusy(true);setError("");setNotice("");
  try{
   const result=await api(body);
   const extra=body.action==="invoice.batch"?
     " New invoices: "+result.result?.issued_count+". Existing invoices were not duplicated.":"";
   setNotice(msg+extra);setModal(null);setForm({});
   await reload();
   return result;
  }catch(e){setError(e.message);return null;}
  finally{setBusy(false);}
 }
 const actor=data?.actor;
 const has=(id)=>actor?.owner===true||actor?.permissions?.includes(id);
 const manager=actor&&[
  "finance.read","fees.manage","invoices.issue","payments.record","payments.approve"
 ].some(id=>has(id));
 const parent=actor?.guardian===true;
 const visibleTabs=STAGES.filter(t=>{
  if(t.id==="overview")return true;
  if(t.id==="catalog")return has("fees.manage")||has("invoices.issue");
  if(t.id==="invoices")return has("finance.read")||has("invoices.issue")||has("payments.record")||has("payments.approve");
  if(t.id==="payments")return has("payments.record")||has("payments.approve");
  if(t.id==="receipts")return has("finance.read")||parent;
  if(t.id==="family")return parent;
  if(t.id==="access")return actor?.owner;
  return false;
 });
 const pupils=new Map((data?.pupils||[]).map(p=>[p.id,p]));
 const invoices=data?.invoices||[];
 const payments=data?.payments||[];
 const receipts=data?.receipts||[];
 const fees=data?.feeCatalog||[];
 const classes=data?.classes||[];
 const claimed=payments.filter(p=>p.status==="pending");
 const day=kigaliDate();
 const canApprove=has("payments.approve");
 const canRecord=has("payments.record")||parent;
 const receiptById=receipts.find(r=>r.id===selectedReceipt);
 const printedInvoice=invoices.find(i=>i.id===receiptById?.invoice_id);
 const receiptPayment=payments.find(p=>p.id===receiptById?.payment_id);
 const filteredInvoices=invoices.filter(i=>{
  const text=[i.invoice_number,i.description,i.student_id,
   pupils.get(i.student_id)?.name,pupils.get(i.student_id)?.studentCode].join(" ").toLowerCase();
  return text.includes(search.toLowerCase())&&
   (invoiceStatus==="all"||(invoiceStatus==="overdue"&&i.balances.overdue)
   ||(invoiceStatus==="open"&&i.status==="issued"&&!i.balances.fully_paid)
   ||(invoiceStatus==="settled"&&i.status==="issued"&&i.balances.fully_paid)
   ||(invoiceStatus==="cancelled"&&i.status==="cancelled"));
 });
 const parentIds=parent?(data?.pupils||[]).map(p=>p.id):[];
 const parentInvoices=invoices.filter(i=>parentIds.includes(i.student_id)&&i.status==="issued");
 const parentDue=parentInvoices.reduce((a,i)=>a+BigInt(i.balances.balance_rwf),0n);
 const parentBilled=parentInvoices.reduce((a,i)=>a+BigInt(i.amount_rwf),0n);
 const parentPaid=parentInvoices.reduce((a,i)=>a+BigInt(i.balances.paid_rwf),0n);
 const parentWaived=parentInvoices.reduce((a,i)=>a+BigInt(i.balances.waived_rwf),0n);
 const isPartial=data?.limitations.partialLists;
 const selectedFees=fees.filter(f=>f.status==="active");
 const modalTitles={
  fee:"Create school fee",feeDisable:"Deactivate fee schedule",
  issue:"Issue student invoice",batch:"Issue class or year invoices",
  claim:"Report a payment reference",approve:"Review payment evidence",
  reject:"Reject payment claim",reverse:"Reverse posted school collection",
  credit:"Approve fee waiver",cancelInvoice:"Cancel invoice",
  access:"School finance access permissions"
 };
 if(!ready||loading)return <main className="school-admin-loading">Opening secure school financial records…</main>;
 if(!session)return <main className="school-admin-loading"><h1>School financial login required</h1>
  <p>Sign in with your verified school account.</p>
  <a className="button" href={"/s/"+code+"/login?role=parent"}>School Sign In</a></main>;
 if(!data)return <main className="school-admin-loading"><h2>School finance unavailable</h2>
  <p role="alert">{error||"This school has not granted financial access."}</p>
  <a href={"/s/"+code}>School Website</a></main>;
 const school=data.school,year=data.year;
 return <div className="fee-shell" style={{"--fee-brand":/^#[0-9a-f]{6}$/i.test(school.primaryColor||"")?school.primaryColor:"#204a78"}}>
  <header className="fee-header"><div className="fee-brand">
   {school.logoUrl?<img src={school.logoUrl} alt={school.name+" logo"} width="52" height="52"/>:
    <span className="fee-brand-fallback">✦</span>}
   <div><strong>{school.name}</strong><small>School Financial Services · RWF</small></div></div>
   <nav><a href={"/s/"+code}>School Website</a>
    {actor.owner&&<a href={"/s/"+code+"/admin"}>School Administration</a>}
    {parent&&<a href={"/s/"+code+"/family"}>My Family</a>}
    <a href={"/s/"+code+"/communications"}>School Community</a></nav>
  </header>
  <div className="fee-layout"><aside className="fee-sidebar">
   <small>FINANCIAL WORKSPACE</small>
   {visibleTabs.map(t=><button key={t.id} className={tab===t.id?"active":""}
    onClick={()=>{setTab(t.id);setError("");}}>{t.label}
    {t.id==="payments"&&claimed.length>0&&<span>{claimed.length}</span>}</button>)}
   <div className="fee-side-note"><small>School ID</small><strong>{school.code}</strong>
    <p>Fees are recorded for this institution only. The platform owner's separate charges never appear here.</p></div>
  </aside>
  <main className="fee-main"><div className="fee-title">
   <span>MODULE 7 · SCHOOL FINANCIAL MANAGEMENT</span>
   <h1>{({
    overview:parent&&!manager?"My Children's School Fees":"School Financial Overview",
    catalog:"School Fee Schedules",invoices:"Student Invoices",
    payments:"Payments Awaiting Review",receipts:"Verified School Receipts",
    family:"Family Fee Statements",access:"Financial Access Controls"})[tab]}</h1>
   <p>{year?.name||"Current academic year not configured"} · Currency: Rwandan francs (RWF)</p>
  </div>
  {error&&<div className="notice error" role="alert">{error}</div>}
  {notice&&<div className="notice ok" role="status">{notice}</div>}
  {tab==="overview"&&<><div className="fee-totals">
   {manager&&data.summary?
    <>
     <Total title="School invoices" value={data.summary.invoiced_rwf} desc="Issued fee invoices · all records"/>
     <Total title="Verified collections" value={data.summary.collected_rwf} desc="Approved payments only"/>
     <Total title="Outstanding balance" value={data.summary.outstanding_rwf} desc="After approved waivers"/>
     <Total title="Past-due balance" value={data.summary.overdue_rwf} desc={"As of "+data.summary.as_of}/>
    </>:
    <>
     <Total title="My children's invoiced fees" value={parentBilled.toString()} desc="Loaded family invoices"/>
     <Total title="Verified payments" value={parentPaid.toString()} desc="Approved school collections"/>
     <Total title="Fee adjustments" value={parentWaived.toString()} desc="Approved waivers"/>
     <Total title="Outstanding fees" value={parentDue.toString()} desc="Across linked children"/>
    </>}
   </div>
   <div className="fee-panels">
    <section className="fee-panel"><h2>{manager?"Pending school payment claims":"My school fee records"}</h2>
     {manager?<><p>Payment references waiting for a different authorized reviewer. Unapproved claims do not reduce balances.</p>
      <div className="fee-kpi"><strong>{data.summary?.pending_claims??claimed.length}</strong>
       <span>Pending claims across this school</span></div>
      {canApprove&&<button className="button secondary" onClick={()=>setTab("payments")}>Review pending collections</button>}</>:
      <><p>You can review invoices, outstanding balances and school-approved receipts. A reported Mobile Money transfer is **not** automatically confirmed.</p>
       <button className="button secondary" onClick={()=>setTab("family")}>View family statements</button></>}
    </section>
    <section className="fee-panel"><h2>How school payments work</h2>
     <ol className="fee-workflow"><li>School publishes an RWF fee schedule</li>
      <li>School issues an invoice for an enrolled pupil</li>
      <li>Guardian or cashier records an actual payment reference</li>
      <li>A separate authorized reviewer checks independent evidence</li>
      <li>Only then does the school issue a printable receipt and reduce the balance</li></ol>
     <p className="fee-callout">MTN MoMo, Airtel and bank integration credentials are not configured. This platform does not initiate transfers or claim provider confirmation.</p>
    </section>
   </div>
   {manager&&<section className="fee-panel"><h2>Outstanding student invoices</h2>
    <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Student</th><th>Due</th><th>Outstanding</th><th>Status</th></tr></thead>
    <tbody>{invoices.filter(i=>i.status==="issued"&&!i.balances.fully_paid)
     .sort((a,b)=>a.due_on.localeCompare(b.due_on)).slice(0,20)
     .map(i=><tr key={i.id}><td>{i.invoice_number}</td><td>{pupils.get(i.student_id)?.name||"Student"}</td>
      <td>{dueDate(i.due_on)}</td><td><strong>{displayRwf(i.balances.balance_rwf)}</strong></td><td><Status invoice={i}/></td></tr>)}</tbody></table>
    {!invoices.some(i=>i.status==="issued"&&!i.balances.fully_paid)&&
      <Empty title="No unpaid invoices in the loaded records" description="Create current-year fee items and issue student invoices to begin."/>}</div></section>}
  </>}
  {tab==="catalog"&&(has("fees.manage")||has("invoices.issue"))&&<>
   <div className="fee-section-actions"><div><h2>Fee items by academic year</h2>
    <p>Only eligible students receive invoices. Updating a future fee never rewrites issued invoice amounts.</p></div>
    {has("fees.manage")&&<button className="button" disabled={!year} onClick={()=>open("fee",{
     yearId:year.id,category:"tuition",label:"",term:"Term 1",dueOn:year.starts_on,
     amount:"",classId:""})}>+ Create Fee</button>}</div>
   <section className="fee-panel"><div className="table-wrap"><table>
    <thead><tr><th>Fee schedule</th><th>Category</th><th>Eligible class</th><th>Amount</th><th>Due date</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>{fees.map(f=><tr key={f.id}><td><strong>{f.label}</strong>
      <small className="fee-table-sub">{f.term_label||"Full year"}</small></td>
     <td>{cap(f.category)}</td>
     <td>{classes.find(c=>c.id===f.class_id)?.name||"All current-year classes"}</td>
     <td><strong>{displayRwf(f.amount_rwf)}</strong></td><td>{f.due_on}</td>
     <td><span className={"fee-status "+(f.status==="active"?"paid":"muted")}>{f.status}</span></td>
     <td><div className="fee-actions">
       {has("invoices.issue")&&f.status==="active"&&<>
        <button className="button small secondary" onClick={()=>open("issue",{feeId:f.id,studentId:""})}>Invoice Pupil</button>
        <button className="button small secondary" onClick={()=>open("batch",{fee:f})}>Issue to Eligible Class</button></>}
       {has("fees.manage")&&f.status==="active"&&<button className="fee-text-link"
         onClick={()=>open("feeDisable",{fee:f,reason:""})}>Deactivate</button>}
      </div></td></tr>)}</tbody></table>
     {!fees.length&&<Empty title="No fee schedule yet" description="An authorized bursar or school owner can create a fee for the current academic year."/>}</div></section>
  </>}
  {tab==="invoices"&&manager&&<><div className="fee-section-actions"><div>
   <h2>Issued invoices and balances</h2><p>Every student is billed in RWF. Overdue status follows the actual due date and remaining balance.</p></div>
   {has("invoices.issue")&&<button className="button" disabled={!selectedFees.length}
      onClick={()=>open("issue",{feeId:selectedFees[0]?.id,studentId:""})}>+ Invoice Student</button>}</div>
   <div className="fee-filters"><input className="input" placeholder="Search invoice, student or fee…" value={search} onChange={e=>setSearch(e.target.value)}/>
    <select className="input" value={invoiceStatus} onChange={e=>setInvoiceStatus(e.target.value)}>
     {[["all","All statuses"],["open","Outstanding"],["overdue","Past due"],
      ["settled","Settled"],["cancelled","Cancelled"]].map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></div>
   <section className="fee-panel"><div className="table-wrap"><table><thead><tr>
    <th>Invoice</th><th>Student</th><th>Fee</th><th>Invoiced</th><th>Approved paid</th><th>Waived</th><th>Balance</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>{filteredInvoices.map(i=><tr key={i.id}>
     <td><strong>{i.invoice_number}</strong><small className="fee-table-sub">{showDate(i.issued_at)}</small></td>
     <td><strong>{pupils.get(i.student_id)?.name||"Student"}</strong>
      <small className="fee-table-sub">{pupils.get(i.student_id)?.studentCode}</small></td>
     <td>{i.description}</td><td>{displayRwf(i.amount_rwf)}</td>
     <td>{displayRwf(i.balances.paid_rwf)}</td><td>{displayRwf(i.balances.waived_rwf)}</td>
     <td><strong>{displayRwf(i.balances.balance_rwf)}</strong></td>
     <td>{i.due_on}</td><td><Status invoice={i}/></td>
     <td><div className="fee-actions">
      {i.status==="issued"&&!i.balances.fully_paid&&has("payments.record")&&<button className="button small secondary"
       onClick={()=>open("claim",{invoice:i,invoiceId:i.id,amount:i.balances.balance_rwf,
        paidOn:kigaliDate(),method:"mtn_momo",reference:""})}>Record</button>}
      {i.status==="issued"&&!i.balances.fully_paid&&actor.owner&&
       <button className="fee-text-link" onClick={()=>open("credit",{invoice:i,amount:i.balances.balance_rwf,reason:""})}>Waive</button>}
      {i.status==="issued"&&actor.owner&&<button className="fee-text-link"
       onClick={()=>open("cancelInvoice",{invoice:i,reason:""})}>Cancel</button>}
     </div></td>
    </tr>)}</tbody></table>
    {!filteredInvoices.length&&<Empty title="No matching invoices" description="Try another filter or issue invoices from the active fee catalog."/>}</div>
    {isPartial&&<small className="fee-limit-note">List shows a capped set of records. Whole-school financial totals use the database summary, not this displayed subset.</small>}</section>
  </>}
  {tab==="payments"&&(has("payments.record")||has("payments.approve"))&&<>
   <div className="fee-section-actions"><div><h2>Pending and verified collections</h2>
    <p>Payment submissions are not revenue. A separate authorized person must verify the evidence before posting.</p></div></div>
   <section className="fee-panel"><h3>Waiting for school review</h3>
    <div className="table-wrap"><table><thead><tr><th>Date</th><th>Invoice</th><th>Method</th><th>Reference</th><th>Amount</th><th>Submitted by</th><th>Action</th></tr></thead>
    <tbody>{claimed.map(p=><tr key={p.id}><td>{p.paid_on}</td>
     <td>{invoices.find(i=>i.id===p.invoice_id)?.invoice_number||"Invoice"}</td>
     <td>{LABELS[p.method]||cap(p.method)}</td><td>{p.reference}</td>
     <td><strong>{displayRwf(p.amount_rwf)}</strong></td>
     <td>{p.source==="guardian_claim"?"Parent / Guardian":"School cashier"}</td>
     <td><div className="fee-actions">
      {canApprove&&<><button className="button small" disabled={p.proposed_by===actor.id}
       onClick={()=>open("approve",{payment:p,evidence:"provider_statement",review:""})}>Review / Approve</button>
       <button className="fee-text-link" onClick={()=>open("reject",{payment:p,reason:""})}>Reject</button></>}
      {p.proposed_by===actor.id&&<small>Different reviewer required</small>}
     </div></td></tr>)}</tbody></table>
    {!claimed.length&&<Empty title="No pending payment references" description="Confirmed collections appear only after independent review."/>}</div></section>
   <section className="fee-panel"><h3>Previously reviewed collections</h3>
    <div className="table-wrap"><table><thead><tr><th>Reference</th><th>Invoice</th><th>Amount</th><th>Method</th><th>Status</th><th>Review</th></tr></thead>
    <tbody>{payments.filter(p=>p.status!=="pending").slice(0,100).map(p=><tr key={p.id}>
     <td>{p.reference}</td><td>{invoices.find(i=>i.id===p.invoice_id)?.invoice_number}</td>
     <td>{displayRwf(p.amount_rwf)}</td><td>{LABELS[p.method]||cap(p.method)}</td>
     <td><span className={"fee-status "+(p.status==="posted"?"paid":"muted")}>{p.status}</span></td>
     <td><div className="fee-actions"><span className="fee-table-sub">{p.review_evidence?cap(p.review_evidence):"—"}</span>
      {p.status==="posted"&&actor.owner&&<button className="fee-text-link" onClick={()=>open("reverse",{payment:p,reason:""})}>Reverse record</button>}
     </div></td>
    </tr>)}</tbody></table></div></section>
  </>}
  {tab==="family"&&parent&&<>
   <div className="fee-section-actions"><div><h2>Only your linked children's invoices</h2>
    <p>Other pupils' financial records are never included. A submitted payment reference remains pending until reviewed by the school.</p></div></div>
   {(data.pupils||[]).map(p=><section className="fee-panel fee-family-section" key={p.id}>
    <div className="fee-family-head"><div className="fee-family-avatar">🎓</div>
     <div><h2>{p.name}</h2><p>Student ID {p.studentCode}</p></div></div>
    <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Fee</th><th>Total</th><th>Verified paid</th><th>Balance</th><th>Due</th><th>Status</th><th>Action</th></tr></thead>
     <tbody>{parentInvoices.filter(i=>i.student_id===p.id).map(i=><tr key={i.id}>
      <td>{i.invoice_number}</td><td>{i.description}{i.term_label?" · "+i.term_label:""}</td>
      <td>{displayRwf(i.amount_rwf)}</td><td>{displayRwf(i.balances.paid_rwf)}</td>
      <td><strong>{displayRwf(i.balances.balance_rwf)}</strong></td><td>{i.due_on}</td><td><Status invoice={i}/></td>
      <td>{!i.balances.fully_paid&&<button className="button secondary small"
       onClick={()=>open("claim",{invoice:i,invoiceId:i.id,amount:i.balances.balance_rwf,
        paidOn:kigaliDate(),method:"mtn_momo",reference:""})}>Report Transfer</button>}</td>
     </tr>)}</tbody></table>
     {!parentInvoices.some(i=>i.student_id===p.id)&&<Empty title="No issued fees" description="Your school has not yet issued an invoice for this pupil."/>}</div>
   </section>)}
   {!data.pupils.length&&<Empty title="No active verified family links" description="Your school must verify your guardian relationship before invoices appear."/>}
   <div className="fee-callout">This page does not initiate an MTN MoMo or Airtel Money transfer. Only enter a reference for money already paid through an officially confirmed school payment channel. The school will independently verify the claim.</div>
  </>}
  {tab==="receipts"&&(has("finance.read")||parent)&&<>
   <div className="fee-section-actions"><div><h2>School-issued receipts</h2>
    <p>Receipts exist only after a school reviewer approves evidence of a payment. These are not payment-network receipts.</p></div></div>
   <section className="fee-panel"><div className="table-wrap"><table><thead><tr>
    <th>Receipt</th><th>Invoice</th><th>Student</th><th>Amount</th><th>Issued</th><th>Status</th><th>Action</th></tr></thead>
    <tbody>{receipts.map(r=><tr key={r.id}><td><strong>{r.receipt_number}</strong></td>
     <td>{invoices.find(i=>i.id===r.invoice_id)?.invoice_number||"Invoice"}</td>
     <td>{pupils.get(invoices.find(i=>i.id===r.invoice_id)?.student_id)?.name||"Student"}</td>
     <td>{displayRwf(r.amount_rwf)}</td><td>{showDate(r.issued_at)}</td>
     <td><span className={"fee-status "+(r.status==="active"?"paid":"muted")}>{r.status}</span></td>
     <td>{r.status==="active"&&<button className="button secondary small" onClick={()=>setSelectedReceipt(r.id)}>Open / Print</button>}</td></tr>)}</tbody></table>
    {!receipts.length&&<Empty title="No approved receipts yet" description="Unverified transfer references and pending claims do not produce receipts."/>}</div></section>
  </>}
  {tab==="access"&&actor.owner&&<section className="fee-panel">
   <h2>Financial roles and permission switches</h2>
   <p>Each role must be approved by the school. School Finance permissions do not confer access to platform-owner income or confidential teacher messages.</p>
   <div className="table-wrap"><table><thead><tr><th>School administrator / staff</th><th>Permissions</th><th>Manage</th></tr></thead>
    <tbody>{data.grants.map(g=><tr key={g.userId}><td><strong>{g.label}</strong>
     <small className="fee-table-sub">{cap(g.role)} · {g.userId.slice(0,8)}…</small></td>
     <td>{g.permissions.length?g.permissions.map(cap).join(", "):"No finance permissions"}</td>
     <td><button className="button secondary small" onClick={()=>open("access",{
      target:g,permissions:[...g.permissions],reason:""})}>Edit toggles</button></td>
    </tr>)}</tbody></table>
    {!data.grants.length&&<Empty title="No authorized school finance staff" description="Invite school staff or administrators, then delegate precisely the permissions required."/>}</div></section>}
  <footer className="fee-footer">Institution-specific RWF records · School-issued receipts · No automatic provider confirmation · Owner subscription tracking stays separate</footer>
  </main></div>
  {modal&&<Dialog title={modalTitles[modal]||"School Finance"} onClose={close}>
   {error&&<div className="notice error" role="alert">{error}</div>}
   {modal==="fee"&&<form onSubmit={e=>{e.preventDefault();action({action:"fee.create",
     yearId:year.id,classId:form.classId||null,category:form.category,
     label:form.label,term:form.term,amount:form.amount,dueOn:form.dueOn});}}>
    <Field label="Fee label"><input className="input" minLength={3} maxLength={120}
     value={form.label||""} required placeholder="e.g. Term 1 Tuition" onChange={e=>setForm({...form,label:e.target.value})}/></Field>
    <Field label="Fee category"><select className="input" value={form.category}
     onChange={e=>setForm({...form,category:e.target.value})}>
     {FEE_CATEGORIES.map(c=><option key={c} value={c}>{cap(c)}</option>)}</select></Field>
    <Field label="School term or period"><input className="input" maxLength={50} value={form.term||""}
     onChange={e=>setForm({...form,term:e.target.value})}/></Field>
    <Field label="Applicable class"><select className="input" value={form.classId||""}
     onChange={e=>setForm({...form,classId:e.target.value})}>
     <option value="">All classes in current school year</option>
     {classes.map(c=><option key={c.id} value={c.id}>{c.name} {c.section}</option>)}</select></Field>
    <Field label="Charge in RWF · whole francs only"><input className="input" type="number" required min="1" max="1000000000000"
     step="1" value={form.amount||""} onChange={e=>setForm({...form,amount:e.target.value})}/></Field>
    <Field label="Payment due date"><input className="input" type="date" required
     value={form.dueOn||""} min={year?.starts_on} max={year?.ends_on}
     onChange={e=>setForm({...form,dueOn:e.target.value})}/></Field>
    <p className="fee-callout">This creates a fee definition, not an invoice. You must issue invoices to eligible pupils separately. MFA is required.</p>
    <button className="button" disabled={busy} type="submit">Save new fee</button>
   </form>}
   {modal==="issue"&&<form onSubmit={e=>{e.preventDefault();action({
    action:"invoice.issue",feeId:form.feeId,studentId:form.studentId});}}>
    <Field label="Active fee schedule"><select className="input" required value={form.feeId||""}
     onChange={e=>setForm({...form,feeId:e.target.value})}>
     <option value="">Select fee</option>
     {selectedFees.map(f=><option key={f.id} value={f.id}>{f.label} · {displayRwf(f.amount_rwf)}</option>)}</select></Field>
    <Field label="Enrolled student"><select className="input" required value={form.studentId||""}
     onChange={e=>setForm({...form,studentId:e.target.value})}>
     <option value="">Select student</option>
     {data.pupils.filter(p=>p.active&&p.classId).map(p=><option key={p.id} value={p.id}>{p.name} · {p.studentCode}</option>)}</select></Field>
    <p>School membership, active enrollment, class eligibility and duplicates are rechecked in the database. MFA is required.</p>
    <button className="button" disabled={busy||!form.feeId||!form.studentId} type="submit">Issue RWF invoice</button>
   </form>}
   {modal==="batch"&&<form onSubmit={e=>{e.preventDefault();action({
    action:"invoice.batch",feeId:form.fee.id
   },"Eligible student invoices issued.");}}>
    <p><strong>{form.fee.label}</strong> · {displayRwf(form.fee.amount_rwf)} per student</p>
    <p>This will issue a separate invoice to every currently enrolled student eligible for this fee. Existing student/fee invoices are skipped rather than duplicated.</p>
    <div className="fee-callout">This is a bulk financial posting. Review the fee amount and eligible class before proceeding. MFA is required.</div>
    <button className="button" disabled={busy} type="submit">Confirm bulk invoice issue</button>
   </form>}
   {modal==="claim"&&<form onSubmit={e=>{e.preventDefault();action({
    action:"payment.report",invoiceId:form.invoiceId,amount:form.amount,
    method:form.method,reference:form.reference,paidOn:form.paidOn,
    note:form.note||""
   },"Payment reference recorded as PENDING. No receipt has been issued.");}}>
    <p><b>{form.invoice.invoice_number}</b> · {form.invoice.description}</p>
    <p>Outstanding as recorded: <strong>{displayRwf(form.invoice.balances.balance_rwf)}</strong></p>
    <Field label="Payment method"><select className="input" value={form.method}
     onChange={e=>setForm({...form,method:e.target.value})}>
     {PAYMENT_METHODS.filter(m=>manager||!["cash","other"].includes(m)).map(m=><option key={m} value={m}>{LABELS[m]}</option>)}</select></Field>
    <Field label="Amount already paid · RWF"><input className="input" type="number" required
     min="1" step="1" max={form.invoice.amount_rwf} value={form.amount||""}
     onChange={e=>setForm({...form,amount:e.target.value})}/></Field>
    <Field label="Existing transaction or cashier reference"><input className="input" minLength={4}
     maxLength={120} required value={form.reference||""} placeholder="Existing receipt or transaction reference"
     onChange={e=>setForm({...form,reference:e.target.value})}/></Field>
    <Field label="Date funds were transferred"><input type="date" className="input" required max={kigaliDate()}
     value={form.paidOn||""} onChange={e=>setForm({...form,paidOn:e.target.value})}/></Field>
    <Field label="Additional note (optional)"><textarea className="input" maxLength={500}
     value={form.note||""} onChange={e=>setForm({...form,note:e.target.value})}/></Field>
    <div className="fee-callout"><strong>Not a payment checkout.</strong> Enter a reference only after a genuine transfer to your school's verified collection channel. This submission is a claim, not proof of bank/Mobile Money settlement.</div>
    <button className="button" type="submit" disabled={busy}>Submit reference for verification</button>
   </form>}
   {modal==="approve"&&<form onSubmit={e=>{e.preventDefault();action({
    action:"payment.approve",paymentId:form.payment.id,
    evidence:form.evidence,review:form.review
   },"School payment posted after independent review. An RWF receipt has been created.");}}>
    <p>Reference <strong>{form.payment.reference}</strong> · {displayRwf(form.payment.amount_rwf)} via {LABELS[form.payment.method]||form.payment.method}</p>
    <div className="fee-callout">You must independently check actual provider, bank, or cash evidence. A parent-entered transfer reference alone is insufficient. The original submitter cannot approve their own record.</div>
    <Field label="Independent evidence examined"><select className="input"
     value={form.evidence} onChange={e=>setForm({...form,evidence:e.target.value})}>
     {REVIEW_EVIDENCE.map(x=><option key={x} value={x}>{cap(x)}</option>)}</select></Field>
    <Field label="Review note · at least 15 characters"><textarea className="input" required minLength={15} maxLength={500}
     value={form.review||""} onChange={e=>setForm({...form,review:e.target.value})}/></Field>
    <button type="submit" className="button" disabled={busy||form.payment.proposed_by===actor.id}>Approve and issue school receipt (MFA)</button>
   </form>}
   {["feeDisable","reject","reverse","cancelInvoice"].includes(modal)&&<form onSubmit={e=>{
    e.preventDefault();
    const x=modal==="feeDisable"?{action:"fee.disable",feeId:form.fee.id}:
     modal==="reject"?{action:"payment.reject",paymentId:form.payment.id}:
     modal==="reverse"?{action:"payment.reverse",paymentId:form.payment.id}:
     {action:"invoice.cancel",invoiceId:form.invoice.id};
    action({...x,reason:form.reason});
   }}>
    <p>Explain the change. Financial history remains visible for auditing; there is no hard deletion or external refund.</p>
    <Field label="Reason for this financial change"><textarea className="input" minLength={modal==="reverse"||modal==="cancelInvoice"?12:8}
     maxLength={500} required value={form.reason||""}
     onChange={e=>setForm({...form,reason:e.target.value})}/></Field>
    <button type="submit" className="button danger" disabled={busy}>Confirm with required authorization</button>
   </form>}
   {modal==="credit"&&<form onSubmit={e=>{e.preventDefault();action({
    action:"invoice.credit",invoiceId:form.invoice.id,amount:form.amount,reason:form.reason
   },"School owner fee credit posted and audited.");}}>
    <p>Approve a documented fee reduction for invoice <strong>{form.invoice.invoice_number}</strong>.</p>
    <p>Remaining amount: {displayRwf(form.invoice.balances.balance_rwf)}</p>
    <Field label="Waiver or adjustment · RWF"><input className="input" type="number" min="1"
     required step="1" max={form.invoice.balances.balance_rwf} value={form.amount||""}
     onChange={e=>setForm({...form,amount:e.target.value})}/></Field>
    <Field label="Approved justification"><textarea className="input" required minLength={12} maxLength={500}
     value={form.reason||""} onChange={e=>setForm({...form,reason:e.target.value})}/></Field>
    <button className="button" type="submit" disabled={busy}>Approve fee waiver with MFA</button>
   </form>}
   {modal==="access"&&<form onSubmit={e=>{e.preventDefault();action({
     action:"rights.set",userId:form.target.userId,permissions:form.permissions,reason:form.reason
   },"School financial permissions updated and audited.");}}>
    <p><strong>{form.target.label}</strong> · {cap(form.target.role)}</p>
    <p>Switches are independent. Neither teachers nor platform-owner staff inherit local school fee access.</p>
    <div className="table-wrap"><table><thead><tr><th>Permission</th><th>What it allows</th><th>ON / OFF</th></tr></thead>
     <tbody>{FINANCE_RIGHTS.map(r=><tr key={r.id}>
      <td><strong>{r.id}</strong></td><td>{r.label}</td>
      <td><label className="switch"><input type="checkbox" role="switch" checked={form.permissions.includes(r.id)}
       aria-label={r.label} onChange={e=>setForm(prev=>({...prev,permissions:e.target.checked?
        [...prev.permissions,r.id]:prev.permissions.filter(x=>x!==r.id)}))}/>
       <span className="switch-track"/></label></td></tr>)}</tbody></table></div>
    <Field label="Audit reason for permission change"><textarea className="input" required minLength={8}
      maxLength={500} value={form.reason||""} onChange={e=>setForm({...form,reason:e.target.value})}/></Field>
    <button className="button" disabled={busy} type="submit">Save financial access with MFA</button>
   </form>}
  </Dialog>}
  {receiptById&&printedInvoice&&<div className="fee-receipt-overlay" role="presentation">
   <div className="fee-receipt-controls"><button className="button secondary"
     onClick={()=>setSelectedReceipt("")}>Back to receipts</button>
     <button className="button" onClick={()=>window.print()}>Print / Save as PDF</button></div>
   <article className="fee-receipt-paper">
    <div className="fee-receipt-head">{school.logoUrl?
      <img src={school.logoUrl} alt={school.name+" logo"} width="68" height="68"/>:
      <span className="fee-brand-fallback">✦</span>}
      <div><small>SCHOOL-ISSUED RECEIPT</small><h2>{school.name}</h2>
       <p>School ID: {school.code}</p></div></div>
    <h1>School Fee Payment Receipt</h1>
    <div className="fee-receipt-details">
     <div><small>Receipt reference</small><strong>{receiptById.receipt_number}</strong></div>
     <div><small>Invoice reference</small><strong>{printedInvoice.invoice_number}</strong></div>
     <div><small>Student</small><strong>{pupils.get(printedInvoice.student_id)?.name||"School pupil"}</strong></div>
     <div><small>Student ID</small><strong>{pupils.get(printedInvoice.student_id)?.studentCode}</strong></div>
     <div><small>Issued</small><strong>{showDate(receiptById.issued_at)}</strong></div>
     <div><small>Payment method</small><strong>{LABELS[receiptPayment?.method]||"School recorded"}</strong></div>
    </div>
    <section className="fee-receipt-amount"><small>APPROVED PAYMENT RECORDED</small>
     <strong>{displayRwf(receiptById.amount_rwf)}</strong><span>Rwandan francs · School-verified</span></section>
    <div className="fee-receipt-footer"><p>Issued by {school.name} after a school-authorized independent review of payment evidence.</p>
     <p>This document confirms the school's recorded collection. It is NOT a receipt issued by MTN MoMo, Airtel Money, a bank or a government authority. Keep the original transfer confirmation for reconciliation.</p>
     <p>Record ID: {receiptById.id} · Invoice {printedInvoice.invoice_number}</p></div>
   </article>
  </div>}
 </div>;
}
