import {schoolVerifiedContext} from "../../../../../lib/school-admin.mjs";
import {ApiError,checked,jsonError} from "../../../../../lib/platform-server.js";
import {requiredSchoolId} from "../../../../../lib/school-classroom.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store"};
const txt=(v,max,min=0,label="text")=>{const t=typeof v==="string"?v.trim():"";if(t.length<min||t.length>max)throw new ApiError(400,"Please check the "+label);return t;};
const nowIso=()=>new Date().toISOString();

// Who is looking: a person can teach, manage, study and be a parent at the same school.
async function viewer(db,school,user){
 const ms=await checked(db.from("school_memberships").select("role,active").eq("school_id",school.id).eq("auth_user_id",user.id).eq("active",true));
 const has=r=>ms.some(m=>m.role===r);
 const year=await checked(db.from("school_academic_years").select("id,name").eq("school_id",school.id).eq("status","current").maybeSingle());
 let manager=has("school_owner");
 if(!manager&&has("school_admin")){
  const g=await checked(db.from("school_admin_permissions").select("permissions").eq("school_id",school.id).eq("auth_user_id",user.id).maybeSingle());
  manager=g?.permissions?.includes("academics.manage")===true;
 }
 const assignments=has("teacher")?await checked(db.from("school_teacher_assignments").select("class_id,subject_id").eq("school_id",school.id).eq("teacher_id",user.id).eq("active",true).limit(500)):[];
 let student=null;
 if(has("student")&&year){
  const acc=await checked(db.from("school_student_accounts").select("student_id").eq("school_id",school.id).eq("auth_user_id",user.id).eq("active",true).maybeSingle());
  if(acc){
   const en=await checked(db.from("school_student_enrollments").select("class_id").eq("school_id",school.id).eq("student_id",acc.student_id).eq("academic_year_id",year.id).eq("status","active").maybeSingle());
   if(en)student={studentId:acc.student_id,classId:en.class_id};
  }
 }
 let children=[];
 if(has("parent")&&year){
  const links=await checked(db.from("school_guardian_links").select("student_id").eq("school_id",school.id).eq("auth_user_id",user.id).eq("active",true).limit(50));
  if(links.length){
   const ids=links.map(l=>l.student_id);
   const [studs,ens]=await Promise.all([
    checked(db.from("school_students").select("id,first_name,last_name").eq("school_id",school.id).in("id",ids).eq("status","active")),
    checked(db.from("school_student_enrollments").select("student_id,class_id").eq("school_id",school.id).eq("academic_year_id",year.id).in("student_id",ids).eq("status","active"))]);
   children=ens.map(e=>{const s=studs.find(x=>x.id===e.student_id);return s?{studentId:s.id,classId:e.class_id,name:s.first_name+" "+s.last_name}:null;}).filter(Boolean);
  }
 }
 return {manager,assignments,student,children,year};
}
// The access a viewer has to one course. edit: may build it. learner: whose progress to show.
function courseAccess(v,classId,subjectId,studentParam){
 const edit=v.manager||v.assignments.some(a=>a.class_id===classId&&a.subject_id===subjectId);
 let learner=null,mode=edit?"teacher":null;
 if(v.student&&v.student.classId===classId&&(!studentParam||studentParam===v.student.studentId)){learner=v.student.studentId;mode=mode||"student";}
 const child=v.children.find(c=>c.classId===classId&&(!studentParam||c.studentId===studentParam));
 if(!learner&&child&&!edit){learner=child.studentId;mode="parent";}
 return {edit,learner,mode};
}
const kindOf=h=>h.time_limit_minutes||h.access_code?"quiz":"assignment";

