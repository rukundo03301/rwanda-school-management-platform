import {randomInt} from "node:crypto";
import {schoolAdminContext,requireSchoolOwner} from "../../../../../lib/school-admin.mjs";
import {ApiError,checked,jsonError,requireAal2,validateUuid} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"no-store","Pragma":"no-cache"};

// The school owner can issue a new first password for staff, teacher and parent
// accounts that the SCHOOL created (addresses that cannot receive email).
// A person who signs in with their own real email address is never reset here:
// that account may also belong to other schools, so they use the emailed
// "Forgot password" link instead.
const SCHOOL_ISSUED=/@(school-example\.test|students\.school-example\.test)$/i;
const ROLES=["school_admin","teacher","staff","parent"];
const ALPHABET="abcdefghjkmnpqrstuvwxyz23456789";
function temporaryPassword(){
  let out="";
  for(let i=0;i<10;i++)out+=ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
async function context(request,code){
  const ctx=await schoolAdminContext(request,code);
  requireSchoolOwner(ctx.actor);
  return ctx;
}
async function members(db,school){
  const rows=await checked(db.from("school_memberships").select("auth_user_id,role")
    .eq("school_id",school.id).eq("active",true).in("role",ROLES).limit(500));
  const owners=await checked(db.from("school_memberships").select("auth_user_id")
    .eq("school_id",school.id).eq("role","school_owner").limit(20));
  const ownerIds=new Set(owners.map(o=>o.auth_user_id));
  const byUser=new Map();
  for(const r of rows){
    if(ownerIds.has(r.auth_user_id))continue;
    byUser.set(r.auth_user_id,[...(byUser.get(r.auth_user_id)||[]),r.role]);
  }
  return byUser;
}
export async function GET(request,{params}){
  try{
    const {code}=await params;
    const {db,school}=await context(request,code);
    const byUser=await members(db,school);
    const list=await Promise.all([...byUser.entries()].slice(0,200).map(async([userId,roles])=>{
      const {data}=await db.auth.admin.getUserById(userId);
      const email=data?.user?.email||"";
      return {userId,roles,login:email,name:data?.user?.user_metadata?.display_name||"",schoolIssued:SCHOOL_ISSUED.test(email)};
    }));
    list.sort((a,b)=>a.login.localeCompare(b.login));
    return Response.json({school:school.name,members:list},{headers:HEADERS});
  }catch(e){return jsonError(e);}
}
export async function POST(request,{params}){
  try{
    const {code}=await params;
    const {db,school,actor,token}=await context(request,code);
    requireAal2(token);
    const body=await request.json().catch(()=>({}));
    if(body.action!=="reset")throw new ApiError(400,"Unsupported account action");
    const userId=validateUuid(body.userId,"account");
    if(userId===actor.id)throw new ApiError(400,"Use Change my password for your own account");
    const byUser=await members(db,school);
    if(!byUser.has(userId))throw new ApiError(404,"This account is not an active member of your school");
    const {data:found}=await db.auth.admin.getUserById(userId);
    const email=found?.user?.email||"";
    if(!SCHOOL_ISSUED.test(email))
      throw new ApiError(409,"This person signs in with their own email address. They can use Forgot password on the sign-in page.");
    const password=temporaryPassword();
    const {error}=await db.auth.admin.updateUserById(userId,{password,
      user_metadata:{...(found.user.user_metadata||{}),must_change_password:true}});
    if(error)throw new ApiError(502,"The password could not be reset. "+(error.code||""));
    await checked(db.from("school_admin_audit").insert({school_id:school.id,actor_id:actor.id,
      event:"member.password_reset",metadata:{userId,roles:byUser.get(userId)}}));
    return Response.json({ok:true,login:email,roles:byUser.get(userId),temporaryPassword:password},{headers:HEADERS});
  }catch(e){return jsonError(e);}
}
