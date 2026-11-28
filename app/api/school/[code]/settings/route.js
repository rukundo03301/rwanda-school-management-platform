import {schoolAdminContext,schoolAdminCan} from "../../../../../lib/school-admin.mjs";
import {ApiError,checked,jsonError} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store"};
const SCHOOL_ISSUED=/@[^@\s]+\.(test|example|invalid|localhost)$/i;

// One read for the School Settings page: everything the owner (or a principal with
// academic rights) needs to set the school up. Every change goes through the existing,
// permission-checked routes (admin, classroom, fees, operations, member-password).
export async function GET(request,{params}){
 try{
  const {code}=await params;
  const {db,school,actor}=await schoolAdminContext(request,code);
  const academics=schoolAdminCan(actor,"academics.read");
  const people=schoolAdminCan(actor,"people.read");
  if(!academics&&!people&&!actor.isOwner)throw new ApiError(403,"School settings need academic or people rights");
  const [setup,years,classes,subjects,maps,members,assignments,board]=await Promise.all([
   checked(db.from("school_onboarding").select("education_levels,term_system").eq("school_id",school.id).maybeSingle()),
   checked(db.from("school_academic_years").select("id,name,starts_on,ends_on,status").eq("school_id",school.id).order("starts_on",{ascending:false}).limit(50)),
   checked(db.from("school_classes").select("id,academic_year_id,name,level,level_band,section,capacity,status").eq("school_id",school.id).order("name").limit(500)),
   checked(db.from("school_subjects").select("id,code,name").eq("school_id",school.id).order("name").limit(500)),
   checked(db.from("school_class_subjects").select("class_id,subject_id").eq("school_id",school.id).limit(3000)),
   checked(db.from("school_memberships").select("auth_user_id,role").eq("school_id",school.id).eq("active",true).in("role",["teacher","school_admin","staff"]).limit(400)),
   checked(db.from("school_teacher_assignments").select("teacher_id,class_id,subject_id").eq("school_id",school.id).eq("active",true).limit(3000)),
   checked(db.from("school_board_members").select("id,full_name,position,phone,term_start,term_end").eq("school_id",school.id).eq("active",true).order("created_at").limit(100))
  ]);
  const current=years.find(y=>y.status==="current")||null;
  const enrol=current?await checked(db.from("school_student_enrollments").select("class_id").eq("school_id",school.id).eq("academic_year_id",current.id).eq("status","active").limit(5000)):[];
  const fees=current?await checked(db.from("school_fee_catalog").select("id,class_id,term_label,category,label,amount_rwf,due_on,status").eq("school_id",school.id).eq("academic_year_id",current.id).order("created_at",{ascending:false}).limit(400)):[];
  const ids=[...new Set(members.map(m=>m.auth_user_id))];
  const people2=await Promise.all(ids.map(async id=>{
   const {data}=await db.auth.admin.getUserById(id);const u=data?.user;const m=u?.user_metadata||{};
   return {id,name:String(m.display_name||m.full_name||"").trim(),email:u?.email||"",schoolIssued:SCHOOL_ISSUED.test(u?.email||""),
    roles:members.filter(x=>x.auth_user_id===id).map(x=>x.role)};
  }));
  const count=new Map();for(const e of enrol)count.set(e.class_id,(count.get(e.class_id)||0)+1);
  return Response.json({
   school:{name:school.name,code:school.school_code},
   actor:{isOwner:actor.isOwner,permissions:actor.permissions},
   levels:Array.isArray(setup?.education_levels)?setup.education_levels:[],termSystem:setup?.term_system||"terms",
   years,currentYear:current,
   classes:classes.map(c=>({...c,students:count.get(c.id)||0})),
   subjects,classSubjects:maps,
   teachers:people2.filter(p=>p.roles.includes("teacher")).sort((a,b)=>(a.name||a.email).localeCompare(b.name||b.email)),
   staff:people2.filter(p=>!p.roles.includes("teacher")).sort((a,b)=>(a.name||a.email).localeCompare(b.name||b.email)),
   assignments,fees,board
  },{headers:noStore});
 }catch(e){return jsonError(e);}
}
