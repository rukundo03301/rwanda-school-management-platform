import {communicationsContext,canViewAnnouncement} from "../../../../../lib/school-communications.mjs";
import {checked,jsonError} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
// Which report statuses each permission can move on (approve may skip the review step).
const CAN={"reports.review":["submitted"],"reports.approve":["submitted","reviewed"],"reports.publish":["approved"]};
const VERB={submitted:"review",reviewed:"approve",approved:"publish"};

// One notification list for every school role. Each item links to the exact page that
// resolves it, so the bell and every entry in it can be opened.
export async function GET(request,{params}){
 try{
  const {code}=await params;
  const ctx=await communicationsContext(request,code);
  const {db,school,user,year}=ctx;
  const base="/s/"+school.school_code+"/";
  const items=[];
  const add=(id,title,detail,href,at,tone="blue")=>items.push({id,title,detail:String(detail||"").slice(0,140),href,at:at||null,tone});
  const nameOf=s=>[s?.first_name,s?.last_name].filter(Boolean).join(" ")||"Student";
  const students=async ids=>ids.length?new Map((await checked(db.from("school_students").select("id,first_name,last_name")
   .eq("school_id",school.id).in("id",[...new Set(ids)]).limit(500))).map(s=>[s.id,nameOf(s)])):new Map();

  // Unread parent and teacher messages open their conversation.
  const unread=await checked(db.from("school_message_notifications").select("id,thread_id,message_id,created_at")
   .eq("school_id",school.id).eq("recipient_id",user.id).is("read_at",null).order("created_at",{ascending:false}).limit(20));
  if(unread.length){
   const msgs=await checked(db.from("school_family_messages").select("id,body").eq("school_id",school.id)
    .in("id",unread.map(n=>n.message_id)).limit(20));
   const body=new Map(msgs.map(m=>[m.id,m.body]));
   for(const n of unread)add("msg:"+n.id,"New message",body.get(n.message_id)||"Open the conversation",
    base+"communications?tab=messages&thread="+n.thread_id+"&notification="+n.id,n.created_at,"purple");
  }

  // Unread announcements this account is allowed to see.
  const notices=await checked(db.from("school_announcements").select("id,audience,class_id,title,status,published_at,expires_at")
   .eq("school_id",school.id).eq("status","published").order("published_at",{ascending:false}).limit(40));
  const visible=notices.filter(a=>ctx.managerAnnouncements||canViewAnnouncement(a,ctx));
  if(visible.length){
   const reads=new Set((await checked(db.from("school_announcement_reads").select("announcement_id").eq("school_id",school.id)
    .eq("auth_user_id",user.id).in("announcement_id",visible.map(a=>a.id)).limit(40))).map(r=>r.announcement_id));
   for(const a of visible.filter(a=>!reads.has(a.id)).slice(0,10))
    add("notice:"+a.id,"School announcement",a.title,base+"communications?tab=announcements&notice="+a.id,a.published_at,"orange");
  }

  // Teachers: homework waiting for a grade, and term reports sent back to them.
  if(ctx.teacher&&ctx.teacherAssignments.length){
   const hw=await checked(db.from("school_homework").select("id,class_id,title").eq("school_id",school.id)
    .eq("teacher_id",user.id).eq("status","published").limit(250));
   const pairs=new Set(ctx.teacherAssignments.map(a=>a.class_id));
   const mine=hw.filter(h=>pairs.has(h.class_id));
   if(mine.length){
    const subs=await checked(db.from("school_homework_submissions").select("id,homework_id,student_id,submitted_at")
     .eq("school_id",school.id).in("homework_id",mine.map(h=>h.id)).is("graded_at",null).order("submitted_at",{ascending:false}).limit(30));
    const names=await students(subs.map(s=>s.student_id)),title=new Map(mine.map(h=>[h.id,h.title]));
    for(const s of subs)add("grade:"+s.id,"Homework to grade",(names.get(s.student_id)||"Student")+" · "+(title.get(s.homework_id)||"Homework"),
     base+"classroom?tab=submissions&submission="+s.id,s.submitted_at,"orange");
   }
  }
  if(year&&(ctx.teacher||ctx.owner||ctx.admin)){
   const returned=await checked(db.from("school_term_reports").select("id,class_id,student_id,term_number,return_reason,updated_at")
    .eq("school_id",school.id).eq("academic_year_id",year.id).eq("drafted_by",user.id).eq("status","returned").limit(30));
   const names=await students(returned.map(r=>r.student_id));
   for(const r of returned)add("tr-ret:"+r.id,"Report returned to you",(names.get(r.student_id)||"Student")+" · Term "+r.term_number+": "+r.return_reason,
    base+"term-reports?tab=write&class="+r.class_id+"&term="+r.term_number+"&student="+r.student_id,r.updated_at,"red");
  }

  // People the owner chose to review, approve or publish term reports.
  if(year&&(ctx.owner||ctx.admin||ctx.teacher||ctx.roles.includes("staff"))){
   const perms=ctx.owner?["reports.review","reports.approve","reports.publish"]:((await checked(db.from("school_report_roles")
    .select("permissions").eq("school_id",school.id).eq("auth_user_id",user.id).maybeSingle()))?.permissions||[]);
   const statuses=[...new Set(perms.flatMap(p=>CAN[p]||[]))];
   if(statuses.length){
    const waiting=await checked(db.from("school_term_reports").select("id,student_id,term_number,status,drafted_by,updated_at")
     .eq("school_id",school.id).eq("academic_year_id",year.id).in("status",statuses).order("updated_at",{ascending:false}).limit(30));
    const names=await students(waiting.map(r=>r.student_id));
    for(const r of waiting.filter(r=>!(r.status==="submitted"&&r.drafted_by===user.id)))
     add("tr-q:"+r.id,"Term report to "+(r.status==="submitted"&&!perms.includes("reports.review")?"approve":VERB[r.status]),(names.get(r.student_id)||"Student")+" · Term "+r.term_number,
      base+"term-reports?tab=queue&report="+r.id,r.updated_at,"blue");
   }
  }

  // Parents and students: published reports and homework still to do.
  const learners=[...new Set([...ctx.childIds,...(ctx.studentId?[ctx.studentId]:[])])];
  if(learners.length&&year){
   const since=new Date(Date.now()-45*86400000).toISOString();
   const published=await checked(db.from("school_term_reports").select("id,student_id,term_number,published_at")
    .eq("school_id",school.id).in("student_id",learners).eq("status","published").gte("published_at",since).limit(20));
   const viewed=published.length?new Set((await checked(db.from("school_report_audit").select("resource_id").eq("school_id",school.id)
    .eq("actor_id",user.id).eq("event","term_report.viewed").in("resource_id",published.map(r=>r.id)).limit(40))).map(v=>v.resource_id)):new Set();
   const names=await students(learners);
   for(const r of published.filter(r=>!viewed.has(r.id)))add("tr-pub:"+r.id,"Term report published",(names.get(r.student_id)||"Student")+" · Term "+r.term_number,
    base+"report-card?report="+r.id,r.published_at,"green");
   const classOf=new Map(ctx.enrollments.map(e=>[e.student_id,e.class_id]));
   const classes=[...new Set(ctx.enrollments.map(e=>e.class_id))];
   if(classes.length){
    const hw=await checked(db.from("school_homework").select("id,class_id,title,due_at,published_at").eq("school_id",school.id)
     .in("class_id",classes).eq("status","published").gte("due_at",new Date(Date.now()-86400000).toISOString())
     .order("due_at",{ascending:true}).limit(60));
    const done=hw.length?new Set((await checked(db.from("school_homework_submissions").select("homework_id,student_id")
     .eq("school_id",school.id).in("homework_id",hw.map(h=>h.id)).in("student_id",learners).limit(600))).map(s=>s.homework_id+"#"+s.student_id)):new Set();
    const home=ctx.parent?"family":"learning";
    for(const sid of learners)for(const h of hw.filter(h=>h.class_id===classOf.get(sid)&&!done.has(h.id+"#"+sid)).slice(0,5))
     add("hw:"+h.id+":"+sid,"Homework due "+new Date(h.due_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"Africa/Kigali"}),
      (ctx.parent?(names.get(sid)||"Child")+" · ":"")+h.title,base+home+"?tab=homework&homework="+h.id,h.published_at||h.due_at,"purple");
   }
  }

  // School leaders: requests and maintenance that need a decision.
  if(ctx.owner||ctx.admin){
   const [reqs,maint]=await Promise.all([
    checked(db.from("school_staff_requests").select("id,kind,title,created_at").eq("school_id",school.id).eq("status","pending")
     .order("created_at",{ascending:false}).limit(15)),
    checked(db.from("school_maintenance_requests").select("id,title,priority,created_at").eq("school_id",school.id)
     .in("status",["open","in_progress"]).order("created_at",{ascending:false}).limit(15))
   ]);
   for(const r of reqs)add("req:"+r.id,"Request to decide",r.title,base+"requests?request="+r.id,r.created_at,"orange");
   for(const m of maint)add("maint:"+m.id,m.priority==="urgent"?"Urgent maintenance":"Maintenance request",m.title,base+"operations?tab=maintenance&request="+m.id,m.created_at,m.priority==="urgent"?"red":"orange");
  }

  items.sort((a,b)=>String(b.at||"").localeCompare(String(a.at||"")));
  return Response.json({items:items.slice(0,40),total:items.length},{headers});
 }catch(e){return jsonError(e);}
}
