import {
 communicationsContext,comText,comId,validClock,validDateTime,
 canViewAnnouncement,normalizeComPermissions,ANNOUNCEMENT_AUDIENCES
} from "../../../../../lib/school-communications.mjs";
import {ApiError,checked,jsonError,requireAal2} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"private, no-store"};
const take=(rows,limit)=>rows.slice(0,limit);
function failUnless(ok,message){if(!ok)throw new ApiError(403,message);}
function withOffset(value){
 if(typeof value!=="string"||!/(?:Z|[+-]\d\d:\d\d)$/.test(value)||value.length>50)
  throw new ApiError(400,"Use a date and time with its timezone");
 const d=new Date(value);
 if(Number.isNaN(d.getTime()))throw new ApiError(400,"Invalid calendar date");
 return d.toISOString();
}
function isVisibleTo(a,ctx){
 return canViewAnnouncement({...a,status:a.status==="scheduled"?"published":a.status,
   expires_at:null},ctx);
}
async function contactGraph(db,ctx){
 const {school,year}=ctx;
 if(!year||(!ctx.teacher&&!ctx.parent))return {contacts:[],pairs:new Set(),roster:[]};
 const assignments=await checked(db.from("school_teacher_assignments")
  .select("class_id,subject_id,teacher_id").eq("school_id",school.id)
  .eq("active",true).limit(1500));
 const currentClasses=await checked(db.from("school_classes")
  .select("id,name,academic_year_id,status").eq("school_id",school.id)
  .eq("academic_year_id",year.id).eq("status","active").limit(600));
 const classById=new Map(currentClasses.map(c=>[c.id,c]));
 const activeAssign=assignments.filter(a=>classById.has(a.class_id));
 const teacherIds=[...new Set(activeAssign.map(a=>a.teacher_id))];
 const activeTeacherMembers=teacherIds.length?await checked(db.from("school_memberships")
  .select("auth_user_id").eq("school_id",school.id).eq("role","teacher")
  .eq("active",true).in("auth_user_id",teacherIds).limit(500)):[];
 const activeTeachers=new Set(activeTeacherMembers.map(m=>m.auth_user_id));
 const verifiedAssignments=activeAssign.filter(a=>activeTeachers.has(a.teacher_id));
 const eligibleClassIds=ctx.parent
  ?[...new Set(ctx.enrollments.map(e=>e.class_id).filter(id=>classById.has(id)))]
  :[...new Set(verifiedAssignments.filter(a=>a.teacher_id===ctx.user.id).map(a=>a.class_id))];
 if(!eligibleClassIds.length)return {contacts:[],pairs:new Set(),roster:[]};
 const enrollments=await checked(db.from("school_student_enrollments")
  .select("student_id,class_id").eq("school_id",school.id)
  .eq("academic_year_id",year.id).eq("status","active")
  .in("class_id",eligibleClassIds).limit(1200));
 const studentIds=[...new Set(enrollments.map(e=>e.student_id))];
 const [students,guardians,subs]=await Promise.all([
  studentIds.length?checked(db.from("school_students")
   .select("id,student_code,first_name,last_name").eq("school_id",school.id)
   .eq("status","active").in("id",studentIds).limit(1000)):Promise.resolve([]),
  studentIds.length?checked(db.from("school_guardian_links")
   .select("student_id,auth_user_id").eq("school_id",school.id)
   .eq("active",true).in("student_id",studentIds).limit(1500)):Promise.resolve([]),
  checked(db.from("school_subjects").select("id,name").eq("school_id",school.id).limit(300))
 ]);
 const guardianIds=[...new Set(guardians.map(g=>g.auth_user_id))];
 const currentGuardianMembers=guardianIds.length?await checked(db.from("school_memberships")
  .select("auth_user_id").eq("school_id",school.id).eq("role","parent")
  .eq("active",true).in("auth_user_id",guardianIds).limit(1000)):[];
 const activeGuardians=new Set(currentGuardianMembers.map(m=>m.auth_user_id));
 const names=new Map(students.map(st=>[st.id,st.first_name+" "+st.last_name]));
 const codes=new Map(students.map(st=>[st.id,st.student_code]));
 const subjects=new Map(subs.map(x=>[x.id,x.name]));
 const pairs=new Set();
 const contacts=[];
 const roster=[];
 for(const enrollment of enrollments){
  const studentName=names.get(enrollment.student_id);
  if(!studentName)continue;
  const authorizedGuardians=guardians.filter(g=>g.student_id===enrollment.student_id&&activeGuardians.has(g.auth_user_id));
  const classAssignments=verifiedAssignments.filter(a=>a.class_id===enrollment.class_id);
  if(ctx.teacher&&classAssignments.some(a=>a.teacher_id===ctx.user.id)){
   roster.push({studentId:enrollment.student_id,name:studentName,
    code:codes.get(enrollment.student_id),classId:enrollment.class_id});
  }
  for(const a of classAssignments){
   for(const g of authorizedGuardians){
    if(!(ctx.teacher&&a.teacher_id===ctx.user.id) &&
       !(ctx.parent&&g.auth_user_id===ctx.user.id))continue;
    const key=[enrollment.student_id,a.teacher_id,g.auth_user_id].join("#");
    pairs.add(key);
    contacts.push({
      key,studentId:enrollment.student_id,studentName,
      className:classById.get(enrollment.class_id)?.name||"Class",
      teacherId:a.teacher_id,guardianId:g.auth_user_id,
      subjectName:subjects.get(a.subject_id)||"Subject",
      label:ctx.teacher?"Verified guardian of "+studentName:
        "Teacher · "+(subjects.get(a.subject_id)||"Subject")+" · "+studentName
    });
   }
  }
 }
 const uniqueContacts=[...new Map(contacts.map(c=>[c.key,c])).values()];
 return {contacts:take(uniqueContacts,300),pairs,roster:take(roster,500)};
}
export async function GET(request,{params}){
 try{
  const {code}=await params;
  const ctx=await communicationsContext(request,code);
  const {db,school,user,year}=ctx;
  const managers=ctx.managerTimetable||ctx.managerAnnouncements;
  const [allClasses,allSubjects,schoolTimetable,rawAnnouncements,rawEvents]=await Promise.all([
   checked(db.from("school_classes").select("id,name,section,academic_year_id,status")
    .eq("school_id",school.id).eq("status","active").limit(700)),
   checked(db.from("school_subjects").select("id,name,code").eq("school_id",school.id).limit(400)),
   year?checked(db.from("school_timetable_periods")
    .select("id,academic_year_id,class_id,subject_id,teacher_id,weekday,starts_at,ends_at,room,active")
    .eq("school_id",school.id).eq("academic_year_id",year.id).eq("active",true)
    .order("weekday",{ascending:true}).order("starts_at",{ascending:true}).limit(1400)):Promise.resolve([]),
   checked(db.from("school_announcements")
    .select("id,audience,class_id,title,body,status,published_at,expires_at,author_id")
    .eq("school_id",school.id).eq("status","published")
    .order("published_at",{ascending:false}).limit(800)),
   checked(db.from("school_calendar_events")
    .select("id,audience,class_id,kind,title,details,starts_at,ends_at,location,status")
    .eq("school_id",school.id).eq("status","scheduled")
    .gte("ends_at",new Date(Date.now()-14*86400000).toISOString())
    .order("starts_at",{ascending:true}).limit(800))
  ]);
  const activeClassIds=new Set(allClasses.filter(c=>c.academic_year_id===year?.id).map(x=>x.id));
  const visibleClasses=allClasses.filter(c=>c.academic_year_id===year?.id&&
   (managers||ctx.classIds.includes(c.id)));
  const myAssignments=ctx.teacherAssignments.filter(a=>activeClassIds.has(a.class_id));
  const pairsAllowedForTeacher=new Set(myAssignments.map(a=>a.class_id+"#"+a.subject_id));
  const allTimetable=schoolTimetable.filter(p=>activeClassIds.has(p.class_id));
  // If a teacher's subject assignment was revoked, their old timetable
  // does not continue to authorize them or expose their former class.
  const timetable=allTimetable.filter(p=>
   ctx.managerTimetable||
   (ctx.teacher&&p.teacher_id===user.id&&pairsAllowedForTeacher.has(p.class_id+"#"+p.subject_id))||
   ((ctx.parent||ctx.student)&&ctx.enrollments.some(e=>e.class_id===p.class_id)));
  const contextForAudience={...ctx,classIds:visibleClasses.map(x=>x.id)};
  const announcements=rawAnnouncements.filter(a=>ctx.managerAnnouncements||canViewAnnouncement(a,contextForAudience));
  const events=rawEvents.filter(e=>ctx.managerAnnouncements||isVisibleTo(e,contextForAudience));
  const graph=await contactGraph(db,ctx);
  let threads=[],messages=[],notifications=[];
  if(ctx.teacher||ctx.parent){
   const [ownTeacherThreads,ownGuardianThreads]=await Promise.all([
    ctx.teacher?checked(db.from("school_family_message_threads")
      .select("id,student_id,teacher_id,guardian_id,status,opened_at")
      .eq("school_id",school.id).eq("teacher_id",user.id)
      .order("opened_at",{ascending:false}).limit(250)):Promise.resolve([]),
    ctx.parent?checked(db.from("school_family_message_threads")
      .select("id,student_id,teacher_id,guardian_id,status,opened_at")
      .eq("school_id",school.id).eq("guardian_id",user.id)
      .order("opened_at",{ascending:false}).limit(250)):Promise.resolve([])
   ]);
   const byId=new Map([...ownTeacherThreads,...ownGuardianThreads].map(t=>[t.id,t]));
   threads=[...byId.values()].filter(t=>graph.pairs.has([
     t.student_id,t.teacher_id,t.guardian_id
   ].join("#")));
   const ids=threads.map(t=>t.id);
   if(ids.length){
    [messages,notifications]=await Promise.all([
     checked(db.from("school_family_messages")
      .select("id,thread_id,sender_id,body,created_at")
      .eq("school_id",school.id).in("thread_id",ids)
      .order("created_at",{ascending:false}).limit(1200)),
     checked(db.from("school_message_notifications")
      .select("id,thread_id,message_id,created_at,read_at,email_status")
      .eq("school_id",school.id).eq("recipient_id",user.id)
      .in("thread_id",ids).order("created_at",{ascending:false}).limit(200))
    ]);
   }
  }
  let family=[];
  if(ctx.parent&&ctx.childIds.length){
   const linkedIds=ctx.childIds;
   const [students,homework,attendance,reports]=await Promise.all([
    checked(db.from("school_students").select("id,first_name,last_name,student_code")
     .eq("school_id",school.id).eq("status","active")
     .in("id",linkedIds).limit(100)),
    ctx.enrollments.length?checked(db.from("school_homework")
     .select("id,class_id,title,due_at,subject_id,status")
     .eq("school_id",school.id).eq("status","published")
     .in("class_id",[...new Set(ctx.enrollments.map(e=>e.class_id))])
     .gte("due_at",new Date(Date.now()-7*86400000).toISOString())
     .order("due_at",{ascending:true}).limit(300)):Promise.resolve([]),
    checked(db.from("school_attendance_records")
     .select("student_id,class_id,attendance_on,status")
     .eq("school_id",school.id).in("student_id",linkedIds)
     .order("attendance_on",{ascending:false}).limit(800)),
    checked(db.from("school_published_reports")
     .select("id,student_id,term_id,published_at").eq("school_id",school.id)
     .eq("status","published").in("student_id",linkedIds)
     .order("published_at",{ascending:false}).limit(300))
   ]);
   const sMap=new Map(students.map(s=>[s.id,s]));
   family=ctx.enrollments.filter(e=>sMap.has(e.student_id)).map(e=>{
    const st=sMap.get(e.student_id);
    const pending=homework.filter(h=>h.class_id===e.class_id);
    const days=attendance.filter(a=>a.student_id===st.id&&a.class_id===e.class_id);
    return {
     studentId:st.id,name:st.first_name+" "+st.last_name,studentCode:st.student_code,
     classId:e.class_id,className:visibleClasses.find(c=>c.id===e.class_id)?.name||"School class",
     upcomingHomework:take(pending,12).map(h=>({title:h.title,dueAt:h.due_at,subjectId:h.subject_id})),
     recordedAttendance:take(days,20),
     publishedReportCount:reports.filter(r=>r.student_id===st.id).length
    };
   });
  }
  let teachingAssignments=[],teachers=[];
  if(ctx.managerTimetable&&year){
   const [a,teacherMembers,invites]=await Promise.all([
    checked(db.from("school_teacher_assignments")
     .select("class_id,subject_id,teacher_id,active")
     .eq("school_id",school.id).eq("active",true).limit(1200)),
    checked(db.from("school_memberships").select("auth_user_id")
     .eq("school_id",school.id).eq("role","teacher").eq("active",true).limit(500)),
    checked(db.from("school_role_invites").select("claimed_by,email")
     .eq("school_id",school.id).eq("role","teacher").eq("status","claimed")
     .not("claimed_by","is",null).limit(500))
   ]);
   const memberIds=new Set(teacherMembers.map(x=>x.auth_user_id));
   const emailById=new Map(invites.map(x=>[x.claimed_by,x.email]));
   teachingAssignments=a.filter(x=>
      activeClassIds.has(x.class_id)&&memberIds.has(x.teacher_id));
   teachers=teacherMembers.map(t=>({userId:t.auth_user_id,
     label:emailById.get(t.auth_user_id)||"Verified school teacher"}));
  }
  let adminGrants=[];
  if(ctx.owner){
   const [adminMembers,grants,claimed]=await Promise.all([
    checked(db.from("school_memberships").select("auth_user_id")
     .eq("school_id",school.id).eq("role","school_admin").eq("active",true).limit(300)),
    checked(db.from("school_communication_permissions").select("auth_user_id,permissions")
     .eq("school_id",school.id).limit(300)),
    checked(db.from("school_role_invites").select("claimed_by,email")
     .eq("school_id",school.id).eq("role","school_admin").eq("status","claimed")
     .not("claimed_by","is",null).limit(300))
   ]);
   const pm=new Map(grants.map(p=>[p.auth_user_id,p.permissions]));
   const em=new Map(claimed.map(p=>[p.claimed_by,p.email]));
   adminGrants=adminMembers.map(a=>({userId:a.auth_user_id,
     email:em.get(a.auth_user_id)||"Verified administrator",
     permissions:pm.get(a.auth_user_id)||[]}));
  }
  const noticeReads=announcements.length?await checked(db.from("school_announcement_reads")
   .select("announcement_id,read_at").eq("school_id",school.id)
   .eq("auth_user_id",user.id).in("announcement_id",announcements.map(x=>x.id))
   .limit(800)):[];
  const [liveBrand,draftBrand]=await Promise.all([
   checked(db.from("platform_school_sites").select("logo_url,primary_color")
    .eq("school_id",school.id).maybeSingle()),
   checked(db.from("school_site_drafts").select("logo_url,primary_color")
    .eq("school_id",school.id).maybeSingle())
  ]);
  const brand=liveBrand?.logo_url?liveBrand:(draftBrand||liveBrand);
  return Response.json({
   school:{name:school.name,code:school.school_code,logoUrl:brand?.logo_url||null,
    primaryColor:brand?.primary_color||"#204a78"},
   actor:{id:user.id,roles:ctx.roles,owner:ctx.owner,
    managerTimetable:ctx.managerTimetable,
    managerAnnouncements:ctx.managerAnnouncements},
   year,classes:visibleClasses,subjects:allSubjects,
   timetable,announcements,events,noticeReads,threads,messages,
   notifications,contacts:graph.contacts,roster:graph.roster,family,adminGrants,
   teachingAssignments,teachers,
   limitations:{emailAlerts:"not_configured",smsAlerts:"not_configured",
     limits:"Loaded records are capped; not full school totals"}
  },{headers:noStore});
 }catch(e){return jsonError(e)}
}
export async function POST(request,{params}){
 try{
  const {code}=await params;
  const ctx=await communicationsContext(request,code);
  const {db,school,user,token}=ctx;
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||"");
  let result;
  if(action==="permissions.set"){
   failUnless(ctx.owner,"Only the school owner can delegate communication rights");
   requireAal2(token);
   result=await checked(db.rpc("school_set_comms_permissions",{
    p_school:school.id,p_target:comId(body.userId,"administrator"),
    p_permissions:normalizeComPermissions(body.permissions||[]),
    p_reason:comText(body.reason,500,{min:8}),p_actor:user.id
   }));
  }else if(action==="period.add"){
   failUnless(ctx.managerTimetable,"Timetable management permission required");
   requireAal2(token);
   const day=Number(body.weekday);
   if(!Number.isInteger(day)||day<1||day>7)throw new ApiError(400,"Invalid weekday");
   result=await checked(db.rpc("school_add_timetable_period",{
    p_school:school.id,p_class:comId(body.classId,"class"),
    p_subject:comId(body.subjectId,"subject"),
    p_teacher:comId(body.teacherId,"teacher"),p_day:day,
    p_start:validClock(body.start),p_end:validClock(body.end),
    p_room:typeof body.room==="string"?body.room.slice(0,60):"",
    p_actor:user.id
   }));
  }else if(action==="period.disable"){
   failUnless(ctx.managerTimetable,"Timetable management permission required");
   requireAal2(token);
   result=await checked(db.rpc("school_disable_timetable_period",{
    p_school:school.id,p_period:comId(body.periodId,"period"),
    p_reason:comText(body.reason,500,{min:8}),p_actor:user.id
   }));
  }else if(action==="announcement.publish"){
   failUnless(ctx.managerAnnouncements,"School announcements management permission required");
   requireAal2(token);
   const audience=String(body.audience||"");
   if(!ANNOUNCEMENT_AUDIENCES.includes(audience))throw new ApiError(400,"Invalid audience");
   result=await checked(db.rpc("school_publish_announcement",{
    p_school:school.id,p_title:comText(body.title,160,{min:3}),
    p_body:comText(body.text,4000,{min:3}),p_audience:audience,
    p_class:audience==="class"?comId(body.classId,"class"):null,
    p_expiration:validDateTime(body.expiresAt),p_actor:user.id
   }));
  }else if(action==="announcement.archive"){
   failUnless(ctx.managerAnnouncements,"School announcements management permission required");
   requireAal2(token);
   result=await checked(db.rpc("school_archive_announcement",{
    p_school:school.id,p_id:comId(body.announcementId,"announcement"),
    p_reason:comText(body.reason,500,{min:8}),p_actor:user.id
   }));
  }else if(action==="announcement.read"){
   const id=comId(body.announcementId,"announcement");
   const notice=await checked(db.from("school_announcements")
    .select("id,audience,class_id,status,expires_at").eq("school_id",school.id)
    .eq("id",id).maybeSingle());
   const allowedClasses=ctx.year&&ctx.classIds.length?await checked(db.from("school_classes")
     .select("id").eq("school_id",school.id).eq("academic_year_id",ctx.year.id)
     .eq("status","active").in("id",ctx.classIds).limit(500)):[];
   failUnless(notice&&(ctx.managerAnnouncements||canViewAnnouncement(notice,{
    ...ctx,classIds:allowedClasses.map(c=>c.id)
   })),"Announcement isn't available to this account");
   await checked(db.from("school_announcement_reads").upsert({
    school_id:school.id,announcement_id:id,auth_user_id:user.id
   },{onConflict:"school_id,announcement_id,auth_user_id",ignoreDuplicates:true}));
   result={read:true};
  }else if(action==="calendar.schedule"){
   failUnless(ctx.managerAnnouncements,"School calendar management permission required");
   requireAal2(token);
   const kind=String(body.kind||"");
   if(!["exam","meeting","holiday","activity","closure","other"].includes(kind))
    throw new ApiError(400,"Invalid school event type");
   const audience=String(body.audience||"");
   if(!ANNOUNCEMENT_AUDIENCES.includes(audience))throw new ApiError(400,"Invalid audience");
   result=await checked(db.rpc("school_schedule_calendar_event",{
    p_school:school.id,p_title:comText(body.title,160,{min:3}),
    p_details:typeof body.details==="string"?body.details.slice(0,1500):"",
    p_kind:kind,p_audience:audience,
    p_class:audience==="class"?comId(body.classId,"class"):null,
    p_start:withOffset(body.startsAt),p_end:withOffset(body.endsAt),
    p_location:typeof body.location==="string"?body.location.slice(0,120):"",
    p_actor:user.id
   }));
  }else if(action==="calendar.cancel"){
   failUnless(ctx.managerAnnouncements,"School calendar management permission required");
   requireAal2(token);
   result=await checked(db.rpc("school_cancel_calendar_event",{
    p_school:school.id,p_event:comId(body.eventId,"event"),
    p_reason:comText(body.reason,500,{min:8}),p_actor:user.id
   }));
  }else if(action==="thread.open"){
   failUnless(ctx.teacher||ctx.parent,"Only verified teachers and guardians can message");
   result=await checked(db.rpc("school_open_family_thread",{
    p_school:school.id,p_student:comId(body.studentId,"student"),
    p_teacher:comId(body.teacherId,"teacher"),
    p_guardian:comId(body.guardianId,"guardian"),p_actor:user.id
   }));
  }else if(action==="thread.message"){
   failUnless(ctx.teacher||ctx.parent,"Only verified teachers and guardians can message");
   result=await checked(db.rpc("school_send_family_message",{
    p_school:school.id,p_thread:comId(body.threadId,"conversation"),
    p_message:comText(body.text,2000),p_actor:user.id
   }));
  }else if(action==="thread.close"){
   failUnless(ctx.teacher||ctx.parent,"Only verified participants can close conversations");
   result=await checked(db.rpc("school_close_family_thread",{
    p_school:school.id,p_thread:comId(body.threadId,"conversation"),
    p_reason:comText(body.reason,500,{min:8}),p_actor:user.id
   }));
  }else if(action==="notification.read"){
   result=await checked(db.rpc("school_read_message_notification",{
    p_school:school.id,p_notification:comId(body.notificationId,"notification"),
    p_actor:user.id
   }));
  }else throw new ApiError(400,"Unsupported communications action");
  return Response.json({ok:true,result},{headers:noStore});
 }catch(e){return jsonError(e)}
}
