import { z } from 'zod';
import { KNOWN_UNITS } from '../types/index.js';

// ============================================================================
// Schemas Zod compartidos entre API y web.
//
// Un solo lugar define la forma de cada payload: el formulario de React valida
// con el mismo objeto con el que el controlador de Express valida. Cuando se
// agrega un campo obligatorio, las dos puntas se enteran a la vez.
// ============================================================================

// ─── Contraseña ──────────────────────────────────────────────────────────────

/**
 * Regla de contraseña, en un solo lugar.
 *
 * 8 caracteres con al menos una letra y un número. Ni menos (queda trivial) ni
 * la torre de símbolos obligatorios que empuja a la gente a `Password1!` y a
 * anotarla en un papel.
 */
export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña es demasiado larga')
  .regex(/[A-Za-zÁÉÍÓÚáéíóúÑñ]/, 'La contraseña debe incluir al menos una letra')
  .regex(/\d/, 'La contraseña debe incluir al menos un número');

export const emailSchema = z.string().trim().toLowerCase().email('Email inválido');

// ─── Auth ────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ingresá tu contraseña'),
  project_id: z.string().optional(),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(2, 'Ingresá tu nombre'),
  phone: z.string().trim().optional(),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Token inválido'),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Ingresá tu contraseña actual'),
  new_password: passwordSchema,
});

export const switchProjectSchema = z.object({ project_id: z.string().min(1) });

// ─── Proyecto ────────────────────────────────────────────────────────────────

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Fecha inválida (YYYY-MM-DD)');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:mm)');

export const createProjectSchema = z.object({
  name: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres'),
  description: z.string().trim().max(2000).optional(),
  address: z.string().trim().max(300).optional(),
  currency: z.string().trim().min(2).max(6).default('ARS'),
  start_date: isoDate.optional(),
  planned_end_date: isoDate.optional(),
  margin_pct: z.number().min(0).max(90).default(10),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.enum(['planning', 'active', 'paused', 'finished']).optional(),
  budget_thresholds: z
    .object({ warning_pct: z.number().min(0).max(100), danger_pct: z.number().min(0).max(100) })
    .refine((t) => t.danger_pct > t.warning_pct, {
      message: 'El umbral rojo tiene que ser mayor que el ámbar',
    })
    .optional(),
  notification_window: z.object({ start: hhmm, end: hhmm }).optional(),
});

export const inviteMemberSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(2).optional(),
  role: z.enum(['executor', 'manager', 'assistant', 'client']),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['executor', 'manager', 'assistant', 'client']),
});

// ─── Actividad (RF-01) ───────────────────────────────────────────────────────

export const createActivitySchema = z
  .object({
    name: z.string().trim().min(2, 'Ingresá el nombre de la actividad'),
    area: z.string().trim().max(120).optional(),
    chapter_code: z.string().trim().max(40).optional(),
    planned_start: isoDate,
    planned_end: isoDate,
    responsible_id: z.string().nullable().optional(),
    weight: z.number().min(0).max(1000).default(1),
    planned_headcount: z.number().int().min(0).max(500).default(0),
    order: z.number().int().default(0),
  })
  .refine((a) => a.planned_end >= a.planned_start, {
    message: 'La fecha de fin no puede ser anterior a la de inicio',
    path: ['planned_end'],
  });

export const updateActivitySchema = z.object({
  name: z.string().trim().min(2).optional(),
  area: z.string().trim().max(120).optional(),
  chapter_code: z.string().trim().max(40).optional(),
  planned_start: isoDate.optional(),
  planned_end: isoDate.optional(),
  responsible_id: z.string().nullable().optional(),
  weight: z.number().min(0).max(1000).optional(),
  planned_headcount: z.number().int().min(0).max(500).optional(),
  order: z.number().int().optional(),
});

/**
 * Cambio de estado en un toque desde el móvil (RF-04).
 *
 * `blocked_reason` es obligatorio para 'blocked' y sólo para ese: un bloqueo
 * sin motivo es exactamente el dato que después nadie puede explicarle al
 * cliente.
 */
export const updateActivityStatusSchema = z
  .object({
    status: z.enum(['pending', 'in_progress', 'done', 'blocked']),
    blocked_reason: z.string().trim().max(500).optional(),
    photo_url: z.string().url('URL de foto inválida').optional(),
  })
  .refine((v) => v.status !== 'blocked' || !!v.blocked_reason?.trim(), {
    message: 'Un bloqueo necesita motivo',
    path: ['blocked_reason'],
  });

// ─── Material (RF-02) ────────────────────────────────────────────────────────

/**
 * Alta rápida de faltante desde el celular: los mínimos obligatorios son
 * nombre y cantidad. Todo campo obligatorio de más es riesgo de abandono
 * (§8, "el registro diario no debe superar los 3 minutos").
 */
export const createMaterialSchema = z.object({
  name: z.string().trim().min(2, 'Ingresá el material'),
  quantity: z.number().positive('La cantidad debe ser mayor a cero'),
  unit: z.string().trim().min(1).default('un'),
  activity_id: z.string().nullable().optional(),
  chapter_code: z.string().trim().max(40).optional(),
  estimated_cost: z.number().min(0).default(0),
  notes: z.string().trim().max(500).optional(),
});

