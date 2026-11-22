import {schoolVerifiedContext} from "../../../../../lib/school-admin.mjs";
import {ApiError,checked,validateUuid,jsonError} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request,{params}){
 try{
  const {code}=await params;
  const {school,db,user}=await schoolVerifiedContext(request,code);
  const [studentInvites,guardianLinks]=await Promise.all([
   checked(db.from("school_student_portal_invitations")
    .select("student_id,status,expires_at,email")
    .eq("school_id",school.id).eq("email",user.email.toLowerCase())
    .eq("status","approved").gt("expires_at",new Date().toISOString()).limit(10)),
   checked(db.from("school_guardian_links")
    .select("student_id").eq("school_id",school.id)
    .eq("auth_user_id",user.id).eq("active",true).limit(50))
  ]);
  let awaitingGuardian=[];
  if(guardianLinks.length){
   const ids=guardianLinks.map(l=>l.student_id);
   awaitingGuardian=await checked(db.from("school_student_portal_invitations")
    .select("student_id,email,expires_at")
    .eq("school_id",school.id).in("student_id",ids)
    .eq("status","awaiting_guardian").gt("expires_at",new Date().toISOString()).limit(50));
  }
  return Response.json({
   approvedInvites:studentInvites.map(i=>({studentId:i.student_id,expiresAt:i.expires_at})),
   guardianApprovals:awaitingGuardian.map(i=>({studentId:i.student_id,
      studentEmail:i.email,expiresAt:i.expires_at}))
  },{headers:{"Cache-Control":"no-store"}});
 }catch(e){return jsonError(e);}
}
export async function POST(request,{params}){
 try{
  const {code}=await params;
  const {school,db,user}=await schoolVerifiedContext(request,code);
  const body=await request.json().catch(()=>({}));
  const id=validateUuid(body.studentId,"student");
  let result;
  if(body.action==="guardian.approve"){
    if(body.consent!==true)throw new ApiError(400,"Guardian consent is required to activate a minor's student account");
    const member=await checked(db.from("school_memberships").select("active")
      .eq("school_id",school.id).eq("auth_user_id",user.id)
      .eq("role","parent").eq("active",true).maybeSingle());
    if(!member)throw new ApiError(403,"Approved guardian access required");
    result=await checked(db.rpc("school_approve_student_account",{
      p_school:school.id,p_student:id,p_guardian:user.id
    }));
    const invitation=await checked(db.from("school_student_portal_invitations")
      .select("email").eq("school_id",school.id).eq("student_id",id)
      .eq("status","approved").maybeSingle());
    let mailStatus="not_sent";
    const base=String(process.env.APP_PUBLIC_URL||"").replace(/\/$/,"");
    if(invitation&&(/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base)||
        /^http:\/\/localhost(?::\d+)?$/.test(base))){
      const {error:mailError}=await db.auth.admin.inviteUserByEmail(invitation.email,{
        redirectTo:base+"/s/"+school.school_code+"/learning"
      });
      mailStatus=mailError?"provider_rejected_or_existing_account":"provider_accepted";
    }
    result={...result,mailStatus};
  }else if(body.action==="student.claim"){
    if(body.accepted!==true)throw new ApiError(400,"Accept your approved school invitation");
    result=await checked(db.rpc("school_claim_student_account",{
      p_school:school.id,p_student:id,p_user:user.id,
      p_email:user.email.toLowerCase()
    }));
  }else throw new ApiError(400,"Unsupported school account action");
  return Response.json({ok:true,result},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return jsonError(e);}
}
