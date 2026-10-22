import type { TradeSpecialty } from './provider.js';

/**
 * Personal fijo de obra.
 *
 * Lo que cada uno tiene que hacer ya no vive acá: es una tarea (`Activity`)
 * con la persona como responsable y en su cuadrilla. Las "metas semanales"
 * que había se migraron a tareas — ver `migrate-crew.ts`.
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
  specialty?: TradeSpecialty;
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


/**
 * Con quién chocó un alta: lo justo para nombrarlo en el banner y ofrecer
 * sumarlo. La ficha completa sale del roster una vez que está en la obra.
 */
export interface CrewMemberSummary {
  id: string;
  name: string;
  kind: CrewMemberKind;
  specialty?: TradeSpecialty;
  isLead: boolean;
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
  existing: CrewMemberSummary & { active: boolean };
  /** Ya está en la obra desde la que se intentó el alta: no hay nada que sumar. */
  alreadyInProject: boolean;
}
