import {schoolFinanceContext} from "../../../../../lib/school-fees.mjs";
import {ApiError,checked,jsonError,validateUuid} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store"};
const EXPENSE_CATEGORIES=["food","utilities","fuel","vehicles","maintenance","supplies","rent","communication","other"];
const METHODS=["mtn_momo","airtel_money","bank_transfer","cash","other"];
const text=(v,max,min=0,label="text")=>{const t=typeof v==="string"?v.trim():"";if(t.length<min||t.length>max)throw new ApiError(400,"Please check the "+label);return t;};
const rwf=(v,label,{min=1,max=1e12}={})=>{const n=Number(v);if(!Number.isInteger(n)||n<min||n>max)throw new ApiError(400,"Enter "+label+" as whole Rwandan francs");return n;};
const day=(v,label)=>{if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v)))throw new ApiError(400,"Choose a valid "+label);return v;};
const monthOf=d=>String(d).slice(0,7);

// Who can do what. The owner can do everything. Staff or principals with finance rights:
// finance.read sees the money pages, payments.record records expenses and prepares payroll.
// Only the owner approves expenses, sets salaries and approves payroll.
function can(ctx){
 const r=new Set(ctx.rights);
 return {owner:ctx.owner,read:ctx.owner||r.has("finance.read"),record:ctx.owner||r.has("payments.record")};
}
async function staffList(db,school){
 const ms=await checked(db.from("school_memberships").select("auth_user_id,role").eq("school_id",school.id).eq("active",true).in("role",["teacher","staff","school_admin"]).limit(400));
 const ids=[...new Set(ms.map(m=>m.auth_user_id))];
 return Promise.all(ids.map(async id=>{
  const {data}=await db.auth.admin.getUserById(id);const u=data?.user;const m=u?.user_metadata||{};
  return {id,name:String(m.display_name||m.full_name||"").trim()||u?.email||"Staff member",email:u?.email||"",roles:ms.filter(x=>x.auth_user_id===id).map(x=>x.role)};
 }));
}

export async function GET(request,{params}){
 try{
  const {code}=await params;
  const ctx=await schoolFinanceContext(request,code);
  const {db,school}=ctx;const p=can(ctx);
  if(!p.read)throw new ApiError(403,"Money and profit pages need finance rights");
  const url=new URL(request.url);
  const from=/^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("from")||"")?url.searchParams.get("from"):(ctx.year?.starts_on||new Date().getFullYear()+"-01-01");
  const to=/^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("to")||"")?url.searchParams.get("to"):(ctx.year?.ends_on||new Date().getFullYear()+"-12-31");
  const [expenses,pay,runs,payments,people]=await Promise.all([
   checked(db.from("school_expenses").select("id,category,title,amount_rwf,spent_on,paid_to,method,reference,notes,status,recorded_by,decided_at,decision_note,created_at").eq("school_id",school.id).gte("spent_on",from).lte("spent_on",to).order("spent_on",{ascending:false}).limit(2000)),
   checked(db.from("school_staff_pay").select("auth_user_id,job_title,monthly_salary_rwf,pay_day,payment_method,active,updated_at").eq("school_id",school.id).limit(400)),
   checked(db.from("school_payroll_runs").select("id,period,status,total_rwf,created_at,approved_at,paid_at").eq("school_id",school.id).order("period",{ascending:false}).limit(60)),
   checked(db.from("school_fee_payments").select("amount_rwf,paid_on").eq("school_id",school.id).eq("status","posted").gte("paid_on",from).lte("paid_on",to).limit(20000)),
   staffList(db,school)
  ]);
  const runIds=runs.map(r=>r.id);
  const lines=runIds.length?await checked(db.from("school_payroll_lines").select("id,run_id,auth_user_id,name,job_title,base_rwf,bonus_rwf,deductions_rwf,net_rwf,note").eq("school_id",school.id).in("run_id",runIds).limit(10000)):[];
  // Profit and loss on a cash basis: fees actually received, minus approved expenses and paid salaries.
  const months=[];
  for(let d=new Date(from.slice(0,7)+"-01T00:00:00Z");d<=new Date(to+"T00:00:00Z");d.setUTCMonth(d.getUTCMonth()+1))months.push(d.toISOString().slice(0,7));
  const pnl=months.map(m=>{
   const income=payments.filter(x=>monthOf(x.paid_on)===m).reduce((a,x)=>a+Number(x.amount_rwf),0);
   const byCat={};for(const c of EXPENSE_CATEGORIES)byCat[c]=0;
   for(const e of expenses)if(e.status==="approved"&&monthOf(e.spent_on)===m)byCat[e.category]+=Number(e.amount_rwf);
   const salaries=runs.filter(r=>r.status==="paid"&&r.period===m).reduce((a,r)=>a+Number(r.total_rwf),0);
   const costs=Object.values(byCat).reduce((a,b)=>a+b,0)+salaries;
   return {month:m,income,salaries,byCat,costs,profit:income-costs};
  });
  const sum=k=>pnl.reduce((a,r)=>a+r[k],0);
  const catTotals={};for(const c of EXPENSE_CATEGORIES)catTotals[c]=pnl.reduce((a,r)=>a+r.byCat[c],0);
  const totals={income:sum("income"),salaries:sum("salaries"),costs:sum("costs"),profit:sum("profit"),byCat:catTotals};
  const payBy=new Map(pay.map(x=>[x.auth_user_id,x]));
  const names=new Map(people.map(x=>[x.id,x.name]));
  return Response.json({
   school:{name:school.name},year:ctx.year,range:{from,to},can:p,
   pnl,totals,
   expenses:expenses.map(e=>({...e,recordedByName:names.get(e.recorded_by)||""})),
   staff:people.map(s=>({...s,pay:payBy.get(s.id)||null})).sort((a,b)=>a.name.localeCompare(b.name)),
   payroll:runs.map(r=>({...r,lines:lines.filter(l=>l.run_id===r.id).sort((a,b)=>a.name.localeCompare(b.name))})),
   pendingExpenses:expenses.filter(e=>e.status==="pending").length,
   monthlyPayroll:pay.filter(x=>x.active).reduce((a,x)=>a+Number(x.monthly_salary_rwf),0)
  },{headers:noStore});
 }catch(e){return jsonError(e);}
}

