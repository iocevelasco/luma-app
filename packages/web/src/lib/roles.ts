import type { UserRole } from '@luma/shared';
import { ROUTES } from '@/lib/routes';

export function isAdmin(role: UserRole | undefined): boolean {
  return role === 'admin';
}

export function isUser(role: UserRole | undefined): boolean {
  return role === 'user';
}

/**
 * Adónde cae quien entra. El admin de plataforma no opera obras: su pantalla
 * de inicio es el panel de cuentas. Fuente única para login, activación y la raíz.
 */
export function homePathFor(role: UserRole | undefined): string {
  return isAdmin(role) ? ROUTES.PLATFORM_USERS : ROUTES.ADMIN;
}
