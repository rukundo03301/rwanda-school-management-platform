import {clients,ApiError,checked,validateUuid} from "./platform-server.js";

export const SCHOOL_ADMIN_ACTIONS=Object.freeze([
 {id:"people.read",group:"People",title:"View staff directory"},
 {id:"people.invite",group:"People",title:"Invite teachers and school staff"},
 {id:"people.manage",group:"People",title:"Revoke teacher or staff access"},
 {id:"academics.read",group:"Academics",title:"View academic years, classes and subjects"},
 {id:"academics.manage",group:"Academics",title:"Create classes, academic years and subjects"},
 {id:"audit.read",group:"Security",title:"View school administrative activity"}
]);
export const SCHOOL_ADMIN_PERMISSIONS=Object.freeze(SCHOOL_ADMIN_ACTIONS.map(a=>a.id));

export function validatedAdminPermissions(input){
 if(!Array.isArray(input)||input.length>6)throw new ApiError(400,"Invalid permission selection");
 if(input.some(v=>typeof v!=="string"||!SCHOOL_ADMIN_PERMISSIONS.includes(v)))
   throw new ApiError(400,"Unknown school permission");
 return [...new Set(input)];
}
export function schoolAdminCan(actor,permission){
 return !!actor?.isOwner||!!(actor?.active&&actor?.role==="school_admin"&&actor?.permissions?.includes(permission));
}
export function requireSchoolPermission(actor,permission){
 if(!schoolAdminCan(actor,permission))throw new ApiError(403,"This school has not approved that permission");
}
export function requireSchoolOwner(actor){
 if(actor?.isOwner!==true||actor?.active!==true)
  throw new ApiError(403,"Only this school's verified owner can approve an administrator");
}
export function schoolAdminText(value,max=120,{required=true}={}){
 if(typeof value!=="string"||value.length>max)throw new ApiError(400,"Field is too long or invalid");
 const trimmed=value.trim();
 if(required&&!trimmed)throw new ApiError(400,"This field is required");
 return trimmed;
}

export async function schoolVerifiedContext(request,code){
 if(typeof code!=="string"||!/^RW-SCH-\d{6,16}$/.test(code))
   throw new ApiError(404,"School not found");
 const raw=request.headers.get("authorization")||"";
 if(!raw.startsWith("Bearer ")||raw.length>8500)throw new ApiError(401,"Sign in to your school first");
 const token=raw.slice(7);
 const {authClient,db}=clients();
 const {data:{user},error:userError}=await authClient.auth.getUser(token);
 if(userError||!user?.id||!user.email||!user.email_confirmed_at)
   throw new ApiError(401,"Confirm your email and sign in first");
 const school=await checked(db.from("platform_schools")
   .select("id,name,school_code,status,owner_email")
   .eq("school_code",code).maybeSingle());
 if(!school)throw new ApiError(404,"School not found");
 if(school.status!=="active")throw new ApiError(403,"This school is not active");
 return {db,user,school,token};
}
export async function schoolAdminContext(request,code){
 const context=await schoolVerifiedContext(request,code);
 const {db,user,school}=context;
 const memberships=await checked(db.from("school_memberships")
  .select("role,active").eq("school_id",school.id).eq("auth_user_id",user.id)
  .eq("active",true).in("role",["school_owner","school_admin"]));
 const isOwner=memberships?.some(m=>m.role==="school_owner")===true;
 const hasAdmin=memberships?.some(m=>m.role==="school_admin")===true;
 if(!isOwner&&!hasAdmin)throw new ApiError(403,"You do not have school administration access");
 let permissions=[];
 if(isOwner) permissions=[...SCHOOL_ADMIN_PERMISSIONS];
 else {
   const record=await checked(db.from("school_admin_permissions")
     .select("permissions").eq("school_id",school.id).eq("auth_user_id",user.id).maybeSingle());
   permissions=Array.isArray(record?.permissions)?record.permissions.filter(p=>SCHOOL_ADMIN_PERMISSIONS.includes(p)):[];
 }
 return {...context,actor:{
   id:user.id,email:user.email,role:isOwner?"school_owner":"school_admin",
   isOwner,active:true,permissions
 }};
}
export async function schoolAdminAudit(db,schoolId,actorId,event,metadata={}){
 await checked(db.from("school_admin_audit").insert({
   school_id:validateUuid(schoolId,"school"),actor_id:actorId,event,metadata
 }));
}
