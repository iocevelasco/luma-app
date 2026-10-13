import type { ProviderSpecialty } from './provider.js';

/**
 * Personal fijo de obra y sus metas semanales.
 *
 * Distinto de `LaborRecord` (RF-03), que es la asistencia del día: presente o
 * ausente, hoy. Esto es lo que alguien tiene que LOGRAR esta semana, cargado
 * una o dos semanas antes. Las dos cosas conviven sin pisarse.
 *
 * Distinto también de `Provider`: el proveedor entra, termina una tarea y se
 * va; el personal fijo está toda la ejecución haciendo actividades varias.
 */

/**
 * Una meta puede ser de una persona o de un equipo entero ("los tres de
 * albañilería"). Es el mismo objeto con distinto alcance: separar Equipo en
 * su propia entidad duplicaría el roster para no ganar nada.
 */
export type CrewMemberKind = 'persona' | 'equipo';

export interface CrewMember {
  id: string;
  organizationId: string;
  /** `project` cuando es gente contratada sólo para esta obra. */
  scope: 'organization' | 'project';
  projectId?: string;
  name: string;
  kind: CrewMemberKind;
  /** Mismo catálogo que los proveedores: es el mismo rubro de obra. */
  specialty?: ProviderSpecialty;
  /**
   * Encargado de su especialidad — el que "reporta como un ingeniero" en una
   * obra grande. Es un flag y no un rol del sistema: no cambia permisos, sólo
   * dice a quién preguntarle por ese rubro.
   */
  isLead: boolean;
  phone?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * Jornal diario, en la moneda de la Empresa. Sólo lo ve quien puede ver
   * plata: la API lo omite para el resto, igual que `estimatedCost` en
   * materiales.
   */
  dailyRate?: number;
}

/**
 * Valores en inglés, textos en castellano: el código nombra, la traducción
 * habla (`crew.goalStatus.*`).
 *
 * - `pending`: abierta. Es la única que se arrastra a la semana siguiente.
 * - `done`: hecha.
 * - `discarded`: cerrada sin hacer. Con el arrastre es la única salida para
 *   algo que no se va a hacer: sin ella, una meta abandonada rodaría para
 *   siempre. Reemplaza a `no_cumplida`.
 *
 * Los valores viejos (`pendiente`, `cumplida`, `no_cumplida`) los traduce la
 * API al leer hasta que corra `migrate:crew` — ver `LEGACY_CREW_GOAL_STATUS`.
 */
export type CrewGoalStatus = 'pending' | 'done' | 'discarded';

export interface CrewGoal {
  id: string;
  projectId: string;
  crewMemberId: string;
  /** Lunes de la semana, `YYYY-MM-DD`. Es la unidad de planificación (RF-01). */
  weekStart: string;
  description: string;
  /** Opcional: la meta puede no mapear a una actividad puntual del cronograma. */
  activityId?: string;
  status: CrewGoalStatus;
  /**
   * Cuándo pasó a `done`. Es un hecho con fecha, no un derivado: es lo único
   * que dice si una meta se cerró en su semana o tres después. Las cerradas
   * antes de que existiera el campo no lo tienen.
   */
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** La meta con el nombre de quien la tiene ya resuelto, para no pedir el roster aparte. */
export interface CrewGoalWithMember extends CrewGoal {
  crewMemberName: string;
  crewMemberKind: CrewMemberKind;
}

export interface CrewMemberListResponse {
  crewMembers: CrewMember[];
}

/** Empleado de la Empresa con las obras donde ya está asignado. */
export interface OrganizationCrewMember extends CrewMember {
  projectIds: string[];
}

export interface OrganizationCrewListResponse {
  crewMembers: OrganizationCrewMember[];
}

export interface OrganizationCrewResponse {
  crewMember: OrganizationCrewMember;
}

export interface CrewMemberResponse {
  crewMember: CrewMember;
}

export interface CrewGoalListResponse {
  goals: CrewGoalWithMember[];
}

export interface CrewGoalResponse {
  goal: CrewGoal;
}

/**
 * Lo que devuelve la búsqueda en la libreta de la Empresa desde una obra.
 *
 * Acotado a propósito: la usa también el supervisor, que es por obra y puede
 * ser externo. Con esto alcanza para reconocer a alguien y sumarlo; teléfono,
 * notas, jornal y en qué otras obras está se ven desde Empleados.
 */
export interface CrewDirectoryEntry {
  id: string;
  name: string;
  kind: CrewMemberKind;
  specialty?: ProviderSpecialty;
  isLead: boolean;
}

export interface CrewDirectoryListResponse {
  crewMembers: CrewDirectoryEntry[];
}

/**
 * `details` del 409 cuando un alta choca con alguien que ya está en la
 * Empresa. El frontend ramifica por `reason`, nunca por el texto.
 *
 * - `phone`: mismo teléfono y mismo tipo. Es la misma persona, sin excepción.
 * - `name`: mismo nombre. Puede ser un homónimo: se puede insistir con
 *   `allowDuplicateName`.
 */
export interface CrewDuplicateDetails {
  reason: 'phone' | 'name';
  existing: CrewDirectoryEntry & { active: boolean };
  /** Ya está en la obra desde la que se intentó el alta: no hay nada que sumar. */
  alreadyInProject: boolean;
}
