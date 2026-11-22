import { authenticate, safeText, checked, jsonError, ApiError } from "../../../../lib/platform-server.js";

export const runtime = "nodejs";
export async function POST(request) {
  try {
    const {user,actor,db} = await authenticate(request);
    if (actor.active) return Response.json({ok:true,alreadyApproved:true});
    const body = await request.json().catch(()=>({}));
    const reason = safeText(body.reason,500);
    if (reason.length < 10) throw new ApiError(400,"Explain why you need platform staff access.");
    const existing = await checked(db.from("platform_staff_requests").select("id,status")
      .eq("auth_user_id",user.id).maybeSingle());
    if(existing && existing.status==="pending") return Response.json({ok:true,pending:true});
    if(existing && existing.status==="approved") throw new ApiError(409,"This request was previously reviewed.");
    const record = {auth_user_id:user.id,email:user.email,reason,status:"pending"};
    if(existing) await checked(db.from("platform_staff_requests").update(record).eq("id",existing.id));
    else await checked(db.from("platform_staff_requests").insert(record));
    return Response.json({ok:true,pending:true});
  } catch(err){return jsonError(err);}
}
