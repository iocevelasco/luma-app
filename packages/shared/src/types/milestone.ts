/**
 * Hitos y eventualidades de la obra.
 *
 * La matriz de roles tiene dos flujos con la misma forma y distinto público:
 *
 * - El **gerente** "reporta hitos y cambios fundamentales del proyecto" y el
 *   cliente "recibe notificación de hito en obra".
 * - El **supervisor** "notifica eventualidades solamente al gerente".
 *
 * Los dos son "pasó algo, esto es, avisale a alguien". Por eso es una sola
 * entidad con un campo de audiencia y no dos modelos gemelos: con dos, el día
 * que haya que agregar "adjuntar una foto al hito" hay que agregarlo dos veces.
 */

/** Los cinco tipos que enumera la matriz, más el cambio de proyecto del gerente. */
export type MilestoneType =
  /** Concluir una etapa fundamental. */
  | 'etapa_concluida'
  /** Recibir una compra significativa. */
  | 'compra_significativa'
  /** Se genera un problema de permisología. */
  | 'permisologia'
  /** Se encuentra un vicio oculto. */
  | 'vicio_oculto'
  /** Retraso por alguna razón de peso mayor. */
  | 'retraso'
  /** Cambio fundamental del proyecto. */
  | 'cambio_proyecto'
  | 'otro';

export const MILESTONE_TYPES: readonly MilestoneType[] = [
  'etapa_concluida',
  'compra_significativa',
  'permisologia',
  'vicio_oculto',
  'retraso',
  'cambio_proyecto',
  'otro',
] as const;

/**
 * Quién se entera.
 *
 * - `cliente`: lo ve todo el mundo, cliente incluido. Es el "hito en obra" de
 *   la matriz.
 * - `interno`: sólo gerente y supervisor. Es la "eventualidad" que el
 *   supervisor le notifica **solamente al gerente** — y la regla 4 del
 *   documento funcional (nada de información operativa interna para el
 *   cliente) es el default, no la excepción.
 *
 * El supervisor sólo puede crear `interno`. Que el cliente se entere de algo
 * es una decisión del gerente, siempre.
 */
export type MilestoneAudience = 'cliente' | 'interno';

export const MILESTONE_AUDIENCES: readonly MilestoneAudience[] = ['cliente', 'interno'] as const;

/**
 * Qué tan grave es. No cambia permisos ni dispara nada distinto: ordena la
 * lista y pinta el badge. Un vicio oculto y una etapa concluida son los dos
 * hitos, pero no se leen con la misma cara.
 */
export type MilestoneSeverity = 'info' | 'atencion' | 'critico';

export const MILESTONE_SEVERITIES: readonly MilestoneSeverity[] = [
  'info',
  'atencion',
  'critico',
] as const;

export interface Milestone {
  id: string;
  projectId: string;
  type: MilestoneType;
  audience: MilestoneAudience;
  severity: MilestoneSeverity;
  title: string;
  description?: string;
  /** `YYYY-MM-DD` — ver CLAUDE.md sobre fechas y Safari. */
  occurredOn: string;
  /** Actividad relacionada, si el hito salió de una. */
  activityId?: string;
  activityName?: string;
  reportedBy: string;
  reportedByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface MilestoneListResponse {
  milestones: Milestone[];
}

export interface MilestoneResponse {
  milestone: Milestone;
}

export interface DeleteMilestoneResponse {
  milestoneId: string;
}
