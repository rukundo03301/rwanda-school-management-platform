import {schoolVerifiedContext} from "../../../../../lib/school-admin.mjs";
import {ApiError,checked,jsonError,validateUuid} from "../../../../../lib/platform-server.js";
import {cleanContent,missingForSubmit} from "../../../../../lib/report-templates.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
const PERMS=["reports.review","reports.approve","reports.publish"];

// Term reports for every level: teachers draft for the classes they teach; the people the owner
// chooses review, approve and publish. Every rule is enforced again inside the database functions.
async function context(request,code){
 const base=await schoolVerifiedContext(request,code);
 const {db,school,user}=base;
 const rows=await checked(db.from("school_memberships").select("role").eq("school_id",school.id)
  .eq("auth_user_id",user.id).eq("active",true).in("role",["school_owner","school_admin","teacher","staff"]));
 const roles=rows.map(r=>r.role);
 if(!roles.length)throw new ApiError(403,"Term reports are for school staff.");
 const owner=roles.includes("school_owner");
 const granted=owner?PERMS:((await checked(db.from("school_report_roles").select("permissions").eq("school_id",school.id)
  .eq("auth_user_id",user.id).maybeSingle()))?.permissions||[]);
 const assignments=await checked(db.from("school_teacher_assignments").select("class_id").eq("school_id",school.id)
  .eq("teacher_id",user.id).eq("active",true).limit(500));
 const teachClasses=[...new Set(assignments.map(a=>a.class_id))];
 if(!teachClasses.length&&!granted.length)throw new ApiError(403,"You do not teach a class and have not been given report permissions.");
 return {...base,owner,perms:granted,teachClasses};
}
const nameOf=s=>s?(s.first_name+" "+s.last_name):"";

export async function GET(request,{params}){
 try{
  const {code}=await params;
  const ctx=await context(request,code);
  const {db,school,owner,perms,teachClasses}=ctx;
  const url=new URL(request.url);
  const year=await checked(db.from("school_academic_years").select("id,name").eq("school_id",school.id).eq("status","current").maybeSingle());
  const allClasses=await checked(db.from("school_classes").select("id,name,section,level_band,academic_year_id").eq("school_id",school.id)
   .eq("status","active").limit(500));
  const classes=allClasses.filter(c=>c.academic_year_id===year?.id&&(teachClasses.includes(c.id)));
  const out={me:{owner,perms,teacher:teachClasses.length>0},year,classes:classes.map(c=>({id:c.id,name:c.name+(c.section?" "+c.section:""),level:c.level_band}))};
  const term=Number(url.searchParams.get("term")||1);
  const classId=url.searchParams.get("classId");
  if(classId&&year){
   const cid=validateUuid(classId,"class");
   if(!teachClasses.includes(cid))throw new ApiError(403,"You can only draft reports for classes you teach.");
   const cls=allClasses.find(c=>c.id===cid);
   const [enr,subjects,reports]=await Promise.all([
    checked(db.from("school_student_enrollments").select("student_id").eq("school_id",school.id).eq("class_id",cid)
     .eq("academic_year_id",year.id).eq("status","active").limit(200)),
    checked(db.from("school_class_subjects").select("subject_id").eq("school_id",school.id).eq("class_id",cid).limit(50)),
    checked(db.from("school_term_reports").select("id,student_id,status,content,teacher_comment,reviewer_comment,headteacher_comment,return_reason,template")
     .eq("school_id",school.id).eq("class_id",cid).eq("academic_year_id",year.id).eq("term_number",term).limit(200))
   ]);
   const ids=enr.map(e=>e.student_id);
   const students=ids.length?await checked(db.from("school_students").select("id,first_name,last_name,student_code").eq("school_id",school.id).in("id",ids)):[];
   const subjectRows=subjects.length?await checked(db.from("school_subjects").select("id,name").eq("school_id",school.id).in("id",subjects.map(s=>s.subject_id))):[];
   const byStudent=new Map(reports.map(r=>[r.student_id,r]));
   out.classView={id:cid,level:cls?.level_band,term,subjects:subjectRows.map(s=>s.name).sort(),
    students:students.sort((a,b)=>nameOf(a).localeCompare(nameOf(b))).map(s=>({id:s.id,name:nameOf(s),code:s.student_code,report:byStudent.get(s.id)||null}))};
  }
  if(perms.length&&year){
   const queue=await checked(db.from("school_term_reports").select("id,student_id,class_id,term_number,template,status,content,teacher_comment,reviewer_comment,headteacher_comment,return_reason,drafted_by,updated_at")
    .eq("school_id",school.id).eq("academic_year_id",year.id).in("status",["submitted","reviewed","approved","published","returned"])
    .order("updated_at",{ascending:false}).limit(500));
   const sids=[...new Set(queue.map(q=>q.student_id))];
   const students=sids.length?await checked(db.from("school_students").select("id,first_name,last_name").eq("school_id",school.id).in("id",sids)):[];
   const sm=new Map(students.map(s=>[s.id,nameOf(s)])),cm=new Map(allClasses.map(c=>[c.id,c.name+(c.section?" "+c.section:"")]));
   out.queue=queue.map(q=>({...q,student:sm.get(q.student_id)||"",className:cm.get(q.class_id)||""}));
  }
  if(owner){
   const members=await checked(db.from("school_memberships").select("auth_user_id,role").eq("school_id",school.id).eq("active",true)
    .in("role",["school_admin","teacher","staff"]).limit(300));
   const roleRows=await checked(db.from("school_report_roles").select("auth_user_id,permissions").eq("school_id",school.id).limit(300));
   const pm=new Map(roleRows.map(r=>[r.auth_user_id,r.permissions]));
   const uniq=[...new Map(members.map(m=>[m.auth_user_id,m])).values()];
   out.members=await Promise.all(uniq.map(async m=>{
    const {data}=await db.auth.admin.getUserById(m.auth_user_id);
    const meta=data?.user?.user_metadata||{};
    return {id:m.auth_user_id,role:m.role,email:data?.user?.email||"",name:meta.display_name||meta.full_name||"",permissions:pm.get(m.auth_user_id)||[]};
   }));
   out.members.sort((a,b)=>(a.role+a.email).localeCompare(b.role+b.email));
  }
  return Response.json(out,{headers});
 }catch(e){return jsonError(e);}
}

