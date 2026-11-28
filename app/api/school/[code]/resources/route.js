import {schoolVerifiedContext,schoolAdminAudit} from "../../../../../lib/school-admin.mjs";
import {ApiError,checked,jsonError,validateUuid} from "../../../../../lib/platform-server.js";
import library from "../../../../../lib/learning-library.json";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
const LANGS=["Kinyarwanda","English","French"];
const text=(v,max,min=0)=>{const s=typeof v==="string"?v.trim():"";if(s.length<min||s.length>max)throw new ApiError(400,min?"Enter "+min+" to "+max+" characters":"Keep this under "+max+" characters");return s;};

// The learning library is part of the platform: every member of every active school sees the
// built-in activities for the levels the school offers, plus the activities its own teachers publish.
async function context(request,code){
 const base=await schoolVerifiedContext(request,code);
 const {db,school,user}=base;
 const rows=await checked(db.from("school_memberships").select("role").eq("school_id",school.id)
  .eq("auth_user_id",user.id).eq("active",true).limit(10));
 const roles=rows.map(r=>r.role);
 if(!roles.length){
  // Learners sign in with a school-issued student account rather than a membership.
  const student=await checked(db.from("school_student_accounts").select("student_id").eq("school_id",school.id)
   .eq("auth_user_id",user.id).eq("active",true).maybeSingle());
  if(student)roles.push("student");
 }
 if(!roles.length)throw new ApiError(403,"You are not an approved member of this school.");
 const manager=roles.includes("school_owner")||roles.includes("school_admin");
 const teacher=roles.includes("teacher");
 const assignments=teacher?await checked(db.from("school_teacher_assignments").select("class_id,subject_id")
  .eq("school_id",school.id).eq("teacher_id",user.id).eq("active",true).limit(500)):[];
 return {...base,roles,manager,teacher,assignments};
}

export async function GET(request,{params}){
 try{
  const {code}=await params;
  const {db,school,user,roles,manager,teacher,assignments}=await context(request,code);
  const setup=await checked(db.from("school_onboarding").select("education_levels").eq("school_id",school.id).maybeSingle());
  const levels=Array.isArray(setup?.education_levels)?setup.education_levels:[];
  const builtIn=library.items.filter(i=>!levels.length||levels.includes(i.level));
  const [classes,subjects,activities]=await Promise.all([
   checked(db.from("school_classes").select("id,name,level_band,status").eq("school_id",school.id).eq("status","active").limit(500)),
   checked(db.from("school_subjects").select("id,code,name").eq("school_id",school.id).limit(500)),
   checked(db.from("school_learning_activities").select("id,class_id,subject_id,title,language,learning_objective,activity_type,teacher_steps,student_steps,materials_needed,estimated_minutes,status,created_by,created_at")
    .eq("school_id",school.id).neq("status","archived").order("created_at",{ascending:false}).limit(500))
  ]);
  const cls=new Map(classes.map(c=>[c.id,c])),sub=new Map(subjects.map(s=>[s.id,s]));
  // Drafts are visible only to the teacher who wrote them and to school leaders.
  const visible=activities.filter(a=>a.status==="published"||manager||a.created_by===user.id);
  const canAdd=manager||teacher;
  const formClasses=canAdd?classes.filter(c=>manager||assignments.some(a=>a.class_id===c.id)).map(c=>({id:c.id,name:c.name,level:c.level_band})):[];
  const formSubjects=canAdd?subjects.map(s=>({id:s.id,name:s.name,code:s.code,classes:manager?formClasses.map(c=>c.id):assignments.filter(a=>a.subject_id===s.id).map(a=>a.class_id)})).filter(s=>s.classes.length):[];
  return Response.json({
   school:school.name,levels,roles,canAdd,
   items:builtIn,
   schoolItems:visible.map(a=>({id:a.id,title:a.title,language:a.language,learningObjective:a.learning_objective,
    teacherSteps:a.teacher_steps,studentSteps:a.student_steps,materials:a.materials_needed,minutes:a.estimated_minutes,
    status:a.status,mine:a.created_by===user.id,canManage:manager||a.created_by===user.id,
    className:cls.get(a.class_id)?.name||"",level:cls.get(a.class_id)?.level_band||"",subject:sub.get(a.subject_id)?.name||""})),
   form:{classes:formClasses,subjects:formSubjects,languages:LANGS}
  },{headers});
 }catch(e){return jsonError(e);}
}

export async function POST(request,{params}){
 try{
  const {code}=await params;
  const ctx=await context(request,code);
  const {db,school,user,manager,teacher,assignments}=ctx;
  const body=await request.json().catch(()=>({}));
  let result;
  if(body.action==="activity.create"){
   if(!manager&&!teacher)throw new ApiError(403,"Only teachers and school leaders can add learning activities.");
   const classId=validateUuid(body.classId,"class"),subjectId=validateUuid(body.subjectId,"subject");
   if(!manager&&!assignments.some(a=>a.class_id===classId&&a.subject_id===subjectId))
    throw new ApiError(403,"You can only add activities for a class and subject you teach.");
   const language=LANGS.includes(body.language)?body.language:null;
   if(!language)throw new ApiError(400,"Choose the language of the activity");
   const minutes=Number(body.minutes||20);
   if(!Number.isInteger(minutes)||minutes<5||minutes>120)throw new ApiError(400,"Time must be between 5 and 120 minutes");
   result=await checked(db.from("school_learning_activities").insert({
    school_id:school.id,class_id:classId,subject_id:subjectId,title:text(body.title,160,3),language,
    learning_objective:text(body.objective,600),activity_type:"other",teacher_steps:text(body.teacherSteps,3000),
    student_steps:text(body.studentSteps,3000),materials_needed:text(body.materials,1000),estimated_minutes:minutes,
    status:body.publish===true?"published":"draft",created_by:user.id
   }).select("id,status").single());
   await schoolAdminAudit(db,school.id,user.id,"learning.activity_created",{id:result.id,status:result.status});
  }else if(body.action==="activity.status"){
   const id=validateUuid(body.id,"activity");
   const status=["draft","published","archived"].includes(body.status)?body.status:null;
   if(!status)throw new ApiError(400,"Unknown status");
   const row=await checked(db.from("school_learning_activities").select("id,created_by").eq("school_id",school.id).eq("id",id).maybeSingle());
   if(!row)throw new ApiError(404,"Activity not found");
   if(!manager&&row.created_by!==user.id)throw new ApiError(403,"Only the teacher who wrote this activity or a school leader can change it.");
   result=await checked(db.from("school_learning_activities").update({status,updated_at:new Date().toISOString()})
    .eq("school_id",school.id).eq("id",id).select("id,status").single());
   await schoolAdminAudit(db,school.id,user.id,"learning.activity_"+status,{id});
  }else throw new ApiError(400,"Unsupported learning library action");
  return Response.json({ok:true,result},{headers});
 }catch(e){return jsonError(e);}
}
