import type { Role } from "@/lib/types";

export const routeRolePermissions: Record<string, readonly Role[]> = {
  "/dashboard": ["ADMIN", "MANAGER", "USER"],
  "/tenders": ["ADMIN", "MANAGER", "USER"],
  "/quotations": ["ADMIN", "MANAGER", "USER"],
  "/proforma-invoices": ["ADMIN", "MANAGER", "USER"],
  "/ims-master": ["ADMIN", "MANAGER", "USER"],
  "/imports": ["ADMIN", "MANAGER", "USER"],
  "/assignments": ["ADMIN", "MANAGER"],
  "/follow-ups": ["ADMIN", "MANAGER", "USER"],
  "/analytics": ["ADMIN", "MANAGER"],
  "/contractor-intelligence": ["ADMIN", "MANAGER"],
  "/product-intelligence": ["ADMIN", "MANAGER"],
  "/deleted-tenders": ["ADMIN"],
  "/users": ["ADMIN", "MANAGER"],
  "/settings": ["ADMIN"]
};

export function canAccessRoute(pathname: string, role: Role) {
  const route = Object.entries(routeRolePermissions)
    .sort(([a], [b]) => b.length - a.length)
    .find(([path]) => pathname === path || pathname.startsWith(`${path}/`));

  if (!route) return true;
  return route[1].includes(role);
}

export function canUseExcelImport(role: Role) {
  return role === "ADMIN" || role === "MANAGER";
}

export function canAssignLeads(role: Role) {
  return role === "ADMIN" || role === "MANAGER";
}

export function canAccessQuotations(profile: { role: Role; can_access_quotations?: boolean }) {
  return profile.role === "ADMIN" || profile.role === "MANAGER" || Boolean(profile.can_access_quotations);
}

export function canAccessProformaInvoices(profile: { role: Role; can_access_pi?: boolean }) {
  return profile.role === "ADMIN" || profile.role === "MANAGER" || Boolean(profile.can_access_pi);
}
