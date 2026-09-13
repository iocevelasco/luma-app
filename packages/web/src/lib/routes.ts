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

  NOT_FOUND: '*',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/** Adónde va cada rol después de entrar. */
export const HOME_BY_ROLE = {
  admin: ROUTES.ADMIN,
  user: ROUTES.ADMIN,
} as const;
