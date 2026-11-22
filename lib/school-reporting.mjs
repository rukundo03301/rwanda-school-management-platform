import {schoolVerifiedContext} from "./school-admin.mjs";
import {ApiError,checked,validateUuid} from "./platform-server.js";

export const REPORT_ADMIN_ACTIONS=Object.freeze([
 {id:"curriculum.manage",label:"Enter school curriculum profiles, units and teaching periods"},
 {id:"reports.read",label:"Review private school marks and published reports"}
]);
export const REPORT_ADMIN_PERMISSIONS=Object.freeze(REPORT_ADMIN_ACTIONS.map(x=>x.id));
export const ASSESSMENT_CATEGORIES=Object.freeze(["unit","project","end_term"]);
export const CURRICULUM_TRACKS=Object.freeze([
 "general","professional","tvet","nursery","international","higher_education"
]);
export const RWANDA_NESA_GENERAL_WEIGHTS=Object.freeze({unit:25,project:25,end_term:50});

export function reportText(value,max=200,{min=1}={}){
 if(typeof value!=="string"||value.trim().length<min||value.trim().length>max)
  throw new ApiError(400,"Enter a valid value of "+min+"–"+max+" characters");
 return value.trim();
}
export function reportUrl(value){
 if(typeof value!=="string"||value.length>1000)throw new ApiError(400,"An official HTTPS source is required");
 let url;
 try{url=new URL(value);}catch{throw new ApiError(400,"Enter a valid official HTTPS source");}
 if(url.protocol!=="https:"||url.username||url.password||!url.hostname.includes("."))
  throw new ApiError(400,"Official curriculum sources must use HTTPS");
 return url.href;
}
export function reportId(value,name){return validateUuid(value,name);}
export function reportDate(value){
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))
  throw new ApiError(400,"Choose a date");
 const t=new Date(value+"T00:00:00.000Z");
 if(Number.isNaN(t.getTime())||t.toISOString().slice(0,10)!==value)
  throw new ApiError(400,"Date does not exist");
 return value;
}
export function validateAssessmentCategory(value){
 if(!ASSESSMENT_CATEGORIES.includes(value))throw new ApiError(400,"Select a valid assessment type");
 return value;
}
export function normalizeReportPermissions(v){
 if(!Array.isArray(v)||v.length>2||v.some(x=>!REPORT_ADMIN_PERMISSIONS.includes(x)))
  throw new ApiError(400,"Unknown report permission");
 return [...new Set(v)];
}
export function weightedGeneralMarks({endUnit,projects,endTerm,periods}){
 const values=[endUnit,projects,endTerm,periods];
 if(values.some(v=>typeof v!=="number"||!Number.isFinite(v))||
   !Number.isInteger(periods)||periods<1||periods>20)
  throw new ApiError(400,"Missing or invalid curriculum marks");
 const maximum=periods*10;
 if([endUnit,projects,endTerm].some(v=>v<0||v>maximum))
  throw new ApiError(400,"Mark exceeds the official curriculum maximum");
 const result=0.25*endUnit+0.25*projects+0.50*endTerm;
 return {
  maximum,
  raw:Math.round((result+Number.EPSILON)*100)/100,
  percentage:Math.round((result/maximum*100+Number.EPSILON)*100)/100
 };
}
export function hasReportPermission(actor,permission){
 return !!actor?.owner||!!(actor?.admin&&actor.reportPermissions?.includes(permission));
}
export async function reportingContext(request,code){
 const base=await schoolVerifiedContext(request,code);
 const {db,school,user}=base;
 const membership=await checked(db.from("school_memberships")
  .select("role").eq("school_id",school.id).eq("auth_user_id",user.id)
  .eq("active",true).in("role",["school_owner","school_admin","teacher"]));
 const owner=membership.some(m=>m.role==="school_owner");
 const admin=membership.some(m=>m.role==="school_admin");
 const teacher=membership.some(m=>m.role==="teacher");
 if(!owner&&!admin&&!teacher)throw new ApiError(403,"Academic reporting access not approved");
 let reportPermissions=[];
 if(admin&&!owner){
  const p=await checked(db.from("school_report_admin_permissions")
   .select("permissions").eq("school_id",school.id).eq("auth_user_id",user.id).maybeSingle());
  reportPermissions=Array.isArray(p?.permissions)?p.permissions.filter(x=>REPORT_ADMIN_PERMISSIONS.includes(x)):[];
 }
 return {...base,actor:{owner,admin,teacher,reportPermissions,id:user.id}};
}
export function schoolYearClassAssignments(assignments,classId,subjectId){
 return assignments.some(a=>a.class_id===classId&&a.subject_id===subjectId&&a.active);
}
