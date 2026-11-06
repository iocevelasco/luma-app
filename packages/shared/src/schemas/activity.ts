import { z } from 'zod';

/**
 * Schemas de planificación semanal (RF-01). Mismo criterio que
 * `schemas/project.ts`: sin imports de `./index.ts`.
 */

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');

export const activityStatusSchema = z.enum([
  'pendiente',
  'en_curso',
  'en_revision',
  'completada',
  'cancelada',
]);

/**
 * Duplica el catálogo de `providerSpecialtySchema` (los schemas de dominio no
 * se importan entre sí). Hay un test que falla si se desincronizan.
 */
export const activityBaseSpecialtySchema = z.enum([
  'electricidad',
  'plomeria',
  'gas',
  'carpinteria',
  'cristaleria',
  'albanileria',
  'herreria',
  'redes',
  'mecanicas',
  'estructura',
  'acabados',
  'pintura',
  'climatizacion',
  'fire_protection',
  'techos',
  'pisos_revestimientos',
  'jardineria',
  'demolicion',
  'arquitectura',
  'diseno',
  'drywall',
  'otra',
]);

/** Clave de una especialidad propia de la obra: el servidor la genera, nunca el cliente. */
export const customSpecialtyKeySchema = z.string().regex(/^custom_[a-z0-9_]{1,60}$/, 'Elige una especialidad');

/**
 * Una de base o una propia de la obra. Que la propia exista y no esté archivada
 * lo comprueba la API contra la obra: el schema sólo conoce la forma.
 */
export const activitySpecialtySchema = z.union([activityBaseSpecialtySchema, customSpecialtyKeySchema]);

/** El supervisor devuelve el trabajo: el motivo es obligatorio a propósito. */
export const rejectActivitySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Escribe por qué lo devuelves')
    .max(500, 'Es demasiado largo'),
});

const activityResponsibleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El responsable es obligatorio')
    .max(120, 'El nombre es demasiado largo'),
  user: z.string().trim().min(1).optional(),
});

export const createActivitySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'El nombre es obligatorio')
      .max(120, 'El nombre es demasiado largo'),
    startDate: dayKeySchema,
    endDate: dayKeySchema,
    responsible: activityResponsibleSchema,
    status: activityStatusSchema.default('pendiente'),
    specialty: activitySpecialtySchema,
    notes: z.string().trim().max(2000, 'Es demasiado largo').optional(),
    /**
     * La cuadrilla con la que nace la tarea. Es lo que la conecta con la
     * Jornada: quien está acá aparece esperado en la asistencia de esos días.
     * Va en el alta y no en un paso aparte porque el supervisor crea tareas
     * pero no administra cuadrillas (`crew.manage`).
     */
    crewMemberIds: z.array(z.string().trim().min(1)).max(30).optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'La fecha de fin no puede ser anterior al inicio',
    path: ['endDate'],
  });

export const updateActivitySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    startDate: dayKeySchema.optional(),
    endDate: dayKeySchema.optional(),
    responsible: activityResponsibleSchema.optional(),
    status: activityStatusSchema.optional(),
    specialty: activitySpecialtySchema.optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine(
    (data) => !data.startDate || !data.endDate || data.endDate >= data.startDate,
    {
      message: 'La fecha de fin no puede ser anterior al inicio',
      path: ['endDate'],
    },
  );

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
export type RejectActivityInput = z.infer<typeof rejectActivitySchema>;
