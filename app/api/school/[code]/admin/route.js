import {
  schoolAdminContext,requireSchoolPermission,requireSchoolOwner,
  validatedAdminPermissions,schoolAdminText,schoolAdminAudit,schoolAdminCan
} from "../../../../../lib/school-admin.mjs";
import {ApiError,checked,validateUuid,jsonError} from "../../../../../lib/platform-server.js";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const roles=["school_owner","school_admin","teacher","staff"];
const noStore={"Cache-Control":"no-store"};

function validDate(raw){
 if(typeof raw!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(raw))throw new ApiError(400,"Enter a valid YYYY-MM-DD date");
 const d=new Date(raw+"T00:00:00Z");
 if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==raw)
   throw new ApiError(400,"Enter an actual calendar date");
 return raw;
}
function allowedInvitedRole(role){
 if(!["school_admin","teacher","staff"].includes(role))
   throw new ApiError(400,"Only school administrators, teachers and staff can be invited in this module");
 return role;
}
async function assertSchoolRow(db,table,schoolId,id){
 const row=await checked(db.from(table).select("id").eq("school_id",schoolId).eq("id",id).maybeSingle());
 if(!row)throw new ApiError(404,"Record not found in this school");
 return row;
}

export async function GET(request,{params}){
 try{
  const {code}=await params;
  const {db,school,actor}=await schoolAdminContext(request,code);
  const [publishedBrand,draftBrand]=await Promise.all([
    checked(db.from("platform_school_sites").select("logo_url,primary_color")
      .eq("school_id",school.id).maybeSingle()),
    checked(db.from("school_site_drafts").select("logo_url,primary_color")
      .eq("school_id",school.id).maybeSingle())
  ]);
  const brand=publishedBrand?.logo_url?publishedBrand:(draftBrand||publishedBrand);
  let admissionsPermissions=[];
  if(!actor.isOwner){
    const grants=await checked(db.from("school_admissions_permissions")
      .select("permissions").eq("school_id",school.id)
      .eq("auth_user_id",actor.id).maybeSingle());
    admissionsPermissions=Array.isArray(grants?.permissions)?grants.permissions:[];
  }
  let reportPermissions=[];
  if(!actor.isOwner){
    const grants=await checked(db.from("school_report_admin_permissions")
      .select("permissions").eq("school_id",school.id)
      .eq("auth_user_id",actor.id).maybeSingle());
    reportPermissions=Array.isArray(grants?.permissions)?grants.permissions:[];
  }
  let communicationPermissions=[];
  if(!actor.isOwner){
    const grants=await checked(db.from("school_communication_permissions")
      .select("permissions").eq("school_id",school.id)
      .eq("auth_user_id",actor.id).maybeSingle());
    communicationPermissions=Array.isArray(grants?.permissions)?grants.permissions:[];
  }
  let financePermissions=[];
  if(!actor.isOwner){
    const grants=await checked(db.from("school_finance_permissions")
      .select("permissions").eq("school_id",school.id)
      .eq("auth_user_id",actor.id).maybeSingle());
    financePermissions=Array.isArray(grants?.permissions)?grants.permissions:[];
  }
  const enrichedActor={...actor,admissionsPermissions,reportPermissions,communicationPermissions,financePermissions};
  const data={school:{name:school.name,code:school.school_code,status:school.status,
    logoUrl:brand?.logo_url||null,primaryColor:/^#[0-9a-f]{6}$/i.test(brand?.primary_color||"")?
      brand.primary_color:"#204a78"},
    actor:enrichedActor,team:[],invites:[],years:[],classes:[],subjects:[],classSubjects:[],audit:[]};
  if(schoolAdminCan(actor,"people.read")){
    const [members,invites]=await Promise.all([
      checked(db.from("school_memberships")
        .select("school_id,auth_user_id,role,active,joined_at")
        .eq("school_id",school.id).in("role",roles).order("joined_at",{ascending:false}).limit(300)),
      checked(db.from("school_role_invites")
        .select("id,email,role,permissions,status,expires_at,claimed_by,claimed_at,created_at")
        .eq("school_id",school.id).order("created_at",{ascending:false}).limit(300))
    ]);
    const claimEmails=new Map(invites.filter(inv=>inv.claimed_by).map(inv=>[inv.claimed_by+"#"+inv.role,inv.email]));
    data.team=members.map(m=>({...m,email:m.role==="school_owner"?school.owner_email:
      claimEmails.get(m.auth_user_id+"#"+m.role)||null}));
    data.invites=invites;
    const admins=data.team.filter(m=>m.role==="school_admin");
    if(admins.length){
      const grants=await checked(db.from("school_admin_permissions")
        .select("auth_user_id,permissions").eq("school_id",school.id));
      const byId=new Map(grants.map(g=>[g.auth_user_id,g.permissions]));
      data.team=data.team.map(m=>m.role==="school_admin"?
        {...m,permissions:byId.get(m.auth_user_id)||[]} : m);
    }
  }
  if(schoolAdminCan(actor,"academics.read")){
    // The levels the owner chose in School setup decide which levels a class can belong to.
    const setup=await checked(db.from("school_onboarding").select("education_levels").eq("school_id",school.id).maybeSingle());
    data.offeredLevels=Array.isArray(setup?.education_levels)?setup.education_levels:[];
    [data.years,data.classes,data.subjects,data.classSubjects]=await Promise.all([
      checked(db.from("school_academic_years")
        .select("id,name,starts_on,ends_on,status").eq("school_id",school.id)
        .order("starts_on",{ascending:false}).limit(250)),
      checked(db.from("school_classes")
        .select("id,academic_year_id,name,level,level_band,section,capacity,status").eq("school_id",school.id)
        .order("name",{ascending:true}).limit(500)),
      checked(db.from("school_subjects")
        .select("id,code,name").eq("school_id",school.id)
        .order("name",{ascending:true}).limit(500)),
      checked(db.from("school_class_subjects")
        .select("class_id,subject_id").eq("school_id",school.id).limit(1000))
    ]);
  }
  if(schoolAdminCan(actor,"audit.read")){
    data.audit=await checked(db.from("school_admin_audit")
      .select("id,event,actor_id,metadata,created_at")
      .eq("school_id",school.id).order("created_at",{ascending:false}).limit(100));
  }
  return Response.json(data,{headers:noStore});
 }catch(err){return jsonError(err)}
}

