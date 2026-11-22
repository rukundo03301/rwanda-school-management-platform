import {
 classroomContext,classroomText,localSchoolDate,classroomDeadline,
 teacherAssignmentAllowed,teacherClassAllowed,requiredSchoolId
} from "../../../../../lib/school-classroom.mjs";
import {ApiError,checked,jsonError,requireAal2} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store"};

export async function GET(request,{params}){
 try{
   const {code}=await params;
   const {db,school,role,actorId}=await classroomContext(request,code);
   const [year,classes,subjects,mappings]=await Promise.all([
     checked(db.from("school_academic_years").select("id,name,starts_on,ends_on")
       .eq("school_id",school.id).eq("status","current").maybeSingle()),
     checked(db.from("school_classes").select("id,academic_year_id,name,section,level,status")
       .eq("school_id",school.id).eq("status","active").limit(500)),
     checked(db.from("school_subjects").select("id,code,name")
       .eq("school_id",school.id).limit(500)),
     checked(db.from("school_class_subjects").select("class_id,subject_id")
       .eq("school_id",school.id).limit(1000))
   ]);
   const allAssignments=role.manager?await checked(db.from("school_teacher_assignments")
     .select("teacher_id,class_id,subject_id,active,assigned_at")
     .eq("school_id",school.id).eq("active",true).limit(700)):[];
   const teacherAssignments=role.teacher?await checked(db.from("school_teacher_assignments")
     .select("teacher_id,class_id,subject_id,active")
     .eq("school_id",school.id).eq("teacher_id",actorId)
     .eq("active",true).limit(700)):[];
   const assignedClasses=new Set(teacherAssignments
     .filter(a=>year&&classes.some(c=>c.id===a.class_id&&c.academic_year_id===year.id))
     .map(a=>a.class_id));
   const roster=[];
   let lessons=[],homework=[],submissions=[],attendance=[];
   if(role.teacher&&assignedClasses.size){
     const classIds=[...assignedClasses];
     const enrollments=await checked(db.from("school_student_enrollments")
       .select("student_id,class_id").eq("school_id",school.id)
       .eq("academic_year_id",year.id).eq("status","active")
       .in("class_id",classIds).limit(1000));
     const studentIds=[...new Set(enrollments.map(e=>e.student_id))];
     const students=studentIds.length?await checked(db.from("school_students")
       .select("id,first_name,last_name,student_code")
       .eq("school_id",school.id).eq("status","active")
       .in("id",studentIds)):[];
     const studentsById=new Map(students.map(s=>[s.id,s]));
     roster.push(...enrollments.filter(e=>studentsById.has(e.student_id)).map(e=>({
       studentId:e.student_id,classId:e.class_id,
       code:studentsById.get(e.student_id).student_code,
       name:studentsById.get(e.student_id).first_name+" "+studentsById.get(e.student_id).last_name
     })));
     [lessons,homework,attendance]=await Promise.all([
       checked(db.from("school_lesson_plans").select("id,class_id,subject_id,title,objectives,lesson_date")
         .eq("school_id",school.id).eq("teacher_id",actorId)
         .in("class_id",classIds).order("lesson_date",{ascending:false}).limit(250)),
       checked(db.from("school_homework").select(
         "id,class_id,subject_id,title,instructions,due_at,status,published_at"
       ).eq("school_id",school.id).eq("teacher_id",actorId)
         .in("class_id",classIds).order("created_at",{ascending:false}).limit(250)),
       checked(db.from("school_attendance_records").select(
         "id,class_id,student_id,attendance_on,status,recorded_at"
       ).eq("school_id",school.id).in("class_id",classIds)
         .order("attendance_on",{ascending:false}).limit(1000))
     ]);
     // A teacher may remain assigned to this class but lose a particular
     // subject. Filter by BOTH active class and subject, not class alone.
     const pairs=new Set(teacherAssignments.map(a=>a.class_id+"#"+a.subject_id));
     lessons=lessons.filter(l=>pairs.has(l.class_id+"#"+l.subject_id));
     homework=homework.filter(h=>pairs.has(h.class_id+"#"+h.subject_id));
     if(homework.length){
       submissions=await checked(db.from("school_homework_submissions")
         .select("id,homework_id,student_id,response_text,submitted_at,is_late")
         .eq("school_id",school.id).in("homework_id",homework.map(h=>h.id))
         .order("submitted_at",{ascending:false}).limit(1000));
     }
   }
   const teacherMembers=role.manager?await checked(db.from("school_memberships")
     .select("auth_user_id,role,active").eq("school_id",school.id)
     .eq("role","teacher").eq("active",true).limit(500)):[];
   const claimedEmails=role.manager?await checked(db.from("school_role_invites")
     .select("email,claimed_by").eq("school_id",school.id)
     .eq("role","teacher").eq("status","claimed").not("claimed_by","is",null)
     .limit(500)):[];
   const emails=new Map(claimedEmails.map(x=>[x.claimed_by,x.email]));
   let studentCandidates=[],studentInvites=[],studentAccounts=[];
   if(role.owner){
     studentCandidates=await checked(db.from("school_students")
       .select("id,student_code,first_name,last_name,date_of_birth,status")
       .eq("school_id",school.id).eq("status","active").limit(500));
     studentInvites=await checked(db.from("school_student_account_invites")
       .select("student_id,email,status,expires_at")
       .eq("school_id",school.id).order("created_at",{ascending:false}).limit(500));
     studentAccounts=await checked(db.from("school_student_accounts")
       .select("student_id,auth_user_id,active,authorized_at")
       .eq("school_id",school.id).limit(500));
   }
   const [publishedBrand,draftBrand]=await Promise.all([
     checked(db.from("platform_school_sites").select("logo_url,primary_color")
       .eq("school_id",school.id).maybeSingle()),
     checked(db.from("school_site_drafts").select("logo_url,primary_color")
       .eq("school_id",school.id).maybeSingle())
   ]);
   const brand=publishedBrand?.logo_url?publishedBrand:(draftBrand||publishedBrand);
   return Response.json({
     school:{name:school.name,code:school.school_code,
       logo:brand?.logo_url||null,color:/^#[0-9a-f]{6}$/i.test(brand?.primary_color||"")?
         brand.primary_color:"#204a78"},
     actor:{...role,id:actorId},
     year,classes:year?classes.filter(c=>c.academic_year_id===year.id):[],
     subjects,mappings,
     assignments:role.manager?allAssignments:teacherAssignments,
     myAssignments:teacherAssignments,
     teachers:teacherMembers.map(m=>({userId:m.auth_user_id,email:emails.get(m.auth_user_id)||"Verified teacher"})),
     roster,lessons,homework,submissions,attendance,
     studentCandidates,studentInvites,studentAccounts
   },{headers:noStore});
 }catch(e){return jsonError(e);}
}

