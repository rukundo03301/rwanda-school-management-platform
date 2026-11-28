"use client";
import {useCallback,useEffect,useState} from "react";
import {useRouter,useSearchParams} from "next/navigation";
import {browserSupabase} from "../../../../lib/client.js";
import {Icon} from "../../../ui/DashboardShell.jsx";
import "./money.css";

const CAT={food:["Food and kitchen","#ea580c"],utilities:["Electricity and water","#0891b2"],fuel:["Fuel and cooking gas","#b45309"],vehicles:["Vehicles and transport","#7c3aed"],
 maintenance:["Repairs and maintenance","#be123c"],supplies:["Supplies and stationery","#0d9488"],rent:["Rent and buildings","#4d7c0f"],communication:["Phone and internet","#2563eb"],other:["Other costs","#64748b"]};
const METHOD={mtn_momo:"MTN MoMo",airtel_money:"Airtel Money",bank_transfer:"Bank transfer",cash:"Cash",other:"Other"};
const TABS=[["pnl","Profit and loss","chart","blue"],["expenses","Expenses and bills","wallet","orange"],["payroll","Salaries to pay","check","green"],["salaries","Salary setup","users","purple"]];
const rwf=v=>Number(v||0).toLocaleString("en-US")+" RWF";
const short=v=>{const n=Number(v||0),a=Math.abs(n);return (n<0?"-":"")+(a>=1e6?(a/1e6).toFixed(1)+"M":a>=1e3?Math.round(a/1e3)+"k":String(a));};
const monthName=m=>new Date(m+"-01T00:00:00").toLocaleDateString("en-GB",{month:"short",year:"numeric"});
const today=()=>new Date().toISOString().slice(0,10);