export async function POST(request,{params}){
 try{
  const {code}=await params;
  const {db,school,actor,token}=await schoolAdminContext(request,code);
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||"");
  let result;
  if(action==="member.invite"){
    requireSchoolPermission(actor,"people.invite");
    const email=schoolAdminText(body.email||"",254).toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new ApiError(400,"Enter a valid staff email address");
    const role=allowedInvitedRole(body.role);
    if(role==="school_admin")requireSchoolOwner(actor);
    const permissions=role==="school_admin"?validatedAdminPermissions(body.permissions||[]):[];
    result=await checked(db.rpc("school_invite_member",{
      p_school_id:school.id,p_email:email,p_role:role,
      p_permissions:permissions,p_actor:actor.id
    }));
    // The database grant is pending until the verified recipient claims it.
    // Invitation email uses Supabase Auth for NEW users only; existing users
    // can sign in at the same school's login URL and accept their pending role.
    let mailStatus="not_sent";
    const base=String(process.env.APP_PUBLIC_URL||"").replace(/\/$/,"");
    const loginPath="/s/"+school.school_code+"/login?role="+encodeURIComponent(role);
    if(/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base)||
        /^http:\/\/localhost(?::\d+)?$/.test(base)){
      const {error:mailError}=await db.auth.admin.inviteUserByEmail(email,{
        redirectTo:base+loginPath
      });
      mailStatus=mailError?"provider_rejected_or_existing_user":"provider_accepted";
    }
    result={...result,email,mailStatus,loginPath};
  }else if(action==="admin.permissions"){
    requireSchoolOwner(actor);
    const target=validateUuid(body.userId,"staff");
    const permissions=validatedAdminPermissions(body.permissions||[]);
    const reason=schoolAdminText(body.reason||"",500);
    if(reason.length<8)throw new ApiError(400,"Enter an audit reason of at least 8 characters");
    result=await checked(db.rpc("school_set_admin_permissions",{
      p_school_id:school.id,p_target:target,p_permissions:permissions,
      p_reason:reason,p_actor:actor.id
    }));
  }else if(action==="member.revoke"){
    requireSchoolPermission(actor,"people.manage");
    const target=validateUuid(body.userId,"staff");
    const role=allowedInvitedRole(body.role);
    if(role==="school_admin")requireSchoolOwner(actor);
    const reason=schoolAdminText(body.reason||"",500);
    if(reason.length<8)throw new ApiError(400,"Enter an audit reason");
    result=await checked(db.rpc("school_revoke_member",{
      p_school_id:school.id,p_target:target,p_role:role,
      p_reason:reason,p_actor:actor.id
    }));
  }else if(action==="academic.year"){
    requireSchoolPermission(actor,"academics.manage");
    const name=schoolAdminText(body.name||"",40);
    if(name.length<3)throw new ApiError(400,"Enter an academic year name");
    const starts=validDate(body.startsOn),ends=validDate(body.endsOn);
    if(starts>ends)throw new ApiError(400,"End date cannot precede start date");
    result=await checked(db.from("school_academic_years").insert({
      school_id:school.id,name,starts_on:starts,ends_on:ends,status:"planned",
      created_by:actor.id
    }).select("id,name,status").single());
    await schoolAdminAudit(db,school.id,actor.id,"academic.year_created",{id:result.id,name});
  }else if(action==="academic.yearCurrent"){
    requireSchoolPermission(actor,"academics.manage");
    const id=validateUuid(body.id,"academic year");
    result=await checked(db.rpc("school_set_current_year",{
      p_school_id:school.id,p_year_id:id,p_actor:actor.id
    }));
  }else if(action==="academic.class"){
    requireSchoolPermission(actor,"academics.manage");
    const yearId=validateUuid(body.yearId,"academic year");
    await assertSchoolRow(db,"school_academic_years",school.id,yearId);
    const name=schoolAdminText(body.name||"",100);
    const level=schoolAdminText(body.level||"",100);
    const levelBand=String(body.levelBand||"");
    if(!["nursery","primary","secondary","tvet","university"].includes(levelBand))
      throw new ApiError(400,"Choose the education level this class belongs to");
    const section=schoolAdminText(body.section||"",50,{required:false});
    const cap=body.capacity==null||body.capacity===""?null:Number(body.capacity);
    if(cap!==null&&(!Number.isInteger(cap)||cap<1||cap>2000))
      throw new ApiError(400,"Class capacity must be between 1 and 2000");
    result=await checked(db.from("school_classes").insert({
      school_id:school.id,academic_year_id:yearId,name,level,level_band:levelBand,section,capacity:cap,
      created_by:actor.id
    }).select("id,name").single());
    await schoolAdminAudit(db,school.id,actor.id,"academic.class_created",{id:result.id,yearId});
  }else if(action==="academic.subject"){
    requireSchoolPermission(actor,"academics.manage");
    const codeText=schoolAdminText(body.code||"",20).toUpperCase();
    if(!/^[A-Z0-9_-]{2,20}$/.test(codeText))throw new ApiError(400,"Subject code must be 2–20 letters/numbers");
    const name=schoolAdminText(body.name||"",100);
    if(name.length<2)throw new ApiError(400,"Subject name is too short");
    result=await checked(db.from("school_subjects").insert({
      school_id:school.id,code:codeText,name,created_by:actor.id
    }).select("id,code,name").single());
    await schoolAdminAudit(db,school.id,actor.id,"academic.subject_created",{id:result.id,code:codeText});
  }else if(action==="academic.classSubject"){
    requireSchoolPermission(actor,"academics.manage");
    const classId=validateUuid(body.classId,"class");
    const subjectId=validateUuid(body.subjectId,"subject");
    await Promise.all([
      assertSchoolRow(db,"school_classes",school.id,classId),
      assertSchoolRow(db,"school_subjects",school.id,subjectId)
    ]);
    result=await checked(db.from("school_class_subjects").upsert({
      school_id:school.id,class_id:classId,subject_id:subjectId,created_by:actor.id
    },{onConflict:"school_id,class_id,subject_id"}).select("class_id,subject_id").single());
    await schoolAdminAudit(db,school.id,actor.id,"academic.subject_assigned",{classId,subjectId});
  }else if(action==="academic.classSubjectRemove"){
    requireSchoolPermission(actor,"academics.manage");
    const classId=validateUuid(body.classId,"class");
    const subjectId=validateUuid(body.subjectId,"subject");
    const busy=await checked(db.from("school_teacher_assignments").select("teacher_id").eq("school_id",school.id)
      .eq("class_id",classId).eq("subject_id",subjectId).eq("active",true).limit(1));
    if(busy.length)throw new ApiError(409,"A teacher is still assigned to this subject in this class. Remove the teacher first.");
    const del=await db.from("school_class_subjects").delete().eq("school_id",school.id).eq("class_id",classId).eq("subject_id",subjectId);
    if(del.error)throw new ApiError(409,"This subject already has homework, marks or reports in this class, so it stays linked.");
    await schoolAdminAudit(db,school.id,actor.id,"academic.subject_unassigned",{classId,subjectId});
    result={classId,subjectId,removed:true};
  }else{
    throw new ApiError(400,"Unsupported school administration action");
  }
  return Response.json({ok:true,result},{headers:noStore});
 }catch(err){return jsonError(err)}
}