export async function POST(request,{params}){
 try{
  const {code}=await params;
  const {db,school,role,actorId,token}=await classroomContext(request,code);
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||"");
  const cls=body.classId?requiredSchoolId(body.classId,"class"):null;
  const subj=body.subjectId?requiredSchoolId(body.subjectId,"subject"):null;
  let result;
  if(action==="teacher.assign"){
    if(!role.manager)throw new ApiError(403,"School academic management permission required");
    requireAal2(token);
    const teacherId=requiredSchoolId(body.teacherId,"teacher");
    if(!cls||!subj)throw new ApiError(400,"Choose class and subject");
    result=await checked(db.rpc("school_assign_teacher",{
      p_school_id:school.id,p_teacher:teacherId,p_class:cls,
      p_subject:subj,p_actor:actorId
    }));
  }else if(action==="teacher.revoke"){
    if(!role.manager)throw new ApiError(403,"School academic management permission required");
    requireAal2(token);
    const teacherId=requiredSchoolId(body.teacherId,"teacher");
    const reason=classroomText(body.reason,500,{min:8});
    result=await checked(db.rpc("school_revoke_teacher_assignment",{
      p_school_id:school.id,p_teacher:teacherId,p_class:cls,p_subject:subj,
      p_reason:reason,p_actor:actorId
    }));
  }else if(action==="lesson.create"){
    if(!role.teacher)throw new ApiError(403,"A verified assigned teacher is required");
    if(!cls||!subj)throw new ApiError(400,"Choose your assigned class and subject");
    const title=classroomText(body.title,180,{min:3});
    const objectives=typeof body.objectives==="string"&&body.objectives.length<=4000?body.objectives:"";
    const lessonOn=localSchoolDate(body.lessonOn);
    result=await checked(db.rpc("school_create_lesson",{
      p_school_id:school.id,p_class:cls,p_subject:subj,p_title:title,
      p_objectives:objectives,p_lesson_date:lessonOn,p_teacher:actorId
    }));
  }else if(action==="homework.create"){
    if(!role.teacher)throw new ApiError(403,"A verified assigned teacher is required");
    if(!cls||!subj)throw new ApiError(400,"Choose your assigned class and subject");
    const title=classroomText(body.title,180,{min:3});
    const instructions=classroomText(body.instructions,5000);
    const dueAt=classroomDeadline(body.dueAt);
    result=await checked(db.rpc("school_create_homework",{
      p_school_id:school.id,p_class:cls,p_subject:subj,
      p_title:title,p_instructions:instructions,p_due_at:dueAt,p_teacher:actorId
    }));
  }else if(action==="homework.publish"){
    if(!role.teacher)throw new ApiError(403,"A verified assigned teacher is required");
    const homeworkId=requiredSchoolId(body.homeworkId,"homework");
    result=await checked(db.rpc("school_publish_homework",{
      p_school_id:school.id,p_homework:homeworkId,p_teacher:actorId
    }));
  }else if(action==="attendance.record"){
    if(!role.teacher)throw new ApiError(403,"A verified assigned teacher is required");
    if(!cls)throw new ApiError(400,"Choose your class");
    const studentId=requiredSchoolId(body.studentId,"student");
    const on=localSchoolDate(body.on);
    const status=String(body.status||"");
    if(!["present","absent","late","excused"].includes(status))throw new ApiError(400,"Invalid attendance status");
    result=await checked(db.rpc("school_record_attendance",{
      p_school_id:school.id,p_class:cls,p_student:studentId,p_date:on,
      p_status:status,p_teacher:actorId
    }));
  }else if(action==="student.revoke"){
    if(!role.owner)throw new ApiError(403,"Only the school owner can revoke student access");
    requireAal2(token);
    const studentId=requiredSchoolId(body.studentId,"student");
    const reason=classroomText(body.reason,500,{min:8});
    result=await checked(db.rpc("school_revoke_student_account",{
      p_school_id:school.id,p_student:studentId,p_reason:reason,p_actor:actorId
    }));
  }else if(action==="student.invite"){
    if(!role.owner)throw new ApiError(403,"Only the school owner can authorize a student account");
    requireAal2(token);
    const studentId=requiredSchoolId(body.studentId,"student");
    const email=String(body.email||"").trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)
      throw new ApiError(400,"Provide a valid school-approved student email");
    if(body.consentAttested!==true)throw new ApiError(400,"School identity and parental approval must be verified");
    result=await checked(db.rpc("school_invite_student_account",{
      p_school_id:school.id,p_student:studentId,p_email:email,
      p_consent:true,p_actor:actorId
    }));
    const base=String(process.env.APP_PUBLIC_URL||"").replace(/\/$/,"");
    let mailStatus="not_sent";
    if(/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base)||/^http:\/\/localhost(?::\d+)?$/.test(base)){
      const {error}=await db.auth.admin.inviteUserByEmail(email,{
        redirectTo:base+"/s/"+school.school_code+"/login?role=student"
      });
      mailStatus=error?"provider_rejected_or_existing_account":"provider_accepted";
    }
    result={...result,mailStatus};
  }else throw new ApiError(400,"Unsupported classroom action");
  return Response.json({ok:true,result},{headers:noStore});
 }catch(e){return jsonError(e);}
}
