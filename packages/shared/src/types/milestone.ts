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

/**
 * Los cinco tipos que enumera la matriz, el cambio de proyecto del gerente y
 * la reunión — ver `'reunion'`.
 */
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
  /**
   * Reunión de obra con su minuta. No viene de la matriz: es "pasó algo,
   * esto es, avisale a alguien" igual que el resto, con la descripción como
   * minuta y una lista de asistentes. Es el único tipo con un campo propio.
   */
  | 'reunion'
  | 'otro';

export const MILESTONE_TYPES: readonly MilestoneType[] = [
  'etapa_concluida',
  'compra_significativa',
  'permisologia',
  'vicio_oculto',
  'retraso',
  'cambio_proyecto',
  'reunion',
  'otro',
] as const;

/**
 * Lo que admite la descripción. Es Markdown: una minuta de una hora no entra
 * en los 2000 caracteres que alcanzaban para un aviso.
 */
export const MILESTONE_DESCRIPTION_MAX = 20_000;

/** Tope de asistentes de una reunión y de largo de cada nombre. */
export const MILESTONE_ATTENDEES_MAX = 30;
export const MILESTONE_ATTENDEE_NAME_MAX = 80;

/**
 * Adjuntos por hito. Los formatos y el peso son los de la documentación de
 * obra (`DOCUMENT_MIME_TYPES`, `DOCUMENT_MAX_BYTES`): una foto del vicio
 * oculto o el acta escaneada de una reunión son el mismo tipo de archivo que
 * un plano, y dos listas distintas se desincronizan.
 */
export const MILESTONE_ATTACHMENTS_MAX = 10;

/**
 * Un archivo que respalda al hito: la foto del problema, el acta, el
 * presupuesto revisado. Vale para todos los tipos, no sólo reuniones.
 *
 * `url` es firmada y se genera en cada respuesta; vence. La ruta interna en el
 * bucket nunca sale de la API.
 */
export interface MilestoneAttachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  /** `null` si el storage no está configurado o el archivo ya no existe. */
  url: string | null;
  createdAt: string;
}

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
  /** Markdown. El texto plano de antes es Markdown válido: no hubo migración. */
  description?: string;
  /**
   * Sólo en `reunion`, y por nombre: en una reunión hay gente sin cuenta (el
   * arquitecto, el inspector). Mismo criterio que el responsable de una tarea.
   */
  attendees?: string[];
  /** Siempre presente, vacío si no tiene. */
  attachments: MilestoneAttachment[];
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
