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

  // Bootstrap by immutable Auth UUID, never by an editable or recycled email address.
  const configuredOwner = (process.env.PLATFORM_OWNER_USER_ID || "").trim().toLowerCase();
  const isOwner = Boolean(configuredOwner && user.id.toLowerCase() === configuredOwner);
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
  if (error) {
    // Log the database detail on the server; never send raw database text to the browser.
    console.error("platform database error", error.code || "", error.message || "");
    if (error.code === "PGRST116") throw new ApiError(404, "Record not found.");
    if (error.code === "23503") throw new ApiError(400, "A referenced record does not exist.");
    if (error.code === "23505") throw new ApiError(409, "This record already exists.");
    if (error.code === "23514") throw new ApiError(400, "A value is outside the permitted range.");
    // P0001 is raised deliberately by the platform database functions with a message written for the owner.
    if (error.code === "P0001") throw new ApiError(400, error.message);
    throw new ApiError(500, "Database operation failed.");
  }
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
