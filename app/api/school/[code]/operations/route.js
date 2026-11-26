import {schoolVerifiedContext} from "../../../../../lib/school-admin.mjs";
import {ApiError,checked,jsonError,validateUuid} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"no-store","Pragma":"no-cache"};

// School operations: stock, assets, maintenance, board of directors and social links.
// Owner and administrators manage everything. Staff keep stock and maintenance up to date.
// Teachers may report a maintenance problem and follow their own reports. Parents and students have no access.
const STOCK=["food","kitchen","cleaning","stationery","teaching","uniform","other"];
const ASSET=["furniture","ict","kitchen","sports","teaching","building","vehicle","other"];
const CONDITION=["good","fair","needs_repair","out_of_service"];
const PRIORITY=["low","normal","urgent"];
const STATUS=["open","in_progress","done","cancelled"];
const HOSTS={youtube:["youtube.com","youtu.be"],tiktok:["tiktok.com"],facebook:["facebook.com","fb.com"],
  instagram:["instagram.com"],x:["x.com","twitter.com"],whatsapp:["wa.me","whatsapp.com"]};

function text(value,label,min,max){
 const s=String(value??"").replace(/\s+/g," ").trim();
 if(s.length<min||s.length>max)throw new ApiError(400,label+" must be between "+min+" and "+max+" characters");
 return s;
}
function optional(value,label,max){
 const s=String(value??"").trim();
 if(!s)return null;
 if(s.length>max)throw new ApiError(400,label+" is too long");
 return s;
}
function pick(value,list,label){
 if(!list.includes(value))throw new ApiError(400,"Choose a valid "+label);
 return value;
}
function amount(value,label,max){
 const n=Number(value);
 if(value===""||value===null||value===undefined||!Number.isFinite(n)||n<0||n>max)throw new ApiError(400,label+" must be a number from 0 to "+max);
 return Math.round(n*100)/100;
}
function day(value,label,required){
 const s=String(value??"").trim();
 if(!s){if(required)throw new ApiError(400,label+" is required");return null;}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s)))throw new ApiError(400,label+" must be a valid date");
 return s;
}

async function context(request,code){
 const base=await schoolVerifiedContext(request,code);
 const {db,school,user}=base;
 const rows=await checked(db.from("school_memberships").select("role")
   .eq("school_id",school.id).eq("auth_user_id",user.id).eq("active",true));
 const roles=rows.map(x=>x.role);
 const owner=roles.includes("school_owner");
 const manager=owner||roles.includes("school_admin");
 const staff=roles.includes("staff");
 const teacher=roles.includes("teacher");
 if(!manager&&!staff&&!teacher)throw new ApiError(403,"School operations are available to school staff only");
 return {...base,owner,manager,staff,teacher};
}

export async function GET(request,{params}){
 try{
  const {code}=await params;
  const ctx=await context(request,code);
  const {db,school,user}=ctx;
  const sid=school.id;
  const office=ctx.manager||ctx.staff;
  let requests=db.from("school_maintenance_requests")
    .select("id,title,details,location,priority,status,resolution,reported_by,created_at,resolved_at")
    .eq("school_id",sid);
  if(!office)requests=requests.eq("reported_by",user.id);
  const [stock,movements,assets,maintenance,boardMembers,boardMeetings,social]=await Promise.all([
   office?checked(db.from("school_stock_items").select("id,name,category,unit,quantity,reorder_level")
     .eq("school_id",sid).eq("active",true).order("name").limit(500)):[],
   office?checked(db.from("school_stock_movements").select("id,item_id,change,note,created_at")
     .eq("school_id",sid).order("created_at",{ascending:false}).limit(40)):[],
   office?checked(db.from("school_assets").select("id,asset_code,name,category,location,condition,acquired_on,value_rwf")
     .eq("school_id",sid).eq("active",true).order("asset_code").limit(500)):[],
   checked(requests.order("created_at",{ascending:false}).limit(200)),
   ctx.manager?checked(db.from("school_board_members").select("id,full_name,position,phone,term_start,term_end")
     .eq("school_id",sid).eq("active",true).order("created_at").limit(60)):[],
   ctx.manager?checked(db.from("school_board_meetings").select("id,held_on,title,agenda,minutes,status")
     .eq("school_id",sid).order("held_on",{ascending:false}).limit(60)):[],
   checked(db.from("school_social_links").select("platform,url").eq("school_id",sid))
  ]);
  return Response.json({
   school:{name:school.name,code:school.school_code},
   actor:{owner:ctx.owner,manager:ctx.manager,staff:ctx.staff,teacher:ctx.teacher},
   stock,movements,assets,
   maintenance:maintenance.map(({reported_by,...rest})=>({...rest,mine:reported_by===user.id})),
   boardMembers,boardMeetings,social,
   options:{stock:STOCK,asset:ASSET,condition:CONDITION,priority:PRIORITY,status:STATUS,platform:Object.keys(HOSTS)}
  },{headers:HEADERS});
 }catch(e){return jsonError(e);}
}

