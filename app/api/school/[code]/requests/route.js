import {schoolVerifiedContext} from "../../../../../lib/school-admin.mjs";
import {ApiError,checked,jsonError} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"no-store","Pragma":"no-cache"};

// Leave and purchase requests. Staff, teachers and administrators raise their own requests and
// follow them. Only the school owner or principal (school_admin) sees everyone's and decides.
const KINDS=["leave","purchase"];
function day(value,label){
 const s=String(value??"").trim();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s)))throw new ApiError(400,label+" must be a valid date");
 return s;
}
async function context(request,code){
 const base=await schoolVerifiedContext(request,code);
 const {db,school,user}=base;
 const rows=await checked(db.from("school_memberships").select("role")
   .eq("school_id",school.id).eq("auth_user_id",user.id).eq("active",true));
 const roles=rows.map(x=>x.role);
 const manager=roles.includes("school_owner")||roles.includes("school_admin");
 if(!manager&&!roles.includes("staff")&&!roles.includes("teacher"))throw new ApiError(403,"Requests are available to school staff only");
 return {...base,manager};
}
export async function GET(request,{params}){
 try{
  const {code}=await params;
  const {db,school,user,manager}=await context(request,code);
  let q=db.from("school_staff_requests")
   .select("id,requester_id,kind,title,details,start_on,end_on,amount_rwf,status,decided_at,decision_note,created_at")
   .eq("school_id",school.id).order("created_at",{ascending:false}).limit(100);
  if(!manager)q=q.eq("requester_id",user.id);
  const rows=await checked(q);
  const ids=[...new Set(rows.map(r=>r.requester_id))];
  let names={};
  if(manager&&ids.length){
   const found=await Promise.all(ids.map(async uid=>{
    const r=await db.auth.admin.getUserById(uid);
    return [uid,String(r?.data?.user?.email||"").split("@")[0]||null];
   }));
   names=Object.fromEntries(found);
  }
  return Response.json({manager,requests:rows.map(r=>({...r,mine:r.requester_id===user.id,requester:names[r.requester_id]||null,requester_id:undefined}))},{headers:HEADERS});
 }catch(error){return jsonError(error);}
}
export async function POST(request,{params}){
 try{
  const {code}=await params;
  const {db,school,user,manager}=await context(request,code);
  const body=await request.json().catch(()=>({}));
  if(body.action==="create"){
   if(!KINDS.includes(body.kind))throw new ApiError(400,"Choose leave or purchase");
   const title=String(body.title??"").replace(/\s+/g," ").trim();
   if(title.length<4||title.length>140)throw new ApiError(400,"Title must be between 4 and 140 characters");
   const details=String(body.details??"").trim();
   if(details.length>1000)throw new ApiError(400,"Details are too long");
   const row={school_id:school.id,requester_id:user.id,kind:body.kind,title,details};
   if(body.kind==="leave"){
    row.start_on=day(body.startOn,"Start date");row.end_on=day(body.endOn,"End date");
    if(row.end_on<row.start_on)throw new ApiError(400,"End date cannot be before the start date");
   }else{
    const n=Number(body.amountRwf);
    if(!Number.isFinite(n)||n<0||n>100000000)throw new ApiError(400,"Amount must be a number from 0 to 100000000");
    row.amount_rwf=Math.round(n);
   }
   await checked(db.from("school_staff_requests").insert(row));
   return Response.json({ok:true},{headers:HEADERS});
  }
  const id=String(body.id||"");
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new ApiError(400,"Choose a request");
  const found=await checked(db.from("school_staff_requests").select("id,requester_id,status")
   .eq("school_id",school.id).eq("id",id).limit(1));
  const current=found[0];
  if(!current)throw new ApiError(404,"Request not found");
  if(current.status!=="pending")throw new ApiError(409,"This request has already been "+current.status);
  if(body.action==="cancel"){
   if(current.requester_id!==user.id)throw new ApiError(403,"You can only cancel your own request");
   await checked(db.from("school_staff_requests").update({status:"cancelled"}).eq("school_id",school.id).eq("id",id));
   return Response.json({ok:true},{headers:HEADERS});
  }
  if(body.action==="decide"){
   if(!manager)throw new ApiError(403,"Only the school owner or principal can decide requests");
   if(current.requester_id===user.id)throw new ApiError(403,"You cannot decide your own request");
   if(!["approved","declined"].includes(body.decision))throw new ApiError(400,"Choose approve or decline");
   const note=String(body.note??"").trim().slice(0,500)||null;
   await checked(db.from("school_staff_requests").update({status:body.decision,decided_by:user.id,decided_at:new Date().toISOString(),decision_note:note})
    .eq("school_id",school.id).eq("id",id).eq("status","pending"));
   return Response.json({ok:true},{headers:HEADERS});
  }
  throw new ApiError(400,"Unknown action");
 }catch(error){return jsonError(error);}
}
