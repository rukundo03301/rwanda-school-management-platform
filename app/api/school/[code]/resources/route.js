import {schoolVerifiedContext} from "../../../../../lib/school-admin.mjs";
import {ApiError,checked,jsonError} from "../../../../../lib/platform-server.js";
import material from "../../../../../demo/remezo-primary-learning-resources.json";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request,{params}){
 try{
  const {code}=await params;
  if(code!=="RW-SCH-000004")throw new ApiError(404,"Learning library is not configured for this school.");
  const {db,school,user}=await schoolVerifiedContext(request,code);
  const schoolRecord=await checked(db.from("platform_schools").select("is_demo").eq("id",school.id).single());
  if(schoolRecord.is_demo!==true)throw new ApiError(403,"This training library is available only to the training school.");
  const membership=await checked(db.from("school_memberships").select("role")
    .eq("school_id",school.id).eq("auth_user_id",user.id).eq("active",true).limit(10));
  if(!membership.length)throw new ApiError(403,"You are not an approved member of this school.");
  return Response.json({school:school.name,roles:membership.map(m=>m.role),items:material.items,trainingOnly:true},
   {headers:{"Cache-Control":"no-store"}});
 }catch(e){return jsonError(e);}
}
