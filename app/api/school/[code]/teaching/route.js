import {teachingManagerContext,cleanTeachingText} from "../../../../../lib/school-learning.mjs";
import {ApiError,checked,validateUuid,requireAal2,jsonError} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request,{params}){
 try{
  const {code}=await params;
  const {db,school}=await teachingManagerContext(request,code);
  const [teachers,classes,subjects,classSubjects,assignments,students,invites]=await Promise.all([
   checked(db.from("school_memberships")
    .select("auth_user_id,role,active").eq("school_id",school.id)
    .eq("role","teacher").eq("active",true).limit(200)),
   checked(db.from("school_classes")
    .select("id,name,section,level,academic_year_id,status")
    .eq("school_id",school.id).eq("status","active").limit(300)),
   checked(db.from("school_subjects").select("id,name,code")
    .eq("school_id",school.id).limit(300)),
   checked(db.from("school_class_subjects").select("class_id,subject_id")
    .eq("school_id",school.id).limit(800)),
   checked(db.from("school_teacher_assignments")
    .select("id,teacher_user_id,class_id,subject_id,academic_year_id,active")
    .eq("school_id",school.id).order("created_at",{ascending:false}).limit(400)),
   checked(db.from("school_students")
    .select("id,student_code,first_name,last_name,status")
    .eq("school_id",school.id).eq("status","active").limit(300)),
   checked(db.from("school_student_portal_invitations")
    .select("id,student_id,email,status,expires_at")
    .eq("school_id",school.id).order("created_at",{ascending:false}).limit(300))
  ]);
  return Response.json({school:{name:school.name,code:school.school_code},
    teachers,classes,subjects,classSubjects,assignments,students,invites},
   {headers:{"Cache-Control":"no-store"}});
 }catch(e){return jsonError(e);}
}
export async function POST(request,{params}){
 try{
  const {code}=await params;
  const {db,user,school,token}=await teachingManagerContext(request,code);
  const body=await request.json().catch(()=>({}));
  let result;
  if(body.action==="teacher.assign"){
   requireAal2(token);
   result=await checked(db.rpc("school_teacher_assign",{
    p_school:school.id,p_teacher:validateUuid(body.teacherId,"teacher"),
    p_class:validateUuid(body.classId,"class"),p_subject:validateUuid(body.subjectId,"subject"),
    p_actor:user.id
   }));
  }else if(body.action==="student.invite"){
   requireAal2(token);
   const email=cleanTeachingText(body.email,254).toLowerCase();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new ApiError(400,"Valid student email required");
   result=await checked(db.rpc("school_invite_student_account",{
     p_school:school.id,p_student:validateUuid(body.studentId,"student"),
     p_email:email,p_actor:user.id
   }));
   // Minors need guardian approval first. Never send student invite before that.
   let mailStatus="not_sent";
   if(result?.status==="approved"){
    const base=String(process.env.APP_PUBLIC_URL||"").replace(/\/$/,"");
    if(/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base)||
       /^http:\/\/localhost(?::\d+)?$/.test(base)){
      const {error}=await db.auth.admin.inviteUserByEmail(email,{
       redirectTo:base+"/s/"+school.school_code+"/learning"
      });
      mailStatus=error?"provider_rejected_or_existing_account":"provider_accepted";
    }
   }
   result={...result,mailStatus};
  }else throw new ApiError(400,"Unsupported academic administration action");
  return Response.json({ok:true,result},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return jsonError(e);}
}
