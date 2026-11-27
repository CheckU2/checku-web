import type { AuthUser } from "../types/api";

export function activeRole(user: AuthUser | null | undefined): string {
  return user?.active_context?.role ?? user?.role ?? "";
}

const academicCatalogs = ["/academic-periods", "/groups", "/subjects"];

export function hasInstitution(user: AuthUser | null | undefined): boolean {
  return Boolean(user?.active_context?.institution_id ?? user?.institution_id);
}

export function canAccessInstitutionRoute(user: AuthUser | null | undefined, path: string): boolean {
  const role = activeRole(user);
  if (path === "/dashboard" && role && (!hasInstitution(user) || user?.active_context)) return true;
  if (!hasInstitution(user)) {
    if (role === "teacher") return ["/dashboard", "/classes", "/sessions", "/justifications", "/reports", "/account"].includes(path);
    if (role === "tutor") return ["/dashboard", "/classes", "/groups", "/sessions", "/justifications", "/reports", "/account"].includes(path);
    if (role === "student") return ["/dashboard", "/classes", "/attendance", "/justifications", "/account"].includes(path);
    return true;
  }
  if (["/account", "/pending-approval"].includes(path)) return true;
  switch (activeRole(user)) {
    case "institution_owner":
    case "institution_admin":
      return ["/institution", "/careers", "/classes", "/reports", ...academicCatalogs].includes(path);
    case "career_director":
    case "career_admin":
      return ["/career", "/institution", "/classes", "/reports", ...academicCatalogs].includes(path);
    case "teacher":
      return ["/dashboard", "/classes", "/sessions", "/justifications", "/reports"].includes(path);
    case "student":
      return ["/dashboard", "/classes", "/attendance", "/justifications"].includes(path);
    case "tutor":
      return ["/classes", "/groups", "/justifications", "/reports"].includes(path);
    default:
      return false;
  }
}

export function homeForUser(user: AuthUser): string {
  if (!user.active_context && !(user.contexts?.length) && user.institution_id) return "/pending-approval";
  return canAccessInstitutionRoute(user, "/dashboard") ? "/dashboard" : "/account";
}
