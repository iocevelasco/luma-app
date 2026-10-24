import type { AccountStatus, UserRole } from './index.js';

/**
 * Lo que ve el admin de la plataforma sobre las cuentas de Luma. Sólo lectura.
 * Las cuentas de prueba (`@luma.test`) no entran en ninguna cifra.
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

export interface PlatformUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  accountStatus: AccountStatus;
  createdAt: string;
}

export interface PlatformUsersPage {
  users: PlatformUserRow[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}
