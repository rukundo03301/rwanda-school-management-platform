import {schoolVerifiedContext,schoolAdminContext} from "./school-admin.mjs";
import {ApiError,checked} from "./platform-server.js";
import {admissionsContext,admissionCan} from "./school-admissions.mjs";

export function classroomText(value,max,{min=1}={}){
 if(typeof value!=="string"||value.trim().length<min||value.length>max)
  throw new ApiError(400,"Enter valid classroom text");
 return value.trim();
}
export function classroomDate(value){
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))
  throw new ApiError(400,"Provide a date in YYYY-MM-DD");
 const d=new Date(value+"T00:00:00.000Z");
 if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==value)
  throw new ApiError(400,"Enter a real calendar date");
 return value;
}
export async function teacherContext(request,code){
 const context=await schoolVerifiedContext(request,code);
 const {db,school,user}=context;
 const membership=await checked(db.from("school_memberships")
   .select("role,active").eq("school_id",school.id)
   .eq("auth_user_id",user.id).eq("role","teacher").maybeSingle());
 if(membership?.active!==true)throw new ApiError(403,"Only an approved teacher can access this school's classroom");
 return context;
}
export async function learningManagerContext(request,code){
 const context=await admissionsContext(request,code);
 const a=context.actor;
 const academicManager=a.isOwner||a.permissions.includes("academics.manage");
 const studentAccessManager=a.isOwner||admissionCan(a,"guardians.manage");
 return {...context,academicManager,studentAccessManager};
}
export async function studentLearningContext(request,code){
 const context=await schoolVerifiedContext(request,code);
 const {db,school,user}=context;
 const member=await checked(db.from("school_memberships")
   .select("active").eq("school_id",school.id).eq("auth_user_id",user.id)
   .eq("role","student").maybeSingle());
 const account=await checked(db.from("school_student_accounts")
   .select("student_id,active").eq("school_id",school.id)
   .eq("auth_user_id",user.id).maybeSingle());
 if(member?.active!==true||account?.active!==true)
  throw new ApiError(403,"This school has not activated your student portal");
 const student=await checked(db.from("school_students")
   .select("id,student_code,first_name,last_name,status")
   .eq("school_id",school.id).eq("id",account.student_id).maybeSingle());
 if(student?.status!=="active")throw new ApiError(403,"Student enrollment is not active");
 return {...context,student};
}
