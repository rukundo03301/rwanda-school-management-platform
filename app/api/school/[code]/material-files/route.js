import {classroomContext,requiredSchoolId,teacherAssignmentAllowed} from "../../../../../lib/school-classroom.mjs";
import {schoolVerifiedContext} from "../../../../../lib/school-admin.mjs";
import {ApiError,checked,jsonError} from "../../../../../lib/platform-server.js";
import {materialFileInput,sniffMatches,MAX_FILE_BYTES} from "../../../../../lib/material-files.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store"};
const BUCKET="school-materials";
const COLS="id,class_id,subject_id,title,description,file_name,mime_type,size_bytes,published,created_at";
const audit=(db,school,actor,event,id)=>checked(db.from("school_classroom_audit").insert({school_id:school.id,actor_id:actor,event,resource_id:id}));

async function studentContext(db,school,user){
 const member=await checked(db.from("school_memberships").select("active").eq("school_id",school.id).eq("auth_user_id",user.id).eq("role","student").maybeSingle());
 if(!member?.active)return null;
 const account=await checked(db.from("school_student_accounts").select("student_id").eq("school_id",school.id).eq("auth_user_id",user.id).eq("active",true).maybeSingle());
 if(!account)return null;
 const year=await checked(db.from("school_academic_years").select("id").eq("school_id",school.id).eq("status","current").maybeSingle());
 if(!year)return null;
 const enrol=await checked(db.from("school_student_enrollments").select("class_id").eq("school_id",school.id).eq("student_id",account.student_id).eq("academic_year_id",year.id).eq("status","active").maybeSingle());
 return enrol?{studentId:account.student_id,classId:enrol.class_id}:null;
}
async function ownFile(db,school,actorId,id){
 const f=await checked(db.from("school_material_files").select("*").eq("school_id",school.id).eq("id",id).maybeSingle());
 if(!f||f.teacher_id!==actorId)throw new ApiError(404,"File not found");
 return f;
}

export async function GET(request,{params}){
 try{
  const {code}=await params;
  const url=new URL(request.url);
  const scope=url.searchParams.get("scope");
  const download=url.searchParams.get("download");
  const base=await schoolVerifiedContext(request,code);
  const {db,school,user}=base;
  if(download){
   const id=requiredSchoolId(download,"file");
   const f=await checked(db.from("school_material_files").select("*").eq("school_id",school.id).eq("id",id).eq("status","ready").maybeSingle());
   if(!f)throw new ApiError(404,"File not found");
   let allowed=f.teacher_id===user.id;
   if(!allowed){
    const st=await studentContext(db,school,user);
    allowed=Boolean(st&&st.classId===f.class_id&&f.published);
   }
   if(!allowed)throw new ApiError(404,"File not found");
   const signed=await db.storage.from(BUCKET).createSignedUrl(f.storage_path,120,{download:false});
   if(signed.error||!signed.data?.signedUrl)throw new ApiError(500,"The file could not be opened right now");
   return Response.json({url:signed.data.signedUrl,fileName:f.file_name,mimeType:f.mime_type},{headers:noStore});
  }
  if(scope==="student"){
   const st=await studentContext(db,school,user);
   if(!st)throw new ApiError(403,"Student access is not approved");
   const files=await checked(db.from("school_material_files").select(COLS).eq("school_id",school.id).eq("class_id",st.classId).eq("published",true).eq("status","ready").order("created_at",{ascending:false}).limit(200));
   return Response.json({files},{headers:noStore});
  }
  const ctx=await classroomContext(request,code);
  if(!ctx.role.teacher)throw new ApiError(403,"A verified assigned teacher is required");
  const files=await checked(db.from("school_material_files").select(COLS).eq("school_id",school.id).eq("teacher_id",ctx.actorId).eq("status","ready").order("created_at",{ascending:false}).limit(300));
  return Response.json({files},{headers:noStore});
 }catch(e){return jsonError(e);}
}

