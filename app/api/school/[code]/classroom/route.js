import {
 teacherContext,learningManagerContext,classroomText,classroomDate
} from "../../../../../lib/school-classroom.mjs";
import {ApiError,checked,jsonError,validateUuid,requireAal2} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store"};

async function publishedSchoolBrand(db,school){
 const site=await checked(db.from("platform_school_sites")
   .select("logo_url,primary_color").eq("school_id",school.id)
   .eq("is_published",true).maybeSingle());
 return {name:school.name,code:school.school_code,
  logoUrl:site?.logo_url||null,
  primaryColor:/^#[0-9a-f]{6}$/i.test(site?.primary_color||"")?
    site.primary_color:"#204a78"};
}


async function teacherData(db,school,user){
 const assignments=await checked(db.from("school_teacher_assignments")
  .select("id,class_id,subject_id,active")
  .eq("school_id",school.id).eq("teacher_user_id",user.id)
  .eq("active",true).limit(100));
 const classIds=[...new Set(assignments.map(x=>x.class_id))];
 const subjectIds=[...new Set(assignments.map(x=>x.subject_id))];
 const currentYear=await checked(db.from("school_academic_years")
  .select("id,name,starts_on,ends_on").eq("school_id",school.id).eq("status","current").maybeSingle());
 if(!classIds.length||!currentYear)return {school,mode:"teacher",assignments:[],classes:[],
  subjects:[],roster:[],enrollments:[],lessons:[],homework:[],attendance:[],submissions:[],currentYear};
 const classes=await checked(db.from("school_classes")
  .select("id,name,section,academic_year_id").eq("school_id",school.id)
  .eq("academic_year_id",currentYear.id).eq("status","active").in("id",classIds).limit(100));
 const allowedClasses=new Set(classes.map(c=>c.id));
 const scopedAssignments=assignments.filter(a=>allowedClasses.has(a.class_id));
 if(!scopedAssignments.length)return {school,mode:"teacher",assignments:[],classes:[],
  subjects:[],roster:[],enrollments:[],lessons:[],homework:[],attendance:[],submissions:[],currentYear};
 const assignmentIds=scopedAssignments.map(x=>x.id);
 const [subjects,enrollments,lessons,homework]=await Promise.all([
  checked(db.from("school_subjects").select("id,name,code")
   .eq("school_id",school.id).in("id",subjectIds).limit(100)),
  checked(db.from("school_student_enrollments")
   .select("id,student_id,class_id,status").eq("school_id",school.id)
   .eq("academic_year_id",currentYear.id).in("class_id",classes.map(c=>c.id))
   .eq("status","active").limit(500)),
  checked(db.from("school_lessons")
   .select("id,assignment_id,title,content,lesson_on,published_at")
   .eq("school_id",school.id).in("assignment_id",assignmentIds)
   .order("lesson_on",{ascending:false}).limit(200)),
  checked(db.from("school_homework")
   .select("id,assignment_id,title,instructions,due_on,published_at")
   .eq("school_id",school.id).in("assignment_id",assignmentIds)
   .order("due_on",{ascending:false}).limit(200))
 ]);
 const attendance=enrollments.length?await checked(db.from("school_attendance")
  .select("id,assignment_id,enrollment_id,attendance_on,state")
  .eq("school_id",school.id).in("enrollment_id",enrollments.map(e=>e.id))
  .order("attendance_on",{ascending:false}).limit(300)):[];
 const studentIds=[...new Set(enrollments.map(e=>e.student_id))];
 const roster=studentIds.length?await checked(db.from("school_students")
  .select("id,student_code,first_name,last_name,status")
  .eq("school_id",school.id).in("id",studentIds).eq("status","active").limit(500)):[];
 const homeworkIds=homework.map(x=>x.id);
 const submissions=homeworkIds.length?await checked(db.from("school_homework_submissions")
  .select("id,homework_id,student_id,response_text,submitted_at")
  .eq("school_id",school.id).in("homework_id",homeworkIds).in("student_id",studentIds.length?studentIds:["00000000-0000-0000-0000-000000000000"])
  .order("submitted_at",{ascending:false}).limit(500)):[];
 return {school,mode:"teacher",currentYear,assignments:scopedAssignments,classes,subjects,
   roster,enrollments,lessons,homework,attendance,submissions,
   limited:enrollments.length===500||homework.length===200||submissions.length===500};
}

