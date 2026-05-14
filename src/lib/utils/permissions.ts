import type { UserRole } from "@/generated/prisma/enums";

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  CLIENT: 0,
  PREPARER: 1,
  MANAGER: 2,
  ADMIN: 3,
};

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function isStaff(role: UserRole): boolean {
  return role === "PREPARER" || role === "MANAGER" || role === "ADMIN";
}

export function isManager(role: UserRole): boolean {
  return role === "MANAGER" || role === "ADMIN";
}

export function isAdmin(role: UserRole): boolean {
  return role === "ADMIN";
}

export const ROUTE_ACCESS: Record<string, UserRole[]> = {
  "/staff": ["PREPARER", "MANAGER", "ADMIN"],
  "/admin": ["ADMIN"],
};

export function canAccessRoute(
  role: UserRole,
  pathname: string
): boolean {
  for (const [prefix, allowedRoles] of Object.entries(ROUTE_ACCESS)) {
    if (pathname.startsWith(prefix)) {
      return allowedRoles.includes(role);
    }
  }
  return true;
}

export function getDefaultRedirect(role: UserRole): string {
  switch (role) {
    case "CLIENT":
      return "/dashboard";
    case "PREPARER":
    case "MANAGER":
      return "/staff/dashboard";
    case "ADMIN":
      return "/admin/users";
    default:
      return "/dashboard";
  }
}
