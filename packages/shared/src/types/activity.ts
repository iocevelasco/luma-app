import type { ProviderSpecialty } from './provider.js';

/**
 * Planificación semanal de una obra (RF-01). Cuelga de `Project`; no hay
 * entidad `Week` — el rango de semana lo calcula el frontend y se pide al
 * backend como querystring `from`/`to`.
 */

/**
 * `en_revision` es el paso que faltaba: quien hizo el trabajo lo reporta
 * terminado, pero no lo cierra. Cerrar a `completada` es exclusivo del dueño
 * de la obra — nadie marca terminado su propio trabajo.
 */
export type ActivityStatus =
  | 'pendiente'
  | 'en_curso'
  | 'en_revision'
  | 'completada'
  | 'cancelada';

/**
 * Quién reportó el trabajo como terminado y qué resolvió el supervisor.
 * Guarda sólo el ciclo vigente, no un historial: al re-reportar se pisa.
 *
 * `rejectionReason` sobrevive al rechazo a propósito — queda visible mientras
 * la actividad vuelve a `en_curso`, que es cuando alguien tiene que leerlo y
 * corregir. Un rechazo sin motivo visible deja a la actividad en un limbo
 * donde nadie sabe si está trabada o si el supervisor todavía no la miró.
 */
export interface ActivityReview {
  reportedBy: string;
  reportedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

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
  /**
   * Rubro de obra, opcional. Mismo catálogo que proveedores y personal: sirve
   * para agrupar el trabajo (y sus fotos) por especialidad sin obligar a
   * clasificar actividades que tocan varios rubros a la vez.
   */
  specialty?: ProviderSpecialty;
  notes?: string;
  review?: ActivityReview;
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
