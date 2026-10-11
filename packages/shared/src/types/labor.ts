/**
 * Mano de obra de una obra (RF-03): quién se espera y quién vino, por
 * actividad y día.
 *
 * Lo esperado es una asignación persistente de personas (`ActivityCrew`), no
 * un número: si el sistema sólo sabe "se esperaban 8", puede decir que falta
 * uno pero nunca cuál, y entonces tampoco a quién llamar.
 */

/** Persona asignada a una actividad, con lo necesario para ubicarla hoy. */
export interface ActivityCrewMember {
  crewMemberId: string;
  name: string;
  specialty?: string;
  /** Para llamar al que no vino. Oculto al cliente invitado. */
  phone?: string;
  isLead: boolean;
}

export interface LaborRecord {
  id: string;
  projectId: string;
  activityId: string;
  /** `YYYY-MM-DD`, nunca ISO datetime — ver CLAUDE.md. */
  date: string;
  /** Ids del roster que estuvieron hoy. Vacío para el cliente invitado. */
  presentCrewMemberIds: string[];
  /**
   * Partes viejos, de cuando esto era un número y nombres tipeados a mano.
   * Sólo lectura: no hay forma honesta de adivinar a qué persona del roster
   * correspondía cada texto.
   */
  expectedCount: number;
  /**
   * Vacío cuando lo pide el cliente invitado: la regla de negocio dice que
   * no ve "la asignación individual de personal". `presentCount` es la
   * cuenta real siempre, sea cual sea el rol de quien mira — así el
   * dashboard no reporta 0 presentes sólo porque el viewer es el cliente.
   */
  presentNames: string[];
  presentCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * La asistencia de una actividad en un día, con todo resuelto para la
 * pantalla: quiénes se esperan, quiénes vinieron, y de ahí salen ausentes
 * (esperados − presentes) y reemplazos (presentes − esperados).
 */
export interface ActivityAttendance {
  activityId: string;
  expected: ActivityCrewMember[];
  presentCrewMemberIds: string[];
  /** Sólo en partes viejos: nombres tipeados que nadie puede vincular. */
  legacyPresentNames: string[];
  legacyExpectedCount: number;
}

export interface ActivityCrewResponse {
  crew: ActivityCrewMember[];
}

export interface LaborRecordListResponse {
  laborRecords: LaborRecord[];
}

export interface LaborRecordResponse {
  laborRecord: LaborRecord;
}
