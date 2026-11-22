import {teacherContext,cleanTeachingText,validTeachingDate,ATTENDANCE_STATES}
 from "../../../../../lib/school-learning.mjs";
import {ApiError,checked,validateUuid,jsonError} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request,{params}){
 try{
  const {code}=await params;
  const {db,user,school}=await teacherContext(request,code);
  const assignments=await checked(db.from("school_teacher_assignments")
   .select("id,class_id,subject_id,academic_year_id")
   .eq("school_id",school.id).eq("teacher_user_id",user.id).eq("active",true)
   .limit(100));
  const assignmentIds=assignments.map(a=>a.id);
  const classIds=[...new Set(assignments.map(a=>a.class_id))];
  const subjectIds=[...new Set(assignments.map(a=>a.subject_id))];
  const years=[...new Set(assignments.map(a=>a.academic_year_id))];
  const [classes,subjects,academicYears,enrollments,lessons,homework]=await Promise.all([
    classIds.length?checked(db.from("school_classes")
      .select("id,name,section,academic_year_id").eq("school_id",school.id).in("id",classIds)):[],
    subjectIds.length?checked(db.from("school_subjects")
      .select("id,name").eq("school_id",school.id).in("id",subjectIds)):[],
    years.length?checked(db.from("school_academic_years")
      .select("id,name").eq("school_id",school.id).in("id",years)):[],
    classIds.length?checked(db.from("school_student_enrollments")
      .select("id,student_id,class_id,academic_year_id,status")
      .eq("school_id",school.id).in("class_id",classIds)
      .eq("status","active").limit(800)):[],
    assignmentIds.length?checked(db.from("school_lesson_plans")
      .select("id,teacher_assignment_id,lesson_on,topic,objectives")
      .eq("school_id",school.id).in("teacher_assignment_id",assignmentIds)
      .order("lesson_on",{ascending:false}).limit(250)):[],
    assignmentIds.length?checked(db.from("school_homework")
      .select("id,teacher_assignment_id,title,instructions,due_at,status")
      .eq("school_id",school.id).in("teacher_assignment_id",assignmentIds)
      .order("due_at",{ascending:false}).limit(250)):[]
  ]);
  // Only roster students enrolled in a class/year ACTUALLY assigned to this teacher.
  const permitted=new Set(assignments.map(a=>a.class_id+"#"+a.academic_year_id));
  const scopedEnrollments=enrollments.filter(e=>permitted.has(e.class_id+"#"+e.academic_year_id));
  const studentIds=[...new Set(scopedEnrollments.map(e=>e.student_id))];
  const homeworkIds=homework.map(h=>h.id);
  const [students,attendance,submissions]=await Promise.all([
    studentIds.length?checked(db.from("school_students")
      .select("id,student_code,first_name,last_name,status")
      .eq("school_id",school.id).in("id",studentIds).eq("status","active")):[],
    scopedEnrollments.length?checked(db.from("school_attendance")
      .select("enrollment_id,attendance_on,attendance_status")
      .eq("school_id",school.id).in("enrollment_id",scopedEnrollments.map(e=>e.id))
      .order("attendance_on",{ascending:false}).limit(900)):[],
    homeworkIds.length?checked(db.from("school_homework_submissions")
      .select("homework_id,student_id,submitted_at")
      .eq("school_id",school.id).in("homework_id",homeworkIds).limit(700)):[]
  ]);
  const allowedStudents=new Set(students.map(s=>s.id));
  return Response.json({school:{name:school.name,code:school.school_code},
    assignments,classes,subjects,academicYears,
    enrollments:scopedEnrollments.filter(e=>allowedStudents.has(e.student_id)),
    students,lessons,homework,attendance,
    submissions:submissions.filter(s=>allowedStudents.has(s.student_id))
  },{headers:{"Cache-Control":"no-store"}});
 }catch(e){return jsonError(e);}
}

export async function POST(request,{params}){
 try{
  const {code}=await params;
  const {db,user,school}=await teacherContext(request,code);
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||"");
  let result;
  if(action==="lesson.create"||action==="homework.create"){
   const kind=action==="lesson.create"?"lesson":"homework";
   const title=cleanTeachingText(body.title,140);
   const text=cleanTeachingText(body.body||"",4000,{required:false});
   const date=kind==="lesson"?validTeachingDate(body.date):
     (typeof body.date==="string"&&Number.isFinite(Date.parse(body.date))?
      body.date:null);
   if(!date)throw new ApiError(400,"Choose a valid lesson date or homework deadline");
   // For a date-only lesson use noon Kigali to avoid timezone rollover.
   const at=kind==="lesson"?date+"T12:00:00+02:00":date;
   result=await checked(db.rpc("school_teacher_create_content",{
    p_school:school.id,p_assignment:validateUuid(body.assignmentId,"class assignment"),
    p_kind:kind,p_title:title,p_body:text,p_on:at,p_actor:user.id
   }));
  }else if(action==="attendance.mark"){
   const status=String(body.status||"");
   if(!ATTENDANCE_STATES.includes(status))throw new ApiError(400,"Invalid attendance status");
   result=await checked(db.rpc("school_teacher_mark_attendance",{
    p_school:school.id,p_assignment:validateUuid(body.assignmentId,"class assignment"),
    p_enrollment:validateUuid(body.enrollmentId,"enrollment"),
    p_day:validTeachingDate(body.date),p_status:status,
    p_note:cleanTeachingText(body.note||"",350,{required:false}),p_actor:user.id
   }));
  }else throw new ApiError(400,"Unsupported teacher action");
  return Response.json({ok:true,result},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return jsonError(e);}
}
