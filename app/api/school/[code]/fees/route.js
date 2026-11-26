import {
 schoolFinanceContext,financeText,financeId,rwfAmount,financeDate,
 normalizeFinanceRights,kigaliToday,
 FEE_CATEGORIES,PAYMENT_METHODS,REVIEW_EVIDENCE
} from "../../../../../lib/school-fees.mjs";
import {ApiError,checked,jsonError} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const privateNoStore={"Cache-Control":"private, no-store"};
const has=(ctx,p)=>ctx.owner||ctx.rights.includes(p);
function required(ctx,p){
 if(!has(ctx,p))throw new ApiError(403,"Your school has not enabled "+p);
}
function enumValue(v,allowed,name){
 if(!allowed.includes(v))throw new ApiError(400,"Choose an approved "+name);
 return v;
}
function balances(invoices,rows,today){
 const byInvoice=new Map(rows.map(b=>[b.invoice_id,b]));
 return invoices.map(i=>{
  const b=byInvoice.get(i.id);
  if(!b)throw new ApiError(503,"Invoice balances are temporarily unavailable");
  const remaining=BigInt(b.balance_rwf);
  return {...i,balances:{
   amount_rwf:String(i.amount_rwf),paid_rwf:b.paid_rwf,
   waived_rwf:b.waived_rwf,balance_rwf:b.balance_rwf,
   fully_paid:remaining===0n,
   overdue:i.status==="issued"&&remaining>0n&&i.due_on<today
  }};
 });
}
export async function GET(request,{params}){
 try{
  const {code}=await params;
  const ctx=await schoolFinanceContext(request,code);
  const {db,school,user,year}=ctx;
  const financeView=has(ctx,"finance.read");
  const invoiceAccess=financeView||has(ctx,"invoices.issue")
   ||has(ctx,"payments.record")||has(ctx,"payments.approve");
  const catalogAccess=invoiceAccess||has(ctx,"fees.manage");
  const isManager=ctx.owner||ctx.staff;
  let linkedStudents=[];
  if(ctx.childIds.length){
   linkedStudents=await checked(db.from("school_students")
    .select("id,student_code,first_name,last_name")
    .eq("school_id",school.id).eq("status","active")
    .in("id",ctx.childIds).limit(100));
  }
  const childSet=new Set(linkedStudents.map(s=>s.id));
  // Each school operator requires explicit rights. Verified parents can only
  // access active school-issued invoices for their own active linked children.
  const visibleChildIds=linkedStudents.map(s=>s.id);
  const seeAll=invoiceAccess;
  const [feeCatalog,allClasses,studentRows,invoicesAll,summary]=await Promise.all([
   catalogAccess&&year?checked(db.from("school_fee_catalog")
    .select("id,academic_year_id,class_id,term_label,category,label,amount_rwf,due_on,status")
    .eq("school_id",school.id).eq("academic_year_id",year.id)
    .order("created_at",{ascending:false}).limit(400)):Promise.resolve([]),
   (isManager||seeAll)&&year?checked(db.from("school_classes")
    .select("id,name,section,academic_year_id").eq("school_id",school.id)
    .eq("academic_year_id",year.id).eq("status","active").limit(500)):Promise.resolve([]),
   invoiceAccess&&year?checked(db.from("school_student_enrollments")
    .select("student_id,class_id").eq("school_id",school.id)
    .eq("academic_year_id",year.id).eq("status","active").limit(1200)):Promise.resolve([]),
   seeAll?checked(db.from("school_fee_invoices")
    .select("id,invoice_number,fee_id,academic_year_id,class_id,student_id,category,description,term_label,amount_rwf,due_on,currency,status,issued_at")
    .eq("school_id",school.id).order("issued_at",{ascending:false}).limit(1500)):
    visibleChildIds.length?checked(db.from("school_fee_invoices")
    .select("id,invoice_number,fee_id,academic_year_id,class_id,student_id,category,description,term_label,amount_rwf,due_on,currency,status,issued_at")
    .eq("school_id",school.id).eq("status","issued")
    .in("student_id",visibleChildIds)
    .order("issued_at",{ascending:false}).limit(500)):Promise.resolve([]),
   financeView?checked(db.rpc("school_finance_summary",{
    p_school:school.id,p_actor:user.id
   })):Promise.resolve(null)
  ]);
  const studentIds=[...new Set([
   ...studentRows.map(x=>x.student_id),
   ...invoicesAll.map(x=>x.student_id)
  ])];
  const pupilRecords=invoiceAccess&&studentIds.length?await checked(db.from("school_students")
   .select("id,student_code,first_name,last_name,status")
   .eq("school_id",school.id).in("id",studentIds).limit(2000)):[];
  const pupils=invoiceAccess?pupilRecords.map(p=>({
   id:p.id,studentCode:p.student_code,
   name:p.first_name+" "+p.last_name,active:p.status==="active",
   classId:studentRows.find(e=>e.student_id===p.id)?.class_id||null
  })):linkedStudents.map(p=>({
   id:p.id,studentCode:p.student_code,name:p.first_name+" "+p.last_name
  }));
  const invoiceIds=invoicesAll.map(i=>i.id);
  let payments=[],receipts=[],credits=[];
  if(invoiceIds.length){
   const [allPayments,allReceipts,allCredits]=await Promise.all([
    checked(db.from("school_fee_payments")
     .select("id,invoice_id,amount_rwf,currency,method,reference,paid_on,source,status,proposed_by,proposed_at,reviewed_at,review_evidence,review_note,reversal_reason")
     .eq("school_id",school.id).in("invoice_id",invoiceIds)
     .order("proposed_at",{ascending:false}).limit(2500)),
    checked(db.from("school_fee_receipts")
     .select("id,receipt_number,payment_id,invoice_id,amount_rwf,currency,issued_at,status,voided_at")
     .eq("school_id",school.id).in("invoice_id",invoiceIds)
     .order("issued_at",{ascending:false}).limit(2000)),
    checked(db.from("school_fee_credits")
     .select("id,invoice_id,amount_rwf,reason,approved_at")
     .eq("school_id",school.id).in("invoice_id",invoiceIds)
     .limit(1500))
   ]);
   if(invoiceAccess){
    payments=allPayments;receipts=allReceipts;credits=allCredits;
   }else{
    // A guardian may see approved fee coverage for a linked pupil, but
    // no other guardian's reference, review notes or rejected claim.
    payments=allPayments
     .filter(p=>p.status==="posted"||p.proposed_by===user.id)
     .map(p=>({
      id:p.id,invoice_id:p.invoice_id,amount_rwf:p.amount_rwf,
      status:p.status,method:p.method,paid_on:p.paid_on,
      proposed_at:p.proposed_at,
      ...(p.proposed_by===user.id?{reference:p.reference,ownClaim:true}:{})
     }));
    receipts=allReceipts.filter(r=>r.status==="active");
    credits=allCredits.map(c=>({invoice_id:c.invoice_id,amount_rwf:c.amount_rwf}));
   }
  }
  const currentDay=kigaliToday();
  const authoritativeBalances=invoiceIds.length?await checked(db.rpc(
   "school_finance_invoice_balances",{
    p_school:school.id,p_actor:user.id,p_invoices:invoiceIds
   })):[],
   invoices=balances(invoicesAll,authoritativeBalances,currentDay);
  let grants=[];
  if(ctx.owner){
   const [members,perms,invitations]=await Promise.all([
    checked(db.from("school_memberships").select("auth_user_id,role")
     .eq("school_id",school.id).eq("active",true)
     .in("role",["school_admin","staff"]).limit(400)),
    checked(db.from("school_finance_permissions").select("auth_user_id,permissions")
     .eq("school_id",school.id).limit(400)),
    checked(db.from("school_role_invites").select("claimed_by,email")
     .eq("school_id",school.id).eq("status","claimed")
     .in("role",["school_admin","staff"]).not("claimed_by","is",null).limit(400))
   ]);
   const pMap=new Map(perms.map(x=>[x.auth_user_id,x.permissions]));
   const names=new Map(invitations.map(x=>[x.claimed_by,x.email]));
   grants=[...new Map(members.map(m=>[m.auth_user_id,{
    userId:m.auth_user_id,role:m.role,
    label:names.get(m.auth_user_id)||"Verified school personnel",
    permissions:pMap.get(m.auth_user_id)||[]
   }])).values()];
  }
  const [site,draft]=await Promise.all([
   checked(db.from("platform_school_sites")
    .select("logo_url,primary_color").eq("school_id",school.id).maybeSingle()),
   checked(db.from("school_site_drafts")
    .select("logo_url,primary_color").eq("school_id",school.id).maybeSingle())
  ]);
  const brand=site?.logo_url?site:(draft||site);
  return Response.json({
   school:{name:school.name,code:school.school_code,
    logoUrl:brand?.logo_url||null,primaryColor:brand?.primary_color||"#204a78"},
   actor:{id:user.id,owner:ctx.owner,roles:ctx.roles,
    permissions:ctx.rights,guardian:ctx.parent&&visibleChildIds.length>0},
   year,feeCatalog,classes:allClasses,pupils,invoices,payments,
   receipts,credits,summary,grants,
   limitations:{
    providerCollections:"not_connected",providerSettlement:"not_verified_by_api",
    currency:"RWF",partialLists:true,
    note:"Invoices/payment lists are capped. School totals use the full database summary RPC."
   }
  },{headers:privateNoStore});
 }catch(e){return jsonError(e)}
}
export async function POST(request,{params}){
 try{
  const {code}=await params;
  const ctx=await schoolFinanceContext(request,code);
  const {db,school,user,token}=ctx;
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||"");
  
  let result;
  if(action==="rights.set"){
   if(!ctx.owner)throw new ApiError(403,"Only your school owner may assign finance rights");
   
   result=await checked(db.rpc("school_finance_set_permissions",{
    p_school:school.id,p_target:financeId(body.userId,"person"),
    p_permissions:normalizeFinanceRights(body.permissions||[]),
    p_reason:financeText(body.reason,500,{min:8}),p_actor:user.id
   }));
  }else if(action==="fee.create"){
   required(ctx,"fees.manage");
   result=await checked(db.rpc("school_fee_create_catalog",{
    p_school:school.id,p_year:financeId(body.yearId,"academic year"),
    p_class:body.classId?financeId(body.classId,"class"):null,
    p_category:enumValue(body.category,FEE_CATEGORIES,"fee category"),
    p_label:financeText(body.label,120,{min:3}),
    p_term:typeof body.term==="string"?body.term.slice(0,50):"",
    p_amount:rwfAmount(body.amount),p_due:financeDate(body.dueOn),
    p_actor:user.id
   }));
  }else if(action==="fee.disable"){
   required(ctx,"fees.manage");
   result=await checked(db.rpc("school_fee_disable_catalog",{
    p_school:school.id,p_fee:financeId(body.feeId,"fee"),
    p_reason:financeText(body.reason,500,{min:8}),p_actor:user.id
   }));
  }else if(action==="invoice.issue"){
   required(ctx,"invoices.issue");
   result=await checked(db.rpc("school_fee_issue_invoice",{
    p_school:school.id,p_fee:financeId(body.feeId,"fee"),
    p_student:financeId(body.studentId,"student"),p_actor:user.id
   }));
  }else if(action==="invoice.batch"){
   required(ctx,"invoices.issue");
   result=await checked(db.rpc("school_fee_issue_class_invoices",{
    p_school:school.id,p_fee:financeId(body.feeId,"fee"),p_actor:user.id
   }));
  }else if(action==="invoice.cancel"){
   if(!ctx.owner)throw new ApiError(403,"Only the school owner can cancel invoices");
   
   result=await checked(db.rpc("school_fee_cancel_invoice",{
    p_school:school.id,p_invoice:financeId(body.invoiceId,"invoice"),
    p_reason:financeText(body.reason,500,{min:12}),p_actor:user.id
   }));
  }else if(action==="payment.report"){
   if(!ctx.parent&&!has(ctx,"payments.record"))
    throw new ApiError(403,"Only verified guardians and authorized cashiers can report collections");
   result=await checked(db.rpc("school_fee_submit_payment",{
    p_school:school.id,p_invoice:financeId(body.invoiceId,"invoice"),
    p_amount:rwfAmount(body.amount),
    p_method:enumValue(body.method,PAYMENT_METHODS,"payment method"),
    p_reference:financeText(body.reference,120,{min:4}),
    p_paid:financeDate(body.paidOn||kigaliToday()),
    p_note:typeof body.note==="string"?body.note.slice(0,500):"",
    p_actor:user.id
   }));
  }else if(action==="payment.approve"){
   required(ctx,"payments.approve");
   result=await checked(db.rpc("school_fee_post_payment",{
    p_school:school.id,p_payment:financeId(body.paymentId,"payment"),
    p_evidence:enumValue(body.evidence,REVIEW_EVIDENCE,"evidence type"),
    p_review:financeText(body.review,500,{min:15}),p_actor:user.id
   }));
  }else if(action==="payment.reject"){
   required(ctx,"payments.approve");
   result=await checked(db.rpc("school_fee_reject_payment",{
    p_school:school.id,p_payment:financeId(body.paymentId,"payment"),
    p_reason:financeText(body.reason,500,{min:8}),p_actor:user.id
   }));
  }else if(action==="payment.reverse"){
   if(!ctx.owner)throw new ApiError(403,"Only your school owner may reverse a posted collection");
   
   result=await checked(db.rpc("school_fee_reverse_payment",{
    p_school:school.id,p_payment:financeId(body.paymentId,"payment"),
    p_reason:financeText(body.reason,500,{min:12}),p_actor:user.id
   }));
  }else if(action==="invoice.credit"){
   if(!ctx.owner)throw new ApiError(403,"Only the school owner can approve fee waivers");
   
   result=await checked(db.rpc("school_fee_approve_credit",{
    p_school:school.id,p_invoice:financeId(body.invoiceId,"invoice"),
    p_amount:rwfAmount(body.amount),
    p_reason:financeText(body.reason,500,{min:12}),p_actor:user.id
   }));
  }else throw new ApiError(400,"Unsupported school finance action");
  return Response.json({ok:true,result},{headers:privateNoStore});
 }catch(e){return jsonError(e)}
}
