import {
 admissionsContext,requireAdmissions,admissionCan,normalizeAdmissionsPermissions,
 validName,validBirthDate
} from "../../../../../lib/school-admissions.mjs";
import {ApiError,checked,jsonError,requireAal2,validateUuid} from "../../../../../lib/platform-server.js";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store"};
const permittedDecisions=["under_review","admit","reject"];

export async function GET(request,{params}){
 try{
  const {code}=await params;
  const {db,school,actor}=await admissionsContext(request,code);
  const result={
    school:{name:school.name,code:school.school_code},
    actor,
    applications:[],students:[],enrollments:[],
    years:[],classes:[],guardianInvites:[],guardianLinks:[],adminGrants:[]
  };
  if(admissionCan(actor,"admissions.read")){
    [result.applications,result.students,result.enrollments,result.years,result.classes]=await Promise.all([
      checked(db.from("school_admission_applications").select(
        "id,application_code,first_name,last_name,date_of_birth,academic_year_id,status,submitted_at,reviewed_at"
      ).eq("school_id",school.id).order("submitted_at",{ascending:false}).limit(250)),
      checked(db.from("school_students").select(
        "id,student_code,first_name,last_name,date_of_birth,status,created_at"
      ).eq("school_id",school.id).order("student_code",{ascending:false}).limit(250)),
      checked(db.from("school_student_enrollments").select(
        "id,student_id,academic_year_id,class_id,status,enrolled_at"
      ).eq("school_id",school.id).order("enrolled_at",{ascending:false}).limit(250)),
      checked(db.from("school_academic_years").select(
        "id,name,status,starts_on,ends_on"
      ).eq("school_id",school.id).order("starts_on",{ascending:false}).limit(100)),
      checked(db.from("school_classes").select(
        "id,academic_year_id,name,level,section,capacity,status"
      ).eq("school_id",school.id).order("name",{ascending:true}).limit(250))
    ]);
  }
  if(admissionCan(actor,"guardians.manage")){
    [result.guardianInvites,result.guardianLinks]=await Promise.all([
      checked(db.from("school_guardian_invitations")
        .select("id,student_id,email,relationship,status,expires_at,claimed_by,claimed_at")
        .eq("school_id",school.id).order("invited_at",{ascending:false}).limit(250)),
      checked(db.from("school_guardian_links")
        .select("student_id,auth_user_id,relationship,active,verified_at")
        .eq("school_id",school.id).order("verified_at",{ascending:false}).limit(250))
    ]);
  }
  if(actor.isOwner){
    const [admins,grants]=await Promise.all([
      checked(db.from("school_memberships").select("auth_user_id,role,active")
        .eq("school_id",school.id).eq("role","school_admin").eq("active",true).limit(250)),
      checked(db.from("school_admissions_permissions").select("auth_user_id,permissions")
        .eq("school_id",school.id).limit(250))
    ]);
    const grantMap=new Map(grants.map(g=>[g.auth_user_id,g.permissions]));
    result.adminGrants=admins.map(a=>({userId:a.auth_user_id,
      permissions:grantMap.get(a.auth_user_id)||[]}));
  }
  return Response.json(result,{headers:noStore});
 }catch(e){return jsonError(e);}
}

export async function POST(request,{params}){
 try{
  const {code}=await params;
  const {db,school,actor,token}=await admissionsContext(request,code);
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||"");
  let result;
  if(action==="application.submit"){
    requireAdmissions(actor,"admissions.manage");
    const first=validName(body.firstName),last=validName(body.lastName);
    const dob=validBirthDate(body.dateOfBirth);
    const yearId=validateUuid(body.yearId,"academic year");
    result=await checked(db.rpc("school_submit_admission",{
      p_school_id:school.id,p_first:first,p_last:last,
      p_dob:dob,p_year_id:yearId,p_actor:actor.id
    }));
  }else if(action==="application.review"){
    requireAdmissions(actor,"admissions.manage");
    const decision=String(body.decision||"");
    if(!permittedDecisions.includes(decision))throw new ApiError(400,"Invalid application decision");
    if(decision==="admit")requireAdmissions(actor,"enrollments.manage");
    if(decision==="admit")requireAal2(token);
    const appId=validateUuid(body.applicationId,"application");
    const classId=decision==="admit"?validateUuid(body.classId,"class"):null;
    result=await checked(db.rpc("school_review_admission",{
      p_school_id:school.id,p_application_id:appId,p_class_id:classId,
      p_decision:decision,p_actor:actor.id
    }));
  }else if(action==="guardian.invite"){
    requireAdmissions(actor,"guardians.manage");requireAal2(token);
    const studentId=validateUuid(body.studentId,"student");
    const email=String(body.email||"").trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)
      throw new ApiError(400,"Enter a valid guardian email");
    const relation=String(body.relationship||"");
    if(!["parent","legal_guardian"].includes(relation))
      throw new ApiError(400,"Choose a verified family relationship");
    if(body.verificationAttested!==true)
      throw new ApiError(400,"Confirm that the school verified this guardian's relationship offline");
    result=await checked(db.rpc("school_invite_guardian",{
      p_school_id:school.id,p_student_id:studentId,p_email:email,
      p_relationship:relation,p_attested:true,p_actor:actor.id
    }));
    let mailStatus="not_sent";
    const base=String(process.env.APP_PUBLIC_URL||"").replace(/\/$/,"");
    if(/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base)||
       /^http:\/\/localhost(?::\d+)?$/.test(base)){
      const {error}=await db.auth.admin.inviteUserByEmail(email,{
        redirectTo:base+"/s/"+school.school_code+"/login?role=parent"
      });
      mailStatus=error?"provider_rejected_or_existing_account":"provider_accepted";
    }
    result={...result,mailStatus,
      parentLoginPath:"/s/"+school.school_code+"/login?role=parent"};
  }else if(action==="guardian.revoke"){
    requireAdmissions(actor,"guardians.manage");requireAal2(token);
    const studentId=validateUuid(body.studentId,"student");
    const guardianUserId=validateUuid(body.userId,"guardian user");
    const reason=String(body.reason||"").trim();
    if(reason.length<8||reason.length>500)throw new ApiError(400,"Enter a reason between 8 and 500 characters");
    result=await checked(db.rpc("school_revoke_guardian",{
      p_school_id:school.id,p_student_id:studentId,
      p_guardian_user_id:guardianUserId,p_reason:reason,p_actor:actor.id
    }));
  }else if(action==="admissions.permissions"){
    if(!actor.isOwner)throw new ApiError(403,"Only the school owner can edit admissions access");
    requireAal2(token);
    const userId=validateUuid(body.userId,"administrator");
    const permissions=normalizeAdmissionsPermissions(body.permissions||[]);
    const reason=String(body.reason||"").trim();
    if(reason.length<8||reason.length>500)
      throw new ApiError(400,"Explain the permission change in 8–500 characters");
    result=await checked(db.rpc("school_set_admissions_permissions",{
      p_school_id:school.id,p_target:userId,
      p_permissions:permissions,p_reason:reason,p_actor:actor.id
    }));
  }else{
    throw new ApiError(400,"Unsupported admissions action");
  }
  return Response.json({ok:true,result},{headers:noStore});
 }catch(e){return jsonError(e);}
}
