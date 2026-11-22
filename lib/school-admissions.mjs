import {ADMISSIONS_PERMISSIONS} from "./school-admissions-permissions.mjs";
import {ApiError,checked} from "./platform-server.js";
import {schoolAdminContext,schoolVerifiedContext} from "./school-admin.mjs";

export function normalizeAdmissionsPermissions(input){
 if(!Array.isArray(input)||input.length>4||input.some(p=>typeof p!=="string"||!ADMISSIONS_PERMISSIONS.includes(p)))
   throw new ApiError(400,"Invalid admissions permission selection");
 const set=new Set(input);
 if(set.has("admissions.manage")||set.has("enrollments.manage")||set.has("guardians.manage"))
   set.add("admissions.read");
 return [...set];
}
export function admissionCan(actor,permission) {
 if(actor?.isOwner)return true;
 if(!actor?.active||actor.role!=="school_admin")return false;
 if(actor.admissionsPermissions?.includes(permission))return true;
 if(permission==="admissions.read")
   return ["admissions.manage","enrollments.manage","guardians.manage"]
     .some(p=>actor.admissionsPermissions?.includes(p));
 return false;
}
export function requireAdmissions(actor,permission){
 if(!admissionCan(actor,permission))throw new ApiError(403,"Your school has not enabled this admissions permission");
}
export function validName(v) {
 if(typeof v!=="string"||v.trim().length<1||v.trim().length>90)
   throw new ApiError(400,"Enter a valid name of up to 90 characters");
 return v.trim();
}
export function validBirthDate(v){
 if(v==null||v==="")return null; // Minimal child data; DOB is optional.
 if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v))
   throw new ApiError(400,"Invalid date of birth");
 const d=new Date(v+"T00:00:00.000Z");
 if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==v
   ||v<"1900-01-01"||v>new Date().toISOString().slice(0,10))
   throw new ApiError(400,"Invalid student date of birth");
 return v;
}
export async function admissionsContext(request,code){
 const context=await schoolAdminContext(request,code);
 let admissionsPermissions=[];
 if(!context.actor.isOwner){
   const {db,school,user}=context;
   const record=await checked(db.from("school_admissions_permissions")
     .select("permissions").eq("school_id",school.id)
     .eq("auth_user_id",user.id).maybeSingle());
   admissionsPermissions=Array.isArray(record?.permissions)?
     record.permissions.filter(p=>ADMISSIONS_PERMISSIONS.includes(p)):[];
 }
 return {...context,actor:{...context.actor,admissionsPermissions}};
}
export async function guardianContext(request,code) {
 const context=await schoolVerifiedContext(request,code);
 const {school,user,db}=context;
 const membership=await checked(db.from("school_memberships")
   .select("active").eq("school_id",school.id).eq("auth_user_id",user.id)
   .eq("role","parent").maybeSingle());
 const authorized=membership?.active===true;
 return {...context,isLinkedParent:authorized};
}
