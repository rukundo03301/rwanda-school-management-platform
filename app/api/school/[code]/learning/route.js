import {schoolVerifiedContext,studentLearningContext,classroomText} from "../../../../../lib/school-classroom.mjs";
import {ApiError,checked,jsonError,validateUuid} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store"};

async function ownLearning(db,school,student,{includeSubmissions=false}={}){
 const currentYear=await checked(db.from("school_academic_years")
   .select("id,name,starts_on,ends_on")
   .eq("school_id",school.id).eq("status","current").maybeSingle());
 const empty={student:{id:student.id,studentCode:student.student_code,
   name:student.first_name+" "+student.last_name},
   currentYear,classRoom:null,subjects:[],lessons:[],homework:[],attendance:[],submissions:[]};
 if(!currentYear)return empty;
 const enrollment=await checked(db.from("school_student_enrollments")
   .select("id,class_id,student_id,status")
   .eq("school_id",school.id).eq("student_id",student.id)
   .eq("academic_year_id",currentYear.id).eq("status","active").maybeSingle());
 if(!enrollment)return empty;
 const cls=await checked(db.from("school_classes")
   .select("id,name,section,status").eq("school_id",school.id)
   .eq("id",enrollment.class_id).eq("status","active").maybeSingle());
 if(!cls)return empty;
 const assignments=await checked(db.from("school_teacher_assignments")
   .select("id,class_id,subject_id,active").eq("school_id",school.id)
   .eq("class_id",cls.id).eq("active",true).limit(100));
 const ids=assignments.map(a=>a.id);
 const [subjects,lessons,homework,attendance]=await Promise.all([
   assignments.length?checked(db.from("school_subjects")
     .select("id,name,code").eq("school_id",school.id)
     .in("id",[...new Set(assignments.map(a=>a.subject_id))]).limit(100)):[],
   ids.length?checked(db.from("school_lessons")
     .select("id,assignment_id,title,content,lesson_on")
     .eq("school_id",school.id).in("assignment_id",ids)
     .order("lesson_on",{ascending:false}).limit(200)):[],
   ids.length?checked(db.from("school_homework")
     .select("id,assignment_id,title,instructions,due_on")
     .eq("school_id",school.id).in("assignment_id",ids)
     .order("due_on",{ascending:true}).limit(200)):[],
   checked(db.from("school_attendance")
     .select("id,attendance_on,state").eq("school_id",school.id)
     .eq("enrollment_id",enrollment.id)
     .order("attendance_on",{ascending:false}).limit(120))
 ]);
 const submissions=includeSubmissions&&homework.length?await checked(db.from("school_homework_submissions")
   .select("id,homework_id,response_text,submitted_at")
   .eq("school_id",school.id).eq("student_id",student.id)
   .in("homework_id",homework.map(h=>h.id)).limit(200)):[];
 return {...empty,classRoom:{id:cls.id,name:cls.name,section:cls.section},
   subjects,lessons,homework,attendance,submissions,
   limited:homework.length===200||lessons.length===200||attendance.length===120};
}

export async function GET(request,{params}){
 try{
  const {code}=await params;
  const mode=new URL(request.url).searchParams.get("view")||"student";
  if(mode!=="student"&&mode!=="family")throw new ApiError(400,"Invalid learning view");
  const {db,school,user}=await schoolVerifiedContext(request,code);
  const schoolInfo={name:school.name,code:school.school_code};
  if(mode==="family"){
    const studentId=validateUuid(new URL(request.url).searchParams.get("studentId"),"child");
    const parent=await checked(db.from("school_memberships")
      .select("active").eq("school_id",school.id).eq("auth_user_id",user.id)
      .eq("role","parent").maybeSingle());
    const link=parent?.active?await checked(db.from("school_guardian_links")
      .select("student_id").eq("school_id",school.id)
      .eq("auth_user_id",user.id).eq("student_id",studentId)
      .eq("active",true).maybeSingle()):null;
    if(!link)throw new ApiError(403,"No verified family access to this child");
    const student=await checked(db.from("school_students")
      .select("id,student_code,first_name,last_name,status")
      .eq("school_id",school.id).eq("id",studentId).eq("status","active").maybeSingle());
    if(!student)throw new ApiError(404,"School child unavailable");
    const view=await ownLearning(db,school,student);
    return Response.json({school:schoolInfo,view:"family",...view},{headers:noStore});
  }
  const pending=await checked(db.from("school_student_access_invitations")
    .select("student_id,expires_at").eq("school_id",school.id)
    .eq("email",user.email.trim().toLowerCase())
    .eq("status","pending").gt("expires_at",new Date().toISOString()).limit(10));
  const [membership,account]=await Promise.all([
    checked(db.from("school_memberships").select("active")
      .eq("school_id",school.id).eq("auth_user_id",user.id)
      .eq("role","student").maybeSingle()),
    checked(db.from("school_student_accounts").select("student_id,active")
      .eq("school_id",school.id).eq("auth_user_id",user.id).maybeSingle())
  ]);
  if(membership?.active!==true||account?.active!==true)
    return Response.json({school:schoolInfo,view:"student",accessReady:false,
      invitations:pending}, {headers:noStore});
  const student=await checked(db.from("school_students")
    .select("id,student_code,first_name,last_name,status")
    .eq("school_id",school.id).eq("id",account.student_id).eq("status","active").maybeSingle());
  if(!student)throw new ApiError(403,"Student account not available");
  const view=await ownLearning(db,school,student,{includeSubmissions:true});
  return Response.json({school:schoolInfo,view:"student",
    accessReady:true,invitations:[],...view},{headers:noStore});
 }catch(e){return jsonError(e);}
}

export async function POST(request,{params}){
 try{
  const {code}=await params;
  const {db,school,user}=await schoolVerifiedContext(request,code);
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||"");
  if(action==="student.claim"){
    if(body.accepted!==true)throw new ApiError(400,"Confirm the school-issued student invitation");
    const studentId=validateUuid(body.studentId,"invitation");
    const result=await checked(db.rpc("school_claim_student_account",{
      p_school:school.id,p_student:studentId,p_user:user.id,
      p_verified_email:user.email.toLowerCase().trim()
    }));
    return Response.json({ok:true,result},{headers:noStore});
  }
  if(action==="homework.submit"){
    const authenticated=await studentLearningContext(request,code);
    const id=validateUuid(body.homeworkId,"homework");
    const responseText=classroomText(body.responseText,5000);
    const result=await checked(db.rpc("school_submit_homework",{
      p_school:school.id,p_homework:id,p_student:authenticated.student.id,
      p_user:user.id,p_text:responseText
    }));
    return Response.json({ok:true,result},{headers:noStore});
  }
  throw new ApiError(400,"Unsupported student learning action");
 }catch(e){return jsonError(e);}
}
