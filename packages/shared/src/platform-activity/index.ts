import type { ProjectRole } from '../permissions/index.js';

/**
 * Actividad por rol de obra, para el admin de la plataforma (capa A: conteos
 * derivados de datos que ya existen, sin eventos ni tracking). Puro y con
 * tests: la API arma los números, esto decide qué se puede mostrar.
 *
 * La regla de privacidad vive acá y no en la UI: una celda con pocas personas
 * deja de ser una estadística y pasa a ser "lo que hizo fulano". Por eso la
 * API la aplica antes de responder.
 */

/** Debajo de esto, un rol/período sale del servidor sin cifras. */
export const MIN_PEOPLE_PER_CELL = 5;

export const ACTIVITY_PERIODS = ['7d', '30d', 'all'] as const;
export type ActivityPeriod = (typeof ACTIVITY_PERIODS)[number];

/**
 * Quién hizo la acción *en la obra donde la hizo*. `exMiembro` es quien ya no
 * tiene ni obra propia ni membresía en ella (lo sacaron o la obra cambió de
 * manos).
 */
export const ACTIVITY_ROLE_GROUPS = [
  'gerente',
  'supervisor',
  'contador',
  'cliente',
  'exMiembro',
] as const;
export type ActivityRoleGroup = (typeof ACTIVITY_ROLE_GROUPS)[number];

/** Acciones que se cuentan, con el rol que las tiene como propias. */
export const PLATFORM_ACTION_OWNER = {
  projectCreated: 'gerente',
  activityCreated: 'gerente',
  activityApproved: 'gerente',
  activityRejected: 'gerente',
  memberInvited: 'gerente',
  budgetImported: 'gerente',
  milestonePublished: 'gerente',
  documentUploaded: 'gerente',
  engagementCreated: 'gerente',
  progressReported: 'supervisor',
  evidenceUploaded: 'supervisor',
  laborLogged: 'supervisor',
  materialRequested: 'supervisor',
  expenseRegistered: 'contador',
  paymentRegistered: 'contador',
} as const satisfies Record<string, ProjectRole>;

export type PlatformAction = keyof typeof PLATFORM_ACTION_OWNER;

export const PLATFORM_ACTIONS = Object.keys(PLATFORM_ACTION_OWNER) as PlatformAction[];

/** Las acciones propias de un rol, en el orden en que se muestran. */
export function actionsOwnedBy(role: ActivityRoleGroup): PlatformAction[] {
  return PLATFORM_ACTIONS.filter((action) => PLATFORM_ACTION_OWNER[action] === role);
}

/** Conteos de un rol en un período. Con `suppressed`, todo va en `null`. */
export interface ActivityCell {
  suppressed: boolean;
  /** Personas distintas que hicieron al menos una acción. */
  people: number | null;
  /** Cantidad por acción. Sólo cantidades: nunca montos. */
  actions: Record<PlatformAction, number> | null;
}

export interface PlatformActivityRole {
  role: ActivityRoleGroup;
  /** El cliente no tiene acciones en esta capa: no hay cifras ni períodos. */
  readOnly: boolean;
  periods: Record<ActivityPeriod, ActivityCell> | null;
}

export interface PlatformActivityReport {
  /** El umbral aplicado, para que la UI lo explique sin duplicar la constante. */
  minPeople: number;
  roles: PlatformActivityRole[];
}

/** ¿Hay que esconder la celda? Estrictamente menos de `MIN_PEOPLE_PER_CELL`, incluido 0. */
export function isCellSuppressed(people: number, min: number = MIN_PEOPLE_PER_CELL): boolean {
  return people < min;
}

export function emptyActionCounts(): Record<PlatformAction, number> {
  return Object.fromEntries(PLATFORM_ACTIONS.map((action) => [action, 0])) as Record<
    PlatformAction,
    number
  >;
}

/**
 * Convierte los conteos crudos en la celda que sale a la red: si hay pocas
 * personas, ni siquiera viaja el total.
 */
export function toCell(
  people: number,
  actions: Record<PlatformAction, number>,
  min: number = MIN_PEOPLE_PER_CELL,
): ActivityCell {
  if (isCellSuppressed(people, min)) return { suppressed: true, people: null, actions: null };
  return { suppressed: false, people, actions };
}
