/**
 * Planificación semanal de una obra (RF-01). Cuelga de `Project`; no hay
 * entidad `Week` — el rango de semana lo calcula el frontend y se pide al
 * backend como querystring `from`/`to`.
 */

export type ActivityStatus = 'pendiente' | 'en_curso' | 'completada' | 'cancelada';

export interface ActivityResponsible {
  name: string;
  user?: string;
}

/**
 * Evidencia fotográfica de avance (RF-04), opcional, asociada a la
 * actividad — no a un cambio de estado puntual, para no obligar a elegir
 * "en qué momento" quedó la foto. `url` es una URL firmada de lectura de
 * vida corta: se recalcula en cada respuesta, nunca se guarda como tal.
 */
export interface ActivityEvidencePhoto {
  id: string;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Activity {
  id: string;
  projectId: string;
  name: string;
  area: string;
  /** `YYYY-MM-DD`, nunca ISO datetime — ver CLAUDE.md. */
  startDate: string;
  endDate: string;
  responsible: ActivityResponsible;
  status: ActivityStatus;
  notes?: string;
  evidence: ActivityEvidencePhoto[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityListResponse {
  activities: Activity[];
}

export interface ActivityResponse {
  activity: Activity;
}
