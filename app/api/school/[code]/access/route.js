import {clients,ApiError,jsonError} from "../../../../../lib/platform-server.js";
import {validSchoolRole} from "../../../../../lib/school-roles.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request,{params}){
 try{
  const {code}=await params;
  if(!/^RW-SCH-\d{6,16}$/.test(code))throw new ApiError(404,"School not found");
  const raw=request.headers.get("authorization")||"";
  if(!raw.startsWith("Bearer "))throw new ApiError(401,"Sign in first");
  const {authClient,db}=clients();
  const [authResult,schoolResult]=await Promise.all([
    authClient.auth.getUser(raw.slice(7)),
    db.from("platform_schools").select("id,name,status,school_code").eq("school_code",code).maybeSingle()
  ]);
  const {data:{user},error:authError}=authResult;
  if(authError||!user||!user.email_confirmed_at)throw new ApiError(401,"Verify your identity and email before continuing");
  const {data:school,error:schoolError}=schoolResult;
  if(schoolError||!school)throw new ApiError(404,"School not found");
  if(!["onboarding","active"].includes(school.status))throw new ApiError(403,"This school is currently unavailable");

  const {data:memberships,error:memberError}=await db.from("school_memberships")
    .select("role,active").eq("school_id",school.id)
    .eq("auth_user_id",user.id).eq("active",true);
  if(memberError)throw new ApiError(503,"School membership is unavailable");
  const roles=(memberships||[]).map(m=>m.role).filter(validSchoolRole)
    .filter(role=>school.status==="active"||role==="school_owner");

  let ownerInvitePending=false;
  if(!roles.includes("school_owner")){
    const {data:invitation}=await db.from("school_owner_invites")
      .select("status").eq("school_id",school.id)
      .eq("email",user.email.toLowerCase()).maybeSingle();
    ownerInvitePending=invitation?.status==="pending";
  }
  // The levels the school offers decide which level-specific modules a member sees.
  let levels=[];
  if(roles.length){
    const {data:setup}=await db.from("school_onboarding").select("education_levels").eq("school_id",school.id).maybeSingle();
    levels=Array.isArray(setup?.education_levels)?setup.education_levels:[];
  }
  // No tenant data, student data, teacher assignments or finance is returned
  // to anyone without an authorized school-scoped membership.
  return Response.json({
    school:{name:school.name,school_code:school.school_code,status:school.status},
    roles,levels,ownerInvitePending,authEmail:user.email
  },{headers:{"Cache-Control":"no-store"}});
 }catch(e){return jsonError(e)}
}
