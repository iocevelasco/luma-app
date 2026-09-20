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
  presentNames: string[];
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
