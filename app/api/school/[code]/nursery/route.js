import {classroomContext,classroomText,localSchoolDate,requiredSchoolId} from "../../../../../lib/school-classroom.mjs";
import {ApiError,checked,jsonError} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store"};
const AREAS=["language_communication","numeracy_early_math","social_emotional","physical_health","creative_arts_culture","environment_science"];
const DESCRIPTORS=["developing","secure","extending"];
// Early-years observation reports apply only when the school offers the nursery level
// (School setup), and only to classes whose education level is nursery.
async function nurseryScope(ctx){
 const {db,school,role,actorId}=ctx;
 const setup=await checked(db.from("school_onboarding").select("education_levels").eq("school_id",school.id).maybeSingle());
 if(!(setup?.education_levels||[]).includes("nursery"))throw new ApiError(403,"This school does not offer the nursery level. The owner can add it in School setup.");
 const year=await checked(db.from("school_academic_years").select("id,name").eq("school_id",school.id).eq("status","current").maybeSingle());
 if(!year)return {year:null,classes:[]};
 const all=await checked(db.from("school_classes").select("id,name,level,section,academic_year_id,status")
  .eq("school_id",school.id).eq("academic_year_id",year.id).eq("status","active").eq("level_band","nursery").limit(200));
 let classes=all;
 if(!role.manager){
  const mine=await checked(db.from("school_teacher_assignments").select("class_id")
   .eq("school_id",school.id).eq("teacher_id",actorId).eq("active",true).limit(500));
  const ids=new Set(mine.map(m=>m.class_id));
  classes=classes.filter(c=>ids.has(c.id));
 }
 return {year,classes};
}

export async function GET(request,{params}){
 try{
  const {code}=await params;
  const ctx=await classroomContext(request,code);
  const {db,school,role}=ctx;
  const {year,classes}=await nurseryScope(ctx);
  if(!year||!classes.length)return Response.json({role,year,classes:[],roster:[],observations:[],reports:[]},{headers:noStore});
  const classIds=classes.map(c=>c.id);
  const enrollments=await checked(db.from("school_student_enrollments").select("student_id,class_id")
   .eq("school_id",school.id).eq("academic_year_id",year.id).eq("status","active").in("class_id",classIds).limit(2000));
  const ids=[...new Set(enrollments.map(e=>e.student_id))];
  const students=ids.length?await checked(db.from("school_students").select("id,first_name,last_name,student_code")
   .eq("school_id",school.id).eq("status","active").in("id",ids).limit(2000)):[];
  const byId=new Map(students.map(s=>[s.id,s]));
  const roster=enrollments.filter(e=>byId.has(e.student_id)).map(e=>({
   studentId:e.student_id,classId:e.class_id,code:byId.get(e.student_id).student_code,
   name:byId.get(e.student_id).first_name+" "+byId.get(e.student_id).last_name
  }));
  const [observations,reports]=await Promise.all([
   checked(db.from("school_nursery_observations").select("id,class_id,student_id,learning_area,observed_on,descriptor,comment")
    .eq("school_id",school.id).in("class_id",classIds).order("observed_on",{ascending:false}).limit(3000)),
   checked(db.from("school_nursery_reports").select("id,class_id,student_id,term_number,area_summaries,teacher_comment,headteacher_comment,status,approved_at,published_at")
    .eq("school_id",school.id).in("class_id",classIds).order("updated_at",{ascending:false}).limit(1000))
  ]);
  return Response.json({role,year,classes,roster,observations,reports,areas:AREAS,descriptors:DESCRIPTORS},{headers:noStore});
 }catch(e){return jsonError(e);}
}

export async function POST(request,{params}){
 try{
  const {code}=await params;
  const ctx=await classroomContext(request,code);
  const {db,school,role,actorId}=ctx;
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||"");
  let result;
  if(action==="observation.record"){
   if(!role.teacher)throw new ApiError(403,"Only an assigned teacher records observations");
   if(!AREAS.includes(body.area))throw new ApiError(400,"Choose a learning area");
   if(!DESCRIPTORS.includes(body.descriptor))throw new ApiError(400,"Choose a descriptor");
   result=await checked(db.rpc("school_record_nursery_observation",{
    p_school_id:school.id,p_class:requiredSchoolId(body.classId,"class"),p_student:requiredSchoolId(body.studentId,"student"),
    p_area:body.area,p_date:localSchoolDate(body.date),p_descriptor:body.descriptor,
    p_comment:classroomText(String(body.comment||""),500,{min:0}),p_teacher:actorId
   }));
  }else if(action==="report.save"){
   if(!role.teacher)throw new ApiError(403,"Only an assigned teacher drafts reports");
   const term=Number(body.term);
   if(![1,2,3].includes(term))throw new ApiError(400,"Choose term 1, 2 or 3");
   const raw=body.areaSummaries&&typeof body.areaSummaries==="object"?body.areaSummaries:{};
   const summaries={};
   for(const a of AREAS)summaries[a]=classroomText(String(raw[a]||""),600,{min:0});
   result=await checked(db.rpc("school_save_nursery_report_draft",{
    p_school_id:school.id,p_class:requiredSchoolId(body.classId,"class"),p_student:requiredSchoolId(body.studentId,"student"),
    p_term:term,p_area_summaries:summaries,p_teacher_comment:classroomText(String(body.teacherComment||""),1500,{min:0}),p_teacher:actorId
   }));
  }else if(action==="report.approve"){
   if(!role.manager)throw new ApiError(403,"Leadership permission required");
   result=await checked(db.rpc("school_approve_nursery_report",{
    p_school_id:school.id,p_report:requiredSchoolId(body.reportId,"report"),
    p_headteacher_comment:classroomText(String(body.headteacherComment||""),1500,{min:0}),p_actor:actorId
   }));
  }else if(action==="report.publish"){
   if(!role.owner)throw new ApiError(403,"Only the school owner may publish reports");
   result=await checked(db.rpc("school_publish_nursery_report",{
    p_school_id:school.id,p_report:requiredSchoolId(body.reportId,"report"),p_actor:actorId
   }));
  }else throw new ApiError(400,"Unsupported nursery action");
  return Response.json({ok:true,result},{headers:noStore});
 }catch(e){return jsonError(e);}
}
