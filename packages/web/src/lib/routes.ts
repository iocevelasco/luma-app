/**
 * Las rutas, en un solo lugar.
 *
 * En Pantera esta constante existía y aun así había literales sueltos que se
 * desincronizaron (`/oauth-callback` contra `/oauth/callback`), y un 401 en el
 * callback deslogueaba en vez de mostrar el error. Acá TODO —links, guards y
 * la lista de rutas públicas del api-client— sale de este objeto.
 */
export const ROUTES = {
  LOGIN: '/login',
  REGISTER: '/registro',
  FORGOT_PASSWORD: '/recuperar-clave',
  RESET_PASSWORD: '/nueva-clave',
  ACTIVATE: '/activar',
  VERIFY_EMAIL: '/verificar-email',

  HOME: '/',
  PROJECTS: '/proyectos',
  NEW_PROJECT: '/proyectos/nuevo',
  PLANNING: '/planificacion',
  MATERIALS: '/materiales',
  PERSONNEL: '/personal',
  BUDGET: '/presupuesto',
  BUDGET_IMPORT: '/presupuesto/importar',
  CONTINGENCIES: '/imprevistos',
  CONTINGENCY_NEW: '/imprevistos/nuevo',
  CONTINGENCY_DETAIL: '/imprevistos/:id',
  ASSISTANT: '/asistente',
  TEAM: '/equipo',
  SETTINGS: '/configuracion',

  CLIENT_HOME: '/cliente',
  CLIENT_DECISION: '/cliente/decisiones/:id',
} as const;

export const PUBLIC_ROUTES = [
  ROUTES.LOGIN,
  ROUTES.REGISTER,
  ROUTES.FORGOT_PASSWORD,
  ROUTES.RESET_PASSWORD,
  ROUTES.ACTIVATE,
  ROUTES.VERIFY_EMAIL,
];

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

export function contingencyPath(id: string): string {
  return ROUTES.CONTINGENCY_DETAIL.replace(':id', id);
}

export function clientDecisionPath(id: string): string {
  return ROUTES.CLIENT_DECISION.replace(':id', id);
}
