import {schoolAdminContext} from "../../../../../lib/school-admin.mjs";
import {checked,jsonError} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store"};

// Read-only school-wide numbers for the School Owner and Principal dashboards.
// Every query is limited to the verified school; nothing is written.
export async function GET(request,{params}){
 try{
  const {code}=await params;
  const {db,school}=await schoolAdminContext(request,code);
  const sid=school.id;
  const year=await checked(db.from("school_academic_years").select("id,name")
    .eq("school_id",sid).eq("status","current").maybeSingle());
  const since=new Date(Date.now()-30*864e5).toISOString().slice(0,10);
  const count=async(q)=>{const r=await q;return r.error?null:(r.count??0);};
  const head=t=>db.from(t).select("id",{count:"exact",head:true}).eq("school_id",sid);
  const [teachers,staff,parents,present,late,absent,excused,published,submitted,graded]=await Promise.all([
   count(db.from("school_memberships").select("auth_user_id",{count:"exact",head:true}).eq("school_id",sid).eq("role","teacher").eq("active",true)),
   count(db.from("school_memberships").select("auth_user_id",{count:"exact",head:true}).eq("school_id",sid).eq("role","staff").eq("active",true)),
   count(db.from("school_guardian_links").select("student_id",{count:"exact",head:true}).eq("school_id",sid).eq("active",true)),
   ...["present","late","absent","excused"].map(s=>count(head("school_attendance_records").eq("status",s).gte("attendance_on",since))),
   count(head("school_homework").eq("status","published")),
   count(head("school_homework_submissions")),
   count(db.from("school_homework_submissions").select("id",{count:"exact",head:true}).eq("school_id",sid).not("graded_at","is",null))
  ]);
  let classes=[],enrolled=[];
  if(year){
   [classes,enrolled]=await Promise.all([
    checked(db.from("school_classes").select("id,name,section,capacity")
      .eq("school_id",sid).eq("academic_year_id",year.id).eq("status","active").order("name").limit(200)),
    checked(db.from("school_student_enrollments").select("class_id")
      .eq("school_id",sid).eq("academic_year_id",year.id).eq("status","active").limit(5000))
   ]);
  }
  const perClass=new Map();enrolled.forEach(e=>perClass.set(e.class_id,(perClass.get(e.class_id)||0)+1));
  const att=[present,late,absent,excused];
  const attTotal=att.every(x=>x===null)?null:att.reduce((a,b)=>a+(b||0),0);
  return Response.json({
   school:{name:school.name,code:school.school_code},year,
   people:{students:enrolled.length,teachers,staff,guardians:parents},
   classes:classes.map(c=>({id:c.id,name:c.name+(c.section?" "+c.section:""),capacity:c.capacity,students:perClass.get(c.id)||0})),
   attendance:{since,total:attTotal,present,late,absent,excused},
   homework:{published,submitted,graded}
  },{headers:noStore});
 }catch(e){return jsonError(e);}
}
