import {randomBytes} from "node:crypto";
import {schoolAdminContext,requireSchoolOwner} from "../../../../../lib/school-admin.mjs";
import {ApiError,checked,requireAal2,jsonError} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"no-store","Pragma":"no-cache"};
const PLAN=Object.freeze([
 {key:"principal01",role:"school_admin",label:"Principal / Head Teacher",destination:"admin"},
 {key:"teacher02",role:"teacher",label:"Teacher 2 · P3 English",className:"P3 DEMO",subjectCode:"ENG",destination:"classroom"},
 {key:"teacher03",role:"teacher",label:"Teacher 3 · P5 Science",className:"P5 TEST",subjectCode:"SCI",destination:"classroom"},
 {key:"teacher04",role:"teacher",label:"Teacher 4 · P6 Social Studies",className:"P6 DEMO",subjectCode:"SST",destination:"classroom"},
 {key:"teacher05",role:"teacher",label:"Teacher 5 · P6 ICT",className:"P6 DEMO",subjectCode:"ICT",destination:"classroom"},
 {key:"staff01",role:"staff",label:"Secretary / Registrar",destination:"communications"},
 {key:"staff02",role:"staff",label:"Bursar / Finance",destination:"communications"},
 {key:"staff03",role:"staff",label:"Cook / Kitchen",destination:"communications"},
 {key:"staff04",role:"staff",label:"Security Guard",destination:"communications"},
 {key:"staff05",role:"staff",label:"Maintenance Technician",destination:"communications"},
 {key:"parent01",role:"parent",label:"Parent of three fictional children",destination:"family"},
 {key:"student01",role:"student",label:"Fictional P3 Student",destination:"learning"}
]);
async function trainingSchool(db,school,code){
 if(code!=="RW-SCH-000004")throw new ApiError(404,"Training accounts unavailable for this school.");
 const row=await checked(db.from("platform_schools").select("is_demo,name").eq("id",school.id).single());
 if(row?.is_demo!==true||row.name!=="Remezo Primary School")throw new ApiError(403,"This action is restricted to the fictional Remezo training school.");
}
const loginEmail=(key)=>"remezo."+key+"@school-example.test";
async function context(request,code){
 const ctx=await schoolAdminContext(request,code);
 requireSchoolOwner(ctx.actor);
 await trainingSchool(ctx.db,ctx.school,code);
 return ctx;
}
export async function GET(request,{params}){
 try{
  const {code}=await params;
  const {db,school}=await context(request,code);
  const memberships=await checked(db.from("school_memberships").select("auth_user_id,role,active").eq("school_id",school.id).eq("active",true));
  const users=await Promise.all(memberships.slice(0,100).map(async m=>{
   const {data,error}=await db.auth.admin.getUserById(m.auth_user_id);
   return !error&&data?.user?.email?.endsWith("@school-example.test")?{email:data.user.email,role:m.role}:null;
  }));
  const existing=new Set(users.filter(Boolean).map(u=>u.email));
  return Response.json({school:school.name,accounts:PLAN.map(p=>({...p,email:loginEmail(p.key),created:existing.has(loginEmail(p.key))}))},{headers:HEADERS});
 }catch(e){return jsonError(e);}
}
export async function POST(request,{params}){
 try{
  const {code}=await params;
  const ctx=await context(request,code);
  requireAal2(ctx.token);
  const {db,school,actor}=ctx;
  const body=await request.json().catch(()=>({}));
  const entry=PLAN.find(x=>x.key===body.key);
  if(!entry)throw new ApiError(400,"Choose one approved training account.");
  if(body.confirmTraining!==true)throw new ApiError(400,"Confirm this is a fictional training identity.");
  const email=loginEmail(entry.key);
  // Never reuse a real email or alter a previously created account's password.
  const {data:found,error:lookupError}=await db.auth.admin.listUsers({page:1,perPage:1000});
  if(lookupError)throw new ApiError(503,"Unable to check existing training accounts.");
  if(found.users.some(u=>u.email?.toLowerCase()===email))throw new ApiError(409,"This test account already exists. Reset through the approved school account recovery workflow.");
  const password=randomBytes(27).toString("base64url");
  const {data:created,error:createError}=await db.auth.admin.createUser({
    email,password,email_confirm:true,
    user_metadata:{training_identity:true,training_school_code:code,display_name:entry.label}
  });
  if(createError||!created?.user?.id)throw new ApiError(502,"Supabase could not create this training account. "+(createError?.code||""));
  const userId=created.user.id;
  // Once Supabase creates this user, all privilege grants are server-side and tenant-scoped.
  try{
   await checked(db.from("school_memberships").insert({school_id:school.id,auth_user_id:userId,role:entry.role,active:true}));
   if(entry.role==="school_admin"){
    await checked(db.from("school_admin_permissions").insert({
     school_id:school.id,auth_user_id:userId,role:"school_admin",
     permissions:["academics.read","academics.manage","people.read","audit.read"],updated_by:actor.id
    }));
   }
   if(entry.role==="teacher"){
    const cls=await checked(db.from("school_classes").select("id").eq("school_id",school.id).eq("name",entry.className).limit(1).single());
    const subject=await checked(db.from("school_subjects").select("id").eq("school_id",school.id).eq("code",entry.subjectCode).single());
    await checked(db.from("school_teacher_assignments").insert({
     school_id:school.id,teacher_id:userId,teacher_role:"teacher",class_id:cls.id,subject_id:subject.id,active:true,assigned_by:actor.id
    }));
   }
   if(entry.key==="parent01"){
    const children=await checked(db.from("school_students").select("id,student_code")
      .eq("school_id",school.id).in("student_code",["DEMO-D-STU-003","DEMO-D-STU-004","DEMO-D-STU-005"]));
    if(children.length!==3)throw new ApiError(409,"Three fictional learners are required before parent account provisioning.");
    await checked(db.from("school_guardian_links").insert(children.map(st=>({
     school_id:school.id,student_id:st.id,auth_user_id:userId,
     relationship:"parent",active:true,verified_by:actor.id
    }))));
   }
   if(entry.key==="student01"){
    const st=await checked(db.from("school_students").select("id").eq("school_id",school.id).eq("student_code","DEMO-D-STU-003").single());
    const guardians=await checked(db.from("school_guardian_links").select("auth_user_id").eq("school_id",school.id).eq("student_id",st.id).eq("active",true));
    if(!guardians.length)throw new ApiError(409,"Create the fictional parent account first; child access requires a linked guardian.");
    await checked(db.from("school_student_accounts").insert({school_id:school.id,student_id:st.id,auth_user_id:userId,active:true,authorized_by:actor.id}));
   }
   await checked(db.from("school_admin_audit").insert({
    school_id:school.id,actor_id:actor.id,event:"training.account_provisioned",
    metadata:{training:true,role:entry.role,key:entry.key,userId,syntheticEmail:true}
   }));
  }catch(e){
   // Only delete the user created by this request, never any existing account.
   // Existing FK rows may prevent deletion; report in that case for administrator repair.
   const {error:cleanupError}=await db.auth.admin.deleteUser(userId);
   if(cleanupError)console.error("training account creation needs manual cleanup",entry.key,cleanupError.code);
   throw e;
  }
  return Response.json({ok:true,email,password,role:entry.role,label:entry.label,
   loginPath:"/s/"+code+"/login",notice:"Copy these credentials now. Password is never stored in GitHub or returned again."},{headers:HEADERS});
 }catch(e){return jsonError(e);}
}
