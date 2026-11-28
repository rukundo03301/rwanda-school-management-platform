import {schoolVerifiedContext} from "../../../../../lib/school-admin.mjs";
import {checked,jsonError} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
// Students this account may see: the parent's verified children, or the student themself.
async function permitted(db,school,user){
  const [memberships,linkedChildren,studentAccount]=await Promise.all([
    checked(db.from("school_memberships")
      .select("role").eq("school_id",school.id).eq("auth_user_id",user.id)
      .eq("active",true).in("role",["parent","student"])),
    checked(db.from("school_guardian_links")
      .select("student_id,relationship").eq("school_id",school.id)
      .eq("auth_user_id",user.id).eq("active",true).limit(100)),
    checked(db.from("school_student_accounts")
      .select("student_id").eq("school_id",school.id)
      .eq("auth_user_id",user.id).eq("active",true).maybeSingle())
  ]);
  const isParent=memberships.some(m=>m.role==="parent");
  const isStudent=memberships.some(m=>m.role==="student");
  const permittedStudents=new Set([
    ...(isParent?linkedChildren.map(g=>g.student_id):[]),
    ...(isStudent&&studentAccount?[studentAccount.student_id]:[])
  ]);
  return {isParent,isStudent,studentIds:[...permittedStudents]};
}
// Records that a parent or student opened a published term report (clears its notification).
export async function POST(request,{params}){
 try{
  const {code}=await params;
  const {db,school,user}=await schoolVerifiedContext(request,code);
  const body=await request.json().catch(()=>({}));
  if(body.action!=="viewed"||!/^[0-9a-f-]{36}$/i.test(String(body.reportId||"")))return Response.json({error:"Unknown action"},{status:400});
  const {studentIds}=await permitted(db,school,user);
  const row=studentIds.length?await checked(db.from("school_term_reports").select("id").eq("school_id",school.id)
    .eq("id",body.reportId).eq("status","published").in("student_id",studentIds).maybeSingle()):null;
  if(!row)return Response.json({error:"Report not found"},{status:404});
  const done=await checked(db.from("school_report_audit").select("id").eq("school_id",school.id).eq("actor_id",user.id)
    .eq("event","term_report.viewed").eq("resource_id",row.id).limit(1));
  if(!done.length)await checked(db.from("school_report_audit").insert({school_id:school.id,actor_id:user.id,event:"term_report.viewed",resource_id:row.id,metadata:{}}));
  return Response.json({ok:true},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return jsonError(e)}
}
export async function GET(request,{params}){
 try{
  const {code}=await params;
  const {db,school,user}=await schoolVerifiedContext(request,code);
  // Client may not request another student ID, even knowing its UUID.
  const {isParent,isStudent,studentIds}=await permitted(db,school,user);
  let reports=[];
  if(studentIds.length){
    reports=await checked(db.from("school_published_reports")
      .select("id,student_id,term_id,class_id,report_data,published_at")
      .eq("school_id",school.id).eq("status","published")
      .in("student_id",studentIds).order("published_at",{ascending:false}).limit(300));
  }
  // Term reports for every level: same verified-link scope, published only, never drafts.
  let nurseryReports=[];
  if(studentIds.length){
    const rows=await checked(db.from("school_term_reports")
      .select("id,student_id,class_id,academic_year_id,term_number,template,content,teacher_comment,reviewer_comment,headteacher_comment,published_at")
      .eq("school_id",school.id).eq("status","published")
      .in("student_id",studentIds).order("published_at",{ascending:false}).limit(100));
    if(rows.length){
      const uniq=a=>[...new Set(a)];
      const [kids,classes,years]=await Promise.all([
        checked(db.from("school_students").select("id,first_name,last_name,student_code").eq("school_id",school.id).in("id",uniq(rows.map(r=>r.student_id)))),
        checked(db.from("school_classes").select("id,name,section").eq("school_id",school.id).in("id",uniq(rows.map(r=>r.class_id)))),
        checked(db.from("school_academic_years").select("id,name").eq("school_id",school.id).in("id",uniq(rows.map(r=>r.academic_year_id))))
      ]);
      const k=new Map(kids.map(x=>[x.id,x])),c=new Map(classes.map(x=>[x.id,x])),y=new Map(years.map(x=>[x.id,x]));
      nurseryReports=rows.map(r=>({id:r.id,term:r.term_number,published_at:r.published_at,
        student_name:[k.get(r.student_id)?.first_name,k.get(r.student_id)?.last_name].filter(Boolean).join(" "),
        student_code:k.get(r.student_id)?.student_code||"",
        class_name:c.get(r.class_id)?.name||"",academic_year:y.get(r.academic_year_id)?.name||"",
        template:r.template,content:r.content||{},teacher_comment:r.teacher_comment||"",
        reviewer_comment:r.reviewer_comment||"",headteacher_comment:r.headteacher_comment||""}));
    }
  }
  // Branding comes from the published website only. A private draft logo or
    // colour is never returned here, because this endpoint answers any signed-in
    // user of an active school (with an empty report list when they are unlinked).
    const branding=await checked(db.from("platform_school_sites")
      .select("logo_url,primary_color,is_published").eq("school_id",school.id).maybeSingle());
    const live=branding?.is_published===true?branding:null;
  // All results are already filtered by verified parent-child link or
  // the student's unique school-issued identity.
  return Response.json({
    school:{name:school.name,code:school.school_code,
      logoUrl:live?.logo_url||null,
      primaryColor:live?.primary_color||"#204a78"},
    reports,nurseryReports,role:isParent?"parent":isStudent?"student":"unlinked"
  },{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return jsonError(e)}
}
