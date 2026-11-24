export type AuthRole = "SUPER_ADMIN" | "ADMIN" | "STAFF";

export type Permission =
  | "leads.view"
  | "leads.create"
  | "leads.edit"
  | "leads.delete"
  | "leads.export"
  | "customers.view"
  | "customers.manage"
  | "packages.manage"
  | "tasks.manage"
  | "reports.view"
  | "users.manage";

const roleDefaults: Record<AuthRole, Permission[]> = {
  SUPER_ADMIN: [
    "leads.view",
    "leads.create",
    "leads.edit",
    "leads.delete",
    "leads.export",
    "customers.view",
    "customers.manage",
    "packages.manage",
    "tasks.manage",
    "reports.view",
    "users.manage",
  ],
  ADMIN: [
    "leads.view",
    "leads.create",
    "leads.edit",
    "customers.view",
    "customers.manage",
    "tasks.manage",
  ],
  STAFF: ["leads.view", "customers.view", "tasks.manage"],
};

export function hasRole(role: AuthRole, allowed: AuthRole[]) {
  return allowed.includes(role);
}

export function can(role: AuthRole, permission: Permission) {
  return roleDefaults[role].includes(permission);
}
