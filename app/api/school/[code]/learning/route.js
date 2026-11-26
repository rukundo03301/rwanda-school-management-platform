import {schoolVerifiedContext} from "../../../../../lib/school-admin.mjs";
import {ApiError,checked,jsonError,validateUuid} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store"};

export async function GET(request,{params}){
 try{
  const {code}=await params;
  const {db,school,user}=await schoolVerifiedContext(request,code);
  const invite=await checked(db.from("school_student_account_invites")
    .select("student_id,status,expires_at").eq("school_id",school.id)
    .eq("email",user.email.trim().toLowerCase())
    .eq("status","pending").gt("expires_at",new Date().toISOString()).limit(20));
  const member=await checked(db.from("school_memberships").select("active")
    .eq("school_id",school.id).eq("auth_user_id",user.id)
    .eq("role","student").maybeSingle());
  let student=null,academicYear=null,activeClass=null,subjects=[],homework=[],submissions=[],attendance=[],questionHomeworkIds=[];
  if(member?.active){
   const account=await checked(db.from("school_student_accounts")
     .select("student_id").eq("school_id",school.id)
     .eq("auth_user_id",user.id).eq("active",true).maybeSingle());
   if(account){
    const record=await checked(db.from("school_students")
      .select("id,student_code,first_name,last_name,status")
      .eq("school_id",school.id).eq("id",account.student_id)
      .eq("status","active").maybeSingle());
    if(record){
     student={id:record.id,code:record.student_code,name:record.first_name+" "+record.last_name};
     academicYear=await checked(db.from("school_academic_years")
       .select("id,name").eq("school_id",school.id).eq("status","current").maybeSingle());
     if(academicYear){
      const enrollment=await checked(db.from("school_student_enrollments")
        .select("class_id").eq("school_id",school.id)
        .eq("student_id",record.id).eq("academic_year_id",academicYear.id)
        .eq("status","active").maybeSingle());
      if(enrollment){
       activeClass=await checked(db.from("school_classes")
         .select("id,name,section,level").eq("school_id",school.id)
         .eq("id",enrollment.class_id).eq("academic_year_id",academicYear.id)
         .eq("status","active").maybeSingle());
       if(activeClass){
        const [mapping,hw,subs,att]=await Promise.all([
         checked(db.from("school_class_subjects").select("subject_id")
           .eq("school_id",school.id).eq("class_id",activeClass.id).limit(100)),
         checked(db.from("school_homework").select(
           "id,title,instructions,due_at,subject_id,published_at,status,release_at"
         ).eq("school_id",school.id).eq("class_id",activeClass.id)
           .eq("status","published").or("release_at.is.null,release_at.lte."+new Date().toISOString()).order("due_at",{ascending:true}).limit(200)),
         checked(db.from("school_homework_submissions")
           .select("homework_id,response_text,submitted_at,is_late,score,max_score,feedback,graded_at,released_at")
           .eq("school_id",school.id).eq("student_id",record.id)
           .order("submitted_at",{ascending:false}).limit(200)),
         checked(db.from("school_attendance_records")
           .select("attendance_on,status,class_id").eq("school_id",school.id)
           .eq("student_id",record.id).eq("class_id",activeClass.id)
           .order("attendance_on",{ascending:false}).limit(250))
        ]);
        const subjectIds=[...new Set(mapping.map(x=>x.subject_id))];
        subjects=subjectIds.length?await checked(db.from("school_subjects")
          .select("id,code,name").eq("school_id",school.id).in("id",subjectIds)):[];
        homework=hw;
        const publishedIds=new Set(hw.map(x=>x.id));
        submissions=subs.filter(x=>publishedIds.has(x.homework_id)).map(x=>x.released_at?x:{...x,score:null,max_score:null,feedback:null,graded_at:null});
        const qrows=hw.length?await checked(db.from("school_homework_questions").select("homework_id").eq("school_id",school.id).in("homework_id",hw.map(x=>x.id)).limit(3000)):[];
        questionHomeworkIds=[...new Set(qrows.map(x=>x.homework_id))];
        attendance=att;
       }
      }
     }
    }
   }
  }
  let materials=[];
  if(activeClass){
   const shown=await db.from("school_learning_materials")
    .select("id,subject_id,title,kind,url,description,created_at")
    .eq("school_id",school.id).eq("class_id",activeClass.id).eq("published",true)
    .order("created_at",{ascending:false}).limit(200);
   materials=shown.error?[]:shown.data;
  }
  const [liveBrand,draftBrand]=await Promise.all([
   checked(db.from("platform_school_sites").select("logo_url").eq("school_id",school.id).maybeSingle()),
   checked(db.from("school_site_drafts").select("logo_url").eq("school_id",school.id).maybeSingle())
  ]);
  const logoUrl=liveBrand?.logo_url||draftBrand?.logo_url||null;
  return Response.json({
    school:{name:school.name,code:school.school_code,logoUrl},
    pendingInvitations:invite.map(i=>({studentId:i.student_id,expiresAt:i.expires_at})),
    student,academicYear,activeClass,subjects,homework,submissions,attendance,materials,questionHomeworkIds
  },{headers:noStore});
 }catch(e){return jsonError(e);}
}

export async function POST(request,{params}){
 try{
  const {code}=await params;
  const {db,school,user}=await schoolVerifiedContext(request,code);
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||"");
  let result;
  if(action==="student.claim"){
    if(body.accepted!==true)throw new ApiError(400,"Confirm school student account activation");
    const studentId=validateUuid(body.studentId,"school invitation");
    result=await checked(db.rpc("school_claim_student_account",{
      p_school_id:school.id,p_student:studentId,p_user:user.id,
      p_verified_email:user.email.trim().toLowerCase()
    }));
  }else if(action==="homework.submit"){
    const homeworkId=validateUuid(body.homeworkId,"homework");
    const hasQ=await checked(db.from("school_homework_questions").select("id").eq("school_id",school.id).eq("homework_id",homeworkId).limit(1));
    if(hasQ.length)throw new ApiError(400,"Open this homework and answer its questions");
    if(typeof body.responseText!=="string"||body.responseText.trim().length<1||
       body.responseText.length>5000)
      throw new ApiError(400,"Write a homework answer of up to 5000 characters");
    result=await checked(db.rpc("school_submit_homework",{
      p_school_id:school.id,p_homework:homeworkId,
      p_response:body.responseText.trim(),p_student_user:user.id
    }));
  }else throw new ApiError(400,"Unsupported student learning action");
  return Response.json({ok:true,result},{headers:noStore});
 }catch(e){return jsonError(e);}
}
