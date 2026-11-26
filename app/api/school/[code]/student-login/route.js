import {randomInt} from "node:crypto";
import {schoolAdminContext,schoolAdminCan} from "../../../../../lib/school-admin.mjs";
import {ApiError,checked,jsonError,validateUuid} from "../../../../../lib/platform-server.js";
import {studentLoginEmail,STUDENT_LOGIN_DOMAIN} from "../../../../../lib/school-roles.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"no-store","Pragma":"no-cache"};

// The school issues each Student ID and its first password. A student signs in
// with the Student ID as a username and must choose a new password afterwards.
// No email inbox and no authenticator app are needed for a student.
const ALPHABET="abcdefghjkmnpqrstuvwxyz23456789";
function temporaryPassword(){
  let out="";
  for(let i=0;i<10;i++)out+=ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
async function context(request,code){
  const ctx=await schoolAdminContext(request,code);
  if(!schoolAdminCan(ctx.actor,"people.manage"))
    throw new ApiError(403,"Only the school owner or an approved administrator can manage student logins");
  return ctx;
}
export async function GET(request,{params}){
  try{
    const {code}=await params;
    const {db,school}=await context(request,code);
    const [students,accounts]=await Promise.all([
      checked(db.from("school_students").select("id,student_code,first_name,last_name")
        .eq("school_id",school.id).eq("status","active").order("student_code").limit(1000)),
      checked(db.from("school_student_accounts").select("student_id,active")
        .eq("school_id",school.id).limit(1000))
    ]);
    const byStudent=new Map(accounts.map(a=>[a.student_id,a]));
    return Response.json({school:school.name,students:students.map(s=>({
      id:s.id,studentId:s.student_code,name:s.first_name+" "+s.last_name,
      hasLogin:byStudent.has(s.id),active:byStudent.get(s.id)?.active===true
    }))},{headers:HEADERS});
  }catch(e){return jsonError(e);}
}
export async function POST(request,{params}){
  try{
    const {code}=await params;
    const {db,school,actor,token}=await context(request,code);

    
    const body=await request.json().catch(()=>({}));
    const action=String(body.action||"");
    if(!["create","reset"].includes(action))throw new ApiError(400,"Unsupported student login action");
    const studentId=validateUuid(body.studentId,"student");
    const student=await checked(db.from("school_students").select("id,student_code,first_name,last_name,status")
      .eq("school_id",school.id).eq("id",studentId).maybeSingle());
    if(!student||student.status!=="active")throw new ApiError(404,"Student not found in this school");
    const account=await checked(db.from("school_student_accounts").select("auth_user_id,active")
      .eq("school_id",school.id).eq("student_id",studentId).maybeSingle());
    const password=temporaryPassword();
    if(action==="create"){
      if(account)throw new ApiError(409,"This student already has a login. Use Reset password instead.");
      const email=studentLoginEmail(school.school_code,student.student_code);
      const {data:created,error}=await db.auth.admin.createUser({email,password,email_confirm:true,
        user_metadata:{student_login:true,school_code:school.school_code,must_change_password:true}});
      if(error||!created?.user?.id)throw new ApiError(502,"The student login could not be created. "+(error?.code||""));
      const userId=created.user.id;
      try{
        await checked(db.from("school_memberships").insert({school_id:school.id,auth_user_id:userId,role:"student",active:true}));
        await checked(db.from("school_student_accounts").insert({
          school_id:school.id,student_id:studentId,auth_user_id:userId,active:true,authorized_by:actor.id}));
      }catch(e){
        // Undo only what this request created.
        await db.from("school_memberships").delete().eq("school_id",school.id).eq("auth_user_id",userId);
        await db.auth.admin.deleteUser(userId);
        throw e;
      }
    }else{
      if(!account||account.active!==true)throw new ApiError(404,"This student has no active login yet");
      const {data:found}=await db.auth.admin.getUserById(account.auth_user_id);
      if(!found?.user?.email?.endsWith("@"+STUDENT_LOGIN_DOMAIN))
        throw new ApiError(409,"This student signs in with an email address. Use the email password reset instead.");
      const {error}=await db.auth.admin.updateUserById(account.auth_user_id,{password,
        user_metadata:{...(found.user.user_metadata||{}),must_change_password:true}});
      if(error)throw new ApiError(502,"The password could not be reset. "+(error.code||""));
    }
    await checked(db.from("school_admin_audit").insert({school_id:school.id,actor_id:actor.id,
      event:action==="create"?"student.login_created":"student.password_reset",metadata:{studentId}}));
    return Response.json({ok:true,studentId:student.student_code,
      name:student.first_name+" "+student.last_name,temporaryPassword:password},{headers:HEADERS});
  }catch(e){return jsonError(e);}
}