export async function POST(request,{params}){
 try{
  const {code}=await params;
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||"");
  const ctx=await classroomContext(request,code);
  if(!ctx.role.teacher)throw new ApiError(403,"A verified assigned teacher is required");
  const {db,school,actorId}=ctx;
  let result;
  if(action==="file.init"){
   const classId=requiredSchoolId(body.classId,"class"),subjectId=requiredSchoolId(body.subjectId,"subject");
   const mine=await checked(db.from("school_teacher_assignments").select("class_id,subject_id,active").eq("school_id",school.id).eq("teacher_id",actorId).eq("active",true).limit(700));
   if(!teacherAssignmentAllowed(mine,classId,subjectId))throw new ApiError(403,"You are not assigned to teach this subject in this class");
   const {ext,...input}=materialFileInput(body);
   const path=school.id+"/"+classId+"/"+crypto.randomUUID()+"."+ext;
   const ins=await db.from("school_material_files").insert({school_id:school.id,class_id:classId,subject_id:subjectId,teacher_id:actorId,...input,storage_path:path,status:"pending",published:false}).select("id").single();
   if(ins.error)throw new ApiError(400,"The upload could not be started");
   const up=await db.storage.from(BUCKET).createSignedUploadUrl(path);
   if(up.error||!up.data?.token){
    await db.from("school_material_files").delete().eq("school_id",school.id).eq("id",ins.data.id);
    throw new ApiError(500,"File storage is not ready");
   }
   result={id:ins.data.id,path,token:up.data.token};
  }else if(action==="file.finish"){
   const f=await ownFile(db,school,actorId,requiredSchoolId(body.fileId,"file"));
   if(f.status!=="pending")throw new ApiError(409,"This file is already saved");
   const dl=await db.storage.from(BUCKET).download(f.storage_path);
   const fail=async(msg)=>{await db.storage.from(BUCKET).remove([f.storage_path]);await db.from("school_material_files").delete().eq("school_id",school.id).eq("id",f.id);throw new ApiError(400,msg);};
   if(dl.error||!dl.data)return fail("The file did not finish uploading. Please try again.");
   const bytes=Buffer.from(await dl.data.arrayBuffer());
   const ext=f.storage_path.split(".").pop();
   if(!bytes.length||bytes.length>MAX_FILE_BYTES)return fail("Files must be 1 byte to 10 MB");
   if(!sniffMatches(ext,bytes))return fail("The file contents do not match its type");
   const upd=await db.from("school_material_files").update({status:"ready",size_bytes:bytes.length,updated_at:new Date().toISOString()}).eq("school_id",school.id).eq("id",f.id);
   if(upd.error)throw new ApiError(400,"The file could not be saved");
   await audit(db,school,actorId,"material_file.added",f.id);
   result={id:f.id};
  }else if(action==="file.toggle"){
   const f=await ownFile(db,school,actorId,requiredSchoolId(body.fileId,"file"));
   if(f.status!=="ready")throw new ApiError(409,"The file is not ready");
   const publish=body.published===true;
   if(publish){
    const mine=await checked(db.from("school_teacher_assignments").select("class_id,subject_id,active").eq("school_id",school.id).eq("teacher_id",actorId).eq("active",true).limit(700));
    if(!teacherAssignmentAllowed(mine,f.class_id,f.subject_id))throw new ApiError(403,"You are no longer assigned to this class and subject");
   }
   const upd=await db.from("school_material_files").update({published:publish,updated_at:new Date().toISOString()}).eq("school_id",school.id).eq("id",f.id);
   if(upd.error)throw new ApiError(400,"The file could not be updated");
   await audit(db,school,actorId,publish?"material_file.published":"material_file.hidden",f.id);
   result={id:f.id,published:publish};
  }else if(action==="file.delete"){
   const f=await ownFile(db,school,actorId,requiredSchoolId(body.fileId,"file"));
   await db.storage.from(BUCKET).remove([f.storage_path]);
   const del=await db.from("school_material_files").delete().eq("school_id",school.id).eq("id",f.id);
   if(del.error)throw new ApiError(400,"The file could not be deleted");
   await audit(db,school,actorId,"material_file.deleted",f.id);
   result={id:f.id,deleted:true};
  }else throw new ApiError(400,"Unknown action");
  return Response.json({ok:true,result},{headers:noStore});
 }catch(e){return jsonError(e);}
}