export default function MoneyView({code}){
 const sp=useSearchParams(),router=useRouter();
 const tab=TABS.some(t=>t[0]===sp.get("tab"))?sp.get("tab"):"pnl";
 const [client,setClient]=useState(null),[d,setD]=useState(null),[err,setErr]=useState(""),[note,setNote]=useState(null),[busy,setBusy]=useState(false);
 useEffect(()=>{setClient(browserSupabase());},[]);
 const call=useCallback(async body=>{
  const {data:{session}}=await client.auth.getSession();
  if(!session)throw Error("Your school sign-in has expired. Sign in again.");
  const r=await fetch("/api/school/"+code+"/money",{method:body?"POST":"GET",cache:"no-store",headers:{Authorization:"Bearer "+session.access_token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||"Request failed");return j;
 },[client,code]);
 const load=useCallback(()=>call().then(x=>{setD(x);setErr("");}).catch(e=>setErr(e.message)),[call]);
 useEffect(()=>{if(client)load();},[client,load]);
 const run=useCallback(async(body,ok)=>{setBusy(true);setNote(null);
  try{const j=await call(body);await load();if(ok)setNote({ok:true,text:typeof ok==="function"?ok(j):ok});return j;}
  catch(e){setNote({ok:false,text:e.message});return null;}finally{setBusy(false);}},[call,load]);
 if(err&&!d)return <section className="ds-panel"><h3>Money and profit are not available</h3><p role="alert">{err}</p></section>;
 if(!d)return <section className="ds-panel"><p>Loading money and profit…</p></section>;
 const t=d.totals,margin=t.income?Math.round(t.profit*100/t.income):0;
 const props={d,run,busy};
 return <div className="mn-wrap">
  <header className="mn-head"><div><h2>Money and Profit</h2><p>{d.year?.name?"Academic year "+d.year.name+" · ":""}{new Date(d.range.from).toLocaleDateString("en-GB")} to {new Date(d.range.to).toLocaleDateString("en-GB")}. Money in is school fees received. Money out is approved expenses and paid salaries.</p></div></header>
  <div className="mn-stats">
   <div className="mn-stat green"><Icon name="wallet"/><div><small>Money in (fees received)</small><b>{rwf(t.income)}</b></div></div>
   <div className="mn-stat orange"><Icon name="alert"/><div><small>Expenses and bills</small><b>{rwf(t.costs-t.salaries)}</b></div></div>
   <div className="mn-stat purple"><Icon name="users"/><div><small>Salaries paid</small><b>{rwf(t.salaries)}</b></div></div>
   <div className={"mn-stat "+(t.profit>=0?"blue":"red")}><Icon name="chart"/><div><small>{t.profit>=0?"Profit":"Loss"} ({margin}% of money in)</small><b>{rwf(t.profit)}</b></div></div>
  </div>
  <nav className="mn-tabs" role="tablist">{TABS.map(([k,l,ic,c])=><button key={k} role="tab" aria-selected={tab===k} className={"mn-tab "+c+(tab===k?" on":"")} onClick={()=>{setNote(null);router.push("/s/"+code+"/money?tab="+k,{scroll:false});}}>
   <Icon name={ic} size={17}/>{l}{k==="expenses"&&d.pendingExpenses>0&&<span className="mn-badge">{d.pendingExpenses}</span>}</button>)}</nav>
  {note&&<div className={"notice "+(note.ok?"info":"error")} role={note.ok?"status":"alert"}>{note.text}</div>}
  {tab==="pnl"&&<Pnl d={d}/>}
  {tab==="expenses"&&<Expenses {...props}/>}
  {tab==="payroll"&&<Payroll {...props}/>}
  {tab==="salaries"&&<Salaries {...props}/>}
 </div>;
}

function Pnl({d}){
 const max=Math.max(1,...d.pnl.map(r=>Math.max(r.income,r.costs)));
 const cats=Object.entries(d.totals.byCat).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
 const allCosts=d.totals.costs||1;
 return <>
  <section className="ds-panel"><h3>Month by month</h3>
   <div className="mn-legend"><span><i className="g"/>Money in</span><span><i className="r"/>Money out</span></div>
   <div className="mn-bars" role="img" aria-label="Money in and money out by month">{d.pnl.map(r=><div key={r.month} className="mn-barcol" title={monthName(r.month)+": in "+rwf(r.income)+", out "+rwf(r.costs)}>
    <div className="mn-barpair"><i className="g" style={{height:(r.income*100/max)+"%"}}/><i className="r" style={{height:(r.costs*100/max)+"%"}}/></div>
    <small>{monthName(r.month).split(" ")[0]}</small><b className={r.profit<0?"neg":""}>{short(r.profit)}</b></div>)}</div>
  </section>
  <section className="ds-panel"><h3>Profit and loss statement</h3>
   <table className="mn-table"><thead><tr><th>Month</th><th>Money in</th><th>Salaries</th><th>Other expenses</th><th>Profit or loss</th></tr></thead><tbody>
    {d.pnl.map(r=><tr key={r.month}><td>{monthName(r.month)}</td><td className="in">{rwf(r.income)}</td><td>{rwf(r.salaries)}</td><td>{rwf(r.costs-r.salaries)}</td><td className={r.profit<0?"neg":"pos"}><b>{rwf(r.profit)}</b></td></tr>)}
    <tr className="mn-total"><td>Total</td><td className="in">{rwf(d.totals.income)}</td><td>{rwf(d.totals.salaries)}</td><td>{rwf(d.totals.costs-d.totals.salaries)}</td><td className={d.totals.profit<0?"neg":"pos"}>{rwf(d.totals.profit)}</td></tr>
   </tbody></table>
  </section>
  <section className="ds-panel"><h3>Where the money goes</h3>
   {!cats.length&&!d.totals.salaries?<p className="muted">No approved expenses or paid salaries yet in this period.</p>:<div className="mn-split">
    {d.totals.salaries>0&&<div className="mn-catrow"><span style={{background:"#7c3aed"}}/><b>Salaries</b><div className="mn-catbar"><i style={{width:(d.totals.salaries*100/allCosts)+"%",background:"#7c3aed"}}/></div><em>{rwf(d.totals.salaries)}</em></div>}
    {cats.map(([k,v])=><div key={k} className="mn-catrow"><span style={{background:CAT[k][1]}}/><b>{CAT[k][0]}</b><div className="mn-catbar"><i style={{width:(v*100/allCosts)+"%",background:CAT[k][1]}}/></div><em>{rwf(v)}</em></div>)}
   </div>}
   <p className="muted">Fees still owed by parents are not counted until they are paid. See Fees and Finance for students past due.</p>
  </section>
 </>;
}

function Expenses({d,run,busy}){
 const [f,setF]=useState(null),[cat,setCat]=useState("all"),[st,setSt]=useState("all");
 const list=d.expenses.filter(e=>(cat==="all"||e.category===cat)&&(st==="all"||e.status===st));
 return <>
  <section className="ds-panel">
   <div className="mn-row"><h3>Expenses and bills</h3>{d.can.record&&!f&&<button className="button" onClick={()=>setF({category:"food",title:"",amount:"",spentOn:today(),paidTo:"",method:"cash",reference:"",notes:""})}><Icon name="plus" size={16}/> Record an expense</button>}</div>
   <p className="muted">{d.can.owner?"Expenses you record are approved straight away. Expenses recorded by your accountant wait for your approval.":"Expenses you record wait for the owner's approval before they count in profit and loss."}</p>
   {f&&<form className="mn-form" onSubmit={async e=>{e.preventDefault();if(await run({action:"expense.add",...f},d.can.owner?"Expense saved":"Expense saved and sent to the owner for approval"))setF(null);}}>
    <label>What was it for<select className="input" value={f.category} onChange={e=>setF({...f,category:e.target.value})}>{Object.entries(CAT).map(([k,[l]])=><option key={k} value={k}>{l}</option>)}</select></label>
    <label>Description<input className="input" required minLength={2} maxLength={160} placeholder="Example: Maize flour 50 kg, REG electricity November" value={f.title} onChange={e=>setF({...f,title:e.target.value})}/></label>
    <label>Amount (RWF)<input className="input" required type="number" min={1} step={1} value={f.amount} onChange={e=>setF({...f,amount:e.target.value})}/></label>
    <label>Date paid<input className="input" required type="date" value={f.spentOn} onChange={e=>setF({...f,spentOn:e.target.value})}/></label>
    <label>Paid to<input className="input" maxLength={160} placeholder="Supplier or person" value={f.paidTo} onChange={e=>setF({...f,paidTo:e.target.value})}/></label>
    <label>Paid by<select className="input" value={f.method} onChange={e=>setF({...f,method:e.target.value})}>{Object.entries(METHOD).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <label>Receipt or reference<input className="input" maxLength={120} value={f.reference} onChange={e=>setF({...f,reference:e.target.value})}/></label>
    <div className="mn-actions"><button className="button" disabled={busy}>Save expense</button><button type="button" className="button secondary" onClick={()=>setF(null)}>Cancel</button></div></form>}
   <div className="mn-pills"><button className={cat==="all"?"on":""} onClick={()=>setCat("all")}>All</button>{Object.entries(CAT).map(([k,[l,c]])=><button key={k} className={cat===k?"on":""} style={cat===k?{background:c,borderColor:c}:{borderColor:c,color:c}} onClick={()=>setCat(k)}>{l}</button>)}</div>
   <div className="mn-pills sm">{[["all","Any status"],["pending","Waiting for approval"],["approved","Approved"],["rejected","Rejected"]].map(([k,l])=><button key={k} className={st===k?"on":""} onClick={()=>setSt(k)}>{l}</button>)}</div>
   <table className="mn-table"><thead><tr><th>Date</th><th>Expense</th><th>Type</th><th>Amount</th><th>Status</th><th/></tr></thead><tbody>
    {list.map(e=><tr key={e.id}><td>{new Date(e.spent_on).toLocaleDateString("en-GB")}</td><td><b>{e.title}</b><br/><small className="muted">{[e.paid_to,METHOD[e.method],e.reference,e.recordedByName&&"recorded by "+e.recordedByName].filter(Boolean).join(" · ")}</small></td>
     <td><span className="mn-cat" style={{background:CAT[e.category][1]+"1a",color:CAT[e.category][1]}}>{CAT[e.category][0]}</span></td><td><b>{rwf(e.amount_rwf)}</b></td>
     <td><span className={"mn-status "+e.status}>{e.status==="pending"?"Waiting for approval":e.status==="approved"?"Approved":"Rejected"}</span></td>
     <td>{d.can.owner&&e.status==="pending"&&<div className="mn-row"><button className="button small" disabled={busy} onClick={()=>run({action:"expense.decide",expenseId:e.id,decision:"approve"},"Expense approved")}>Approve</button>
      <button className="button secondary small" disabled={busy} onClick={()=>run({action:"expense.decide",expenseId:e.id,decision:"reject"},"Expense rejected")}>Reject</button></div>}
      {d.can.owner&&e.status!=="pending"&&<button className="button secondary small" disabled={busy} onClick={()=>run({action:"expense.delete",expenseId:e.id},"Expense deleted")}>Delete</button>}</td></tr>)}
    {!list.length&&<tr><td colSpan={6}>No expenses here yet.</td></tr>}
   </tbody></table>
  </section>
 </>;
}

function Payroll({d,run,busy}){
 const next=(()=>{const n=new Date();return n.toISOString().slice(0,7);})();
 const [period,setPeriod]=useState(next),[edit,setEdit]=useState(null);
 const open=d.payroll.filter(r=>r.status!=="cancelled");
 const STATUS={draft:["Prepared, waiting for the owner","pending"],approved:["Approved, ready to pay","approved"],paid:["Paid","paid"],cancelled:["Cancelled","rejected"]};
 return <>
  <section className="ds-panel">
   <h3>Prepare a month's salaries</h3>
   <p className="muted">Uses each person's salary from Salary setup ({rwf(d.monthlyPayroll)} a month in total). The accountant prepares it, the owner approves it, then it is marked paid and counts in profit and loss.</p>
   {d.can.record&&<div className="mn-row" style={{justifyContent:"flex-start"}}><label className="mn-inline">Month<input className="input" type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></label>
    <button className="button" disabled={busy||!period} onClick={()=>run({action:"payroll.create",period},j=>"Salaries for "+monthName(period)+" prepared: "+j.result.people+" people, "+rwf(j.result.total))}>Prepare salaries</button></div>}
  </section>
  {open.map(r=><section key={r.id} className="ds-panel mn-run">
   <div className="mn-row"><div><h3>Salaries for {monthName(r.period)}</h3><span className={"mn-status "+STATUS[r.status][1]}>{STATUS[r.status][0]}</span> <b className="mn-big">{rwf(r.total_rwf)}</b></div>
    <div className="mn-row">
     {r.status==="draft"&&d.can.owner&&<button className="button" disabled={busy} onClick={()=>run({action:"payroll.approve",runId:r.id},"Salaries for "+monthName(r.period)+" approved")}>Approve salaries</button>}
     {r.status==="approved"&&d.can.record&&<button className="button" disabled={busy} onClick={()=>run({action:"payroll.paid",runId:r.id},"Salaries for "+monthName(r.period)+" marked as paid")}>Mark as paid</button>}
     {(r.status==="draft"||(r.status==="approved"&&d.can.owner))&&d.can.record&&<button className="button secondary" disabled={busy} onClick={()=>run({action:"payroll.cancel",runId:r.id},"Payroll cancelled")}>Cancel</button>}
    </div></div>
   <table className="mn-table"><thead><tr><th>Name</th><th>Job</th><th>Salary</th><th>Bonus</th><th>Deductions</th><th>To pay</th><th/></tr></thead><tbody>
    {r.lines.map(l=>edit?.id===l.id?<tr key={l.id}><td><b>{l.name}</b></td><td>{l.job_title}</td><td>{rwf(l.base_rwf)}</td>
     <td><input className="input mn-num" type="number" min={0} aria-label="Bonus" value={edit.bonus} onChange={e=>setEdit({...edit,bonus:e.target.value})}/></td>
     <td><input className="input mn-num" type="number" min={0} aria-label="Deductions" value={edit.deductions} onChange={e=>setEdit({...edit,deductions:e.target.value})}/></td>
     <td><input className="input" maxLength={300} placeholder="Note" aria-label="Note" value={edit.note} onChange={e=>setEdit({...edit,note:e.target.value})}/></td>
     <td><button className="button small" disabled={busy} onClick={async()=>{if(await run({action:"payroll.line",lineId:l.id,bonus:Number(edit.bonus||0),deductions:Number(edit.deductions||0),note:edit.note},"Saved"))setEdit(null);}}>Save</button></td></tr>
     :<tr key={l.id}><td><b>{l.name}</b>{l.note&&<><br/><small className="muted">{l.note}</small></>}</td><td>{l.job_title}</td><td>{rwf(l.base_rwf)}</td><td>{rwf(l.bonus_rwf)}</td><td>{rwf(l.deductions_rwf)}</td><td><b>{rwf(l.net_rwf)}</b></td>
      <td>{r.status==="draft"&&d.can.record&&<button className="button secondary small" onClick={()=>setEdit({id:l.id,bonus:l.bonus_rwf,deductions:l.deductions_rwf,note:l.note})}>Change</button>}</td></tr>)}
   </tbody></table>
  </section>)}
  {!open.length&&<section className="ds-panel"><p>No salaries prepared yet.</p></section>}
 </>;
}

function Salaries({d,run,busy}){
 const [edit,setEdit]=useState(null),[q,setQ]=useState("");
 const ROLE={teacher:"Teacher",staff:"Staff",school_admin:"Principal / admin"};
 const shown=d.staff.filter(s=>!q||(s.name+" "+s.email).toLowerCase().includes(q.toLowerCase()));
 const missing=d.staff.filter(s=>!s.pay).length;
 return <section className="ds-panel">
  <div className="mn-row"><h3>Salary setup</h3><input className="input" style={{maxWidth:260}} aria-label="Search staff" placeholder="Search" value={q} onChange={e=>setQ(e.target.value)}/></div>
  <p className="muted">Set the monthly salary and the pay day for every teacher and staff member. {missing?missing+" people have no salary yet.":"Everyone has a salary."} Monthly total: <b>{rwf(d.monthlyPayroll)}</b>.</p>
  {!d.can.owner&&<p className="notice info">Only the school owner can set or change salaries.</p>}
  <table className="mn-table"><thead><tr><th>Name</th><th>Role</th><th>Job title</th><th>Monthly salary</th><th>Pay day</th><th>Paid by</th><th/></tr></thead><tbody>
   {shown.map(s=>edit?.userId===s.id?<tr key={s.id}><td><b>{s.name}</b></td><td>{s.roles.map(r=>ROLE[r]||r).join(", ")}</td>
    <td><input className="input" maxLength={80} aria-label="Job title" value={edit.jobTitle} onChange={e=>setEdit({...edit,jobTitle:e.target.value})}/></td>
    <td><input className="input mn-num" type="number" min={0} aria-label="Monthly salary" value={edit.monthlySalary} onChange={e=>setEdit({...edit,monthlySalary:e.target.value})}/></td>
    <td><select className="input" aria-label="Pay day" value={edit.payDay} onChange={e=>setEdit({...edit,payDay:Number(e.target.value)})}>{Array.from({length:28},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}</select></td>
    <td><select className="input" aria-label="Paid by" value={edit.method} onChange={e=>setEdit({...edit,method:e.target.value})}>{Object.entries(METHOD).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></td>
    <td><button className="button small" disabled={busy} onClick={async()=>{if(await run({action:"pay.set",...edit,monthlySalary:Number(edit.monthlySalary)},s.name+": "+rwf(edit.monthlySalary)+" a month, paid on day "+edit.payDay))setEdit(null);}}>Save</button>
     <button className="button secondary small" onClick={()=>setEdit(null)}>Cancel</button></td></tr>
    :<tr key={s.id}><td><b>{s.name}</b><br/><small className="muted">{s.email}</small></td><td>{s.roles.map(r=>ROLE[r]||r).join(", ")}</td><td>{s.pay?.job_title||""}</td>
     <td>{s.pay?<b>{rwf(s.pay.monthly_salary_rwf)}</b>:<span className="mn-status pending">Not set</span>}</td><td>{s.pay?"Day "+s.pay.pay_day:""}</td><td>{s.pay?METHOD[s.pay.payment_method]:""}</td>
     <td>{d.can.owner&&<button className="button secondary small" onClick={()=>setEdit({userId:s.id,jobTitle:s.pay?.job_title||(s.roles.includes("teacher")?"Teacher":""),monthlySalary:s.pay?.monthly_salary_rwf??"",payDay:s.pay?.pay_day||28,method:s.pay?.payment_method||"bank_transfer"})}>{s.pay?"Change":"Set salary"}</button>}</td></tr>)}
  </tbody></table>
 </section>;
}
