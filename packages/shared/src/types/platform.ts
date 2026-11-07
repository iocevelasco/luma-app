import type { ProjectRole } from '../permissions/index.js';
import type {
  AccountHealthKey,
  AccountSegment,
  AccountStage,
  MembershipBucket,
  StaffRoleCount,
} from '../platform-accounts/index.js';
import type { SubscriptionStatus } from './subscription.js';
import type { AccountStatus, UserRole } from './index.js';

/**
 * Lo que ve el admin de la plataforma sobre las cuentas de Luma. Las cuentas
 * de prueba (`@luma.test`) no entran en ninguna cifra. El único cambio que
 * puede hacer desde acá es asignar o quitar el plan ilimitado.
 */

/** Totales de cuentas. `verified` y `unverified` cuentan sólo cuentas activas. */
export interface PlatformUsersStats {
  total: number;
  active: number;
  inactive: number;
  /** Activas con el mail confirmado. */
  verified: number;
  /** Activas que todavía no confirmaron el mail. */
  unverified: number;
}

/** Cuántas cuentas se crearon en una semana (lunes a domingo, UTC). */
export interface PlatformSignupWeek {
  /** Lunes de esa semana, `YYYY-MM-DD`. */
  weekStart: string;
  count: number;
}

export interface PlatformUsersOverview {
  stats: PlatformUsersStats;
  /** Las últimas 12 semanas, de la más vieja a la actual. Las vacías vienen con 0. */
  signups: PlatformSignupWeek[];
}

/** Cuentas reales por segmento. Una persona cuenta en uno solo. */
export type PlatformCensusSegments = Record<AccountSegment, number>;

/** Altas de una semana, separadas entre quienes tienen membresía y el resto. */
export interface PlatformCensusWeek {
  /** Lunes de esa semana, `YYYY-MM-DD`. */
  weekStart: string;
  members: number;
  others: number;
}

/**
 * El censo de cuentas, por segmento. `total` es la suma de `segments`: las
 * cuentas de prueba no están y se cuentan aparte.
 */
export interface PlatformCensus {
  total: number;
  segments: PlatformCensusSegments;
  /** Cuentas `@luma.test`, fuera de todo lo demás. */
  testAccounts: number;
  /** Estado de la membresía de las cuentas que tienen una. */
  memberships: Record<MembershipBucket, number>;
  /** Empleados por rol, con los roles chicos fundidos en `other`. */
  staffRoles: StaffRoleCount[];
  /** Las últimas 12 semanas, de la más vieja a la actual. */
  signups: PlatformCensusWeek[];
}

/** Cuántas cuentas con membresía llegaron a una etapa del embudo. */
export interface PlatformFunnelStage {
  stage: AccountStage;
  count: number;
}

/** Una semana de altas: cuántas cuentas entraron y cuántas llegaron a cada etapa. */
export interface PlatformFunnelCohort {
  /** Lunes de esa semana, `YYYY-MM-DD`. */
  weekStart: string;
  size: number;
  /** Una cifra por etapa, en el orden de `ACCOUNT_STAGES`. */
  reached: number[];
}

/** El embudo de activación de las cuentas con membresía. */
export interface PlatformFunnel {
  stages: PlatformFunnelStage[];
  /** Las últimas 6 semanas, de la más vieja a la actual. */
  cohorts: PlatformFunnelCohort[];
  /** Cuentas con alguna acción en los últimos 7 días. */
  active7d: number;
}

/**
 * Una cuenta con membresía en la lista de seguimiento. Solo cantidades: ni
 * nombres de clientes, ni descripciones, ni montos.
 */
export interface PlatformFollowUpRow {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  membership: SubscriptionStatus;
  /** Solo en prueba. */
  trialDaysLeft: number | null;
  stage: AccountStage;
  projects: number;
  invited: number;
  invitedByRole: Partial<Record<ProjectRole, number>>;
  activities: number;
  /** `null` si nunca hizo una acción registrada. */
  lastActionAt: string | null;
  health: AccountHealthKey;
  /** Va en "necesitan atención". */
  risk: boolean;
}

export type PlatformFollowUpFilter = 'all' | 'risk' | 'trial' | 'paying' | 'expired';

export interface PlatformFollowUpPage {
  rows: PlatformFollowUpRow[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  /** Cuántas cuentas tiene cada filtro, con la búsqueda ya aplicada. */
  counts: Record<PlatformFollowUpFilter, number>;
}

export interface PlatformUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  segment: AccountSegment;
  emailVerified: boolean;
  accountStatus: AccountStatus;
  createdAt: string;
  /** La empresa que esta cuenta es dueña tiene el plan ilimitado. */
  unlimited: boolean;
}

export interface PlatformUsersPage {
  users: PlatformUserRow[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}
