import type { UserRole } from '@luma/shared';

export function isAdmin(role: UserRole | undefined): boolean {
  return role === 'admin';
}

export function isUser(role: UserRole | undefined): boolean {
  return role === 'user';
}
