/**
 * Rutas de la SPA. Fuente única: los guards, los redirects y la lista de rutas
 * públicas del api-client se derivan de acá. Un path escrito a mano en otro
 * archivo es un 401 que desloguea al usuario en una pantalla pública.
 */
export const ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  CHECK_EMAIL: '/check-email',
  VERIFY_EMAIL: '/verify-email',
  ACTIVATE: '/activate',
  CONFIRM_EMAIL_CHANGE: '/confirm-email-change',

  ADMIN: '/admin',
  ACCOUNT_SETTINGS: '/admin/settings/account',
  PROJECT_NEW: '/admin/proyectos/nuevo',
  PROJECT_DETAIL: '/admin/proyectos/:projectId',

  NOT_FOUND: '*',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/** `ROUTES.PROJECT_DETAIL` con el `:projectId` resuelto, para armar links. */
export function projectDetailPath(projectId: string): string {
  return ROUTES.PROJECT_DETAIL.replace(':projectId', projectId);
}
