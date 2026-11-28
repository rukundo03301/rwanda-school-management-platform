import {schoolVerifiedContext} from "../../../../../lib/school-admin.mjs";
import {kigaliToday} from "../../../../../lib/school-fees.mjs";
import {ApiError,checked,jsonError,validateUuid} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"private, no-store"};

// Student Records: one page per pupil showing school fees and the school's checklist
// (uniform, student card, exam papers...). The owner, principals and office staff can open it.
// Fee amounts are shown only to the owner and to people with the finance.read right.
const CATEGORIES=["uniform","card","materials","exam","fees","other"];
const LEVELS=["all","nursery","primary","secondary","tvet","university"];
const STATUSES=["done","missing","waived"];
const text=(v,label,min,max)=>{const s=String(v??"").replace(/\s+/g," ").trim();if(s.length<min||s.length>max)throw new ApiError(400,label+" must be between "+min+" and "+max+" characters");return s;};

async function context(request,code){
 const base=await schoolVerifiedContext(request,code);
 const {db,school,user}=base;
 const rows=await checked(db.from("school_memberships").select("role").eq("school_id",school.id).eq("auth_user_id",user.id).eq("active",true));
 const roles=rows.map(r=>r.role);
 const owner=roles.includes("school_owner"),manager=owner||roles.includes("school_admin"),staff=roles.includes("staff");
 if(!manager&&!staff)throw new ApiError(403,"Student records are for the school owner, principals and office staff");
 let finance=owner;
 if(!finance){
  const grant=await checked(db.from("school_finance_permissions").select("permissions").eq("school_id",school.id).eq("auth_user_id",user.id).maybeSingle());
  finance=Array.isArray(grant?.permissions)&&grant.permissions.includes("finance.read");
 }
 const year=await checked(db.from("school_academic_years").select("id,name").eq("school_id",school.id).eq("status","current").maybeSingle());
 return {...base,owner,manager,staff,finance,year};
}
const applies=(item,band)=>item.level_band==="all"||item.level_band===band;

export async function GET(request,{params}){
 try{
  const {code}=await params;
  const ctx=await context(request,code);
  const {db,school,user,year}=ctx;
  const sid=school.id;
  const url=new URL(request.url);
  const one=url.searchParams.get("student");
  const studentId=one?validateUuid(one,"student"):null;
  let studentQ=db.from("school_students").select("id,student_code,first_name,last_name,date_of_birth,status,created_at").eq("school_id",sid);
  studentQ=studentId?studentQ.eq("id",studentId):studentQ.eq("status","active").order("student_code").limit(3000);
  const [students,classes,enrolls,items,marks]=await Promise.all([
   checked(studentQ),
   year?checked(db.from("school_classes").select("id,name,section,level,level_band").eq("school_id",sid).eq("academic_year_id",year.id).limit(500)):[],
   year?checked(db.from("school_student_enrollments").select("student_id,class_id").eq("school_id",sid).eq("academic_year_id",year.id).eq("status","active").limit(5000)):[],
   checked(db.from("school_requirement_items").select("id,name,category,price_rwf,level_band,position").eq("school_id",sid).eq("active",true).order("position").order("created_at").limit(200)),
   checked((studentId?db.from("school_student_requirements").select("student_id,item_id,status,note,updated_at,updated_by").eq("school_id",sid).eq("student_id",studentId)
    :db.from("school_student_requirements").select("student_id,item_id,status").eq("school_id",sid)).limit(50000))
  ]);
  if(studentId&&!students.length)throw new ApiError(404,"Student not found");
  const classBy=new Map(classes.map(c=>[c.id,c])),enrolBy=new Map(enrolls.map(e=>[e.student_id,e.class_id]));
  const markBy=new Map(marks.map(m=>[m.student_id+"|"+m.item_id,m]));
  // Fees: invoices and authoritative balances, only for people allowed to see money.
  let invoices=[],balBy=new Map();
  if(ctx.finance){
   let q=db.from("school_fee_invoices").select("id,invoice_number,student_id,description,term_label,category,amount_rwf,due_on,status,issued_at").eq("school_id",sid).eq("status","issued");
   q=studentId?q.eq("student_id",studentId):q;
   invoices=await checked(q.order("due_on").limit(studentId?200:6000));
   for(let i=0;i<invoices.length;i+=800){
    const ids=invoices.slice(i,i+800).map(x=>x.id);
    const rows=await checked(db.rpc("school_finance_invoice_balances",{p_school:sid,p_actor:user.id,p_invoices:ids}));
    for(const r of rows)balBy.set(r.invoice_id,r);
   }
  }
  const today=kigaliToday();
  const feeOf=sidStudent=>{
   if(!ctx.finance)return null;
   const mine=invoices.filter(x=>x.student_id===sidStudent);
   let billed=0,paid=0,balance=0,overdue=0;
   const list=mine.map(x=>{const b=balBy.get(x.id);const bal=b?Number(b.balance_rwf):Number(x.amount_rwf);const late=bal>0&&x.due_on<today;
    billed+=Number(x.amount_rwf);paid+=b?Number(b.paid_rwf):0;balance+=bal;if(late)overdue+=bal;
    return {id:x.id,number:x.invoice_number,description:x.description||x.category,term:x.term_label,amount:Number(x.amount_rwf),paid:b?Number(b.paid_rwf):0,waived:b?Number(b.waived_rwf):0,balance:bal,dueOn:x.due_on,late};});
   return {billed,paid,balance,overdue,invoices:studentId?list:undefined,bills:list.length};
  };
  const rows=students.map(s=>{
   const cls=classBy.get(enrolBy.get(s.id));const band=cls?.level_band||"";
   const mine=items.filter(i=>applies(i,band));
   const checklist=mine.map(i=>{const m=markBy.get(s.id+"|"+i.id);return {itemId:i.id,status:m?.status||"missing",note:m?.note||"",updatedAt:m?.updated_at||null};});
   const done=checklist.filter(c=>c.status!=="missing").length;
   return {id:s.id,code:s.student_code,name:s.first_name+" "+s.last_name,dateOfBirth:studentId?s.date_of_birth:undefined,status:s.status,
    classId:cls?.id||null,className:cls?[cls.name,cls.section].filter(Boolean).join(" "):"No class this year",levelBand:band,
    checklist:studentId?checklist:undefined,done,total:checklist.length,missing:checklist.filter(c=>c.status==="missing").map(c=>c.itemId),
    fees:feeOf(s.id)};
  });
  let guardians=undefined;
  if(studentId){
   const links=await checked(db.from("school_guardian_links").select("auth_user_id,relationship,active").eq("school_id",sid).eq("student_id",studentId).eq("active",true).limit(10));
   guardians=await Promise.all(links.map(async l=>{const {data}=await db.auth.admin.getUserById(l.auth_user_id);const u=data?.user;const m=u?.user_metadata||{};
    return {relationship:l.relationship,name:String(m.display_name||m.full_name||"").trim()||u?.email||"Parent",email:u?.email||""};}));
  }
  return Response.json({
   school:{name:school.name},year,can:{finance:ctx.finance,manage:ctx.manager,mark:ctx.manager||ctx.staff},
   items,classes:classes.map(c=>({id:c.id,name:[c.name,c.section].filter(Boolean).join(" "),levelBand:c.level_band})).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true})),
   students:studentId?undefined:rows,student:studentId?{...rows[0],guardians}:undefined,
   options:{categories:CATEGORIES,levels:LEVELS}
  },{headers:noStore});
 }catch(e){return jsonError(e);}
}

