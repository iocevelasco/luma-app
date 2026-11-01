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
  /** Términos y Política de Privacidad. Pública: se lee antes de tener cuenta. */
  LEGAL: '/legal',

  ADMIN: '/admin',
  COMPANY: '/admin/empresa',
  PROVIDERS: '/admin/proveedores',
  CREW: '/admin/empleados',
  ACCOUNT_SETTINGS: '/admin/settings/account',
  /** La API arma las vueltas desde Stripe con este mismo path: ver `stripe.service.ts`. */
  SUBSCRIPTION: '/admin/settings/subscription',
  /**
   * Administración global de Luma. Fuera de `/admin` a propósito: no es parte
   * del panel de obras y no comparte su navegación. Sólo `role: 'admin'`.
   */
  PLATFORM: '/plataforma',
  /** Las cuentas registradas, sólo lectura. */
  PLATFORM_USERS: '/plataforma/cuentas',
  /** Cuánto hace la gente por rol de obra: sólo conteos agregados. */
  PLATFORM_ACTIVITY: '/plataforma/actividad',
  /** Comunicados por correo a las cuentas. */
  PLATFORM_CAMPAIGNS: '/plataforma/campanas',
  /** La cola de pagos en Bs y la tasa BCV. */
  PLATFORM_BILLING: '/plataforma/pagos',
  /** El prompt del asistente. Uno solo, para todas las cuentas. */
  PLATFORM_ASSISTANT: '/plataforma/asistente',
  /** Dónde vivía la cola de pagos antes de separar la administración: sigue redirigiendo. */
  LEGACY_PLATFORM_BILLING: '/admin/plataforma/pagos',
  PROJECT_NEW: '/admin/proyectos/nuevo',
  /** Las obras eliminadas, restaurables durante 90 días. */
  PROJECTS_TRASH: '/admin/proyectos/papelera',
  PROJECT_DETAIL: '/admin/proyectos/:projectId',
  PROJECT_ACTIVITIES: '/admin/proyectos/:projectId/actividades',
  PROJECT_MATERIALS: '/admin/proyectos/:projectId/materiales',
  PROJECT_LABOR: '/admin/proyectos/:projectId/personal',
  PROJECT_PROVIDERS: '/admin/proyectos/:projectId/proveedores',
  PROJECT_DOCUMENTS: '/admin/proyectos/:projectId/documentacion',
  PROJECT_MILESTONES: '/admin/proyectos/:projectId/hitos',
  PROJECT_MILESTONE_NEW: '/admin/proyectos/:projectId/hitos/nuevo',
  PROJECT_MILESTONE_EDIT: '/admin/proyectos/:projectId/hitos/:milestoneId/editar',
  PROJECT_TEAM: '/admin/proyectos/:projectId/equipo',
  PROJECT_PAYMENTS: '/admin/proyectos/:projectId/pagos',
  PROJECT_EXPENSES: '/admin/proyectos/:projectId/gastos',
  PROJECT_BUDGET: '/admin/proyectos/:projectId/presupuesto',
  PROJECT_ADVISOR: '/admin/proyectos/:projectId/consultor-ia',

  NOT_FOUND: '*',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/** `ROUTES.PROJECT_DETAIL` con el `:projectId` resuelto, para armar links. */
export function projectDetailPath(projectId: string): string {
  return ROUTES.PROJECT_DETAIL.replace(':projectId', projectId);
}

/** Las vistas de Actividades que se abren por link: sin vista, el Cronograma. */
export type ProjectActivitiesView = 'board' | 'list';

/**
 * `ROUTES.PROJECT_ACTIVITIES` con el `:projectId` resuelto, para armar links.
 * Sin vista abre el Cronograma; con `view`, el Tablero o la Lista.
 */
export function projectActivitiesPath(projectId: string, view?: ProjectActivitiesView): string {
  const path = ROUTES.PROJECT_ACTIVITIES.replace(':projectId', projectId);
  if (view === 'board') return `${path}?vista=tablero`;
  if (view === 'list') return `${path}?vista=lista`;
  return path;
}

/** `ROUTES.PROJECT_MATERIALS` con el `:projectId` resuelto, para armar links. */
export function projectMaterialsPath(projectId: string): string {
  return ROUTES.PROJECT_MATERIALS.replace(':projectId', projectId);
}

/**
 * Un material puntual dentro de Compras: abre la pestaña donde está y lo
 * resalta. No hay una pantalla de detalle aparte; la fila ya muestra todo y
 * tiene las acciones.
 */
export function projectMaterialPath(projectId: string, materialId: string): string {
  return `${projectMaterialsPath(projectId)}?material=${encodeURIComponent(materialId)}`;
}

/**
 * `ROUTES.PROJECT_LABOR` con el `:projectId` resuelto, para armar links. Es
 * Personal: la Jornada del día. Las tareas viven en Actividades
 * (`projectActivitiesPath`).
 */
export function projectLaborPath(projectId: string): string {
  return ROUTES.PROJECT_LABOR.replace(':projectId', projectId);
}

/** `ROUTES.PROJECT_PAYMENTS` con el `:projectId` resuelto, para armar links. */
export function projectPaymentsPath(projectId: string): string {
  return ROUTES.PROJECT_PAYMENTS.replace(':projectId', projectId);
}

/** `ROUTES.PROJECT_EXPENSES` con el `:projectId` resuelto, para armar links. */
export function projectExpensesPath(projectId: string): string {
  return ROUTES.PROJECT_EXPENSES.replace(':projectId', projectId);
}

/** `ROUTES.PROJECT_TEAM` con el `:projectId` resuelto, para armar links. */
export function projectTeamPath(projectId: string): string {
  return ROUTES.PROJECT_TEAM.replace(':projectId', projectId);
}

/** `ROUTES.PROJECT_MILESTONES` con el `:projectId` resuelto, para armar links. */
export function projectMilestonesPath(projectId: string): string {
  return ROUTES.PROJECT_MILESTONES.replace(':projectId', projectId);
}

/** `ROUTES.PROJECT_MILESTONE_NEW` con el `:projectId` resuelto, para armar links. */
export function projectMilestoneNewPath(projectId: string): string {
  return ROUTES.PROJECT_MILESTONE_NEW.replace(':projectId', projectId);
}

/** `ROUTES.PROJECT_MILESTONE_EDIT` con los dos ids resueltos, para armar links. */
export function projectMilestoneEditPath(projectId: string, milestoneId: string): string {
  return ROUTES.PROJECT_MILESTONE_EDIT.replace(':projectId', projectId).replace(
    ':milestoneId',
    milestoneId,
  );
}

/** `ROUTES.PROJECT_DOCUMENTS` con el `:projectId` resuelto, para armar links. */
export function projectDocumentsPath(projectId: string): string {
  return ROUTES.PROJECT_DOCUMENTS.replace(':projectId', projectId);
}

/** `ROUTES.PROJECT_PROVIDERS` con el `:projectId` resuelto, para armar links. */
export function projectProvidersPath(projectId: string): string {
  return ROUTES.PROJECT_PROVIDERS.replace(':projectId', projectId);
}

/** `ROUTES.PROJECT_BUDGET` con el `:projectId` resuelto, para armar links. */
export function projectBudgetPath(projectId: string): string {
  return ROUTES.PROJECT_BUDGET.replace(':projectId', projectId);
}

/** `ROUTES.PROJECT_ADVISOR` con el `:projectId` resuelto, para armar links. */
export function projectAdvisorPath(projectId: string): string {
  return ROUTES.PROJECT_ADVISOR.replace(':projectId', projectId);
}
