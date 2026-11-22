import {guardianContext} from "../../../../../lib/school-admissions.mjs";
import {ApiError,checked,jsonError,validateUuid} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request,{params}){
 try{
  const {code}=await params;
  const {db,user,school,isLinkedParent}=await guardianContext(request,code);
  const invitations=await checked(db.from("school_guardian_invitations")
    .select("student_id,relationship,expires_at")
    .eq("school_id",school.id)
    .eq("email",user.email.trim().toLowerCase())
    .eq("status","pending").gt("expires_at",new Date().toISOString())
    .limit(50));
  let children=[];
  if(isLinkedParent){
    const links=await checked(db.from("school_guardian_links")
      .select("student_id,relationship,verified_at")
      .eq("school_id",school.id).eq("auth_user_id",user.id)
      .eq("active",true).limit(100));
    if(links.length){
      const ids=links.map(x=>x.student_id);
      const currentYear=await checked(db.from("school_academic_years")
        .select("id").eq("school_id",school.id).eq("status","current").maybeSingle());
      const students=await checked(db.from("school_students")
        .select("id,student_code,first_name,last_name,status")
        .eq("school_id",school.id).in("id",ids).eq("status","active"));
      // No arbitrary "first active" enrollment from a previous year.
      const enrollments=currentYear?await checked(db.from("school_student_enrollments")
        .select("student_id,class_id,academic_year_id,status")
        .eq("school_id",school.id).eq("academic_year_id",currentYear.id)
        .in("student_id",ids).eq("status","active")):[];
      const classIds=[...new Set(enrollments.map(x=>x.class_id))];
      const classes=classIds.length?await checked(db.from("school_classes")
        .select("id,name,section").eq("school_id",school.id).in("id",classIds)):[];
      const classMap=new Map(classes.map(c=>[c.id,c]));
      const linkMap=new Map(links.map(l=>[l.student_id,l]));
      children=students.map(stu=>{
        const enrollment=enrollments.find(e=>e.student_id===stu.id);
        const cls=enrollment?classMap.get(enrollment.class_id):null;
        return {
          id:stu.id,studentCode:stu.student_code,
          name:stu.first_name+" "+stu.last_name,
          relationship:linkMap.get(stu.id)?.relationship,
          className:cls?cls.name+(cls.section?" — "+cls.section:""):null
        };
      });
    }
  }
  // Never expose names or personal details for pending/unclaimed invitations.
  return Response.json({
    school:{name:school.name,code:school.school_code},
    invitations:invitations.map(i=>({studentId:i.student_id,relationship:i.relationship,
      expiresAt:i.expires_at})),children
  },{headers:{"Cache-Control":"no-store"}});
 }catch(e){return jsonError(e);}
}
export async function POST(request,{params}){
 try{
  const {code}=await params;
  const {db,user,school}=await guardianContext(request,code);
  const body=await request.json().catch(()=>({}));
  if(body.action!=="claim")throw new ApiError(400,"Unsupported family action");
  if(body.accepted!==true)throw new ApiError(400,"Accept your verified school family link");
  const studentId=validateUuid(body.studentId,"invitation");
  const result=await checked(db.rpc("school_claim_guardian_invitation",{
    p_school_id:school.id,p_student_id:studentId,
    p_auth_user_id:user.id,p_verified_email:user.email.toLowerCase().trim()
  }));
  return Response.json({ok:true,result},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return jsonError(e);}
}
