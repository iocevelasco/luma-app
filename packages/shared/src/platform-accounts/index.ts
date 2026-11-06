import type { ProjectRole } from '../permissions/index.js';
import { MIN_PEOPLE_PER_CELL } from '../platform-activity/index.js';
import type { SubscriptionStatus } from '../types/subscription.js';

/**
 * Qué cuentas importan para el admin de la plataforma. Puro y con tests: la API
 * lee hechos de la base y le pregunta a esto; la UI muestra lo que la API
 * resolvió.
 *
 * Solo importan las cuentas con **membresía**: la `Subscription` de la Empresa
 * que la persona posee. Un invitado no la tiene (queda `sin_iniciar`); cuando
 * crea su primera obra se le arranca la prueba y pasa a tener una. Lo demás
 * —clientes que miran el estado de su obra, empleados de una obra ajena— se
 * cuenta aparte y no se sigue.
 */

/**
 * Los segmentos en los que cae una cuenta real. Una persona cuenta una sola
 * vez, y el orden de esta lista es la precedencia (salvo las cuentas de
 * prueba, que quedan fuera de todo y ni siquiera son un segmento).
 */
export const ACCOUNT_SEGMENTS = ['inactive', 'membership', 'staff', 'client', 'noProject'] as const;
export type AccountSegment = (typeof ACCOUNT_SEGMENTS)[number];

/** Hechos de una cuenta, los que decide el segmento. */
export interface AccountFacts {
  /** Mail `@luma.test`: cuenta de E2E o de seed. */
  isTest: boolean;
  /** `account_status === 'active'`. */
  active: boolean;
  /** Estado de la suscripción de la Empresa que posee. `null` si no tiene ninguna. */
  subscriptionStatus: SubscriptionStatus | null;
  /** Roles que tiene en obras de otros (`ProjectMembership`), uno por obra. */
  projectRoles: readonly ProjectRole[];
}

/** `test` no es un segmento: son las cuentas que no cuentan en ninguna cifra. */
export type AccountClassification = AccountSegment | 'test';

/**
 * Precedencia: prueba > baja > membresía > empleado > cliente > sin obra.
 * Una persona con membresía propia que además es supervisora en otra obra
 * cuenta solo como "con membresía".
 */
export function classifyAccount(facts: AccountFacts): AccountClassification {
  if (facts.isTest) return 'test';
  if (!facts.active) return 'inactive';
  if (facts.subscriptionStatus !== null && facts.subscriptionStatus !== 'sin_iniciar') {
    return 'membership';
  }
  if (facts.projectRoles.some((role) => role !== 'cliente')) return 'staff';
  if (facts.projectRoles.length > 0) return 'client';
  return 'noProject';
}

/**
 * Cómo se agrupa el estado de la membresía en el censo. `sin_iniciar` no es
 * una membresía y devuelve `null`.
 */
export const MEMBERSHIP_BUCKETS = ['trial', 'paying', 'unlimited', 'expired'] as const;
export type MembershipBucket = (typeof MEMBERSHIP_BUCKETS)[number];

export function membershipBucket(status: SubscriptionStatus): MembershipBucket | null {
  switch (status) {
    case 'prueba':
      return 'trial';
    case 'activa':
    case 'en_revision':
    case 'pago_fallido':
      return 'paying';
    case 'ilimitado':
      return 'unlimited';
    case 'vencida':
      return 'expired';
    case 'sin_iniciar':
      return null;
  }
}

/** Los roles de un empleado, del que más manda al que menos. */
export const STAFF_ROLES = [
  'gerente',
  'supervisor',
  'arquitecto',
  'ingeniero',
  'disenador',
  'contador',
] as const satisfies readonly ProjectRole[];
export type StaffRole = (typeof STAFF_ROLES)[number];

/**
 * El rol con el que una persona cuenta en el censo cuando tiene varios: el
 * primero de `STAFF_ROLES`. `null` si solo es cliente o no tiene obra.
 */
export function primaryStaffRole(roles: readonly ProjectRole[]): StaffRole | null {
  return STAFF_ROLES.find((role) => roles.includes(role)) ?? null;
}

/** Una fila del desglose de empleados. `other` junta los roles que quedaron chicos. */
export interface StaffRoleCount {
  role: StaffRole | 'other';
  people: number;
}

/**
 * Arma el desglose de empleados por rol sin dejar ver una celda chica: un rol
 * con menos de `MIN_PEOPLE_PER_CELL` personas se funde en `other`, y si `other`
 * tampoco llega al mínimo se omite. Es la misma regla de confidencialidad que
 * Actividad, pero fundiendo en vez de esconder: el total del segmento se
 * publica, y con un rol en `null` bastaría restar para recuperarlo.
 */
export function foldSmallRoles(
  counts: Partial<Record<StaffRole, number>>,
  min: number = MIN_PEOPLE_PER_CELL,
): StaffRoleCount[] {
  const rows: StaffRoleCount[] = [];
  let other = 0;
  for (const role of STAFF_ROLES) {
    const people = counts[role] ?? 0;
    if (people >= min) rows.push({ role, people });
    else other += people;
  }
  if (other >= min) rows.push({ role: 'other', people: other });
  return rows;
}