export async function POST(request,{params}){
 try{
  const {code}=await params;
  const ctx=await context(request,code);
  const {db,school,user}=ctx;
  const body=await request.json().catch(()=>({}));
  let result;
  if(body.action==="save"){
   const classId=validateUuid(body.classId,"class"),studentId=validateUuid(body.studentId,"student");
   const term=Number(body.term);
   if(![1,2,3].includes(term))throw new ApiError(400,"Choose term 1, 2 or 3");
   const cls=await checked(db.from("school_classes").select("level_band").eq("school_id",school.id).eq("id",classId).maybeSingle());
   if(!cls?.level_band)throw new ApiError(400,"Set this class's education level before drafting reports");
   let content;
   try{content=cleanContent(cls.level_band,body.content);}catch(e){throw new ApiError(400,e.message);}
   const comment=typeof body.teacherComment==="string"?body.teacherComment.trim().slice(0,1500):"";
   if(body.submit===true){
    const missing=missingForSubmit(cls.level_band,content);
    if(missing.length)throw new ApiError(400,"Complete before submitting: "+missing.slice(0,6).join(", "));
    if(comment.length<5)throw new ApiError(400,"Write the teacher comment before submitting");
   }
   result=await checked(db.rpc("school_term_report_save",{p_school:school.id,p_class:classId,p_student:studentId,
    p_term:term,p_content:content,p_teacher_comment:comment,p_actor:user.id}));
   if(body.submit===true)result=await checked(db.rpc("school_term_report_advance",{p_school:school.id,p_report:result.id,
    p_action:"submit",p_comment:"",p_actor:user.id}));
  }else if(body.action==="advance"){
   const action=["review","approve","publish","return","withdraw"].includes(body.step)?body.step:null;
   if(!action)throw new ApiError(400,"Unknown report step");
   result=await checked(db.rpc("school_term_report_advance",{p_school:school.id,p_report:validateUuid(body.reportId,"report"),
    p_action:action,p_comment:typeof body.comment==="string"?body.comment.slice(0,1500):"",p_actor:user.id}));
  }else if(body.action==="roles"){
   const perms=Array.isArray(body.permissions)?[...new Set(body.permissions)].filter(p=>PERMS.includes(p)):[];
   result=await checked(db.rpc("school_set_report_roles",{p_school:school.id,p_target:validateUuid(body.userId,"member"),
    p_permissions:perms,p_actor:user.id}));
  }else throw new ApiError(400,"Unsupported report action");
  return Response.json({ok:true,result},{headers});
 }catch(e){return jsonError(e);}
}