export async function POST(request,{params}){
 try{
  const {code}=await params;
  const ctx=await context(request,code);
  const {db,school,user,token}=ctx;
  // Two-step verification is asked of the school owner only.
  
  const sid=school.id;
  const office=ctx.manager||ctx.staff;
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||"");
  const managerOnly=()=>{if(!ctx.manager)throw new ApiError(403,"Only the school owner or an administrator can do this");};
  const officeOnly=()=>{if(!office)throw new ApiError(403,"Only school office staff can do this");};
  const now=new Date().toISOString();
  let result=null;
  if(action==="stock.add"){
   managerOnly();
   const name=text(body.name,"Item name",2,120);
   const existing=await checked(db.from("school_stock_items").select("id").eq("school_id",sid).eq("name",name).maybeSingle());
   if(existing)throw new ApiError(409,"This stock item already exists");
   result=await checked(db.from("school_stock_items").insert({school_id:sid,name,
     category:pick(body.category,STOCK,"stock category"),unit:text(body.unit,"Unit",1,20),
     quantity:amount(body.quantity,"Quantity",1000000),reorder_level:amount(body.reorderLevel??0,"Reorder level",1000000)
   }).select("id").single());
  }else if(action==="stock.move"){
   officeOnly();
   const itemId=validateUuid(body.itemId,"stock item");
   const change=Math.round(Number(body.change)*100)/100;
   if(!Number.isFinite(change)||change===0||Math.abs(change)>1000000)throw new ApiError(400,"Enter the quantity received or used");
   const item=await checked(db.from("school_stock_items").select("id,quantity")
     .eq("school_id",sid).eq("id",itemId).eq("active",true).maybeSingle());
   if(!item)throw new ApiError(404,"Stock item not found");
   const next=Math.round((Number(item.quantity)+change)*100)/100;
   if(next<0)throw new ApiError(400,"There is not enough of this item in stock");
   const updated=await checked(db.from("school_stock_items").update({quantity:next,updated_at:now})
     .eq("school_id",sid).eq("id",itemId).eq("quantity",item.quantity).select("id"));
   if(!updated.length)throw new ApiError(409,"Stock changed while you were saving. Reload and try again");
   await checked(db.from("school_stock_movements").insert({school_id:sid,item_id:itemId,change,
     note:optional(body.note,"Note",300),created_by:user.id}));
   result={quantity:next};
  }else if(action==="asset.add"){
   managerOnly();
   const assetCode=text(body.assetCode,"Asset code",2,30).toUpperCase();
   const existing=await checked(db.from("school_assets").select("id").eq("school_id",sid).eq("asset_code",assetCode).maybeSingle());
   if(existing)throw new ApiError(409,"This asset code is already used");
   result=await checked(db.from("school_assets").insert({school_id:sid,asset_code:assetCode,
     name:text(body.name,"Asset name",2,120),category:pick(body.category,ASSET,"asset category"),
     location:optional(body.location,"Location",120),condition:pick(body.condition||"good",CONDITION,"condition"),
     acquired_on:day(body.acquiredOn,"Date acquired",false),
     value_rwf:body.valueRwf===""||body.valueRwf==null?null:Math.round(amount(body.valueRwf,"Value in RWF",100000000000))
   }).select("id").single());
  }else if(action==="asset.condition"){
   officeOnly();
   const updated=await checked(db.from("school_assets").update({condition:pick(body.condition,CONDITION,"condition"),updated_at:now})
     .eq("school_id",sid).eq("id",validateUuid(body.assetId,"asset")).eq("active",true).select("id"));
   if(!updated.length)throw new ApiError(404,"Asset not found");
   result={updated:true};
  }else if(action==="maintenance.report"){
   result=await checked(db.from("school_maintenance_requests").insert({school_id:sid,
     title:text(body.title,"Problem title",4,140),details:optional(body.details,"Details",1000),
     location:optional(body.location,"Location",120),priority:pick(body.priority||"normal",PRIORITY,"priority"),
     reported_by:user.id}).select("id").single());
  }else if(action==="maintenance.update"){
   officeOnly();
   const status=pick(body.status,STATUS,"status");
   const updated=await checked(db.from("school_maintenance_requests").update({status,
     resolution:optional(body.resolution,"Resolution note",600),updated_at:now,
     resolved_at:status==="done"?now:null})
     .eq("school_id",sid).eq("id",validateUuid(body.requestId,"maintenance request")).select("id"));
   if(!updated.length)throw new ApiError(404,"Maintenance request not found");
   result={updated:true};
  }else if(action==="board.member"){
   managerOnly();
   result=await checked(db.from("school_board_members").insert({school_id:sid,
     full_name:text(body.fullName,"Full name",3,120),position:text(body.position,"Position",2,80),
     phone:optional(body.phone,"Phone",30),term_start:day(body.termStart,"Term start",false),
     term_end:day(body.termEnd,"Term end",false)}).select("id").single());
  }else if(action==="board.member.remove"){
   managerOnly();
   const updated=await checked(db.from("school_board_members").update({active:false})
     .eq("school_id",sid).eq("id",validateUuid(body.memberId,"board member")).select("id"));
   if(!updated.length)throw new ApiError(404,"Board member not found");
   result={updated:true};
  }else if(action==="board.meeting"){
   managerOnly();
   result=await checked(db.from("school_board_meetings").insert({school_id:sid,
     held_on:day(body.heldOn,"Meeting date",true),title:text(body.title,"Meeting title",4,140),
     agenda:optional(body.agenda,"Agenda",2000),minutes:optional(body.minutes,"Minutes",6000),
     status:pick(body.status||"planned",["planned","held"],"meeting status")}).select("id").single());
  }else if(action==="social.set"){
   managerOnly();
   const platform=pick(body.platform,Object.keys(HOSTS),"platform");
   const raw=String(body.url??"").trim();
   if(!raw){
    await checked(db.from("school_social_links").delete().eq("school_id",sid).eq("platform",platform));
    result={removed:true};
   }else{
    let parsed;
    try{parsed=new URL(raw);}catch{throw new ApiError(400,"Enter the full link, starting with https://");}
    const host=parsed.hostname.toLowerCase().replace(/^www\./,"").replace(/^m\./,"");
    if(parsed.protocol!=="https:"||raw.length>300||!HOSTS[platform].some(h=>host===h||host.endsWith("."+h)))
      throw new ApiError(400,"This link does not belong to "+platform);
    await checked(db.from("school_social_links").upsert({school_id:sid,platform,url:parsed.toString(),updated_at:now},
      {onConflict:"school_id,platform"}));
    result={saved:true};
   }
  }else throw new ApiError(400,"Unsupported school operations action");
  return Response.json({ok:true,result},{headers:HEADERS});
 }catch(e){return jsonError(e);}
}
