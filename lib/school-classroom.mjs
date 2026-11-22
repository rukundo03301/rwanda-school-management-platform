import {schoolVerifiedContext} from "./school-admin.mjs";
import {ApiError,checked,validateUuid} from "./platform-server.js";

export function classroomText(value,max,{min=1}={}){
 if(typeof value!=="string"||value.trim().length<min||value.trim().length>max)
  throw new ApiError(400,"Please enter valid classroom information");
 return value.trim();
}
export function requiredSchoolId(value,label="record"){return validateUuid(value,label);}
export function localSchoolDate(value){
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))
   throw new ApiError(400,"Use a valid YYYY-MM-DD date");
 const time=new Date(value+"T00:00:00Z");
 if(Number.isNaN(time.getTime())||time.toISOString().slice(0,10)!==value)
   throw new ApiError(400,"Date does not exist");
 return value;
}
export function classroomDeadline(value){
 if(typeof value!=="string"||value.length>40)throw new ApiError(400,"Choose a due date");
 const date=new Date(value);
 if(Number.isNaN(date.getTime())||!/(?:Z|[+-]\d\d:\d\d)$/.test(value))
  throw new ApiError(400,"Due date must include a timezone");
 const diff=date.getTime()-Date.now();
 if(diff<=0||diff>366*24*3600*1000)throw new ApiError(400,"Due date must be in the next year");
 return date.toISOString();
}
export async function classroomContext(request,code){
 const base=await schoolVerifiedContext(request,code);
 const {db,user,school}=base;
 const memberships=await checked(db.from("school_memberships")
   .select("role,active").eq("school_id",school.id).eq("auth_user_id",user.id)
   .eq("active",true).in("role",["school_owner","school_admin","teacher"]));
 const owner=memberships.some(x=>x.role==="school_owner");
 const admin=memberships.some(x=>x.role==="school_admin");
 const teacher=memberships.some(x=>x.role==="teacher");
 let manager=owner;
 if(admin&&!owner){
  const grants=await checked(db.from("school_admin_permissions")
    .select("permissions").eq("school_id",school.id)
    .eq("auth_user_id",user.id).maybeSingle());
  manager=grants?.permissions?.includes("academics.manage")===true;
 }
 if(!manager&&!teacher)throw new ApiError(403,"School classroom access is not approved");
 return {...base,role:{manager,teacher,owner},actorId:user.id};
}
export function teacherAssignmentAllowed(assignments,cls,subject){
 return assignments.some(a=>a.active===true&&a.class_id===cls&&a.subject_id===subject);
}
export function teacherClassAllowed(assignments,cls){
 return assignments.some(a=>a.active===true&&a.class_id===cls);
}
