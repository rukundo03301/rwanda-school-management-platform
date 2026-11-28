import {classroomContext,classroomDeadline,requiredSchoolId,teacherAssignmentAllowed} from "../../../../../lib/school-classroom.mjs";
import {createHash,timingSafeEqual} from "node:crypto";
import {schoolVerifiedContext} from "../../../../../lib/school-admin.mjs";
import {ApiError,checked,jsonError} from "../../../../../lib/platform-server.js";
import {normalizeQuestions,autoMark,cleanAnswers,publicQuestion,answered} from "../../../../../lib/homework-questions.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store"};
const text=(v,max,min=0)=>{const t=typeof v==="string"?v.trim():"";if(t.length<min||t.length>max)throw new ApiError(400,"Please check the text you entered");return t;};

async function studentContext(db,school,user){
 const member=await checked(db.from("school_memberships").select("active").eq("school_id",school.id).eq("auth_user_id",user.id).eq("role","student").maybeSingle());
 if(!member?.active)return null;
 const account=await checked(db.from("school_student_accounts").select("student_id").eq("school_id",school.id).eq("auth_user_id",user.id).eq("active",true).maybeSingle());
 if(!account)return null;
 const year=await checked(db.from("school_academic_years").select("id").eq("school_id",school.id).eq("status","current").maybeSingle());
 if(!year)return null;
 const enrol=await checked(db.from("school_student_enrollments").select("class_id").eq("school_id",school.id).eq("student_id",account.student_id).eq("academic_year_id",year.id).eq("status","active").maybeSingle());
 if(!enrol)return null;
 return {studentId:account.student_id,classId:enrol.class_id};
}
async function myHomework(db,school,actorId,id){
 const hw=await checked(db.from("school_homework").select("*").eq("school_id",school.id).eq("id",id).maybeSingle());
 if(!hw||hw.teacher_id!==actorId)throw new ApiError(404,"Homework not found");
 const mine=await checked(db.from("school_teacher_assignments").select("class_id,subject_id,active").eq("school_id",school.id).eq("teacher_id",actorId).eq("active",true).limit(700));
 if(!teacherAssignmentAllowed(mine,hw.class_id,hw.subject_id))throw new ApiError(403,"You are no longer assigned to this class and subject");
 return {hw,mine};
}
const questionsOf=(db,school,id)=>checked(db.from("school_homework_questions").select("id,position,kind,prompt,options,answer_key,marks,tolerance").eq("school_id",school.id).eq("homework_id",id).order("position"));
async function replaceQuestions(db,school,id,list){
 const del=await db.from("school_homework_questions").delete().eq("school_id",school.id).eq("homework_id",id);
 if(del.error)throw new ApiError(400,"Questions could not be saved");
 const ins=await db.from("school_homework_questions").insert(list.map(q=>({...q,school_id:school.id,homework_id:id})));
 if(ins.error)throw new ApiError(400,"Questions could not be saved");
}
// Quiz access code: compared in constant time, 8 wrong tries in 15 minutes locks the student out for that quiz.
async function checkAccessCode(db,school,user,hw,given,unlocked){
 if(!hw.access_code||unlocked)return;
 const since=new Date(Date.now()-15*60000).toISOString();
 const fails=await checked(db.from("school_classroom_audit").select("id").eq("school_id",school.id).eq("actor_id",user.id).eq("event","homework.code_failed").eq("resource_id",hw.id).gte("created_at",since).limit(20));
 if(fails.length>=8)throw new ApiError(429,"Too many wrong codes. Wait 15 minutes and ask your teacher for the code.");
 const a=createHash("sha256").update(String(given||"").trim()).digest(),b=createHash("sha256").update(hw.access_code).digest();
 if(!given||!timingSafeEqual(a,b)){
  await checked(db.from("school_classroom_audit").insert({school_id:school.id,actor_id:user.id,event:"homework.code_failed",resource_id:hw.id}));
  throw new ApiError(423,given?"That access code is not correct":"This quiz is locked. Enter the access code your teacher gave you.");
 }
}
const audit=(db,school,actor,event,id)=>checked(db.from("school_classroom_audit").insert({school_id:school.id,actor_id:actor,event,resource_id:id}));

