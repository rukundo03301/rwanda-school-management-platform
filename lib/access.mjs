export const ALL_PERMISSIONS = Object.freeze([
  "tenants.read",
  "tenants.create",
  "tenants.lifecycle",
  "tickets.read",
  "tickets.manage",
  "billing.read",
  "billing.methods",
  "billing.record",
  "tenants.brand",
  "staff.read",
  "staff.manage",
  "audit.read",
]);

export const ROLE_DEFAULTS = Object.freeze({
  operations: ["tenants.read", "tenants.create", "tenants.lifecycle", "tickets.read", "tickets.manage", "audit.read"],
  support: ["tenants.read", "tickets.read", "tickets.manage"],
  finance: ["tenants.read", "billing.read"],
  observer: ["tenants.read", "tickets.read", "billing.read"],
});

export const TENANT_STATES = Object.freeze([
  "onboarding", "active", "paused", "suspended", "archived", "deletion_requested",
]);

const transitions = Object.freeze({
  onboarding: ["active", "paused", "suspended", "deletion_requested"],
  active: ["paused", "suspended", "archived", "deletion_requested"],
  paused: ["active", "suspended", "archived", "deletion_requested"],
  suspended: ["paused", "archived", "deletion_requested"],
  archived: ["active", "deletion_requested"],
  deletion_requested: ["paused", "archived"],
});

export function canTransition(from, to) {
  return Boolean(from !== to && transitions[from]?.includes(to));
}

export function hasPermission(actor, permission) {
  if (!actor || actor.active === false) return false;
  if (actor.isOwner === true) return ALL_PERMISSIONS.includes(permission);
  return Array.isArray(actor.permissions) && actor.permissions.includes(permission);
}

export function normalizePermissions(value) {
  if (!Array.isArray(value)) throw new Error("Permissions must be an array");
  if (!value.every((item) => typeof item === "string" && ALL_PERMISSIONS.includes(item))) {
    throw new Error("Unknown permission requested");
  }
  return [...new Set(value)];
}

export function validateTenantInput(data) {
  const company_name = String(data?.companyName ?? "").trim();
  const school_name = String(data?.schoolName ?? "").trim();
  const owner_email = String(data?.ownerEmail ?? "").trim().toLowerCase();
  if (company_name.length < 2 || company_name.length > 120) throw new Error("Enter a valid company name");
  if (school_name.length < 2 || school_name.length > 120) throw new Error("Enter a valid school name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner_email) || owner_email.length > 254) throw new Error("Enter a valid school owner email");
  return { company_name, school_name, owner_email };
}
