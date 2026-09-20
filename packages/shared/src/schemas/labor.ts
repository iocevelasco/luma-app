import { z } from 'zod';

/**
 * Registro diario de mano de obra por actividad (RF-03). Un registro por
 * (actividad, día) — no hay altas/bajas: recargar el mismo día actualiza el
 * existente, es un parte diario, no un historial.
 */

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');

export const laborRecordSchema = z.object({
  activityId: z.string().trim().min(1, 'La actividad es obligatoria'),
  date: dayKeySchema,
  expectedCount: z
    .number()
    .int('Tiene que ser un número entero')
    .min(0, 'No puede ser negativo'),
  presentNames: z.array(z.string().trim().min(1)).default([]),
});

export type LaborRecordInput = z.infer<typeof laborRecordSchema>;
