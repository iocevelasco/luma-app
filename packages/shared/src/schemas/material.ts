import { z } from 'zod';

/**
 * Schemas de gestión de materiales (RF-02). `statusChangedBy`/`statusChangedAt`
 * no viajan acá: se setean server-side en el controller, nunca los manda el
 * cliente. La pertenencia de `activity` al mismo `project` tampoco se valida
 * acá — necesita ir a la base, así que es responsabilidad del controller.
 */

export const materialUnitSchema = z.enum([
  'un',
  'm',
  'm2',
  'm3',
  'kg',
  'l',
  'bolsa',
  'rollo',
  'global',
]);

export const materialStatusSchema = z.enum(['pendiente', 'solicitado', 'comprado', 'en_obra']);

export const createMaterialSchema = z.object({
  activityId: z.string().trim().min(1).optional().nullable(),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(120, 'Es demasiado largo'),
  quantity: z.number({ invalid_type_error: 'La cantidad es obligatoria' }).positive('Tiene que ser mayor a 0'),
  unit: materialUnitSchema,
  status: materialStatusSchema.default('pendiente'),
  estimatedCost: z.number().min(0, 'No puede ser negativo').optional(),
  supplier: z.string().trim().max(120, 'Es demasiado largo').optional(),
});

export const updateMaterialSchema = z.object({
  activityId: z.string().trim().min(1).optional().nullable(),
  name: z.string().trim().min(1).max(120).optional(),
  quantity: z.number().positive('Tiene que ser mayor a 0').optional(),
  unit: materialUnitSchema.optional(),
  status: materialStatusSchema.optional(),
  estimatedCost: z.number().min(0).optional(),
  supplier: z.string().trim().max(120).optional(),
});

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
