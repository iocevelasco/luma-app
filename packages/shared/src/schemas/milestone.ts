import { z } from 'zod';

/**
 * Schemas de hitos. Sin imports de `./index.ts`, mismo criterio que
 * `./project.ts`.
 */

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');

export const milestoneTypeSchema = z.enum([
  'etapa_concluida',
  'compra_significativa',
  'permisologia',
  'vicio_oculto',
  'retraso',
  'cambio_proyecto',
  'otro',
]);

export const milestoneAudienceSchema = z.enum(['cliente', 'interno']);

export const milestoneSeveritySchema = z.enum(['info', 'atencion', 'critico']);

export const createMilestoneSchema = z.object({
  type: milestoneTypeSchema,
  /**
   * Sin default: que el cliente se entere de algo es una decisión explícita,
   * y un default silencioso de `'cliente'` haría que una eventualidad interna
   * se publique por olvidarse de un campo.
   */
  audience: milestoneAudienceSchema,
  severity: milestoneSeveritySchema.default('info'),
  title: z
    .string()
    .trim()
    .min(1, 'El título es obligatorio')
    .max(160, 'El título es demasiado largo'),
  description: z.string().trim().max(2000, 'La descripción es demasiado larga').optional(),
  occurredOn: dayKeySchema,
  activityId: z.string().trim().optional(),
});

export const updateMilestoneSchema = z
  .object({
    type: milestoneTypeSchema.optional(),
    audience: milestoneAudienceSchema.optional(),
    severity: milestoneSeveritySchema.optional(),
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(2000).optional(),
    occurredOn: dayKeySchema.optional(),
    activityId: z.string().trim().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'No hay nada para actualizar',
  });

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
