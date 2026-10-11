import { z } from 'zod';

/**
 * Schemas de cobros y gastos. Sin imports de `./index.ts`, mismo criterio que
 * `./project.ts`.
 */

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');

const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(3, 'La moneda es un código de 3 letras');

const amountSchema = z
  .number({ invalid_type_error: 'El monto es obligatorio' })
  .positive('El monto tiene que ser mayor a cero')
  .max(1_000_000_000, 'El monto es demasiado grande');

/**
 * Cuántas unidades de la moneda de la obra vale UNA de `currency`.
 *
 * Default `1` y no opcional-sin-default: si la moneda del movimiento es la de
 * la obra, nadie debería tener que escribir un 1, y un `undefined` que llega
 * al cálculo da `NaN` en vez de un error visible.
 */
const exchangeRateSchema = z
  .number({ invalid_type_error: 'La cotización es obligatoria' })
  .positive('La cotización tiene que ser mayor a cero')
  .default(1);

export const paymentMethodSchema = z.enum(['transferencia', 'efectivo', 'cheque', 'otro']);

export const expenseCategorySchema = z.enum([
  'material',
  'herramienta',
  'nomina',
  'insumo',
  'otro',
]);

const moneyFields = {
  amount: amountSchema,
  currency: currencySchema,
  exchangeRate: exchangeRateSchema,
};

export const createPaymentScheduleItemSchema = z.object({
  ...moneyFields,
  concept: z
    .string()
    .trim()
    .min(1, 'El concepto es obligatorio')
    .max(160, 'El concepto es demasiado largo'),
  dueOn: dayKeySchema,
  order: z.number().int().min(0).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const updatePaymentScheduleItemSchema = z
  .object({
    amount: amountSchema.optional(),
    currency: currencySchema.optional(),
    exchangeRate: exchangeRateSchema.optional(),
    concept: z.string().trim().min(1).max(160).optional(),
    dueOn: dayKeySchema.optional(),
    order: z.number().int().min(0).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'No hay nada para actualizar',
  });

export const createPaymentSchema = z.object({
  ...moneyFields,
  scheduleItemId: z.string().trim().optional(),
  paidOn: dayKeySchema,
  method: paymentMethodSchema,
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
});

/**
 * Los montos viajan como campos de texto de un multipart cuando el gasto trae
 * comprobante, así que `amount` y `exchangeRate` pueden llegar string. El
 * coerce vive acá y no en el controller para que la regla sea una sola.
 */
export const createExpenseSchema = z.object({
  amount: z.coerce.number().pipe(amountSchema),
  currency: currencySchema,
  exchangeRate: z.coerce.number().pipe(exchangeRateSchema),
  category: expenseCategorySchema,
  description: z
    .string()
    .trim()
    .min(1, 'La descripción es obligatoria')
    .max(300, 'La descripción es demasiado larga'),
  spentOn: dayKeySchema,
  providerId: z.string().trim().optional(),
  activityId: z.string().trim().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const updateExpenseSchema = z
  .object({
    amount: z.coerce.number().pipe(amountSchema).optional(),
    currency: currencySchema.optional(),
    exchangeRate: z.coerce.number().pipe(exchangeRateSchema).optional(),
    category: expenseCategorySchema.optional(),
    description: z.string().trim().min(1).max(300).optional(),
    spentOn: dayKeySchema.optional(),
    providerId: z.string().trim().optional(),
    activityId: z.string().trim().optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'No hay nada para actualizar',
  });

/** Rango de la nómina. Se calcula, no se guarda. */
export const payrollQuerySchema = z.object({
  from: dayKeySchema,
  to: dayKeySchema,
});

export type CreatePaymentScheduleItemInput = z.infer<typeof createPaymentScheduleItemSchema>;
export type UpdatePaymentScheduleItemInput = z.infer<typeof updatePaymentScheduleItemSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type PayrollQueryInput = z.infer<typeof payrollQuerySchema>;
