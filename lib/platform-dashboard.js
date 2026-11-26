import { ApiError, checked, audit, validateUuid, requireOwner, requirePermission } from "./platform-server.js";

export const PROVINCES = ["kigali", "northern", "southern", "eastern", "western"];
export const LEVELS = ["nursery", "primary", "secondary", "college"];

// Read-only extras for the Platform Owner dashboard. Each part degrades to an empty value so
// the console still loads if a part is unavailable (for example before a migration is applied).
export async function loadDashboardExtras(db, tenants) {
  const out = { plans: [], announcements: [], profiles: {}, health: null };
  try {
    if (tenants.length) {
      const rows = await checked(db.from("platform_schools")
        .select("id,province,district,education_level,plan_code").in("id", tenants.map((t) => t.id)));
      for (const r of rows) out.profiles[r.id] = r;
    }
  } catch (e) { /* profile columns not available yet */ }
  try {
    out.plans = await checked(db.from("platform_plans")
      .select("code,name,monthly_fee_rwf,description,sort_order,active").order("sort_order"));
  } catch (e) { /* plans not available yet */ }
  try {
    out.announcements = await checked(db.from("platform_announcements")
      .select("id,title,body,audience,created_at,expires_on,active").order("created_at", { ascending: false }).limit(30));
  } catch (e) { /* announcements not available yet */ }
  out.health = await healthChecks(db);
  return out;
}

async function timed(fn) {
  const t0 = Date.now();
  try { const ok = await fn(); return { ok: ok !== false, ms: Date.now() - t0 }; }
  catch (e) { return { ok: false, ms: Date.now() - t0 }; }
}

// Only things this server can really verify. Anything it cannot verify is reported as unknown, never as healthy.
export async function healthChecks(db) {
  const database = await timed(async () => {
    const { error } = await db.from("platform_schools").select("id", { count: "exact", head: true });
    return !error;
  });
  const auth = await timed(async () => {
    const { error } = await db.auth.admin.listUsers({ page: 1, perPage: 1 });
    return !error;
  });
  let brandingBucket = false;
  const storage = await timed(async () => {
    const { data, error } = await db.storage.listBuckets();
    if (error) return false;
    brandingBucket = (data || []).some((b) => b.name === "school-branding");
    return true;
  });
  return {
    checkedAt: new Date().toISOString(),
    database, auth, storage: { ...storage, brandingBucket },
    email: { configured: Boolean(process.env.BREVO_API_KEY) },
    mobileMoney: { configured: Boolean(process.env.PAYPACK_CLIENT_ID || process.env.FLUTTERWAVE_SECRET_KEY) },
    backups: { verified: false },
  };
}

const cleanLine = (v, max) => String(v ?? "").trim().slice(0, max);

export async function dashboardAction(action, body, { db, actor, token }) {
  if (action === "school.profile") {
    requirePermission(actor, "tenants.lifecycle");
    const schoolId = validateUuid(body.schoolId, "school");
    const province = body.province ? String(body.province) : null;
    const level = body.educationLevel ? String(body.educationLevel) : null;
    if (province && !PROVINCES.includes(province)) throw new ApiError(400, "Choose a valid province.");
    if (level && !LEVELS.includes(level)) throw new ApiError(400, "Choose a valid education level.");
    const district = cleanLine(body.district, 60) || null;
    if (district && district.length < 2) throw new ApiError(400, "District name is too short.");
    const plan = body.planCode ? String(body.planCode) : null;
    if (plan) {
      const found = await checked(db.from("platform_plans").select("code").eq("code", plan).eq("active", true).maybeSingle());
      if (!found) throw new ApiError(400, "That plan is not available.");
    }
    const result = await checked(db.from("platform_schools")
      .update({ province, district, education_level: level, plan_code: plan, updated_at: new Date().toISOString() })
      .eq("id", schoolId).select("id").single());
    await audit(db, actor, "school.profile_updated", schoolId, { province, level, plan });
    return result;
  }
  if (action === "plan.save") {
    requireOwner(actor);
    const code = String(body.code || "");
    if (!/^[a-z][a-z0-9_]{1,30}$/.test(code)) throw new ApiError(400, "Plan code must be lowercase letters, numbers or underscores.");
    const fee = body.monthlyFeeRwf === "" || body.monthlyFeeRwf == null ? null : Number(body.monthlyFeeRwf);
    if (fee !== null && (!Number.isSafeInteger(fee) || fee < 0 || fee > 1000000000)) throw new ApiError(400, "Enter the monthly fee in whole RWF.");
    const name = cleanLine(body.name, 60);
    if (name.length < 2) throw new ApiError(400, "Give the plan a name.");
    const record = { code, name, monthly_fee_rwf: fee, description: cleanLine(body.description, 400),
      active: body.active !== false, sort_order: Number.isInteger(body.sortOrder) ? body.sortOrder : 100,
      updated_at: new Date().toISOString() };
    const result = await checked(db.from("platform_plans").upsert(record, { onConflict: "code" }).select("code").single());
    await audit(db, actor, "plan.saved", null, { code, fee });
    return result;
  }
  if (action === "announce.create") {
    requirePermission(actor, "tickets.manage");
    const title = cleanLine(body.title, 120), text = cleanLine(body.body, 2000);
    if (title.length < 3 || text.length < 3) throw new ApiError(400, "Write a title and a message.");
    const audience = body.audience === "all_members" ? "all_members" : "school_owners";
    const expires = body.expiresOn ? String(body.expiresOn) : null;
    if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) throw new ApiError(400, "Use a valid expiry date.");
    const result = await checked(db.from("platform_announcements")
      .insert({ title, body: text, audience, expires_on: expires, created_by: actor.id }).select("id").single());
    await audit(db, actor, "announcement.created", result.id, { audience });
    return result;
  }
  if (action === "announce.toggle") {
    requirePermission(actor, "tickets.manage");
    const id = validateUuid(body.id, "announcement");
    const result = await checked(db.from("platform_announcements").update({ active: Boolean(body.active) }).eq("id", id).select("id").single());
    await audit(db, actor, "announcement.toggled", id, { active: Boolean(body.active) });
    return result;
  }
  return undefined;
}
