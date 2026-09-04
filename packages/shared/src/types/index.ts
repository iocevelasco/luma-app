// ============================================================================
// Luma — tipos compartidos entre API y web
//
// El modelo sigue el §6 del Documento Funcional: Proyecto es el contenedor y
// TODO lo demás cuelga de él. `project_id` juega acá el mismo papel que
// `dojo_id` en Pantera Negra: es el filtro de tenant implícito de cada query.
// ============================================================================

// ─── Roles y permisos ────────────────────────────────────────────────────────

/** Rol global de la cuenta. El rol que importa es el del proyecto. */
export type UserRole = 'user' | 'superadmin';

/**
 * Rol dentro de un proyecto (§2 del documento).
 *
 * - `executor`  — el ejecutante: dueño del proyecto, ve y decide todo.
 * - `manager`   — arquitecto o ingeniero encargado. Aprueba imprevistos antes
 *                 de que lleguen al cliente. Mismos permisos que executor salvo
 *                 la gestión de usuarios.
 * - `assistant` — asistente de obra. Es el generador de datos: carga avance,
 *                 faltantes y asistencia. No aprueba nada.
 * - `client`    — el financiador. Vista simplificada; aprueba o rechaza
 *                 sobrecostos. Nunca ve el detalle operativo interno.
 */
export type ProjectRole = 'executor' | 'manager' | 'assistant' | 'client';

export const PROJECT_ROLES: ProjectRole[] = ['executor', 'manager', 'assistant', 'client'];

/**
 * Matriz de permisos del §2.5, como dato y no como `if` desperdigados.
 *
 * El backend la usa en `requirePermission()` y el frontend en `can()`, así que
 * una pantalla nunca puede ofrecer una acción que la API va a rechazar.
 */
export type Permission =
  | 'dashboard.view.full'
  | 'dashboard.view.client'
  | 'planning.manage'
  | 'planning.update_status'
  | 'materials.manage'
  | 'personnel.manage'
  | 'budget.view.full'
  | 'budget.view.summary'
  | 'budget.import'
  | 'contingency.create'
  | 'contingency.approve_internal'
  | 'contingency.decide_client'
  | 'assistant.use'
  | 'members.manage';

export const ROLE_PERMISSIONS: Record<ProjectRole, Permission[]> = {
  executor: [
    'dashboard.view.full',
    'planning.manage',
    'planning.update_status',
    'materials.manage',
    'personnel.manage',
    'budget.view.full',
    'budget.import',
    'contingency.create',
    'contingency.approve_internal',
    'assistant.use',
    'members.manage',
  ],
  manager: [
    'dashboard.view.full',
    'planning.manage',
    'planning.update_status',
    'materials.manage',
    'personnel.manage',
    'budget.view.full',
    'budget.import',
    'contingency.create',
    'contingency.approve_internal',
    'assistant.use',
  ],
  assistant: [
    'dashboard.view.full',
    'planning.update_status',
    'materials.manage',
    'personnel.manage',
    'budget.view.summary',
    'contingency.create',
    'assistant.use',
  ],
  // El cliente NO tiene 'assistant.use': §RF-06 lo deja para una fase posterior.
  client: ['dashboard.view.client', 'budget.view.summary', 'contingency.decide_client'],
};

