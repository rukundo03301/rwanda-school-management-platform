import {schoolContext,schoolText,schoolStep} from "../../../../lib/school-server.js";
import {checked,ApiError,audit,jsonError} from "../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request,{params}){
  try{
    const {code}=await params;
    const {db,school,user,invited}=await schoolContext(request,code,{allowInvite:true});
    if(invited){
      return Response.json({school:{name:school.name,school_code:school.school_code,
        company_code:school.platform_companies?.company_code,status:school.status},
        invited:true,role:"pending_claim"},{headers:{"Cache-Control":"no-store"}});
    }
    const [progress,site]=await Promise.all([
      checked(db.from("school_onboarding").select(
        "current_step,school_type,education_levels,province,district,campus_name,academic_year,term_system,privacy_acknowledged,review_requested_at"
      ).eq("school_id",school.id).maybeSingle()),
      checked(db.from("school_site_drafts").select(
        "tagline,about_text,announcement,logo_url,hero_url,primary_color,contact_email,contact_phone"
      ).eq("school_id",school.id).maybeSingle())
    ]);
    return Response.json({
      school:{name:school.name,school_code:school.school_code,
        company_code:school.platform_companies?.company_code,
        company_name:school.platform_companies?.name,status:school.status},
      progress:progress||{},site:site||{},role:"school_owner",user:{id:user.id,email:user.email},
    },{headers:{"Cache-Control":"no-store"}});
  }catch(e){return jsonError(e)}
}

export async function POST(request,{params}){
  try{
    const {code}=await params;
    const {db,school,user,invited}=await schoolContext(request,code,{allowInvite:true});
    const body=await request.json().catch(()=>({}));
    const action=String(body.action||"");
    if(action==="claim"){
      if(!invited) return Response.json({ok:true,alreadyClaimed:true});
      const result=await checked(db.rpc("school_claim_owner_invitation",{
        p_school_id:school.id,p_auth_user_id:user.id,p_verified_email:user.email.toLowerCase()
      }));
      return Response.json({ok:true,result});
    }
    if(invited)throw new ApiError(403,"Claim your school owner invitation first");

    if(action==="saveProfile"){
      const levels=body.educationLevels;
      const allowed=["nursery","primary","secondary","tvet","university"];
      if(!Array.isArray(levels)||levels.length>5||levels.some(l=>!allowed.includes(l)))
        throw new ApiError(400,"Invalid education levels");
      const schoolType=String(body.schoolType||"");
      if(![...allowed,"mixed"].includes(schoolType))throw new ApiError(400,"Invalid school type");
      const termSystem=String(body.termSystem||"");
      if(!["terms","semesters","continuous"].includes(termSystem))throw new ApiError(400,"Invalid academic calendar");
      const nextStep=schoolStep(body.currentStep||1);
      const values={
        school_id:school.id,
        school_type:schoolType,
        education_levels:[...new Set(levels)],
        province:schoolText(body.province||"",100),
        district:schoolText(body.district||"",100),
        campus_name:schoolText(body.campusName||"",120),
        academic_year:schoolText(body.academicYear||"",40),
        term_system:termSystem,
        privacy_acknowledged:body.privacyAcknowledged===true,
        current_step:nextStep,
        updated_by:user.id,updated_at:new Date().toISOString()
      };
      const result=await checked(db.from("school_onboarding").upsert(values,{onConflict:"school_id"}).select("school_id,current_step").single());
      await audit(db,{id:user.id},"school.profile_updated",school.id,{step:nextStep});
      return Response.json({ok:true,result});
    }
    if(action==="saveSite"){
      const color=String(body.primaryColor||"#204a78");
      if(!/^#[0-9a-fA-F]{6}$/.test(color))throw new ApiError(400,"Invalid theme color");
      const image=(url)=>{
        if(!url)return null;
        const prefix="https://stgqhkhfpnqmsiyrvvhe.supabase.co/storage/v1/object/public/school-branding/"+school.id+"/";
        if(typeof url!=="string"||!url.startsWith(prefix)||!/\.webp(?:\?.*)?$/.test(url)||url.length>1200)
          throw new ApiError(400,"School image must be uploaded to your school's media library");
        return url;
      };
      const site={
        school_id:school.id,
        tagline:schoolText(body.tagline||"",160),
        about_text:schoolText(body.aboutText||"",2000),
        announcement:schoolText(body.announcement||"",300),
        logo_url:image(body.logoUrl),
        hero_url:image(body.heroUrl),
        primary_color:color,
        contact_email:schoolText(body.contactEmail||"",254),
        contact_phone:schoolText(body.contactPhone||"",60),
        updated_at:new Date().toISOString()
      };
      // A draft write never touches the live public homepage.
      await checked(db.from("school_site_drafts").upsert({
        ...site,updated_by:user.id
      },{onConflict:"school_id"}).select("school_id").single());
      await audit(db,{id:user.id},"school.brand_draft_saved",school.id,{});
      return Response.json({ok:true});
    }
    if(action==="requestReview"){
      const [p,site]=await Promise.all([
        checked(db.from("school_onboarding").select("*").eq("school_id",school.id).single()),
        checked(db.from("school_site_drafts").select("*").eq("school_id",school.id).maybeSingle())
      ]);
      if(!p.privacy_acknowledged||!p.campus_name?.trim()||!p.province?.trim()||!p.education_levels?.length||!p.academic_year?.trim())
        throw new ApiError(400,"Complete your school, academic and privacy details before requesting review");
      if(!site?.tagline?.trim()||!site?.about_text?.trim()||(!site.contact_email&&!site.contact_phone))
        throw new ApiError(400,"Complete your public school description and contact information");
      const result=await checked(db.from("school_onboarding").update({
        review_requested_at:new Date().toISOString(),current_step:5,
        updated_by:user.id,updated_at:new Date().toISOString()
      }).eq("school_id",school.id).select("review_requested_at").single());
      await audit(db,{id:user.id},"school.review_requested",school.id,{});
      return Response.json({ok:true,result});
    }
    if(action==="publish"){
      if(school.status!=="active")throw new ApiError(403,"Your school must be activated by the platform owner before publishing");
      const p=await checked(db.from("school_onboarding").select("review_requested_at").eq("school_id",school.id).single());
      if(!p.review_requested_at)throw new ApiError(400,"Request and receive school review before publication");
      const draft=await checked(db.from("school_site_drafts").select(
        "tagline,about_text,announcement,logo_url,hero_url,primary_color,contact_email,contact_phone"
      ).eq("school_id",school.id).single());
      if(!draft.tagline?.trim()||!draft.about_text?.trim()||(!draft.contact_email&&!draft.contact_phone))
        throw new ApiError(400,"The homepage requires an introduction and contact details");
      // Publish a snapshot. Later edits remain private drafts until published again.
      await checked(db.from("platform_school_sites").upsert({
        school_id:school.id,...draft,is_published:true,
        updated_at:new Date().toISOString()
      },{onConflict:"school_id"}).select("school_id").single());
      await audit(db,{id:user.id},"school.homepage_published",school.id,{});
      return Response.json({ok:true,published:true});
    }
    throw new ApiError(400,"Unsupported school setup action");
  }catch(e){return jsonError(e)}
}
