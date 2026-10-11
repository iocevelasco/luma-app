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
}

/**
 * `pendiente` no es lo mismo que `no_cumplida`: un booleano confunde "todavía
 * no" con "no se logró", y justamente el incumplimiento es el dato que le
 * dice al ejecutante que está planificando de más.
 */
export type CrewGoalStatus = 'pendiente' | 'cumplida' | 'no_cumplida';

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

export interface CrewMemberResponse {
  crewMember: CrewMember;
}

export interface CrewGoalListResponse {
  goals: CrewGoalWithMember[];
}

export interface CrewGoalResponse {
  goal: CrewGoal;
}