export async function POST(request,{params}){
 try{
  const {code}=await params;
  const ctx=await schoolFinanceContext(request,code);
  const {db,school,user}=ctx;const p=can(ctx);
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||"");
  const ownerOnly=()=>{if(!p.owner)throw new ApiError(403,"Only the school owner can approve this");};
  const recorder=()=>{if(!p.record)throw new ApiError(403,"You need the finance right to record payments");};
  const loadRun=async id=>{const r=await checked(db.from("school_payroll_runs").select("id,period,status").eq("school_id",school.id).eq("id",validateUuid(id,"payroll")).maybeSingle());if(!r)throw new ApiError(404,"Payroll not found");return r;};
  const retotal=async runId=>{const ls=await checked(db.from("school_payroll_lines").select("net_rwf").eq("school_id",school.id).eq("run_id",runId));
   const total=ls.reduce((a,l)=>a+Number(l.net_rwf),0);const u=await db.from("school_payroll_runs").update({total_rwf:total}).eq("school_id",school.id).eq("id",runId);if(u.error)throw new ApiError(400,"Could not update the payroll total");return total;};
  let result;
  if(action==="expense.add"){
   recorder();
   const category=String(body.category||"");if(!EXPENSE_CATEGORIES.includes(category))throw new ApiError(400,"Choose what the money was spent on");
   const method=METHODS.includes(body.method)?body.method:"cash";
   const row={school_id:school.id,category,title:text(body.title,160,2,"description"),amount_rwf:rwf(body.amount,"the amount"),spent_on:day(body.spentOn,"date"),
    paid_to:text(body.paidTo||"",160,0,"paid to"),method,reference:text(body.reference||"",120,0,"reference"),notes:text(body.notes||"",500,0,"notes"),
    recorded_by:user.id,status:p.owner?"approved":"pending",...(p.owner?{decided_by:user.id,decided_at:new Date().toISOString(),decision_note:"Recorded by the owner"}:{})};
   const ins=await db.from("school_expenses").insert(row).select("id,status").single();
   if(ins.error)throw new ApiError(400,"The expense could not be saved");
   result=ins.data;
  }else if(action==="expense.decide"){
   ownerOnly();
   const id=validateUuid(body.expenseId,"expense");const approve=body.decision==="approve";
   const up=await db.from("school_expenses").update({status:approve?"approved":"rejected",decided_by:user.id,decided_at:new Date().toISOString(),decision_note:text(body.note||"",300,0,"note")})
    .eq("school_id",school.id).eq("id",id).eq("status","pending").select("id");
   if(up.error||!up.data?.length)throw new ApiError(409,"This expense was already decided");
   result={id,status:approve?"approved":"rejected"};
  }else if(action==="expense.delete"){
   ownerOnly();
   const id=validateUuid(body.expenseId,"expense");
   const del=await db.from("school_expenses").delete().eq("school_id",school.id).eq("id",id).select("id");
   if(del.error||!del.data?.length)throw new ApiError(404,"Expense not found");
   result={id,deleted:true};
  }else if(action==="pay.set"){
   ownerOnly();
   const target=validateUuid(body.userId,"staff member");
   const member=await checked(db.from("school_memberships").select("role").eq("school_id",school.id).eq("auth_user_id",target).eq("active",true).in("role",["teacher","staff","school_admin"]).limit(1));
   if(!member.length)throw new ApiError(404,"This person is not an active teacher or staff member of your school");
   const payDay=Number(body.payDay);if(!Number.isInteger(payDay)||payDay<1||payDay>28)throw new ApiError(400,"Choose a pay day from 1 to 28");
   const row={school_id:school.id,auth_user_id:target,job_title:text(body.jobTitle||"",80,0,"job title"),monthly_salary_rwf:rwf(body.monthlySalary,"the monthly salary",{min:0,max:1e10}),
    pay_day:payDay,payment_method:METHODS.includes(body.method)?body.method:"bank_transfer",active:body.active!==false,updated_by:user.id,updated_at:new Date().toISOString()};
   const up=await db.from("school_staff_pay").upsert(row,{onConflict:"school_id,auth_user_id"}).select("auth_user_id").single();
   if(up.error)throw new ApiError(400,"The salary could not be saved");
   result={userId:target};
  }else if(action==="payroll.create"){
   recorder();
   const period=String(body.period||"");if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw new ApiError(400,"Choose the month to pay");
   const pay=await checked(db.from("school_staff_pay").select("auth_user_id,job_title,monthly_salary_rwf").eq("school_id",school.id).eq("active",true).gt("monthly_salary_rwf",0));
   if(!pay.length)throw new ApiError(400,"No salaries are set yet. Set each teacher's salary first.");
   const people=await staffList(db,school);const active=new Map(people.map(x=>[x.id,x]));
   const due=pay.filter(x=>active.has(x.auth_user_id));
   const run=await db.from("school_payroll_runs").insert({school_id:school.id,period,status:"draft",created_by:user.id}).select("id").single();
   if(run.error)throw new ApiError(409,"A payroll for "+period+" already exists");
   const ins=await db.from("school_payroll_lines").insert(due.map(x=>({school_id:school.id,run_id:run.data.id,auth_user_id:x.auth_user_id,name:active.get(x.auth_user_id).name.slice(0,160),
    job_title:x.job_title,base_rwf:x.monthly_salary_rwf,net_rwf:x.monthly_salary_rwf})));
   if(ins.error){await db.from("school_payroll_runs").delete().eq("school_id",school.id).eq("id",run.data.id);throw new ApiError(400,"The payroll could not be prepared");}
   result={id:run.data.id,total:await retotal(run.data.id),people:due.length};
  }else if(action==="payroll.line"){
   recorder();
   const line=await checked(db.from("school_payroll_lines").select("id,run_id,base_rwf").eq("school_id",school.id).eq("id",validateUuid(body.lineId,"payroll line")).maybeSingle());
   if(!line)throw new ApiError(404,"Payroll line not found");
   const run=await loadRun(line.run_id);if(run.status!=="draft")throw new ApiError(409,"An approved payroll cannot be changed");
   const bonus=rwf(body.bonus||0,"the bonus",{min:0,max:1e10}),ded=rwf(body.deductions||0,"the deductions",{min:0,max:1e10});
   const net=Number(line.base_rwf)+bonus-ded;if(net<0)throw new ApiError(400,"Deductions cannot be more than the salary and bonus");
   const up=await db.from("school_payroll_lines").update({bonus_rwf:bonus,deductions_rwf:ded,net_rwf:net,note:text(body.note||"",300,0,"note")}).eq("school_id",school.id).eq("id",line.id);
   if(up.error)throw new ApiError(400,"Could not save");
   result={net,total:await retotal(run.id)};
  }else if(action==="payroll.approve"){
   ownerOnly();
   const run=await loadRun(body.runId);if(run.status!=="draft")throw new ApiError(409,"Only a prepared payroll can be approved");
   const total=await retotal(run.id);
   const up=await db.from("school_payroll_runs").update({status:"approved",approved_by:user.id,approved_at:new Date().toISOString()}).eq("school_id",school.id).eq("id",run.id).eq("status","draft");
   if(up.error)throw new ApiError(400,"Could not approve");
   result={id:run.id,status:"approved",total};
  }else if(action==="payroll.paid"){
   recorder();
   const run=await loadRun(body.runId);if(run.status!=="approved")throw new ApiError(409,"The owner must approve the payroll before it is paid");
   const up=await db.from("school_payroll_runs").update({status:"paid",paid_by:user.id,paid_at:new Date().toISOString()}).eq("school_id",school.id).eq("id",run.id).eq("status","approved");
   if(up.error)throw new ApiError(400,"Could not mark as paid");
   result={id:run.id,status:"paid"};
  }else if(action==="payroll.cancel"){
   recorder();
   const run=await loadRun(body.runId);if(run.status!=="draft"&&!(p.owner&&run.status==="approved"))throw new ApiError(409,"A paid payroll cannot be cancelled");
   const up=await db.from("school_payroll_runs").update({status:"cancelled"}).eq("school_id",school.id).eq("id",run.id);
   if(up.error)throw new ApiError(400,"Could not cancel");
   result={id:run.id,status:"cancelled"};
  }else throw new ApiError(400,"Unknown money action");
  await db.from("school_admin_audit").insert({school_id:school.id,actor_id:user.id,event:"money."+action,metadata:{result}});
  return Response.json({ok:true,result},{headers:noStore});
 }catch(e){return jsonError(e);}
}
