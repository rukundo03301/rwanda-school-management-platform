import {clients,ApiError,validateUuid} from "./platform-server.js";

// Every request has verified Supabase Auth identity. Public role selection is
// never authorization. Only a bound, active school_owner membership can edit.
export async function schoolContext(request,code,{allowInvite=false}={}){
  if(!/^RW-SCH-\d{6,16}$/.test(String(code||"")))throw new ApiError(404,"School not found");
  const header=request.headers.get("authorization")||"";
  if(!header.startsWith("Bearer "))throw new ApiError(401,"Sign in to continue");
  const {authClient,db}=clients();
  const {data:{user},error:authError}=await authClient.auth.getUser(header.slice(7));
  if(authError||!user||!user.email||!user.email_confirmed_at)throw new ApiError(401,"Verify your email and sign in");
  const {data:school,error:schoolError}=await db.from("platform_schools").select(
    "id,school_code,name,status,company_id,owner_email,platform_companies(company_code,name)"
  ).eq("school_code",code).maybeSingle();
  if(schoolError||!school)throw new ApiError(404,"School not found");
  if(!["onboarding","active"].includes(school.status)){
    throw new ApiError(403,"This school is not currently available");
  }
  const {data:member,error:memberError}=await db.from("school_memberships").select(
    "role,active"
  ).eq("school_id",school.id).eq("auth_user_id",user.id).maybeSingle();
  if(memberError)throw new ApiError(503,"School membership access is unavailable");
  if(member?.active&&member.role==="school_owner")return {db,school,user,member};
  if(allowInvite){
    const {data:invite,error:inviteError}=await db.from("school_owner_invites")
      .select("status,claimed_by").eq("school_id",school.id)
      .eq("email",user.email.toLowerCase()).maybeSingle();
    if(inviteError)throw new ApiError(503,"Invitation verification unavailable");
    if(invite?.status==="pending"){
      return {db,school,user,member:null,invited:true};
    }
  }
  throw new ApiError(403,"Your account is not an approved owner of this school");
}

export function schoolText(value,max,{required=false}={}){
  if(typeof value!=="string"||value.length>max)throw new ApiError(400,"Invalid school field");
  const v=value.trim();
  if(required&&!v)throw new ApiError(400,"This field is required");
  return v;
}

export function schoolStep(value){
  const step=Number(value);
  if(!Number.isInteger(step)||step<1||step>5)throw new ApiError(400,"Invalid setup step");
  return step;
}
