import { authenticate, requirePermission, requireOwner, requireAal2, validateUuid, safeText, checked, audit, jsonError, ApiError } from "../../../lib/platform-server.js";
import { canTransition, normalizePermissions, ROLE_DEFAULTS, validateTenantInput } from "../../../lib/access.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { actor, db } = await authenticate(request);
    if (!actor.active) return Response.json({ actor, needsApproval: true }, { headers: { "Cache-Control": "no-store" } });
    const can = (permission) => actor.isOwner || actor.permissions.includes(permission);
    const data = { actor, needsApproval: false, tenants: [], tickets: [], staff: [], requests: [], methods: [], invoices: [], payments: [], audit: [] };
    if (can("tenants.read")) {
      data.tenants = await checked(db.from("platform_schools")
        .select("id,school_code,name,owner_email,status,created_at,updated_at,company_id,platform_companies(company_code,name)")
        .order("created_at", { ascending: false }).limit(200));
    }
    if (can("tickets.read")) {
      data.tickets = await checked(db.from("platform_tickets")
        .select("id,school_id,title,description,priority,status,assigned_to,created_at,updated_at")
        .order("created_at", { ascending: false }).limit(100));
    }
    if (can("billing.read")) {
      data.invoices = await checked(db.from("platform_invoices")
        .select("id,school_id,amount_rwf,status,due_date,created_at")
        .order("created_at", { ascending: false }).limit(500));
      data.payments = await checked(db.from("platform_payments")
        .select("id,invoice_id,amount_rwf,status,provider,created_at")
        .order("created_at", { ascending: false }).limit(500));
    }
    if (can("billing.methods")) {
      data.methods = await checked(db.from("platform_payment_methods")
        .select("id,label,type,enabled,is_default,created_at")
        .order("created_at", { ascending: true }));
    }
    if (can("staff.read") || actor.isOwner) {
      data.staff = await checked(db.from("platform_staff")
        .select("auth_user_id,email,role,permissions,active,created_at").order("created_at", { ascending: false }));
    }
    if (actor.isOwner) {
      data.requests = await checked(db.from("platform_staff_requests")
        .select("id,auth_user_id,email,reason,status,created_at").eq("status", "pending")
        .order("created_at", { ascending: false }));
    }
    if (can("audit.read")) {
      data.audit = await checked(db.from("platform_audit")
        .select("id,actor_id,event,resource_id,created_at").order("created_at", { ascending: false }).limit(80));
    }
    const stats = await checked(db.rpc("platform_owner_stats"));
    const financial = can("billing.read")
      ? { billedRwf: Number(stats.billedRwf), collectedRwf: Number(stats.collectedRwf),
          unallocatedDifferenceRwf: Number(stats.billedRwf) - Number(stats.collectedRwf) }
      : {};
    if (can("billing.read") && !Object.values(financial).every(Number.isSafeInteger)) {
      throw new ApiError(500,"Platform financial totals exceed safe whole-RWF display limits.");
    }
    const totals = {
      tenants: can("tenants.read") ? Number(stats.tenants) : 0,
      ...Object.fromEntries(["onboarding","active","paused","suspended","archived","deletion_requested"]
        .map(state => [state, can("tenants.read") ? Number(stats[state]) : 0])),
      ticketsOpen: can("tickets.read") ? Number(stats.ticketsOpen) : 0,
      ...financial
    };
    return Response.json({
      ...data, totals, roleDefaults: actor.isOwner ? ROLE_DEFAULTS : undefined
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) { return jsonError(err); }
}

