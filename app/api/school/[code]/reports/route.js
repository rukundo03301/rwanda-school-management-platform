import {
 reportingContext,hasReportPermission,reportText,reportUrl,reportId,
 reportDate,validateAssessmentCategory,normalizeReportPermissions,CURRICULUM_TRACKS
} from "../../../../../lib/school-reporting.mjs";
import {ApiError,checked,jsonError,requireAal2} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
const restricted=(actor,permission)=>{
 if(!hasReportPermission(actor,permission))
  throw new ApiError(403,"Your school did not enable this report or curriculum permission");
};
const dateBound=(begin,end,year)=>{
 if(begin>end||begin<year.starts_on||end>year.ends_on)
  throw new ApiError(400,"Term dates must belong to the selected academic year");
};

export async function GET(request,{params}){
 try{
  const {code}=await params;
  const {db,school,actor,user}=await reportingContext(request,code);
  const manage=hasReportPermission(actor,"curriculum.manage");
  const readReports=hasReportPermission(actor,"reports.read");
  if(!manage&&!readReports&&!actor.teacher)
   throw new ApiError(403,"No academic reports permission");
  const [year,allClasses,allSubjects,allMappings]=await Promise.all([
    checked(db.from("school_academic_years").select("id,name,status,starts_on,ends_on")
      .eq("school_id",school.id).eq("status","current").maybeSingle()),
    checked(db.from("school_classes").select("id,name,section,academic_year_id,status")
      .eq("school_id",school.id).eq("status","active").limit(500)),
    checked(db.from("school_subjects").select("id,code,name")
      .eq("school_id",school.id).limit(500)),
    checked(db.from("school_class_subjects").select("class_id,subject_id")
      .eq("school_id",school.id).limit(1000))
  ]);
  const assignments=actor.teacher?await checked(db.from("school_teacher_assignments")
    .select("class_id,subject_id,active")
    .eq("school_id",school.id).eq("teacher_id",user.id)
    .eq("active",true).limit(500)):[];
  const allowedPairs=new Set(assignments.map(x=>x.class_id+"#"+x.subject_id));
  const classIds=new Set(assignments.map(x=>x.class_id));
  const classes=(manage||readReports)?allClasses.filter(x=>x.academic_year_id===year?.id):
    allClasses.filter(x=>x.academic_year_id===year?.id&&classIds.has(x.id));
  const classSet=new Set(classes.map(c=>c.id));
  const mappings=allMappings.filter(m=>classSet.has(m.class_id)&&
    ((manage||readReports)||allowedPairs.has(m.class_id+"#"+m.subject_id)));
  const subjectIds=new Set(mappings.map(x=>x.subject_id));
  const subjects=allSubjects.filter(x=>subjectIds.has(x.id));
  const termRecords=year?await checked(db.from("school_assessment_terms")
    .select("id,term_number,begins_on,ends_on,status")
    .eq("school_id",school.id).eq("academic_year_id",year.id)
    .order("term_number",{ascending:true}).limit(10)):[];
  const curriculum=year?await checked(db.from("school_curriculum_profiles")
    .select("id,name,track,level_band,pathway,policy_version,source_title,source_url,status,academic_year_id")
    .eq("school_id",school.id).eq("academic_year_id",year.id).limit(100)):[];
  const courseMappings=classSet.size?await checked(db.from("school_curriculum_class_subjects")
    .select("class_id,subject_id,academic_year_id,curriculum_profile_id,weekly_periods,module_credits,syllabus_title,syllabus_url,approved_at")
    .eq("school_id",school.id).in("class_id",[...classSet]).limit(1000)):[];
  const allowedCourses=courseMappings.filter(m=>
    (manage||readReports)||allowedPairs.has(m.class_id+"#"+m.subject_id));
  const units=classSet.size?await checked(db.from("school_curriculum_units")
    .select("id,class_id,subject_id,unit_code,term_number,unit_title,key_competence,learning_outcomes")
    .eq("school_id",school.id).in("class_id",[...classSet]).limit(1500)):[];
  const visibleUnits=units.filter(u=>(manage||readReports)||allowedPairs.has(u.class_id+"#"+u.subject_id));
  let roster=[],marks=[],publishedReports=[],adminGrants=[];
  if((readReports||actor.teacher)&&year&&classes.length){
    const en=await checked(db.from("school_student_enrollments")
      .select("student_id,class_id")
      .eq("school_id",school.id).eq("academic_year_id",year.id)
      .eq("status","active").in("class_id",[...classSet]).limit(1500));
    const studentIds=[...new Set(en.map(e=>e.student_id))];
    const studentRecords=studentIds.length?await checked(db.from("school_students")
      .select("id,student_code,first_name,last_name,status")
      .eq("school_id",school.id).eq("status","active").in("id",studentIds)):[];
    const byId=new Map(studentRecords.map(s=>[s.id,s]));
    roster=en.filter(e=>byId.has(e.student_id)).map(e=>({
      studentId:e.student_id,classId:e.class_id,
      studentCode:byId.get(e.student_id).student_code,
      name:byId.get(e.student_id).first_name+" "+byId.get(e.student_id).last_name
    }));
    if(termRecords.length&&studentIds.length){
      const allMarks=await checked(db.from("school_assessment_marks")
        .select("id,term_id,student_id,class_id,subject_id,category,assessment_code,score,maximum_marks,raw_score,raw_maximum,learning_feedback,teacher_id,entered_at")
        .eq("school_id",school.id).in("term_id",termRecords.map(t=>t.id))
        .in("student_id",studentIds).limit(3000));
      marks=readReports?allMarks:allMarks.filter(m=>allowedPairs.has(m.class_id+"#"+m.subject_id));
      if(readReports){
        publishedReports=await checked(db.from("school_published_reports")
         .select("id,term_id,student_id,class_id,status,report_data,published_at")
         .eq("school_id",school.id).in("term_id",termRecords.map(t=>t.id))
         .order("published_at",{ascending:false}).limit(1000));
      }
    }
  }
  if(actor.owner){
    const [admins,grants,emails]=await Promise.all([
      checked(db.from("school_memberships").select("auth_user_id")
        .eq("school_id",school.id).eq("role","school_admin").eq("active",true).limit(250)),
      checked(db.from("school_report_admin_permissions").select("auth_user_id,permissions")
        .eq("school_id",school.id).limit(250)),
      checked(db.from("school_role_invites").select("claimed_by,email")
        .eq("school_id",school.id).eq("role","school_admin").eq("status","claimed")
        .not("claimed_by","is",null).limit(250))
    ]);
    const permsById=new Map(grants.map(a=>[a.auth_user_id,a.permissions]));
    const byEmail=new Map(emails.map(x=>[x.claimed_by,x.email]));
    adminGrants=admins.map(a=>({userId:a.auth_user_id,
      email:byEmail.get(a.auth_user_id)||null,
      permissions:permsById.get(a.auth_user_id)||[]}));
  }
  const [officialBrand,draftBrand]=await Promise.all([
    checked(db.from("platform_school_sites")
      .select("logo_url,primary_color").eq("school_id",school.id).maybeSingle()),
    checked(db.from("school_site_drafts")
      .select("logo_url,primary_color").eq("school_id",school.id).maybeSingle())
  ]);
  const brand=officialBrand?.logo_url?officialBrand:(draftBrand||officialBrand);
  return Response.json({
    school:{name:school.name,code:school.school_code,
      logoUrl:brand?.logo_url||null,primaryColor:brand?.primary_color||"#204a78"},
    actor,year,classes,subjects,mappings,terms:termRecords,curriculum,
    courseMappings:allowedCourses,units:visibleUnits,roster,marks,
    publishedReports,adminGrants,
    info:{loadedRecordsOnly:true,
      gradingMethod:"NESA 2023 General/Professional (unit 25%, project 25%, end-term 50%)",
      unavailableTracks:["tvet","nursery","higher_education","international"]}
  },{headers});
 }catch(e){return jsonError(e)}
}