export function hasPermission(role: ProjectRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

// ─── Base ────────────────────────────────────────────────────────────────────

export interface Timestamped {
  created_at?: string;
  updated_at?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  details?: unknown;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// ─── Usuario ─────────────────────────────────────────────────────────────────

export interface User extends Timestamped {
  id: string;
  email: string;
  email_verified: boolean;
  name?: string;
  phone?: string;
  picture?: string;
  role: UserRole;
  enabled: boolean;
  last_project_id?: string | null;
}

export interface JWTPayload {
  sub: string;
  email: string;
  /** Proyecto activo de la sesión. Es el scope de tenant de cada request. */
  project_id?: string;
  /** Rol DENTRO de `project_id`. Ausente si la sesión no tiene proyecto activo. */
  project_role?: ProjectRole;
  roles: UserRole[];
  type?: 'refresh';
  iat?: number;
  exp?: number;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginCredentials {
  email: string;
  password: string;
  project_id?: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}
export interface ResetPasswordRequest {
  token: string;
  password: string;
}
export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface AuthUserResponse {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  email_verified: boolean;
  project_id?: string | null;
  project_role?: ProjectRole | null;
  projects: ProjectSummary[];
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUserResponse;
}

// ─── Proyecto ────────────────────────────────────────────────────────────────

export type ProjectStatus = 'planning' | 'active' | 'paused' | 'finished';

export interface BudgetHealthThresholds {
  /** % de desvío sobre la línea base a partir del cual el semáforo pasa a ámbar. */
  warning_pct: number;
  /** % a partir del cual pasa a rojo. */
  danger_pct: number;
}

export interface NotificationWindow {
  /** HH:mm — nada se manda antes de esta hora (RF-09, "momento de envío"). */
  start: string;
  /** HH:mm — ni después de esta. */
  end: string;
}

export interface Project extends Timestamped {
  id: string;
  name: string;
  description?: string;
  address?: string;
  status: ProjectStatus;
  currency: string;
  start_date?: string;
  planned_end_date?: string;
  owner_id: string;
  /** Presupuesto vigente. La línea base es la versión 1. */
  budget_id?: string | null;
  budget_thresholds: BudgetHealthThresholds;
  notification_window: NotificationWindow;
  /**
   * Margen de maniobra del ejecutante, en % sobre la línea base. Es lo que
   * puede absorber antes de comerse su rentabilidad (glosario del documento).
   */
  margin_pct: number;
  archived: boolean;
}

export interface ProjectSummary {
  id: string;
  name: string;
  role: ProjectRole;
  status: ProjectStatus;
}

export type ProjectMemberStatus = 'invited' | 'active' | 'removed';

export interface ProjectMember extends Timestamped {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  status: ProjectMemberStatus;
  invited_by?: string;
  invited_at?: string;
  joined_at?: string;
  /** Denormalizado para listar el equipo sin un populate por fila. */
  user?: Pick<User, 'id' | 'email' | 'name' | 'picture'>;
}

// ─── Actividad (RF-01, RF-04) ────────────────────────────────────────────────

export type ActivityStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

export const ACTIVITY_STATUSES: ActivityStatus[] = ['pending', 'in_progress', 'done', 'blocked'];

export interface Activity extends Timestamped {
  id: string;
  project_id: string;
  name: string;
  /** Área o espacio de la obra: "Baño principal", "Cocina". */
  area?: string;
  /** Capítulo del presupuesto al que imputa, por código. */
  chapter_code?: string;
  planned_start: string;
  planned_end: string;
  responsible_id?: string | null;
  status: ActivityStatus;
  /** Obligatorio si `status === 'blocked'`. */
  blocked_reason?: string;
  /**
   * Ponderación para el % de avance general. Por defecto 1: si nadie pondera,
   * el avance es la fracción de actividades listas, que ya es útil.
   */
  weight: number;
  /** Personal planificado para la actividad — base del alerta de déficit. */
  planned_headcount: number;
  /** Clave ISO de semana (`2026-W36`). Deriva de planned_start. */
  week: string;
  progress_photos: string[];
  completed_at?: string | null;
  order: number;
}

/** Una actividad con lo que el dashboard necesita para no pedir 3 endpoints. */
export interface ActivityWithContext extends Activity {
  is_late: boolean;
  blocking_materials: number;
  headcount_today?: number;
}

// ─── Material (RF-02) ────────────────────────────────────────────────────────

export type MaterialStatus = 'pending' | 'requested' | 'purchased' | 'on_site';

export const MATERIAL_STATUSES: MaterialStatus[] = ['pending', 'requested', 'purchased', 'on_site'];

export interface Material extends Timestamped {
  id: string;
  project_id: string;
  activity_id?: string | null;
  name: string;
  quantity: number;
  unit: string;
  status: MaterialStatus;
  estimated_cost: number;
  actual_cost?: number | null;
  chapter_code?: string;
  notes?: string;
  created_by: string;
}

// ─── Personal (RF-03) ────────────────────────────────────────────────────────

export interface Worker extends Timestamped {
  id: string;
  project_id: string;
  name: string;
  /** Oficio: albañil, plomero, electricista. */
  trade?: string;
  phone?: string;
  active: boolean;
}

export interface AttendanceRecord extends Timestamped {
  id: string;
  project_id: string;
  worker_id: string;
  /** YYYY-MM-DD. */
  date: string;
  present: boolean;
  activity_id?: string | null;
  notes?: string;
  recorded_by: string;
  worker?: Pick<Worker, 'id' | 'name' | 'trade'>;
}

// ─── Presupuesto (RF-05) ─────────────────────────────────────────────────────

export type BudgetSource = 'import' | 'manual';

export interface BudgetItem {
  code?: string;
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface BudgetChapter {
  code: string;
  name: string;
  items: BudgetItem[];
  total: number;
}

export interface Budget extends Timestamped {
  id: string;
  project_id: string;
  /** 1 es la línea base. Una recarga crea la 2, y la 1 se conserva. */
  version: number;
  is_baseline: boolean;
  source: BudgetSource;
  file_name?: string;
  currency: string;
  chapters: BudgetChapter[];
  total: number;
  imported_by: string;
}

/** Resultado de la vista previa de importación, antes de confirmar. */
export interface BudgetImportPreview {
  chapters: BudgetChapter[];
  total: number;
  currency: string;
  row_count: number;
  warnings: BudgetImportWarning[];
  detected_columns: Record<string, string>;
}

export interface BudgetImportWarning {
  kind: 'incomplete_row' | 'unknown_unit' | 'duplicate' | 'total_mismatch';
  message: string;
  row?: number;
}

export type BudgetHealth = 'healthy' | 'warning' | 'danger';

/**
 * El estado financiero del proyecto. No hay pagos ni anticipos acá a propósito
 * (§ "Exclusión explícita" del documento): la plataforma controla presupuesto,
 * no caja.
 */
export interface BudgetStatus {
  currency: string;
  /** Línea base: el presupuesto importado, versión 1. */
  baseline: number;
  /** Gastado y cerrado: materiales comprados o en obra, a costo real. */
  executed: number;
  /** Aprobado y todavía no gastado: imprevistos aprobados + material pedido. */
  committed: number;
  /** baseline − executed − committed. */
  available: number;
  /**
   * Margen de maniobra: cuánta holgura queda antes de comerse la rentabilidad
   * del ejecutante o pasarse del tope del cliente.
   */
  maneuver_margin: number;
  maneuver_margin_pct: number;
  health: BudgetHealth;
  by_chapter: BudgetChapterStatus[];
}

export interface BudgetChapterStatus {
  code: string;
  name: string;
  baseline: number;
  executed: number;
  committed: number;
  deviation: number;
  deviation_pct: number;
  health: BudgetHealth;
}

// ─── Imprevisto (RF-07, RF-08) — el diferenciador ────────────────────────────

/**
 * El ciclo de vida del §RF-08, en orden. Cada salto queda en `history`, que es
 * inmutable (regla de negocio 5).
 */
export type ContingencyStatus =
  | 'draft'
  | 'pending_internal'
  | 'internal_approved'
  | 'sent_to_client'
  | 'client_approved'
  | 'client_rejected'
  | 'alternative_requested'
  | 'cancelled';

export type ContingencyUrgency = 'blocking' | 'non_blocking';

export interface ContingencyOption {
  description: string;
  cost: number;
  days: number;
}

export interface ContingencyHistoryEntry {
  at: string;
  by: string;
  by_name?: string;
  from_status: ContingencyStatus | null;
  to_status: ContingencyStatus;
  comment?: string;
}

export interface Contingency extends Timestamped {
  id: string;
  project_id: string;
  /** Correlativo legible por proyecto: IMP-001. */
  code: string;
  /** Qué pasó, en lenguaje simple. */
  what_happened: string;
  /** Por qué pasó. Obligatorio: es lo que convierte un cobro en una explicación. */
  why_happened: string;
  /** Qué implica, cuantificado. */
  impact_cost: number;
  impact_days: number;
  /** Al menos una alternativa cuando exista. */
  options: ContingencyOption[];
  evidence: string[];
  urgency: ContingencyUrgency;
  blocking_since?: string | null;
  affected_activity_ids: string[];
  chapter_code?: string;
  status: ContingencyStatus;
  created_by: string;
  internal_approved_by?: string | null;
  internal_approved_at?: string | null;
  sent_to_client_at?: string | null;
  client_decision?: {
    by: string;
    by_name?: string;
    at: string;
    decision: 'approved' | 'rejected' | 'alternative';
    comment?: string;
    chosen_option?: number;
  } | null;
  history: ContingencyHistoryEntry[];
  /** Notificación agrupada a la que se sumó, si se envió en lote (RF-09). */
  batch_id?: string | null;
}

// ─── Notificaciones (RF-08, RF-09) ───────────────────────────────────────────

export type NotificationType =
  | 'contingency_pending_internal'
  | 'contingency_awaiting_client'
  | 'contingency_decided'
  | 'material_blocking'
  | 'headcount_deficit'
  | 'activity_late'
  | 'weekly_summary'
  | 'budget_threshold';

export type NotificationChannel = 'in_app' | 'email';

export interface Notification extends Timestamped {
  id: string;
  project_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  channels: NotificationChannel[];
  read_at?: string | null;
  sent_at?: string | null;
  /** Agrupación de no urgentes en una sola comunicación periódica (RF-09). */
  batch_id?: string | null;
}

// ─── Dashboard (§3) ──────────────────────────────────────────────────────────

export interface DashboardSummary {
  project: Pick<Project, 'id' | 'name' | 'status' | 'currency'>;
  week: string;
  progress_pct: number;
  activities: {
    total: number;
    done: number;
    in_progress: number;
    pending: number;
    blocked: number;
    late: number;
    this_week: ActivityWithContext[];
  };
  materials: {
    pending: number;
    blocking: number;
    estimated_pending_cost: number;
  };
  personnel: {
    expected_today: number;
    present_today: number;
    deficit: number;
  };
  budget: BudgetStatus;
  contingencies: {
    pending_internal: number;
    awaiting_client: number;
    oldest_awaiting_days: number | null;
  };
  forecast: Forecast;
}

/** Vista simplificada del cliente (§2.4). Sin detalle operativo interno. */
export interface ClientDashboard {
  project: Pick<Project, 'id' | 'name' | 'status' | 'currency'>;
  progress_pct: number;
  activities_done: number;
  activities_total: number;
  budget: {
    currency: string;
    baseline: number;
    committed_total: number;
    remaining: number;
    health: BudgetHealth;
  };
  pending_decisions: Array<
    Pick<
      Contingency,
      | 'id'
      | 'code'
      | 'what_happened'
      | 'why_happened'
      | 'impact_cost'
      | 'impact_days'
      | 'options'
      | 'urgency'
      | 'sent_to_client_at'
    >
  >;
  last_summary_at?: string | null;
}

// ─── Previsiones (RF-10) ─────────────────────────────────────────────────────

export interface Forecast {
  /** Proyección de cierre del presupuesto al ritmo actual de ejecución. */
  projected_budget_close: number;
  projected_budget_deviation: number;
  /** Proyección de fecha de fin según avance real vs planificado. */
  projected_end_date: string | null;
  planned_end_date: string | null;
  projected_delay_days: number;
  alerts: ForecastAlert[];
}

export interface ForecastAlert {
  kind: 'material_running_out' | 'activity_at_risk' | 'chapter_deviation';
  severity: 'info' | 'warning' | 'danger';
  message: string;
  link?: string;
}

// ─── Asistente conversacional (RF-06) ────────────────────────────────────────

export interface AssistantSource {
  label: string;
  /** Ruta interna a la pantalla o registro de origen, para verificar el dato. */
  link: string;
}

export interface AssistantSuggestedAction {
  kind: 'create_contingency' | 'add_material' | 'update_activity_status';
  label: string;
  payload: Record<string, unknown>;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: AssistantSource[];
  /** Acción sugerida — nunca se ejecuta sin confirmación explícita. */
  suggested_action?: AssistantSuggestedAction | null;
  created_at: string;
}

export interface AssistantConversation extends Timestamped {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  messages: AssistantMessage[];
}

// ─── Auditoría (regla de negocio 7) ──────────────────────────────────────────

export interface AuditEntry extends Timestamped {
  id: string;
  project_id: string;
  user_id: string;
  action: string;
  entity: string;
  entity_id: string;
  summary: string;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

export const DEFAULT_BUDGET_THRESHOLDS: BudgetHealthThresholds = {
  warning_pct: 5,
  danger_pct: 12,
};

export const DEFAULT_NOTIFICATION_WINDOW: NotificationWindow = { start: '08:00', end: '20:00' };

/** Unidades que el importador reconoce sin avisar (RF-05, vista previa). */
export const KNOWN_UNITS = [
  'un', 'u', 'm', 'm2', 'm3', 'ml', 'kg', 'lt', 'gl', 'bolsa', 'caja', 'hora', 'día', 'global',
] as const;

export const CONTINGENCY_STATUS_LABELS: Record<ContingencyStatus, string> = {
  draft: 'Borrador',
  pending_internal: 'Esperando aprobación interna',
  internal_approved: 'Aprobado internamente',
  sent_to_client: 'Enviado al cliente',
  client_approved: 'Aprobado por el cliente',
  client_rejected: 'Rechazado por el cliente',
  alternative_requested: 'El cliente pidió alternativa',
  cancelled: 'Cancelado',
};

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En proceso',
  done: 'Listo',
  blocked: 'Bloqueado',
};

export const MATERIAL_STATUS_LABELS: Record<MaterialStatus, string> = {
  pending: 'Pendiente',
  requested: 'Solicitado',
  purchased: 'Comprado',
  on_site: 'En obra',
};

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  executor: 'Ejecutante',
  manager: 'Encargado',
  assistant: 'Asistente de obra',
  client: 'Cliente',
};
