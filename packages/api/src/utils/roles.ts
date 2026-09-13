import type { JWTPayload, UserRole } from '@luma/shared';

export function getUserRoles(
  payload: JWTPayload | { roles?: UserRole[] } | null | undefined,
): UserRole[] {
  if (!payload) return [];
  if (Array.isArray(payload.roles) && payload.roles.length > 0) {
    return payload.roles;
  }
  return [];
}

export function hasRole(
  userRoles: UserRole[] | undefined,
  requiredRole: UserRole | UserRole[],
): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  const required = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return required.some((role) => userRoles.includes(role));
}

export function isAdmin(userRoles: UserRole[] | undefined): boolean {
  return hasRole(userRoles, 'admin');
}

export function isUser(userRoles: UserRole[] | undefined): boolean {
  return hasRole(userRoles, 'user');
}