async function managerData(db,school,actor,academicManager,studentAccessManager){
 const currentYear=await checked(db.from("school_academic_years")
  .select("id,name").eq("school_id",school.id).eq("status","current").maybeSingle());
 const [classes,subjects,classSubjects,assigned,teachers,invites]=await Promise.all([
  checked(db.from("school_classes").select("id,name,section,academic_year_id,status")
   .eq("school_id",school.id).eq("academic_year_id",currentYear?.id||"00000000-0000-0000-0000-000000000000").limit(250)),
  checked(db.from("school_subjects").select("id,name,code")
   .eq("school_id",school.id).limit(250)),
  checked(db.from("school_class_subjects").select("class_id,subject_id")
   .eq("school_id",school.id).limit(500)),
  checked(db.from("school_teacher_assignments").select("id,class_id,subject_id,teacher_user_id,active")
   .eq("school_id",school.id).limit(250)),
  checked(db.from("school_memberships").select("auth_user_id,role,active")
   .eq("school_id",school.id).eq("role","teacher").eq("active",true).limit(250)),
  checked(db.from("school_role_invites").select("claimed_by,email")
   .eq("school_id",school.id).eq("role","teacher").eq("status","claimed")
   .not("claimed_by","is",null).limit(250))
 ]);
 const names=new Map(invites.map(x=>[x.claimed_by,x.email]));
 const activeTeachers=teachers.map(t=>({id:t.auth_user_id,email:names.get(t.auth_user_id)||null}));
 const students=studentAccessManager?await checked(db.from("school_students")
  .select("id,student_code,first_name,last_name,status").eq("school_id",school.id)
  .eq("status","active").limit(250)):[];
 return {school,mode:"manage",actor:{id:actor.id,isOwner:actor.isOwner,
   academicManager,studentAccessManager},currentYear,
   classes:academicManager?classes:[],subjects:academicManager?subjects:[],
   classSubjects:academicManager?classSubjects:[],assignments:academicManager?assigned:[],
   teachers:academicManager?activeTeachers:[],students,
   limited:classes.length===250||students.length===250};
}
export async function GET(request,{params}){
 try{
  const {code}=await params;
  const mode=new URL(request.url).searchParams.get("mode")||"teacher";
  if(mode==="manage"){
   const {db,school,user,actor,academicManager,studentAccessManager}
     =await learningManagerContext(request,code);
   if(!academicManager&&!studentAccessManager)
     throw new ApiError(403,"School management permission required");
   const data=await managerData(db,school,actor,academicManager,studentAccessManager);
   return Response.json({...data,school:await publishedSchoolBrand(db,school)},{headers:noStore});
  }
  if(mode!=="teacher")throw new ApiError(400,"Unknown classroom mode");
  const {db,school,user}=await teacherContext(request,code);
  const data=await teacherData(db,school,user);
  return Response.json({...data,school:await publishedSchoolBrand(db,school)},{headers:noStore});
 }catch(e){return jsonError(e);}
}

export async function POST(request,{params}){
 try{
  const {code}=await params;
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||"");
  if(action==="teacher.assign"||action==="student.invite"){
   const {db,school,actor,academicManager,studentAccessManager,token}
     =await learningManagerContext(request,code);
   requireAal2(token);
   if(action==="teacher.assign"){
    if(!academicManager)throw new ApiError(403,"Academic management permission required");
    const result=await checked(db.rpc("school_assign_teacher",{
      p_school:school.id,p_class:validateUuid(body.classId,"class"),
      p_subject:validateUuid(body.subjectId,"subject"),
      p_teacher:validateUuid(body.teacherUserId,"teacher"),p_actor:actor.id
    }));
    return Response.json({ok:true,result},{headers:noStore});
   }
   if(!studentAccessManager)throw new ApiError(403,"Guardian management permission required");
   if(body.guardianConsentAttested!==true)
    throw new ApiError(400,"Confirm real guardian consent using the school's approved procedure");
   const email=classroomText(body.email,254).toLowerCase();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new ApiError(400,"Invalid student email");
   const result=await checked(db.rpc("school_invite_student_account",{
     p_school:school.id,p_student:validateUuid(body.studentId,"student"),
     p_email:email,p_attested:true,p_actor:actor.id
   }));
   let mailStatus="not_sent";
   const base=String(process.env.APP_PUBLIC_URL||"").replace(/\/$/,"");
   if(/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base)||
      /^http:\/\/localhost(?::\d+)?$/.test(base)){
     const {error:mailError}=await db.auth.admin.inviteUserByEmail(email,{
       redirectTo:base+"/s/"+school.school_code+"/login?role=student"
     });
     mailStatus=mailError?"provider_rejected_or_existing_account":"provider_accepted";
   }
   return Response.json({ok:true,result:{...result,mailStatus}},{headers:noStore});
  }
  if(!["lesson.publish","homework.publish","attendance.record"].includes(action))
   throw new ApiError(400,"Unsupported classroom action");
  const {db,school,user}=await teacherContext(request,code);
  const assignmentId=validateUuid(body.assignmentId,"class assignment");
  let result;
  if(action==="lesson.publish"){
   result=await checked(db.rpc("school_publish_lesson",{
    p_school:school.id,p_assignment:assignmentId,
    p_title:classroomText(body.title,160,{min:3}),
    p_content:classroomText(body.content,5000,{min:3}),
    p_lesson_on:classroomDate(body.lessonOn),p_actor:user.id
   }));
  }else if(action==="homework.publish"){
   result=await checked(db.rpc("school_publish_homework",{
    p_school:school.id,p_assignment:assignmentId,
    p_title:classroomText(body.title,160,{min:3}),
    p_instructions:classroomText(body.instructions,5000,{min:3}),
    p_due_on:classroomDate(body.dueOn),p_actor:user.id
   }));
  }else{
   if(!["present","absent","late","excused"].includes(body.state))
    throw new ApiError(400,"Invalid attendance state");
   result=await checked(db.rpc("school_record_attendance",{
    p_school:school.id,p_assignment:assignmentId,
    p_enrollment:validateUuid(body.enrollmentId,"enrollment"),
    p_day:classroomDate(body.attendanceOn),
    p_state:body.state,p_actor:user.id
   }));
  }
  return Response.json({ok:true,result},{headers:noStore});
 }catch(e){return jsonError(e);}
}