async function listCourses(db,school,v){
 if(!v.year)return [];
 const want=new Map();
 const add=(classId,subjectId,lens,extra={})=>{const k=classId+":"+subjectId;const c=want.get(k)||{classId,subjectId,lens:[],...extra};if(!c.lens.includes(lens))c.lens.push(lens);Object.assign(c,extra);want.set(k,c);};
 for(const a of v.assignments)add(a.class_id,a.subject_id,"teaching");
 const learnClasses=[...(v.student?[v.student.classId]:[]),...v.children.map(c=>c.classId)];
 let classIds=[...new Set([...v.assignments.map(a=>a.class_id),...learnClasses])];
 let mapping=[];
 if(v.manager){
  const cls=await checked(db.from("school_classes").select("id").eq("school_id",school.id).eq("academic_year_id",v.year.id).eq("status","active").limit(400));
  classIds=[...new Set([...classIds,...cls.map(c=>c.id)])];
 }
 if(classIds.length)mapping=await checked(db.from("school_class_subjects").select("class_id,subject_id").eq("school_id",school.id).in("class_id",classIds).limit(4000));
 for(const m of mapping){
  if(v.manager)add(m.class_id,m.subject_id,"managing");
  if(v.student&&m.class_id===v.student.classId)add(m.class_id,m.subject_id,"learning",{studentId:v.student.studentId});
  for(const ch of v.children)if(ch.classId===m.class_id)add(m.class_id,m.subject_id,"child:"+ch.studentId);
 }
 const list=[...want.values()];
 if(!list.length)return [];
 const cIds=[...new Set(list.map(c=>c.classId))],sIds=[...new Set(list.map(c=>c.subjectId))];
 const [classes,subjects,hw,mats,mods]=await Promise.all([
  checked(db.from("school_classes").select("id,name,section,level").eq("school_id",school.id).in("id",cIds)),
  checked(db.from("school_subjects").select("id,name,code").eq("school_id",school.id).in("id",sIds)),
  checked(db.from("school_homework").select("id,class_id,subject_id,status,release_at,due_at").eq("school_id",school.id).in("class_id",cIds).in("status",["published","closed"]).limit(4000)),
  checked(db.from("school_learning_materials").select("id,class_id,subject_id").eq("school_id",school.id).in("class_id",cIds).eq("published",true).limit(4000)),
  checked(db.from("school_course_modules").select("id,class_id,subject_id").eq("school_id",school.id).in("class_id",cIds).limit(4000))]);
 const live=hw.filter(h=>!h.release_at||new Date(h.release_at)<=new Date());
 const learners=[...new Set([...(v.student?[v.student.studentId]:[]),...v.children.map(c=>c.studentId)])];
 const [subs,done]=learners.length?await Promise.all([
  checked(db.from("school_homework_submissions").select("homework_id,student_id").eq("school_id",school.id).in("student_id",learners).limit(5000)),
  checked(db.from("school_material_completions").select("material_id,student_id").eq("school_id",school.id).in("student_id",learners).limit(5000))]):[[],[]];
 const out=[];
 for(const c of list){
  const cl=classes.find(x=>x.id===c.classId),sb=subjects.find(x=>x.id===c.subjectId);
  if(!cl||!sb)continue;
  const items=[...live.filter(h=>h.class_id===c.classId&&h.subject_id===c.subjectId).map(h=>({t:"h",id:h.id,due:h.due_at})),
   ...mats.filter(m=>m.class_id===c.classId&&m.subject_id===c.subjectId).map(m=>({t:"m",id:m.id}))];
  const learnersHere=c.lens.filter(l=>l==="learning"||l.startsWith("child:")).map(l=>l==="learning"?v.student.studentId:l.slice(6));
  const progress=learnersHere.map(sid=>{
   const d=items.filter(i=>i.t==="h"?subs.some(s=>s.homework_id===i.id&&s.student_id===sid):done.some(x=>x.material_id===i.id&&x.student_id===sid)).length;
   const ch=v.children.find(x=>x.studentId===sid);
   return {studentId:sid,name:ch?ch.name:null,done:d,total:items.length,percent:items.length?Math.round(d*100/items.length):0};
  });
  const next=items.filter(i=>i.t==="h"&&new Date(i.due)>new Date()).sort((a,b)=>new Date(a.due)-new Date(b.due))[0];
  out.push({classId:c.classId,subjectId:c.subjectId,lens:c.lens,className:cl.name+(cl.section?" "+cl.section:""),level:cl.level,
   subject:sb.name,subjectCode:sb.code,items:items.length,modules:mods.filter(m=>m.class_id===c.classId&&m.subject_id===c.subjectId).length,
   nextDue:next?.due||null,progress});
 }
 return out.sort((a,b)=>(a.className+a.subject).localeCompare(b.className+b.subject));
}

