import {
 studentContext,familyStudentContext,classLearningSnapshot,cleanTeachingText
} from "../../../../../lib/school-learning.mjs";
import {ApiError,checked,validateUuid,jsonError} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";

async function schoolLearner(request,code){
 const url=new URL(request.url);
 const asParent=url.searchParams.get("as")==="parent";
 const {db,school,user,studentId}=asParent?
   await familyStudentContext(request,code):
   await studentContext(request,code);
 if(!asParent)return {db,school,user,studentId,role:"student"};
 const selected=validateUuid(url.searchParams.get("studentId"),"linked student");
 const link=await checked(db.from("school_guardian_links")
  .select("active").eq("school_id",school.id).eq("student_id",selected)
  .eq("auth_user_id",user.id).eq("active",true).maybeSingle());
 if(!link)throw new ApiError(403,"No verified guardian access to this child");
 return {db,school,user,studentId:selected,role:"parent"};
}

export async function GET(request,{params}){
 try{
  const {code}=await params;
  const {db,school,studentId,role}=await schoolLearner(request,code);
  const student=await checked(db.from("school_students")
   .select("student_code,first_name,last_name,status")
   .eq("school_id",school.id).eq("id",studentId).eq("status","active").maybeSingle());
  if(!student)throw new ApiError(404,"Active school student record not found");
  const snapshot=await classLearningSnapshot(db,school.id,studentId);
  return Response.json({
   school:{name:school.name,code:school.school_code},
   role,student:{id:studentId,code:student.student_code,
     name:student.first_name+" "+student.last_name},
   ...snapshot
  },{headers:{"Cache-Control":"no-store"}});
 }catch(e){return jsonError(e);}
}

export async function POST(request,{params}){
 try{
  const {code}=await params;
  const {db,school,user,studentId}=await schoolLearner(request,code);
  const body=await request.json().catch(()=>({}));
  if(body.action!=="homework.submit")throw new ApiError(400,"Unsupported learning action");
  const response=cleanTeachingText(body.responseText||"",5000);
  const result=await checked(db.rpc("school_submit_homework",{
    p_school:school.id,p_homework:validateUuid(body.homeworkId,"homework"),
    p_student:studentId,p_actor:user.id,p_answer:response
  }));
  return Response.json({ok:true,result},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return jsonError(e);}
}
