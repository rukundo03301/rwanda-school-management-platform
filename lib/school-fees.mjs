import {schoolVerifiedContext} from "./school-admin.mjs";
import {ApiError,checked,validateUuid} from "./platform-server.js";

export const RWF="RWF";
export const FINANCE_RIGHTS=Object.freeze([
 {id:"finance.read",label:"View school financial reports, invoices, receipts",group:"Reports"},
 {id:"fees.manage",label:"Create and deactivate school fee schedules",group:"Fees"},
 {id:"invoices.issue",label:"Issue student and class invoices",group:"Invoicing"},
 {id:"payments.record",label:"Record cash and payment references for later review",group:"Payments"},
 {id:"payments.approve",label:"Approve independent evidence or reject payment claims",group:"Payments"}
]);
export const FINANCE_RIGHT_IDS=Object.freeze(FINANCE_RIGHTS.map(x=>x.id));
export const FEE_CATEGORIES=Object.freeze([
 "tuition","registration","boarding","transport","meals","examination","other"
]);
export const PAYMENT_METHODS=Object.freeze([
 "mtn_momo","airtel_money","bank_transfer","cash","other"
]);
export const REVIEW_EVIDENCE=Object.freeze([
 "provider_statement","bank_statement","cash_count","other"
]);
export function financeText(value,max,{min=1}={}){
 if(typeof value!=="string"||value.trim().length<min||value.trim().length>max)
  throw new ApiError(400,"Enter valid text ("+min+"–"+max+" characters)");
 return value.trim();
}
export function financeId(id,name){return validateUuid(id,name);}
export function rwfAmount(raw){
 if(typeof raw!=="string"&&typeof raw!=="number")
  throw new ApiError(400,"RWF amounts must be whole positive francs");
 const s=String(raw);
 if(!/^[1-9]\d{0,12}$/.test(s))
  throw new ApiError(400,"Enter a positive whole RWF amount");
 const n=Number(s);
 if(!Number.isSafeInteger(n)||n>1000000000000)
  throw new ApiError(400,"RWF amount exceeds the supported limit");
 return n;
}
export function normalizeFinanceRights(value){
 if(!Array.isArray(value)||value.length>FINANCE_RIGHT_IDS.length
   ||value.some(x=>!FINANCE_RIGHT_IDS.includes(x)))
  throw new ApiError(400,"Unknown financial permission");
 return [...new Set(value)];
}
export function financeDate(value){
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))
  throw new ApiError(400,"Choose a YYYY-MM-DD date");
 const d=new Date(value+"T00:00:00.000Z");
 if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==value)
  throw new ApiError(400,"Choose an actual calendar date");
 return value;
}
export function kigaliToday(now=new Date()){
 return new Intl.DateTimeFormat("en-CA",{
  timeZone:"Africa/Kigali",year:"numeric",month:"2-digit",day:"2-digit"
 }).format(now);
}
export function invoiceMath(invoice,payments=[],credits=[],today=kigaliToday()){
 const approved=payments.filter(p=>p.invoice_id===invoice.id&&p.status==="posted")
  .reduce((a,p)=>a+BigInt(p.amount_rwf),0n);
 const forgiven=credits.filter(p=>p.invoice_id===invoice.id)
  .reduce((a,p)=>a+BigInt(p.amount_rwf),0n);
 const gross=BigInt(invoice.amount_rwf);
 const raw=gross-approved-forgiven;
 const outstanding=raw>0n?raw:0n;
 return {
  amount_rwf:gross.toString(),
  paid_rwf:approved.toString(),
  waived_rwf:forgiven.toString(),
  balance_rwf:outstanding.toString(),
  fully_paid:outstanding===0n,
  overdue:invoice.status==="issued"&&outstanding>0n&&invoice.due_on<today
 };
}
export function displayRwf(raw){
 try{return new Intl.NumberFormat("en-RW").format(BigInt(raw))+" RWF";}
 catch{return "—";}
}
export async function schoolFinanceContext(request,code){
 const base=await schoolVerifiedContext(request,code);
 const {db,school,user}=base;
 const memberships=await checked(db.from("school_memberships")
  .select("role").eq("school_id",school.id).eq("auth_user_id",user.id)
  .eq("active",true).in("role",["school_owner","school_admin","staff","parent"]));
 const roles=memberships.map(x=>x.role);
 if(!roles.length)throw new ApiError(403,"No authorized school finance or guardian role");
 const owner=roles.includes("school_owner");
 const staff=roles.some(x=>x==="school_admin"||x==="staff");
 const parent=roles.includes("parent");
 let rights=[];
 if(owner)rights=[...FINANCE_RIGHT_IDS];
 else if(staff){
  const grant=await checked(db.from("school_finance_permissions")
   .select("permissions").eq("school_id",school.id)
   .eq("auth_user_id",user.id).maybeSingle());
  rights=Array.isArray(grant?.permissions)?
   grant.permissions.filter(x=>FINANCE_RIGHT_IDS.includes(x)):[];
 }
 const links=parent?await checked(db.from("school_guardian_links")
  .select("student_id").eq("school_id",school.id)
  .eq("auth_user_id",user.id).eq("active",true).limit(100)):[];
 const childIds=[...new Set(links.map(l=>l.student_id))];
 if(!rights.length&&!childIds.length&&!owner)
  throw new ApiError(403,"No approved financial rights or verified children");
 const year=await checked(db.from("school_academic_years")
  .select("id,name,starts_on,ends_on").eq("school_id",school.id)
  .eq("status","current").maybeSingle());
 return {...base,owner,staff,parent,roles,rights,childIds,year};
}
