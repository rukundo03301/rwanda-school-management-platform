import { createClient } from "@supabase/supabase-js";
import { ALL_PERMISSIONS, hasPermission } from "./access.mjs";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publishable || !secret) {
    throw new ApiError(503, "Supabase is not configured. Set the server's environment variables.");
  }
  return { url, publishable, secret };
}

export function clients() {
  const { url, publishable, secret } = supabaseConfig();
  const opts = { auth: { autoRefreshToken: false, persistSession: false } };
  return { authClient: createClient(url, publishable, opts), db: createClient(url, secret, opts) };
}

export async function authenticate(request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || token.length > 8192) throw new ApiError(401, "Sign in to continue.");
  const { authClient, db } = clients();
  const { data, error } = await authClient.auth.getUser(token);
  const user = data?.user;
  if (error || !user) throw new ApiError(401, "Your session is invalid or expired.");
  if (!user.email_confirmed_at) throw new ApiError(403, "Confirm your email before accessing the platform.");

  const configuredOwner = (process.env.PLATFORM_OWNER_EMAIL || "").toLowerCase().trim();
  const isOwner = Boolean(configuredOwner && user.email?.toLowerCase() === configuredOwner);
  let actor = { id: user.id, email: user.email, role: "pending", active: false, isOwner: false, permissions: [] };
  if (isOwner) {
    actor = { ...actor, role: "platform_owner", active: true, isOwner: true, permissions: [...ALL_PERMISSIONS] };
  } else {
    const { data: staff, error: staffError } = await db.from("platform_staff")
      .select("auth_user_id,role,permissions,active")
      .eq("auth_user_id", user.id).maybeSingle();
    if (staffError) throw new ApiError(503, "Staff permissions are not available. The platform database may not be initialized.");
    if (staff?.active) {
      actor = { ...actor, role: staff.role, active: true, permissions: staff.permissions || [] };
    }
  }
  return { user, actor, db, token };
}

export function requirePermission(actor, permission) {
  if (!hasPermission(actor, permission)) throw new ApiError(403, "You do not have permission for this action.");
}

export function requireOwner(actor) {
  if (actor?.isOwner !== true || !actor?.active) throw new ApiError(403, "Only the verified platform owner can perform this action.");
}

export function requireAal2(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] || "", "base64url").toString("utf8"));
    if (payload?.aal === "aal2") return;
  } catch {
    // Incorrect token format.
  }
  throw new ApiError(403, "Two-factor authentication is required for this sensitive action.");
}

export function validateUuid(id, field = "ID") {
  const value = String(id || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError(400, "Invalid " + field);
  }
  return value;
}

export function safeText(value, max = 250) {
  const v = String(value ?? "").trim();
  if (!v || v.length > max) throw new ApiError(400, "Enter valid text, up to " + max + " characters.");
  return v;
}

export async function checked(promise) {
  const { data, error } = await promise;
  if (error) throw new ApiError(500, "Database operation failed: " + error.message);
  return data;
}

export async function audit(db, actor, event, resourceId, metadata = {}) {
  await checked(db.from("platform_audit").insert({
    actor_id: actor.id, event, resource_id: resourceId || null, metadata
  }));
}

export function jsonError(err) {
  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status <= 599 ? err.status : 500;
  const safeMessage = status >= 500 && !(err instanceof ApiError) ? "Unexpected server error." : (err?.message || "Request failed.");
  return Response.json({ error: safeMessage }, { status, headers: { "Cache-Control": "no-store" } });
}
