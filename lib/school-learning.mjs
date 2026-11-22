import {ApiError,checked,validateUuid} from "./platform-server.js";
import {schoolVerifiedContext,schoolAdminContext,schoolAdminCan} from "./school-admin.mjs";

export const ATTENDANCE_STATES=Object.freeze(["present","absent","late","excused"]);
export const TEACHER_CONTEXT_TYPES=Object.freeze(["teacher","school_owner","school_admin"]);

export function cleanTeachingText(input,max,{required=true}={}){
 if(typeof input!=="string"||input.length>max)throw new ApiError(400,"Field length is invalid");
 const t=input.trim();if(required&&!t)throw new ApiError(400,"Field is required");return t;
}
export function validTeachingDate(raw){
 if(typeof raw!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(raw))throw new ApiError(400,"Choose a valid school date");
 const d=new Date(raw+"T12:00:00Z");
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==raw)
   throw new ApiError(400,"Invalid calendar date");
 return raw;
}
export async function teacherContext(request,code){
 const ctx=await schoolVerifiedContext(request,code);
 const {db,user,school}=ctx;
 const member=await checked(db.from("school_memberships")
  .select("role,active").eq("school_id",school.id)
  .eq("auth_user_id",user.id).eq("role","teacher").eq("active",true).maybeSingle());
 if(!member)throw new ApiError(403,"Only an approved teacher of this school can enter classrooms");
 return ctx;
}
export async function teachingManagerContext(request,code){
 const ctx=await schoolAdminContext(request,code);
 if(!schoolAdminCan(ctx.actor,"academics.manage"))
  throw new ApiError(403,"School academic-management permission required");
 return ctx;
}
export async function studentContext(request,code){
 const ctx=await schoolVerifiedContext(request,code);
 const {db,user,school}=ctx;
 const [member,account]=await Promise.all([
  checked(db.from("school_memberships").select("active")
   .eq("school_id",school.id).eq("auth_user_id",user.id)
   .eq("role","student").eq("active",true).maybeSingle()),
  checked(db.from("school_student_accounts")
   .select("student_id,active").eq("school_id",school.id)
   .eq("auth_user_id",user.id).eq("active",true).maybeSingle())
 ]);
 if(!member||!account)throw new ApiError(403,"A verified school-issued student account is required");
 return {...ctx,studentId:validateUuid(account.student_id,"student")};
}
export async function familyStudentContext(request,code){
 const ctx=await schoolVerifiedContext(request,code);
 const {db,user,school}=ctx;
 const member=await checked(db.from("school_memberships").select("active")
  .eq("school_id",school.id).eq("auth_user_id",user.id)
  .eq("role","parent").eq("active",true).maybeSingle());
 if(!member)throw new ApiError(403,"Verified parent membership required");
 return ctx;
}
export async function classLearningSnapshot(db,schoolId,studentId){
 // Called ONLY after confirmed student or guardian authorization.
 const years=await checked(db.from("school_academic_years")
   .select("id,name").eq("school_id",schoolId).eq("status","current").limit(1));
 if(!years.length)return {classInfo:null,homework:[],attendance:[],submissions:[]};
 const currentYear=years[0];
 const enrollment=await checked(db.from("school_student_enrollments")
   .select("id,class_id,academic_year_id").eq("school_id",schoolId)
   .eq("student_id",studentId).eq("academic_year_id",currentYear.id)
   .eq("status","active").maybeSingle());
 if(!enrollment)return {classInfo:null,homework:[],attendance:[],submissions:[]};
 const cls=await checked(db.from("school_classes")
   .select("name,section").eq("school_id",schoolId).eq("id",enrollment.class_id).single());
 const assignments=await checked(db.from("school_teacher_assignments")
   .select("id,subject_id").eq("school_id",schoolId)
   .eq("class_id",enrollment.class_id).eq("academic_year_id",currentYear.id)
   .eq("active",true).limit(100));
 const assignmentIds=assignments.map(a=>a.id);
 const subjectIds=[...new Set(assignments.map(a=>a.subject_id))];
 const subjects=subjectIds.length?await checked(db.from("school_subjects").select("id,name")
  .eq("school_id",schoolId).in("id",subjectIds)):[];
 const subjectsById=new Map(subjects.map(s=>[s.id,s.name]));
 const assignmentsById=new Map(assignments.map(a=>[a.id,subjectsById.get(a.subject_id)||"Subject"]));
 const [homework,attendance]=await Promise.all([
  assignmentIds.length?checked(db.from("school_homework")
    .select("id,teacher_assignment_id,title,instructions,due_at,status")
    .eq("school_id",schoolId).in("teacher_assignment_id",assignmentIds)
    .eq("status","published").order("due_at",{ascending:true}).limit(100)):[],
  checked(db.from("school_attendance")
    .select("attendance_on,attendance_status")
    .eq("school_id",schoolId).eq("enrollment_id",enrollment.id)
    .order("attendance_on",{ascending:false}).limit(90))
 ]);
 const homeworkIds=homework.map(h=>h.id);
 const submissions=homeworkIds.length?await checked(db.from("school_homework_submissions")
  .select("homework_id,submitted_at,response_text")
  .eq("school_id",schoolId).eq("student_id",studentId)
  .in("homework_id",homeworkIds)):[];
 const submitted=new Map(submissions.map(s=>[s.homework_id,s]));
 return {
  classInfo:{name:cls.name,section:cls.section,academicYear:currentYear.name},
  homework:homework.map(h=>({
    id:h.id,subject:assignmentsById.get(h.teacher_assignment_id),
    title:h.title,instructions:h.instructions,dueAt:h.due_at,
    submission:submitted.get(h.id)||null
  })),
  attendance,submissions:[] // response already nested within owned homework
 };
}
