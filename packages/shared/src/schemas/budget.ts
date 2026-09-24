import { z } from 'zod';
import { roundMoney } from '../utils/money.js';

/**
 * Schema de presupuesto (RF-05, corte 1: carga manual). `total` de cada ítem
 * es el valor que manda — nunca se recalcula a partir de `quantity * unitCost`,
 * porque es el número que el ejecutante ya le pasó al cliente. La consistencia
 * entre `totalAmount` y la suma de los ítems se valida en el controller, no
 * acá: necesita el resultado del cálculo del lado del servidor para dar un
 * mensaje claro, no un ajuste silencioso.
 */

const budgetLineInputSchema = z.object({
  chapter: z.string().trim().min(1, 'El capítulo es obligatorio').max(120, 'Es demasiado largo'),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(160, 'Es demasiado largo'),
  unit: z.string().trim().min(1, 'La unidad es obligatoria').max(20, 'Es demasiado larga'),
  quantity: z.number().positive('Tiene que ser mayor a 0').optional(),
  unitCost: z.number().min(0, 'No puede ser negativo').optional(),
  total: z.number().min(0, 'No puede ser negativo').transform(roundMoney),
});

export const createBudgetSchema = z.object({
  totalAmount: z.number().min(0, 'No puede ser negativo').transform(roundMoney),
  contingencyAmount: z
    .number()
    .min(0, 'No puede ser negativo')
    .default(0)
    .transform(roundMoney),
  lines: z.array(budgetLineInputSchema).min(1, 'Agregá al menos un ítem'),
  /** Metadata de origen — nunca se confía en `sourceRowCount` para nada más que mostrarlo. */
  importMode: z.enum(['manual', 'import']).default('manual'),
  sourceFileName: z.string().trim().max(200, 'Es demasiado largo').optional(),
  sourceRowCount: z.number().int().positive().optional(),
});

export type BudgetLineInput = z.infer<typeof budgetLineInputSchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