export async function GET(request,{params}){
 try{
  const {code}=await params;
  const url=new URL(request.url);
  const homeworkId=url.searchParams.get("homeworkId");
  const base=await schoolVerifiedContext(request,code);
  const {db,school,user}=base;
  if(url.searchParams.get("as")==="student"){
   const st=await studentContext(db,school,user);
   if(!st)throw new ApiError(403,"Student access is not approved");
   const id=requiredSchoolId(homeworkId,"homework");
   const hw=await checked(db.from("school_homework").select("id,title,instructions,objectives,due_at,release_at,late_policy,time_limit_minutes,status,class_id,subject_id,access_code").eq("school_id",school.id).eq("id",id).eq("class_id",st.classId).eq("status","published").maybeSingle());
   if(!hw||(hw.release_at&&new Date(hw.release_at)>new Date()))throw new ApiError(404,"Homework not found");
   const sub=await checked(db.from("school_homework_submissions").select("answers,submitted_at,is_late,score,max_score,feedback,graded_at,released_at").eq("school_id",school.id).eq("homework_id",id).eq("student_id",st.studentId).maybeSingle());
   const draft=sub?null:await checked(db.from("school_homework_drafts").select("answers,updated_at,started_at").eq("school_id",school.id).eq("homework_id",id).eq("student_id",st.studentId).maybeSingle());
   if(hw.access_code&&!sub&&!draft&&!url.searchParams.get("accessCode")){
    const {access_code,...open}=hw;
    return Response.json({homework:open,locked:true,questions:[],draft:{},startedAt:null,serverNow:new Date().toISOString(),submission:null},{headers:noStore});
   }
   await checkAccessCode(db,school,user,hw,url.searchParams.get("accessCode"),!!(sub||draft));
   delete hw.access_code;
   const qs=await questionsOf(db,school,id);
   const released=!!sub?.released_at;
   return Response.json({homework:hw,questions:qs.map(publicQuestion),
    draft:draft?.answers||{},startedAt:draft?.started_at||null,serverNow:new Date().toISOString(),
    submission:sub?{submittedAt:sub.submitted_at,isLate:sub.is_late,answers:sub.answers?.a||{},
      released,score:released?sub.score:null,maxScore:released?sub.max_score:null,feedback:released?sub.feedback:null,
      marks:released?sub.answers?.m||{}:{}}:null},{headers:noStore});
  }
  const ctx=await classroomContext(request,code);
  if(!ctx.role.teacher)throw new ApiError(403,"A verified assigned teacher is required");
  const id=requiredSchoolId(homeworkId,"homework");
  const {hw}=await myHomework(db,school,ctx.actorId,id);
  const qs=await questionsOf(db,school,id);
  const subs=await checked(db.from("school_homework_submissions").select("id,student_id,answers,auto_score,submitted_at,is_late,score,max_score,feedback,graded_at,released_at").eq("school_id",school.id).eq("homework_id",id).limit(600));
  const enrol=await checked(db.from("school_student_enrollments").select("student_id").eq("school_id",school.id).eq("class_id",hw.class_id).eq("status","active").limit(600));
  const ids=[...new Set(enrol.map(e=>e.student_id))];
  const studs=ids.length?await checked(db.from("school_students").select("id,first_name,last_name,student_code").eq("school_id",school.id).in("id",ids)):[];
  return Response.json({homework:hw,questions:qs,submissions:subs,
   students:studs.map(s=>({id:s.id,name:s.first_name+" "+s.last_name,code:s.student_code}))},{headers:noStore});
 }catch(e){return jsonError(e);}
}