export async function POST(request) {
  try {
    const { actor, db, token } = await authenticate(request);
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "");
    let result = null;

    if (action === "tenant.create") {
      requirePermission(actor,"tenants.create");
      const payload = validateTenantInput(body);
      result = await checked(db.rpc("platform_register_school", {
        p_company_name: payload.company_name, p_school_name: payload.school_name,
        p_owner_email: payload.owner_email, p_actor: actor.id
      }));
    } else if (action === "tenant.state") {
      requirePermission(actor,"tenants.lifecycle");
      const schoolId = validateUuid(body.id, "school");
      const reason = safeText(body.reason, 500);
      if (reason.length < 8) throw new ApiError(400,"Enter a meaningful reason (at least 8 characters).");
      const target = String(body.status || "");
      const current = await checked(db.from("platform_schools").select("status,school_code").eq("id",schoolId).single());
      if (!canTransition(current.status,target)) throw new ApiError(400, "This tenant status change is not permitted.");
      if (target === "deletion_requested") { requireOwner(actor); requireAal2(token); if (String(body.confirmSchoolCode || "") !== current.school_code) throw new ApiError(400,"Type the exact School ID to request deletion."); }
      result = await checked(db.rpc("platform_change_school_state", {
        p_school_id: schoolId, p_target: target, p_reason: reason, p_actor: actor.id
      }));
    } else if (action === "ticket.create") {
      requirePermission(actor,"tickets.manage");
      const schoolId = validateUuid(body.schoolId,"school");
      const title = safeText(body.title, 160);
      const description = safeText(body.description, 2000);
      result = await checked(db.from("platform_tickets").insert({
        school_id:schoolId,title,description,priority:"normal",status:"open",created_by:actor.id
      }).select("id").single());
      await audit(db,actor,"ticket.created",result.id,{school_id:schoolId});
    } else if (action === "ticket.update") {
      requirePermission(actor,"tickets.manage");
      const id = validateUuid(body.id,"ticket");
      const status = String(body.status||"");
      if (!["open","in_progress","resolved"].includes(status)) throw new ApiError(400,"Invalid ticket status.");
      result = await checked(db.from("platform_tickets").update({status,updated_at:new Date().toISOString()}).eq("id",id).select("id").single());
      await audit(db,actor,"ticket.status_changed",id,{status});
    } else if (action === "ticket.assign") {
      requirePermission(actor,"tickets.manage");
      requirePermission(actor,"staff.read");
      const id=validateUuid(body.id,"ticket");
      const assigneeId=validateUuid(body.assigneeId,"staff");
      const staff=await checked(db.from("platform_staff").select("active,permissions")
        .eq("auth_user_id",assigneeId).single());
      if (!staff.active || !staff.permissions.includes("tickets.manage")) throw new ApiError(400,"Select an active colleague with ticket management permission.");
      result=await checked(db.from("platform_tickets").update({
        assigned_to:assigneeId,status:"in_progress",updated_at:new Date().toISOString()
      }).eq("id",id).select("id").single());
      await audit(db,actor,"ticket.assigned",id,{assigned_to:assigneeId});
    } else if (action === "staff.approve") {
      requireOwner(actor); requireAal2(token);
      const requestId = validateUuid(body.id,"request");
      const role = String(body.role||"");
      if (!ROLE_DEFAULTS[role]) throw new ApiError(400,"Invalid staff role.");
      const permissions = normalizePermissions(body.permissions ?? ROLE_DEFAULTS[role]);
      const req = await checked(db.from("platform_staff_requests")
        .select("auth_user_id,email,status").eq("id",requestId).single());
      if (req.status !== "pending" || req.auth_user_id === actor.id) throw new ApiError(409,"Staff request cannot be approved.");
      result = await checked(db.rpc("platform_approve_staff_request", {
        p_request_id:requestId,p_role:role,p_permissions:permissions,p_actor:actor.id
      }));
    } else if (action === "staff.permissions") {
      requireOwner(actor); requireAal2(token);
      const staffId = validateUuid(body.id,"staff");
      if (staffId===actor.id) throw new ApiError(400,"You cannot edit your own owner permissions.");
      const role = String(body.role||"");
      if (!ROLE_DEFAULTS[role]) throw new ApiError(400,"Invalid staff role.");
      const permissions = normalizePermissions(body.permissions);
      const reason = safeText(body.reason,500);
      if (reason.length < 8) throw new ApiError(400,"Explain the permission change.");
      const staff = await checked(db.from("platform_staff")
        .select("active").eq("auth_user_id",staffId).single());
      if (!staff.active) throw new ApiError(409,"This account is disabled; you must approve access again.");
      result=await checked(db.rpc("platform_update_staff_permissions",{
        p_staff_id:staffId,p_role:role,p_permissions:permissions,
        p_reason:reason,p_actor:actor.id
      }));
    } else if (action === "staff.disable") {
      requireOwner(actor); requireAal2(token);
      const staffId = validateUuid(body.id,"staff");
      if (staffId === actor.id) throw new ApiError(400,"You cannot disable your own owner account.");
      result = await checked(db.rpc("platform_disable_staff", {p_staff_id:staffId,p_actor:actor.id}));
    } else if (action === "method.create") {
      requirePermission(actor,"billing.methods");
      const label = safeText(body.label, 80);
      const type = String(body.type || "");
      if (!["mobile_money","bank","card","other"].includes(type)) throw new ApiError(400,"Invalid payment channel.");
      result = await checked(db.from("platform_payment_methods")
        .insert({label,type,enabled:false,is_default:false}).select("id").single());
      await audit(db,actor,"billing.method_added",result.id,{type,label});
    } else if (action === "method.toggle" || action === "method.default") {
      requirePermission(actor,"billing.methods");
      const id = validateUuid(body.id,"payment method");
      if (action === "method.default") requireAal2(token);
      result = await checked(db.rpc("platform_configure_payment_method", {
        p_method_id:id,p_set_default:action === "method.default",
        p_enabled: action === "method.toggle" ? Boolean(body.enabled) : true,p_actor:actor.id
      }));
    } else {
      throw new ApiError(400,"Unsupported action.");
    }

    return Response.json({ok:true,result},{headers:{"Cache-Control":"no-store"}});
  } catch (err) {return jsonError(err);}
}