export const updateMaterialSchema = createMaterialSchema.partial().extend({
  status: z.enum(['pending', 'requested', 'purchased', 'on_site']).optional(),
  actual_cost: z.number().min(0).nullable().optional(),
});

// ─── Personal (RF-03) ────────────────────────────────────────────────────────

export const createWorkerSchema = z.object({
  name: z.string().trim().min(2, 'Ingresá el nombre'),
  trade: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
});

export const updateWorkerSchema = createWorkerSchema.partial().extend({
  active: z.boolean().optional(),
});

/** Parte diario: se manda la lista entera del día en un request. */
export const recordAttendanceSchema = z.object({
  date: isoDate,
  entries: z
    .array(
      z.object({
        worker_id: z.string().min(1),
        present: z.boolean(),
        activity_id: z.string().nullable().optional(),
        notes: z.string().trim().max(300).optional(),
      }),
    )
    .min(1, 'Registrá al menos una persona'),
});

// ─── Presupuesto (RF-05) ─────────────────────────────────────────────────────

const unitSchema = z.string().trim().min(1).max(20);

export const budgetItemSchema = z.object({
  code: z.string().trim().max(40).optional(),
  name: z.string().trim().min(1, 'El ítem necesita nombre'),
  unit: unitSchema,
  quantity: z.number().min(0),
  unit_price: z.number().min(0),
  total: z.number().min(0),
});

export const budgetChapterSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  items: z.array(budgetItemSchema),
  total: z.number().min(0),
});

/**
 * Mapeo de columnas de la planilla. Configurable porque §13.7 deja abierto
 * cuán estandarizadas están las planillas reales de los ejecutantes: hasta
 * saberlo, el importador se adapta en vez de imponer un formato.
 */
export const columnMappingSchema = z.object({
  chapter: z.string().optional(),
  code: z.string().optional(),
  name: z.string(),
  unit: z.string().optional(),
  quantity: z.string().optional(),
  unit_price: z.string().optional(),
  total: z.string().optional(),
});

export const confirmBudgetImportSchema = z.object({
  currency: z.string().trim().min(2).max(6).default('ARS'),
  file_name: z.string().trim().max(200).optional(),
  chapters: z.array(budgetChapterSchema).min(1, 'El presupuesto no tiene capítulos'),
});

export const manualBudgetSchema = confirmBudgetImportSchema;

export function isKnownUnit(unit: string): boolean {
  return (KNOWN_UNITS as readonly string[]).includes(unit.trim().toLowerCase());
}

// ─── Imprevisto (RF-07) ──────────────────────────────────────────────────────

/**
 * La estructura obligatoria del §RF-07. `why_happened` no es opcional a
 * propósito: es el campo que convierte un cobro en una explicación, y sin él
 * el producto entero pierde su diferencial.
 */
export const createContingencySchema = z.object({
  what_happened: z.string().trim().min(5, 'Contá qué pasó'),
  why_happened: z.string().trim().min(5, 'La causa es obligatoria: sin ella es sólo un cobro'),
  impact_cost: z.number().min(0),
  impact_days: z.number().int().min(0).default(0),
  options: z
    .array(
      z.object({
        description: z.string().trim().min(3),
        cost: z.number().min(0),
        days: z.number().int().min(0).default(0),
      }),
    )
    .default([]),
  evidence: z.array(z.string().url()).default([]),
  urgency: z.enum(['blocking', 'non_blocking']).default('non_blocking'),
  affected_activity_ids: z.array(z.string()).default([]),
  chapter_code: z.string().trim().max(40).optional(),
});

export const updateContingencySchema = createContingencySchema.partial();

export const internalApprovalSchema = z.object({
  /** El encargado puede ajustar cifras antes de aprobar (RF-08, paso 2). */
  impact_cost: z.number().min(0).optional(),
  impact_days: z.number().int().min(0).optional(),
  comment: z.string().trim().max(1000).optional(),
});

export const clientDecisionSchema = z
  .object({
    decision: z.enum(['approved', 'rejected', 'alternative']),
    comment: z.string().trim().max(1000).optional(),
    chosen_option: z.number().int().min(0).optional(),
  })
  .refine((d) => d.decision !== 'alternative' || !!d.comment?.trim(), {
    message: 'Contale al equipo qué alternativa buscás',
    path: ['comment'],
  });

// ─── Asistente (RF-06) ───────────────────────────────────────────────────────

export const assistantAskSchema = z.object({
  message: z.string().trim().min(2, 'Escribí tu consulta').max(2000),
  conversation_id: z.string().optional(),
});

// ─── Tipos inferidos ─────────────────────────────────────────────────────────

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
export type UpdateActivityStatusInput = z.infer<typeof updateActivityStatusSchema>;
export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
export type CreateWorkerInput = z.infer<typeof createWorkerSchema>;
export type RecordAttendanceInput = z.infer<typeof recordAttendanceSchema>;
export type ColumnMapping = z.infer<typeof columnMappingSchema>;
export type ConfirmBudgetImportInput = z.infer<typeof confirmBudgetImportSchema>;
export type CreateContingencyInput = z.infer<typeof createContingencySchema>;
export type InternalApprovalInput = z.infer<typeof internalApprovalSchema>;
export type ClientDecisionInput = z.infer<typeof clientDecisionSchema>;
export type AssistantAskInput = z.infer<typeof assistantAskSchema>;