export async function POST(request,{params}){
 try{
  const {code}=await params;
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||"");
  const base=await schoolVerifiedContext(request,code);
  const {db,school,user}=base;
  let result;
  if(action==="draft.save"||action==="submit"||action==="start"){
   const st=await studentContext(db,school,user);
   if(!st)throw new ApiError(403,"Student access is not approved");
   const id=requiredSchoolId(body.homeworkId,"homework");
   const hw=await checked(db.from("school_homework").select("id,due_at,release_at,late_policy,time_limit_minutes,status,class_id,access_code").eq("school_id",school.id).eq("id",id).eq("class_id",st.classId).eq("status","published").maybeSingle());
   if(!hw||(hw.release_at&&new Date(hw.release_at)>new Date()))throw new ApiError(404,"Homework not found");
   const existing=await checked(db.from("school_homework_submissions").select("id").eq("school_id",school.id).eq("homework_id",id).eq("student_id",st.studentId).maybeSingle());
   if(existing)throw new ApiError(409,"You have already submitted this homework");
   if(hw.access_code){
    const hasDraft=await checked(db.from("school_homework_drafts").select("homework_id").eq("school_id",school.id).eq("homework_id",id).eq("student_id",st.studentId).maybeSingle());
    await checkAccessCode(db,school,user,hw,body.accessCode,!!hasDraft);
   }
   const late=Date.now()>new Date(hw.due_at).getTime();
   if(late&&hw.late_policy==="reject")throw new ApiError(403,"The deadline has passed and this homework no longer accepts answers");
   const qs=await questionsOf(db,school,id);
   if(!qs.length)throw new ApiError(400,"This homework has no questions");
   const lim=hw.time_limit_minutes?Number(hw.time_limit_minutes)*60000:0;
   const dr=lim?await checked(db.from("school_homework_drafts").select("started_at").eq("school_id",school.id).eq("homework_id",id).eq("student_id",st.studentId).maybeSingle()):null;
   const startedAt=dr?.started_at||null;
   const overtime=Boolean(lim&&startedAt&&Date.now()>new Date(startedAt).getTime()+lim+30000);
   if(action==="start"){
    const needDraft=lim?!startedAt:!!hw.access_code;
    if(needDraft){
     const exists=lim?null:await checked(db.from("school_homework_drafts").select("homework_id").eq("school_id",school.id).eq("homework_id",id).eq("student_id",st.studentId).maybeSingle());
     const s=exists?{}:await db.from("school_homework_drafts").upsert({school_id:school.id,homework_id:id,student_id:st.studentId,answers:{},started_at:lim?new Date().toISOString():null,updated_at:new Date().toISOString()});
     if(s.error)throw new ApiError(400,"The quiz could not be started");
    }
    return Response.json({ok:true,result:{started:true}},{headers:noStore});
   }
   if(lim&&!startedAt&&action==="draft.save")throw new ApiError(409,"Start the quiz first");
   if(overtime&&action==="draft.save")throw new ApiError(403,"Your time is finished. Submit your answers now.");
   const a=cleanAnswers(qs,body.answers);
   if(action==="draft.save"){
    const up=await db.from("school_homework_drafts").upsert({school_id:school.id,homework_id:id,student_id:st.studentId,answers:a,updated_at:new Date().toISOString()});
    if(up.error)throw new ApiError(400,"Your answers could not be saved");
    result={saved:true};
   }else{
    const m={};let auto=0;
    for(const q of qs){const mk=autoMark(q,a[q.id]);if(mk!==null){m[q.id]=mk;auto+=mk;}}
    const ins=await db.from("school_homework_submissions").insert({school_id:school.id,homework_id:id,student_id:st.studentId,
     response_text:"Answered "+answered(a)+" of "+qs.length+" questions",is_late:late||overtime,answers:{a,m},auto_score:Math.round(auto*100)/100}).select("id").single();
    if(ins.error)throw new ApiError(409,"Your homework could not be submitted. It may already be submitted.");
    await db.from("school_homework_drafts").delete().eq("school_id",school.id).eq("homework_id",id).eq("student_id",st.studentId);
    await audit(db,school,user.id,"homework.submitted",ins.data.id);
    result={submitted:true,late:late||overtime};
   }
   return Response.json({ok:true,result},{headers:noStore});
  }
  const ctx=await classroomContext(request,code);
  if(!ctx.role.teacher)throw new ApiError(403,"A verified assigned teacher is required");
  const actorId=ctx.actorId;
  if(action==="hw.save"){
   const classId=requiredSchoolId(body.classId,"class"),subjectId=requiredSchoolId(body.subjectId,"subject");
   const mine=await checked(db.from("school_teacher_assignments").select("class_id,subject_id,active").eq("school_id",school.id).eq("teacher_id",actorId).eq("active",true).limit(700));
   if(!teacherAssignmentAllowed(mine,classId,subjectId))throw new ApiError(403,"You are not assigned to teach this subject in this class");
   let list;try{list=normalizeQuestions(body.questions);}catch(e){throw new ApiError(400,e.message);}
   const row={title:text(body.title,180,3),instructions:text(body.instructions||"See the questions below.",5000,1),
    objectives:text(body.objectives||"",2000)||null,due_at:classroomDeadline(body.dueAt),
    release_at:body.releaseAt?new Date(body.releaseAt).toISOString():null,
    late_policy:body.latePolicy==="reject"?"reject":"accept_flag",results_release:body.resultsRelease==="auto"?"auto":"manual",
    time_limit_minutes:body.timeLimit?Math.floor(Number(body.timeLimit)):null};
   if(row.time_limit_minutes!==null&&!(row.time_limit_minutes>=1&&row.time_limit_minutes<=240))throw new ApiError(400,"Time limit must be 1 to 240 minutes");
   if(row.release_at&&Number.isNaN(Date.parse(row.release_at)))throw new ApiError(400,"Choose a valid release date");
   let id=body.homeworkId?requiredSchoolId(body.homeworkId,"homework"):null;
   if(id){
    const {hw}=await myHomework(db,school,actorId,id);
    if(hw.status!=="draft")throw new ApiError(409,"Published homework cannot be re-written. Extend the deadline, close it, or duplicate it.");
    const up=await db.from("school_homework").update({...row,class_id:classId,subject_id:subjectId,version:hw.version+1,updated_at:new Date().toISOString()}).eq("school_id",school.id).eq("id",id);
    if(up.error)throw new ApiError(400,"The homework could not be saved");
   }else{
    const ins=await db.from("school_homework").insert({...row,school_id:school.id,teacher_id:actorId,class_id:classId,subject_id:subjectId,status:"draft"}).select("id").single();
    if(ins.error)throw new ApiError(400,"The homework could not be saved");
    id=ins.data.id;
   }
   await replaceQuestions(db,school,id,list);
   await audit(db,school,actorId,"homework.saved",id);
   result={id,questions:list.length};
  }else if(action==="hw.publish"){
   const id=requiredSchoolId(body.homeworkId,"homework");
   const {hw}=await myHomework(db,school,actorId,id);
   if(hw.status!=="draft")throw new ApiError(409,"Only a draft can be published");
   if(!(await questionsOf(db,school,id)).length)throw new ApiError(400,"Add at least one question before publishing");
   if(new Date(hw.due_at)<=new Date())throw new ApiError(400,"Move the deadline into the future first");
   const up=await db.from("school_homework").update({status:"published",published_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("school_id",school.id).eq("id",id);
   if(up.error)throw new ApiError(400,"Could not publish");
   await audit(db,school,actorId,"homework.published",id);result={published:true};
  }else if(action==="hw.extend"||action==="hw.close"||action==="hw.reopen"){
   const id=requiredSchoolId(body.homeworkId,"homework");
   const {hw}=await myHomework(db,school,actorId,id);
   if(hw.status==="draft")throw new ApiError(409,"Publish the homework first");
   let patch;
   if(action==="hw.close")patch={status:"closed"};
   else{
    const due=classroomDeadline(body.dueAt);
    if(action==="hw.extend"&&new Date(due)<=new Date(hw.due_at))throw new ApiError(400,"The new deadline must be later than the current one");
    patch={due_at:due,status:"published"};
   }
   const up=await db.from("school_homework").update({...patch,updated_at:new Date().toISOString()}).eq("school_id",school.id).eq("id",id);
   if(up.error)throw new ApiError(400,"Could not update the homework");
   await audit(db,school,actorId,"homework."+action.slice(3),id);result={ok:true};
  }else if(action==="hw.duplicate"){
   const id=requiredSchoolId(body.homeworkId,"homework");
   const {hw,mine}=await myHomework(db,school,actorId,id);
   const classId=body.classId?requiredSchoolId(body.classId,"class"):hw.class_id;
   if(!teacherAssignmentAllowed(mine,classId,hw.subject_id))throw new ApiError(403,"You are not assigned to this subject in that class");
   const qs=await questionsOf(db,school,id);
   const ins=await db.from("school_homework").insert({school_id:school.id,teacher_id:actorId,class_id:classId,subject_id:hw.subject_id,
    title:(hw.title+" (copy)").slice(0,180),instructions:hw.instructions,objectives:hw.objectives,due_at:new Date(Date.now()+7*86400000).toISOString(),
    late_policy:hw.late_policy,results_release:hw.results_release,time_limit_minutes:hw.time_limit_minutes,status:"draft"}).select("id").single();
   if(ins.error)throw new ApiError(400,"Could not duplicate");
   if(qs.length)await replaceQuestions(db,school,ins.data.id,qs.map(({id:_i,...q})=>q));
   result={id:ins.data.id};
  }else if(action==="grade.save"||action==="grade.approveAuto"){
   const hid=requiredSchoolId(body.homeworkId,"homework");
   const {hw}=await myHomework(db,school,actorId,hid);
   const qs=await questionsOf(db,school,hid);
   const total=Math.round(qs.reduce((s,q)=>s+Number(q.marks),0)*100)/100;
   const subs=await checked(db.from("school_homework_submissions").select("id,answers,graded_at").eq("school_id",school.id).eq("homework_id",hid).limit(600));
   const finish=async(sub,marks,feedback)=>{
    const m={};let score=0;
    for(const q of qs){
     let v=marks?.[q.id];
     if(v===undefined||v===null||v==="")v=sub.answers?.m?.[q.id];
     if(v===undefined||v===null)throw new ApiError(400,"Enter a mark for every question that needs marking");
     v=Number(v);if(!Number.isFinite(v)||v<0||v>Number(q.marks))throw new ApiError(400,"Marks must be between 0 and the question's maximum");
     m[q.id]=Math.round(v*100)/100;score+=m[q.id];
    }
    const now=new Date().toISOString();
    const up=await db.from("school_homework_submissions").update({answers:{...sub.answers,m},score:Math.round(score*100)/100,max_score:total,
     feedback:feedback||null,graded_at:now,graded_by:actorId,...(hw.results_release==="auto"?{released_at:now}:{})}).eq("school_id",school.id).eq("id",sub.id);
    if(up.error)throw new ApiError(400,"The grade could not be saved");
    await audit(db,school,actorId,"homework.graded",sub.id);
   };
   if(action==="grade.save"){
    const sub=subs.find(s=>s.id===body.submissionId);
    if(!sub)throw new ApiError(404,"Submission not found");
    await finish(sub,body.marks,text(body.feedback||"",2000));result={graded:1};
   }else{
    let n=0;
    for(const sub of subs){
     const done=!sub.graded_at&&qs.every(q=>sub.answers?.m?.[q.id]!==undefined);
     if(done){await finish(sub,{},"");n++;}
    }
    result={graded:n};
   }
  }else if(action==="grade.release"){
   const hid=requiredSchoolId(body.homeworkId,"homework");
   await myHomework(db,school,actorId,hid);
   const up=await db.from("school_homework_submissions").update({released_at:new Date().toISOString()}).eq("school_id",school.id).eq("homework_id",hid).not("graded_at","is",null).is("released_at",null).select("id");
   if(up.error)throw new ApiError(400,"Results could not be released");
   await audit(db,school,actorId,"homework.released",hid);result={released:up.data.length};
  }else throw new ApiError(400,"Unsupported action");
  return Response.json({ok:true,result},{headers:noStore});
 }catch(e){return jsonError(e);}
}