export async function POST(request,{params}){
 try{
  const {code}=await params;
  const ctx=await context(request,code);
  const {db,school,user}=ctx;const sid=school.id;
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||"");
  const managerOnly=()=>{if(!ctx.manager)throw new ApiError(403,"Only the school owner or a principal can change the checklist items");};
  let result;
  if(action==="item.add"){
   managerOnly();
   const category=CATEGORIES.includes(body.category)?body.category:"other";
   const level=LEVELS.includes(body.levelBand)?body.levelBand:"all";
   const name=text(body.name,"Item name",2,120);
   const dup=await checked(db.from("school_requirement_items").select("id").eq("school_id",sid).eq("active",true).ilike("name",name).eq("level_band",level).limit(1));
   if(dup.length)throw new ApiError(409,"This item is already on the checklist");
   let price=null;if(body.price!==""&&body.price!=null){price=Number(body.price);if(!Number.isInteger(price)||price<0||price>100000000)throw new ApiError(400,"Price must be whole Rwandan francs");}
   const count=await checked(db.from("school_requirement_items").select("id").eq("school_id",sid).limit(500));
   const ins=await db.from("school_requirement_items").insert({school_id:sid,name,category,price_rwf:price,level_band:level,position:count.length,created_by:user.id}).select("id").single();
   if(ins.error)throw new ApiError(400,"The item could not be saved");
   result={id:ins.data.id};
  }else if(action==="item.remove"){
   managerOnly();
   const up=await db.from("school_requirement_items").update({active:false}).eq("school_id",sid).eq("id",validateUuid(body.itemId,"item")).select("id");
   if(up.error||!up.data?.length)throw new ApiError(404,"Item not found");
   result={removed:true};
  }else if(action==="mark"){
   if(!(ctx.manager||ctx.staff))throw new ApiError(403,"You cannot change the checklist");
   const status=STATUSES.includes(body.status)?body.status:null;if(!status)throw new ApiError(400,"Choose done, missing or not needed");
   const itemId=validateUuid(body.itemId,"item");
   const ids=(Array.isArray(body.studentIds)?body.studentIds:[body.studentId]).slice(0,300).map(x=>validateUuid(x,"student"));
   if(!ids.length)throw new ApiError(400,"Choose a student");
   const item=await checked(db.from("school_requirement_items").select("id").eq("school_id",sid).eq("id",itemId).eq("active",true).maybeSingle());
   if(!item)throw new ApiError(404,"Item not found");
   const okStudents=await checked(db.from("school_students").select("id").eq("school_id",sid).in("id",ids));
   if(okStudents.length!==new Set(ids).size)throw new ApiError(404,"Student not found");
   const note=String(body.note??"").trim().slice(0,300);
   const up=await db.from("school_student_requirements").upsert(ids.map(id=>({school_id:sid,student_id:id,item_id:itemId,status,note,updated_by:user.id,updated_at:new Date().toISOString()})),{onConflict:"student_id,item_id"});
   if(up.error)throw new ApiError(400,"The checklist could not be saved");
   result={count:ids.length,status};
  }else throw new ApiError(400,"Unknown student records action");
  await db.from("school_admin_audit").insert({school_id:sid,actor_id:user.id,event:"student_records."+action,metadata:{result}});
  return Response.json({ok:true,result},{headers:noStore});
 }catch(e){return jsonError(e);}
}
