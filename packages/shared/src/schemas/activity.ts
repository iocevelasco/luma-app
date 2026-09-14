import { z } from 'zod';

/**
 * Schemas de planificación semanal (RF-01). Mismo criterio que
 * `schemas/project.ts`: sin imports de `./index.ts`.
 */

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');

export const activityStatusSchema = z.enum(['pendiente', 'en_curso', 'completada', 'cancelada']);

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
    area: z.string().trim().min(1, 'El área es obligatoria').max(120, 'Es demasiado largo'),
    startDate: dayKeySchema,
    endDate: dayKeySchema,
    responsible: activityResponsibleSchema,
    status: activityStatusSchema.default('pendiente'),
    notes: z.string().trim().max(2000, 'Es demasiado largo').optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'La fecha de fin no puede ser anterior al inicio',
    path: ['endDate'],
  });

export const updateActivitySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    area: z.string().trim().min(1).max(120).optional(),
    startDate: dayKeySchema.optional(),
    endDate: dayKeySchema.optional(),
    responsible: activityResponsibleSchema.optional(),
    status: activityStatusSchema.optional(),
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
