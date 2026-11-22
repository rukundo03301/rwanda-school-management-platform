import {schoolVerifiedContext} from "../../../../../lib/school-admin.mjs";
import {ApiError,checked,jsonError} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request,{params}){
 try{
  const {code}=await params;
  const {db,user,school}=await schoolVerifiedContext(request,code);
  const records=await checked(db.from("school_role_invites")
    .select("role,status,expires_at,created_at")
    .eq("school_id",school.id).eq("email",user.email.trim().toLowerCase())
    .eq("status","pending").gt("expires_at",new Date().toISOString()));
  return Response.json({roles:records.map(r=>r.role),invites:records},{
    headers:{"Cache-Control":"no-store"}
  });
 }catch(e){return jsonError(e)}
}
export async function POST(request,{params}){
 try{
  const {code}=await params;
  const {db,user,school}=await schoolVerifiedContext(request,code);
  const body=await request.json().catch(()=>({}));
  if(body.action!=="claim")throw new ApiError(400,"Unsupported invitation action");
  const role=String(body.role||"");
  if(!["school_admin","teacher","staff"].includes(role))
    throw new ApiError(400,"Unsupported role invitation");
  const result=await checked(db.rpc("school_claim_member_invite",{
    p_school_id:school.id,p_auth_user_id:user.id,
    p_verified_email:user.email.trim().toLowerCase(),p_role:role
  }));
  return Response.json({ok:true,result},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return jsonError(e)}
}
