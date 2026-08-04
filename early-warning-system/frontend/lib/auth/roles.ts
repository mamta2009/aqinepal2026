export type AppRole = "anonymous" | "registrant" | "facility" | "admin";

export interface SessionClaims {
  role: AppRole;
  contactId?: string;
  facilityId?: string;
  scopes?: string[];
}

export function hasScope(
  claims: SessionClaims | null | undefined,
  scope: string,
): boolean {
  if (!claims?.scopes?.length) return false;
  return claims.scopes.includes(scope);
}

export function canManageFacilities(claims: SessionClaims | null | undefined) {
  return (
    claims?.role === "registrant" ||
    claims?.role === "facility" ||
    hasScope(claims, "facility_actions")
  );
}

export function isAdminSession(hasAdminCookie: boolean) {
  return hasAdminCookie;
}