async function courseDetail(db,school,v,classId,subjectId,studentParam){
 const acc=courseAccess(v,classId,subjectId,studentParam);
 if(!acc.mode)throw new ApiError(403,"You do not have access to this course");
 const [cl,sb,map]=await Promise.all([
  checked(db.from("school_classes").select("id,name,section,level").eq("school_id",school.id).eq("id",classId).maybeSingle()),
  checked(db.from("school_subjects").select("id,name,code").eq("school_id",school.id).eq("id",subjectId).maybeSingle()),
  checked(db.from("school_class_subjects").select("subject_id").eq("school_id",school.id).eq("class_id",classId).eq("subject_id",subjectId).limit(1))]);
 if(!cl||!sb||(!map.length&&!acc.edit))throw new ApiError(404,"Course not found");
 let modQ=db.from("school_course_modules").select("id,title,summary,position,opens_at,published").eq("school_id",school.id).eq("class_id",classId).eq("subject_id",subjectId).order("position").order("created_at");
 if(!acc.edit)modQ=modQ.eq("published",true);
 let hwQ=db.from("school_homework").select("id,title,instructions,due_at,release_at,status,module_id,time_limit_minutes,access_code,late_policy,published_at,teacher_id").eq("school_id",school.id).eq("class_id",classId).eq("subject_id",subjectId).order("due_at").limit(500);
 if(!acc.edit)hwQ=hwQ.in("status",["published","closed"]);
 let mQ=db.from("school_learning_materials").select("id,title,kind,url,description,module_id,published,created_at,teacher_id").eq("school_id",school.id).eq("class_id",classId).eq("subject_id",subjectId).order("created_at").limit(500);
 if(!acc.edit)mQ=mQ.eq("published",true);
 const [mods0,hw0,mats,teachers,enrol]=await Promise.all([checked(modQ),checked(hwQ),checked(mQ),
  checked(db.from("school_teacher_assignments").select("teacher_id").eq("school_id",school.id).eq("class_id",classId).eq("subject_id",subjectId).eq("active",true).limit(20)),
  checked(db.from("school_student_enrollments").select("student_id").eq("school_id",school.id).eq("class_id",classId).eq("status","active").limit(800))]);
 const now=new Date();
 const mods=acc.edit?mods0:mods0.filter(m=>!m.opens_at||new Date(m.opens_at)<=now);
 const hiddenMods=new Set(mods0.filter(m=>!mods.includes(m)).map(m=>m.id));
 const hw=(acc.edit?hw0:hw0.filter(h=>!h.release_at||new Date(h.release_at)<=now)).filter(h=>acc.edit||!h.module_id||!hiddenMods.has(h.module_id));
 const mt=mats.filter(m=>acc.edit||!m.module_id||!hiddenMods.has(m.module_id));
 const hwIds=hw.map(h=>h.id),studentIds=[...new Set(enrol.map(e=>e.student_id))];
 const qrows=hwIds.length?await checked(db.from("school_homework_questions").select("homework_id,marks").eq("school_id",school.id).in("homework_id",hwIds).limit(5000)):[];
 const maxOf=id=>qrows.filter(q=>q.homework_id===id).reduce((a,q)=>a+Number(q.marks||0),0);
 const tNames=await Promise.all([...new Set(teachers.map(t=>t.teacher_id))].map(async id=>{
  const {data}=await db.auth.admin.getUserById(id);const m=data?.user?.user_metadata||{};
  return {id,name:String(m.display_name||m.full_name||"").trim()||"Teacher"};
 }));
 const studs=studentIds.length?await checked(db.from("school_students").select("id,first_name,last_name,student_code").eq("school_id",school.id).in("id",studentIds).eq("status","active")):[];
 const roster=studs.map(s=>({id:s.id,name:s.first_name+" "+s.last_name,code:acc.edit?s.student_code:undefined})).sort((a,b)=>a.name.localeCompare(b.name));
 // Submissions: everyone's for the builder, only the learner's own otherwise.
 const who=acc.edit?studentIds:acc.learner?[acc.learner]:[];
 const [subs,done]=who.length&&(hwIds.length||mt.length)?await Promise.all([
  hwIds.length?checked(db.from("school_homework_submissions").select("homework_id,student_id,submitted_at,is_late,score,max_score,feedback,graded_at,released_at").eq("school_id",school.id).in("homework_id",hwIds).in("student_id",who).limit(20000)):[],
  mt.length?checked(db.from("school_material_completions").select("material_id,student_id,completed_at").eq("school_id",school.id).in("material_id",mt.map(m=>m.id)).in("student_id",who).limit(20000)):[]]):[[],[]];
 const items=[
  ...hw.map(h=>{
   const mine=acc.learner?subs.find(s=>s.homework_id===h.id&&s.student_id===acc.learner):null;
   const rel=!!mine?.released_at;
   return {type:kindOf(h),id:h.id,moduleId:h.module_id,title:h.title,description:h.instructions,dueAt:h.due_at,openAt:h.release_at||h.published_at,
    closed:h.status==="closed",status:acc.edit?h.status:undefined,timeLimit:h.time_limit_minutes,locked:!!h.access_code,
    accessCode:acc.edit?h.access_code:undefined,maxMarks:maxOf(h.id),
    submittedCount:acc.edit?subs.filter(s=>s.homework_id===h.id).length:undefined,
    done:mine?{at:mine.submitted_at,late:mine.is_late,how:"Submitted"}:null,
    grade:rel?{score:mine.score,max:mine.max_score,feedback:mine.feedback}:null};
  }),
  ...mt.map(m=>{
   const d=acc.learner?done.find(x=>x.material_id===m.id&&x.student_id===acc.learner):null;
   return {type:m.kind,id:m.id,moduleId:m.module_id,title:m.title,description:m.description,url:m.url,createdAt:m.created_at,
    published:acc.edit?m.published:undefined,doneCount:acc.edit?done.filter(x=>x.material_id===m.id).length:undefined,
    done:d?{at:d.completed_at,how:"Marked as done"}:null};
  })];
 const counted=items.filter(i=>acc.edit?true:true);
 const progress=acc.learner?{done:counted.filter(i=>i.done).length,total:counted.length}:null;
 // Grades: the learner's own report, or the full gradebook for the builder.
 const gradeItems=hw.filter(h=>acc.edit||h.status!=="draft").map(h=>({id:h.id,title:h.title,type:kindOf(h),max:maxOf(h.id),dueAt:h.due_at}));
 let grades;
 if(acc.edit){
  grades={items:gradeItems,rows:roster.map(s=>{
   const cells={};let got=0,max=0;
   for(const g of gradeItems){const x=subs.find(y=>y.homework_id===g.id&&y.student_id===s.id);
    if(x){cells[g.id]={score:x.score,max:x.max_score,released:!!x.released_at,late:x.is_late,graded:!!x.graded_at};if(x.score!=null&&x.max_score){got+=Number(x.score);max+=Number(x.max_score);}}}
   const complete=items.filter(i=>i.type==="assignment"||i.type==="quiz"?subs.some(y=>y.homework_id===i.id&&y.student_id===s.id):done.some(y=>y.material_id===i.id&&y.student_id===s.id)).length;
   return {studentId:s.id,name:s.name,code:s.code,cells,percent:max?Math.round(got*1000/max)/10:null,complete,total:items.length};
  })};
 }else{
  let got=0,max=0;
  const rows=gradeItems.map(g=>{const it=items.find(i=>i.id===g.id);const gr=it?.grade;
   if(gr&&gr.score!=null&&gr.max){got+=Number(gr.score);max+=Number(gr.max);}
   return {...g,score:gr?gr.score:null,range:"0 to "+(gr?.max??g.max),percent:gr&&gr.max?Math.round(Number(gr.score)*1000/Number(gr.max))/10:null,
    feedback:gr?.feedback||null,status:gr?"Graded":it?.done?"Submitted, waiting for the teacher":"Not submitted"};});
  grades={rows,total:max?{score:got,max,percent:Math.round(got*1000/max)/10}:null};
 }
 const learnerName=acc.learner?(v.children.find(c=>c.studentId===acc.learner)?.name||roster.find(r=>r.id===acc.learner)?.name||null):null;
 return {course:{classId,subjectId,className:cl.name+(cl.section?" "+cl.section:""),level:cl.level,subject:sb.name,subjectCode:sb.code,
   teachers:tNames.map(t=>t.name)},
  mode:acc.mode,canEdit:acc.edit,learner:acc.learner?{id:acc.learner,name:learnerName}:null,
  children:v.children.filter(c=>c.classId===classId).map(c=>({id:c.studentId,name:c.name})),
  modules:mods.map(m=>({id:m.id,title:m.title,summary:m.summary,position:m.position,opensAt:m.opens_at,published:m.published})),
  items,progress,grades,participants:{teachers:tNames.map(t=>t.name),students:roster.map(r=>({name:r.name,code:r.code}))}};
}

