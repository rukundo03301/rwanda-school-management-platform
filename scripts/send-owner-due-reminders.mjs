import {createClient} from "@supabase/supabase-js";
import {buildOwnerDigest,digestText} from "../lib/owner-reminder.mjs";
import {kigaliDate} from "../lib/billing-clock.mjs";

const required=["NEXT_PUBLIC_SUPABASE_URL","SUPABASE_SECRET_KEY","BREVO_API_KEY","BREVO_SENDER_EMAIL","PLATFORM_OWNER_ALERT_EMAIL"];
if(process.env.ENABLE_OWNER_EMAIL_REMINDERS!=="true"){
  console.log("Owner payment reminders are disabled; no email sent.");
  process.exit(0);
}
const missing=required.filter(n=>!process.env[n]);
if(missing.length)throw new Error("Missing reminder configuration: "+missing.join(", "));
const sender=process.env.BREVO_SENDER_EMAIL.trim();
const recipient=process.env.PLATFORM_OWNER_ALERT_EMAIL.trim();
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))
  throw new Error("Invalid sender/owner email setting");

const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{
  auth:{persistSession:false,autoRefreshToken:false}
});
async function fetchAllTerms(){
  const items=[];
  for(let page=0;page<1000;page++){
    const start=page*500;
    const {data,error}=await db.from("platform_fee_terms")
      .select("school_id,monthly_fee_rwf,next_due_on,platform_schools(name,school_code,status)")
      .range(start,start+499);
    if(error)throw new Error("Could not read private school fee dates: "+error.message);
    for(const row of data||[]){
      items.push({...row,school:row.platform_schools});
    }
    if(!data||data.length<500)return items;
  }
  throw new Error("Reminder exceeds 500,000 tenants: implement additional pagination");
}
const today=kigaliDate();
const rows=await fetchAllTerms();
const digest=buildOwnerDigest(rows,{today,windowDays:7});
if(!digest.hasItems){
  console.log("No upcoming/overdue school fees; no email sent. Date: "+today);
  process.exit(0);
}
const {data:claimed,error:claimError}=await db.rpc("platform_claim_owner_digest",{
  p_date:today,p_recipient:recipient
});
if(claimError)throw new Error("Could not claim reminder digest: "+claimError.message);
if(!claimed){
  console.log("Daily owner digest already claimed/sent; skipping duplicate.");
  process.exit(0);
}
const subject="Private school fee reminder: "+digest.overdue.length+" overdue, "+
  digest.dueToday.length+" due today, "+digest.dueSoon.length+" approaching";
try{
  const response=await fetch("https://api.brevo.com/v3/smtp/email",{
    method:"POST",
    headers:{
      "api-key":process.env.BREVO_API_KEY,
      "accept":"application/json",
      "content-type":"application/json"
    },
    body:JSON.stringify({
      sender:{name:"Rwanda Education Platform",email:sender},
      to:[{email:recipient}],
      subject,
      textContent:digestText(digest)
    }),
    signal:AbortSignal.timeout(20000)
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok||!body.messageId)throw new Error("Mail provider did not accept reminder: HTTP "+response.status);
  const {error}=await db.from("platform_owner_email_digests").update({
    status:"sent",sent_at:new Date().toISOString(),
    external_message_id:String(body.messageId).slice(0,250),last_error:null
  }).eq("digest_date",today).eq("recipient",recipient);
  if(error)throw new Error("Provider accepted message but delivery audit could not be updated; review Brevo logs manually");
  console.log("Owner digest accepted by provider on "+today+". Categories: overdue "+digest.overdue.length+
    ", today "+digest.dueToday.length+", upcoming "+digest.dueSoon.length+". Delivery not independently verified.");
}catch(err){
  const {error}=await db.from("platform_owner_email_digests").update({
    status:"failed",last_error:String(err?.message||err).slice(0,250)
  }).eq("digest_date",today).eq("recipient",recipient);
  if(error)console.error("Failed to record reminder error status.");
  throw err;
}
