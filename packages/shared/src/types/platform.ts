import type {
  AccountSegment,
  MembershipBucket,
  StaffRoleCount,
} from '../platform-accounts/index.js';
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