export async function GET(request,{params}){
 try{
  const {code}=await params;
  const {db,school,user}=await schoolVerifiedContext(request,code);
  const v=await viewer(db,school,user);
  const url=new URL(request.url);
  const classId=url.searchParams.get("classId"),subjectId=url.searchParams.get("subjectId");
  if(classId||subjectId){
   const st=url.searchParams.get("student");
   const detail=await courseDetail(db,school,v,requiredSchoolId(classId,"class"),requiredSchoolId(subjectId,"subject"),st?requiredSchoolId(st,"student"):null);
   return Response.json(detail,{headers:noStore});
  }
  const courses=await listCourses(db,school,v);
  return Response.json({courses,year:v.year?.name||null,children:v.children.map(c=>({id:c.studentId,name:c.name})),
   canBuild:v.manager||v.assignments.length>0},{headers:noStore});
 }catch(e){return jsonError(e);}
}

export async function POST(request,{params}){
 try{
  const {code}=await params;
  const {db,school,user}=await schoolVerifiedContext(request,code);
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||"");
  const v=await viewer(db,school,user);
  const audit=(event,id)=>db.from("school_classroom_audit").insert({school_id:school.id,actor_id:user.id,event,resource_id:id});
  if(action==="complete.toggle"){
   if(!v.student)throw new ApiError(403,"Only a student can mark course items as done");
   const id=requiredSchoolId(body.materialId,"material");
   const m=await checked(db.from("school_learning_materials").select("id,class_id,published").eq("school_id",school.id).eq("id",id).maybeSingle());
   if(!m||!m.published||m.class_id!==v.student.classId)throw new ApiError(404,"Item not found");
   if(body.done===false){
    const d=await db.from("school_material_completions").delete().eq("school_id",school.id).eq("material_id",id).eq("student_id",v.student.studentId);
    if(d.error)throw new ApiError(400,"Could not update");
   }else{
    const u=await db.from("school_material_completions").upsert({school_id:school.id,material_id:id,student_id:v.student.studentId},{onConflict:"material_id,student_id",ignoreDuplicates:true});
    if(u.error)throw new ApiError(400,"Could not update");
   }
   return Response.json({ok:true,done:body.done!==false},{headers:noStore});
  }
  // Everything below builds a course: the assigned teacher or an academic manager.
  const mustEdit=(classId,subjectId)=>{if(!courseAccess(v,classId,subjectId,null).edit)throw new ApiError(403,"Only the course teacher or an academic manager can change this course");};
  const loadModule=async id=>{const m=await checked(db.from("school_course_modules").select("id,class_id,subject_id,position").eq("school_id",school.id).eq("id",requiredSchoolId(id,"module")).maybeSingle());
   if(!m)throw new ApiError(404,"Module not found");mustEdit(m.class_id,m.subject_id);return m;};
  const fields=b=>{const f={};
   if(b.title!==undefined)f.title=txt(b.title,140,2,"module title (2 to 140 characters)");
   if(b.summary!==undefined)f.summary=txt(b.summary||"",2000,0,"module summary");
   if(b.opensAt!==undefined){if(b.opensAt&&Number.isNaN(Date.parse(b.opensAt)))throw new ApiError(400,"Choose a valid opening date");f.opens_at=b.opensAt?new Date(b.opensAt).toISOString():null;}
   if(b.published!==undefined)f.published=b.published!==false;return f;};
  let result;
  if(action==="module.create"){
   const classId=requiredSchoolId(body.classId,"class"),subjectId=requiredSchoolId(body.subjectId,"subject");
   mustEdit(classId,subjectId);
   const f=fields({...body,title:body.title??""});
   const last=await checked(db.from("school_course_modules").select("position").eq("school_id",school.id).eq("class_id",classId).eq("subject_id",subjectId).order("position",{ascending:false}).limit(1));
   const ins=await db.from("school_course_modules").insert({school_id:school.id,class_id:classId,subject_id:subjectId,created_by:user.id,position:Math.min(10000,(last[0]?.position??-1)+1),...f}).select("id").single();
   if(ins.error)throw new ApiError(400,"The module could not be created");
   await audit("course.module.created",ins.data.id);result={id:ins.data.id};
  }else if(action==="module.update"){
   const m=await loadModule(body.moduleId);
   const up=await db.from("school_course_modules").update({...fields(body),updated_at:nowIso()}).eq("school_id",school.id).eq("id",m.id);
   if(up.error)throw new ApiError(400,"The module could not be saved");
   await audit("course.module.updated",m.id);result={id:m.id};
  }else if(action==="module.delete"){
   const m=await loadModule(body.moduleId);
   const d=await db.from("school_course_modules").delete().eq("school_id",school.id).eq("id",m.id);
   if(d.error)throw new ApiError(400,"The module could not be removed");
   await audit("course.module.deleted",m.id);result={id:m.id};
  }else if(action==="module.move"){
   const m=await loadModule(body.moduleId);
   const all=await checked(db.from("school_course_modules").select("id,position").eq("school_id",school.id).eq("class_id",m.class_id).eq("subject_id",m.subject_id).order("position").order("created_at"));
   const i=all.findIndex(x=>x.id===m.id),j=body.direction==="up"?i-1:i+1;
   if(j>=0&&j<all.length){
    [all[i],all[j]]=[all[j],all[i]];
    for(let k=0;k<all.length;k++){const u=await db.from("school_course_modules").update({position:k}).eq("school_id",school.id).eq("id",all[k].id);if(u.error)throw new ApiError(400,"Could not reorder");}
   }
   result={id:m.id};
  }else if(action==="item.place"){
   const type=body.itemType==="material"?"material":"homework";
   const table=type==="material"?"school_learning_materials":"school_homework";
   const it=await checked(db.from(table).select("id,class_id,subject_id").eq("school_id",school.id).eq("id",requiredSchoolId(body.itemId,type)).maybeSingle());
   if(!it)throw new ApiError(404,"Item not found");
   mustEdit(it.class_id,it.subject_id);
   let moduleId=null;
   if(body.moduleId){const m=await loadModule(body.moduleId);if(m.class_id!==it.class_id||m.subject_id!==it.subject_id)throw new ApiError(400,"That module belongs to another course");moduleId=m.id;}
   const up=await db.from(table).update({module_id:moduleId}).eq("school_id",school.id).eq("id",it.id);
   if(up.error)throw new ApiError(400,"The item could not be moved");
   result={id:it.id,moduleId};
  }else if(action==="homework.code"){
   const hw=await checked(db.from("school_homework").select("id,class_id,subject_id").eq("school_id",school.id).eq("id",requiredSchoolId(body.homeworkId,"homework")).maybeSingle());
   if(!hw)throw new ApiError(404,"Quiz not found");
   mustEdit(hw.class_id,hw.subject_id);
   const c=body.accessCode?txt(body.accessCode,40,4,"access code (4 to 40 characters)"):null;
   const up=await db.from("school_homework").update({access_code:c}).eq("school_id",school.id).eq("id",hw.id);
   if(up.error)throw new ApiError(400,"The access code could not be saved");
   await audit(c?"homework.code_set":"homework.code_cleared",hw.id);result={id:hw.id,locked:!!c};
  }else throw new ApiError(400,"Unknown course action");
  return Response.json({ok:true,result},{headers:noStore});
 }catch(e){return jsonError(e);}
}
