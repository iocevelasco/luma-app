/**
 * Mano de obra de una obra (RF-03): personal esperado vs. presente, por
 * actividad y día. No hay una entidad "Personal" separada — los nombres son
 * texto libre, igual que `Activity.responsible.name`.
 */

export interface LaborRecord {
  id: string;
  projectId: string;
  activityId: string;
  /** `YYYY-MM-DD`, nunca ISO datetime — ver CLAUDE.md. */
  date: string;
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

export interface LaborRecordListResponse {
  laborRecords: LaborRecord[];
}

export interface LaborRecordResponse {
  laborRecord: LaborRecord;
}