export async function POST(request,{params}){
 try{
  const {code}=await params;
  const {db,school,actor,token}=await reportingContext(request,code);
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||"");
  let result;
  if(action==="curriculum.profile"){
    restricted(actor,"curriculum.manage");
    const yearId=reportId(body.yearId,"academic year");
    const year=await checked(db.from("school_academic_years").select("id,status")
      .eq("school_id",school.id).eq("id",yearId).maybeSingle());
    if(!year||year.status!=="current")throw new ApiError(400,"Choose the current school year");
    const track=String(body.track||"");
    if(!CURRICULUM_TRACKS.includes(track))throw new ApiError(400,"Choose a curriculum track");
    const band=String(body.levelBand||"");
    const permitted={
      general:["lower_primary","upper_primary","ordinary_secondary","advanced_secondary"],
      professional:["professional"],tvet:["tvet"],nursery:["nursery"],
      higher_education:["higher_education"],international:["international"]
    };
    if(!permitted[track].includes(band))
      throw new ApiError(400,"Select a valid education level for this curriculum");
    result=await checked(db.from("school_curriculum_profiles").insert({
      school_id:school.id,academic_year_id:yearId,
      name:reportText(body.name,120,{min:3}),track,level_band:band,
      pathway:typeof body.pathway==="string"?body.pathway.slice(0,120):"",
      policy_version:reportText(body.policyVersion,120,{min:3}),
      source_title:reportText(body.sourceTitle,240,{min:3}),
      source_url:reportUrl(body.sourceUrl),created_by:actor.id
    }).select("id,name,status").single());
  }else if(action==="curriculum.map"){
    restricted(actor,"curriculum.manage");
    const classId=reportId(body.classId,"class"),subjectId=reportId(body.subjectId,"subject");
    const profileId=reportId(body.profileId,"curriculum profile");
    const cls=await checked(db.from("school_classes").select("academic_year_id")
      .eq("school_id",school.id).eq("id",classId).eq("status","active").maybeSingle());
    const profile=await checked(db.from("school_curriculum_profiles")
      .select("id,track,academic_year_id").eq("school_id",school.id)
      .eq("id",profileId).maybeSingle());
    if(!cls||!profile||cls.academic_year_id!==profile.academic_year_id)
      throw new ApiError(400,"Curriculum and class must share the same school and year");
    const exists=await checked(db.from("school_class_subjects").select("subject_id")
      .eq("school_id",school.id).eq("class_id",classId)
      .eq("subject_id",subjectId).maybeSingle());
    if(!exists)throw new ApiError(400,"Assign the subject to this class in School Administration first");
    let weeklyPeriods=null,moduleCredits=null;
    if(["general","professional"].includes(profile.track)){
      weeklyPeriods=Number(body.weeklyPeriods);
      if(!Number.isInteger(weeklyPeriods)||weeklyPeriods<1||weeklyPeriods>20)
        throw new ApiError(400,"Provide curriculum-verified weekly teaching periods (1–20)");
    }else if(profile.track==="tvet"){
      moduleCredits=Number(body.moduleCredits);
      if(!Number.isInteger(moduleCredits)||moduleCredits<1||moduleCredits>100)
        throw new ApiError(400,"Provide approved TVET module credits");
    }
    result=await checked(db.from("school_curriculum_class_subjects").insert({
      school_id:school.id,class_id:classId,subject_id:subjectId,
      academic_year_id:cls.academic_year_id,curriculum_profile_id:profileId,
      weekly_periods:weeklyPeriods,module_credits:moduleCredits,
      syllabus_title:reportText(body.syllabusTitle,200,{min:3}),
      syllabus_url:reportUrl(body.syllabusUrl),created_by:actor.id
    }).select("class_id,subject_id,approved_at").single());
  }else if(action==="curriculum.unit"){
    restricted(actor,"curriculum.manage");
    const classId=reportId(body.classId,"class"),subjectId=reportId(body.subjectId,"subject");
    const mapping=await checked(db.from("school_curriculum_class_subjects")
      .select("approved_at").eq("school_id",school.id)
      .eq("class_id",classId).eq("subject_id",subjectId).maybeSingle());
    if(!mapping||mapping.approved_at)
      throw new ApiError(400,"Add syllabus units before the owner approves the subject mapping");
    const termNumber=Number(body.termNumber);
    if(!Number.isInteger(termNumber)||termNumber<1||termNumber>3)
      throw new ApiError(400,"Specify which school term teaches this syllabus unit");
    result=await checked(db.from("school_curriculum_units").insert({
      school_id:school.id,class_id:classId,subject_id:subjectId,
      term_number:termNumber,
      unit_code:reportText(body.unitCode,30),
      unit_title:reportText(body.unitTitle,180,{min:3}),
      key_competence:reportText(body.competence,2000,{min:3}),
      learning_outcomes:typeof body.learningOutcomes==="string"?body.learningOutcomes.slice(0,3000):"",
      entered_by:actor.id
    }).select("id,unit_code").single());
  }else if(action==="curriculum.approve"){
    if(!actor.owner)throw new ApiError(403,"Only the school owner approves curriculum");
    requireAal2(token);
    result=await checked(db.rpc("school_approve_curriculum",{
      p_school:school.id,p_profile:reportId(body.profileId,"curriculum"),p_actor:actor.id
    }));
  }else if(action==="curriculum.subjectApprove"){
    if(!actor.owner)throw new ApiError(403,"Only the school owner approves syllabus allocations");
    requireAal2(token);
    result=await checked(db.rpc("school_approve_curriculum_subject",{
      p_school:school.id,p_class:reportId(body.classId,"class"),
      p_subject:reportId(body.subjectId,"subject"),p_actor:actor.id
    }));
  }else if(action==="term.create"){
    restricted(actor,"curriculum.manage");
    const yearId=reportId(body.yearId,"academic year");
    const year=await checked(db.from("school_academic_years")
      .select("id,starts_on,ends_on,status").eq("school_id",school.id)
      .eq("id",yearId).maybeSingle());
    if(!year||year.status!=="current")throw new ApiError(400,"Current academic year required");
    const termNumber=Number(body.termNumber);
    if(!Number.isInteger(termNumber)||termNumber<1||termNumber>3)
      throw new ApiError(400,"Choose Term 1, 2 or 3");
    const begins=reportDate(body.beginsOn),ends=reportDate(body.endsOn);
    dateBound(begins,ends,year);
    result=await checked(db.from("school_assessment_terms").insert({
      school_id:school.id,academic_year_id:yearId,term_number:termNumber,
      begins_on:begins,ends_on:ends,created_by:actor.id
    }).select("id,term_number").single());
  }else if(action==="mark.record"){
    if(!actor.teacher)throw new ApiError(403,"Only a verified assigned teacher may enter marks");
    const score=Number(body.score);
    const rawMaximum=Number(body.rawMaximum);
    if(!Number.isFinite(score)||!Number.isFinite(rawMaximum)
      ||score<0||rawMaximum<=0||rawMaximum>10000||score>rawMaximum
      ||Math.abs(Math.round(score*100)-score*100)>1e-6
      ||Math.abs(Math.round(rawMaximum*100)-rawMaximum*100)>1e-6)
      throw new ApiError(400,"Enter the score earned and actual paper maximum, with up to two decimals");
    const category=validateAssessmentCategory(body.category);
    const assessmentCode=category==="end_term"?"TERM":reportText(body.assessmentCode,30);
    const feedback=typeof body.feedback==="string"&&body.feedback.length<=1500?
      body.feedback:"";
    result=await checked(db.rpc("school_record_assessment",{
      p_school:school.id,p_term:reportId(body.termId,"term"),
      p_student:reportId(body.studentId,"student"),
      p_class:reportId(body.classId,"class"),
      p_subject:reportId(body.subjectId,"subject"),
      p_category:category,p_assessment_code:assessmentCode,
      p_raw_score:score,p_raw_maximum:rawMaximum,p_feedback:feedback,p_actor:actor.id
    }));
  }else if(action==="report.publish"){
    if(!actor.owner)throw new ApiError(403,"Only this school's owner can publish reports");
    requireAal2(token);
    const remark=typeof body.remark==="string"&&body.remark.length<=2000?body.remark:"";
    result=await checked(db.rpc("school_publish_term_report",{
      p_school:school.id,p_student:reportId(body.studentId,"student"),
      p_term:reportId(body.termId,"term"),p_remark:remark,p_actor:actor.id
    }));
  }else if(action==="report.withdraw"){
    if(!actor.owner)throw new ApiError(403,"Only the school owner can withdraw reports");
    requireAal2(token);
    const reason=reportText(body.reason,1000,{min:8});
    result=await checked(db.rpc("school_withdraw_term_report",{
      p_school:school.id,p_report:reportId(body.reportId,"report"),
      p_reason:reason,p_actor:actor.id
    }));
  }else if(action==="report.permissions"){
    if(!actor.owner)throw new ApiError(403,"Only the school owner can grant report access");
    requireAal2(token);
    const permissions=normalizeReportPermissions(body.permissions||[]);
    result=await checked(db.rpc("school_set_report_permissions",{
      p_school:school.id,p_target:reportId(body.userId,"administrator"),
      p_permissions:permissions,
      p_reason:reportText(body.reason,600,{min:8}),p_actor:actor.id
    }));
  }else throw new ApiError(400,"Unsupported report or curriculum action");
  return Response.json({ok:true,result},{headers});
 }catch(e){return jsonError(e)}
}
