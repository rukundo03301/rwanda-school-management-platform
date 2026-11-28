import {randomBytes} from "node:crypto";
import {schoolAdminContext,requireSchoolOwner} from "../../../../../lib/school-admin.mjs";
import {ApiError,checked,jsonError} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"no-store","Pragma":"no-cache"};
const ROLES=new Set(["teacher","staff","school_admin","parent"]);
const ADMIN_PERMS=["academics.read","academics.manage","people.read","audit.read"];
const MAX_PEOPLE=150;
const text=(v,max)=>String(v??"").trim().slice(0,max);
const emailOf=(v)=>text(v,254).toLowerCase();
/*
 * Owner-only school onboarding import for staff, teachers and guardians.
 * Accounts are created locked: a random password is generated and never returned,
 * and no message is sent. The person gets access through the normal password
 * recovery or invitation step once the school confirms a real email address.
 * Existing accounts are reused and never modified.
 */
export async function POST(request,{params}){
 try{
  const {code}=await params;
  const {db,school,actor}=await (async()=>{const c=await schoolAdminContext(request,code);requireSchoolOwner(c.actor);return c;})();
  const body=await request.json().catch(()=>({}));
  const people=Array.isArray(body.people)?body.people:[];
  if(!people.length||people.length>MAX_PEOPLE)throw new ApiError(400,"Send between 1 and "+MAX_PEOPLE+" people per import.");
  const classes=await checked(db.from("school_classes").select("id,name").eq("school_id",school.id));
  const subjects=await checked(db.from("school_subjects").select("id,code").eq("school_id",school.id));
  const students=await checked(db.from("school_students").select("id,first_name,last_name,date_of_birth").eq("school_id",school.id));
  const classByName=new Map(classes.map(c=>[c.name,c.id]));
  const subjectByCode=new Map(subjects.map(s=>[s.code,s.id]));
  const studentByKey=new Map();
  for(const s of students){
   const k=[s.first_name,s.last_name,s.date_of_birth].join("|").toLowerCase();
   studentByKey.set(k,studentByKey.has(k)?null:s.id);
  }
  const {data:found,error:listError}=await db.auth.admin.listUsers({page:1,perPage:1000});
  if(listError)throw new ApiError(503,"Unable to check existing accounts.");
  const userByEmail=new Map(found.users.map(u=>[u.email?.toLowerCase(),u.id]));
  const result={created:0,reused:0,memberships:0,assignments:0,guardianLinks:0,failures:[]};
  for(const p of people){
   const email=emailOf(p.email),name=text(p.name,120),role=text(p.role,30);
   try{
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw new ApiError(400,"Invalid email");
    if(!name)throw new ApiError(400,"Name required");
    if(!ROLES.has(role))throw new ApiError(400,"Unsupported role");
    let userId=userByEmail.get(email),made=false;
    if(!userId){
     const {data:created,error}=await db.auth.admin.createUser({
      email,password:randomBytes(27).toString("base64url"),email_confirm:true,
      user_metadata:{display_name:name,imported_by_school:school.school_code}
     });
     if(error||!created?.user?.id)throw new ApiError(502,"Account could not be created. "+(error?.code||""));
     userId=created.user.id;userByEmail.set(email,userId);made=true;
    }
    const memberships=await checked(db.from("school_memberships").select("role").eq("school_id",school.id).eq("auth_user_id",userId));
    if(!memberships.length){
     await checked(db.from("school_memberships").insert({school_id:school.id,auth_user_id:userId,role,active:true}));
     result.memberships++;
    }else if(memberships[0].role!==role)throw new ApiError(409,"Already a member with a different role");
    if(role==="school_admin"){
     const perms=await checked(db.from("school_admin_permissions").select("auth_user_id").eq("school_id",school.id).eq("auth_user_id",userId));
     if(!perms.length)await checked(db.from("school_admin_permissions").insert({school_id:school.id,auth_user_id:userId,role:"school_admin",permissions:ADMIN_PERMS,updated_by:actor.id}));
    }
    if(role==="teacher"){
     for(const a of Array.isArray(p.assignments)?p.assignments:[]){
      const classId=classByName.get(text(a.class,100)),subjectId=subjectByCode.get(text(a.subject,40));
      if(!classId||!subjectId)throw new ApiError(400,"Unknown class or subject in assignment");
      const have=await checked(db.from("school_teacher_assignments").select("teacher_id").eq("school_id",school.id).eq("teacher_id",userId).eq("class_id",classId).eq("subject_id",subjectId));
      if(!have.length){
       await checked(db.from("school_teacher_assignments").insert({school_id:school.id,teacher_id:userId,teacher_role:"teacher",class_id:classId,subject_id:subjectId,active:true,assigned_by:actor.id}));
       result.assignments++;
      }
     }
    }
    if(role==="parent"){
     for(const c of Array.isArray(p.children)?p.children:[]){
      const k=[text(c.first,100),text(c.last,100),text(c.dob,10)].join("|").toLowerCase();
      const sid=studentByKey.get(k);
      if(!sid)throw new ApiError(400,"Child not found or ambiguous: "+text(c.first,40));
      const have=await checked(db.from("school_guardian_links").select("student_id").eq("school_id",school.id).eq("student_id",sid).eq("auth_user_id",userId));
      if(!have.length){
       await checked(db.from("school_guardian_links").insert({school_id:school.id,student_id:sid,auth_user_id:userId,relationship:/guardian/i.test(text(p.relationship,30))?"legal_guardian":"parent",active:true,verified_by:actor.id}));
       result.guardianLinks++;
      }
     }
    }
    made?result.created++:result.reused++;
   }catch(e){result.failures.push({email,error:e?.message||"Failed"});}
  }
  await checked(db.from("school_admin_audit").insert({school_id:school.id,actor_id:actor.id,event:"people.imported",
   metadata:{people:people.length,created:result.created,reused:result.reused,failures:result.failures.length}}));
  return Response.json({ok:result.failures.length===0,...result,
   notice:"Accounts are locked. Each person signs in after a password reset or invitation to a confirmed email."},{headers:HEADERS});
 }catch(e){return jsonError(e);}
}
