import {schoolVerifiedContext} from "../../../../../lib/school-admin.mjs";
import {checked,jsonError} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request,{params}){
 try{
  const {code}=await params;
  const {db,school,user}=await schoolVerifiedContext(request,code);
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
  // Client may not request another student ID, even knowing its UUID.
  const studentIds=[...permittedStudents];
  let reports=[];
  if(studentIds.length){
    reports=await checked(db.from("school_published_reports")
      .select("id,student_id,term_id,class_id,report_data,published_at")
      .eq("school_id",school.id).eq("status","published")
      .in("student_id",studentIds).order("published_at",{ascending:false}).limit(300));
  }
  const [published,draft]=await Promise.all([
    checked(db.from("platform_school_sites")
      .select("logo_url,primary_color").eq("school_id",school.id).maybeSingle()),
    checked(db.from("school_site_drafts")
      .select("logo_url,primary_color").eq("school_id",school.id).maybeSingle())
  ]);
  const branding=published?.logo_url?published:(draft||published);
  // All results are already filtered by verified parent-child link or
  // the student's unique school-issued identity.
  return Response.json({
    school:{name:school.name,code:school.school_code,
      logoUrl:branding?.logo_url||null,
      primaryColor:branding?.primary_color||"#204a78"},
    reports,role:isParent?"parent":isStudent?"student":"unlinked"
  },{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return jsonError(e)}
}
