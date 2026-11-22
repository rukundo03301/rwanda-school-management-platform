import {schoolVerifiedContext} from "./school-admin.mjs";
import {ApiError,checked,validateUuid} from "./platform-server.js";

export const COMMUNICATION_PERMISSIONS=Object.freeze([
 {id:"timetable.manage",label:"Create or disable class timetables",group:"Timetable"},
 {id:"announcements.manage",label:"Publish or archive school announcements",group:"Announcements"}
]);
export const COMMUNICATION_PERMISSION_IDS=Object.freeze(COMMUNICATION_PERMISSIONS.map(x=>x.id));
export const WEEKDAYS=Object.freeze(["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]);
export const ANNOUNCEMENT_AUDIENCES=Object.freeze([
 "all","staff","teachers","parents","students","class"
]);
export function comText(value,max,{min=1}={}){
 if(typeof value!=="string"||value.trim().length<min||value.trim().length>max)
  throw new ApiError(400,"Enter "+min+"–"+max+" characters");
 return value.trim();
}
export function comId(raw,name){return validateUuid(raw,name);}
export function normalizeComPermissions(value){
 if(!Array.isArray(value)||value.length>2||value.some(p=>!COMMUNICATION_PERMISSION_IDS.includes(p)))
  throw new ApiError(400,"Invalid communications permission toggles");
 return [...new Set(value)];
}
export function validClock(raw){
 if(typeof raw!=="string"||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(raw))
  throw new ApiError(400,"Enter a valid 24-hour school time");
 return raw+":00";
}
export function validDateTime(raw){
 if(raw==null||raw==="")return null;
 if(typeof raw!=="string"||raw.length>45||!/(?:Z|[+-]\d\d:\d\d)$/.test(raw))
  throw new ApiError(400,"Provide an expiration with timezone");
 const d=new Date(raw);
 if(Number.isNaN(d.getTime())||d.getTime()<=Date.now()
   ||d.getTime()>Date.now()+366*24*60*60*1000)
  throw new ApiError(400,"Expiration must be within the next year");
 return d.toISOString();
}
export function canViewAnnouncement(a,ctx){
 if(a.status!=="published"||a.expires_at&&new Date(a.expires_at).getTime()<=Date.now())return false;
 const roles=ctx.roles;
 if(a.audience==="all")return roles.length>0;
 if(a.audience==="staff")return roles.some(r=>["school_owner","school_admin","teacher","staff"].includes(r));
 if(a.audience==="teachers")return roles.includes("teacher");
 if(a.audience==="parents")return roles.includes("parent")&&ctx.childIds.length>0;
 if(a.audience==="students")return roles.includes("student")&&!!ctx.studentId;
 if(a.audience==="class")return ctx.classIds.includes(a.class_id);
 return false;
}
export async function communicationsContext(request,code){
 const base=await schoolVerifiedContext(request,code);
 const {db,school,user}=base;
 const memberships=await checked(db.from("school_memberships")
  .select("role").eq("school_id",school.id).eq("auth_user_id",user.id)
  .eq("active",true).in("role",[
   "school_owner","school_admin","teacher","staff","parent","student"
  ]));
 const roles=memberships.map(x=>x.role);
 if(!roles.length)throw new ApiError(403,"School membership has not been approved");
 const owner=roles.includes("school_owner");
 const admin=roles.includes("school_admin");
 const teacher=roles.includes("teacher");
 const parent=roles.includes("parent");
 const student=roles.includes("student");
 let permissions=[];
 if(admin&&!owner){
  const grants=await checked(db.from("school_communication_permissions")
   .select("permissions").eq("school_id",school.id)
   .eq("auth_user_id",user.id).maybeSingle());
  permissions=Array.isArray(grants?.permissions)?
   grants.permissions.filter(p=>COMMUNICATION_PERMISSION_IDS.includes(p)):[];
 }
 const managerTimetable=owner||permissions.includes("timetable.manage");
 const managerAnnouncements=owner||permissions.includes("announcements.manage");
 const links=parent?await checked(db.from("school_guardian_links")
  .select("student_id").eq("school_id",school.id)
  .eq("auth_user_id",user.id).eq("active",true).limit(100)):[];
 const childIds=[...new Set(links.map(x=>x.student_id))];
 const own=student?await checked(db.from("school_student_accounts")
  .select("student_id").eq("school_id",school.id)
  .eq("auth_user_id",user.id).eq("active",true).maybeSingle()):null;
 const studentId=own?.student_id||null;
 const year=await checked(db.from("school_academic_years")
  .select("id,name,starts_on,ends_on").eq("school_id",school.id)
  .eq("status","current").maybeSingle());
 const teacherAssignments=teacher?await checked(db.from("school_teacher_assignments")
  .select("class_id,subject_id,active").eq("school_id",school.id)
  .eq("teacher_id",user.id).eq("active",true).limit(1000)):[];
 const studentIds=[...new Set([...childIds,...(studentId?[studentId]:[])])];
 const enrollments=year&&studentIds.length?await checked(db.from("school_student_enrollments")
  .select("student_id,class_id").eq("school_id",school.id)
  .eq("academic_year_id",year.id).eq("status","active")
  .in("student_id",studentIds).limit(500)):[];
 const classIds=[...new Set([
  ...teacherAssignments.map(x=>x.class_id),
  ...enrollments.map(e=>e.class_id)
 ])];
 return {
  ...base,roles,owner,admin,teacher,parent,student,permissions,
  managerTimetable,managerAnnouncements,childIds,studentId,year,
  teacherAssignments,enrollments,classIds
 };
}
