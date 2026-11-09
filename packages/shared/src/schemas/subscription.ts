import { z } from 'zod';

/**
 * Schemas de la suscripción. Sin imports de `./index.ts`, mismo criterio que
 * `./project.ts`.
 */

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');

export const planCodeSchema = z.enum(['pro', 'unlimited']);

const usdSchema = z
  .number({ required_error: 'El precio es obligatorio', invalid_type_error: 'El precio es obligatorio' })
  .min(0, 'El precio no puede ser negativo')
  .max(100_000, 'El precio es demasiado alto')
  .refine((value) => Number.isInteger(Math.round(value * 100 * 1e6) / 1e6), 'Hasta dos decimales');

/**
 * Una lista de precios. Graduada: los escalones suben de obra y no suben de
 * precio, y el último no tiene tope, así toda obra cae en alguno.
 */
export const planConfigSchema = z
  .object({
    basePriceUsd: usdSchema.refine((value) => value > 0, 'El precio tiene que ser mayor a cero'),
    includedProjects: z
      .number({ required_error: 'Indica cuántas obras incluye' })
      .int('Tiene que ser un número entero')
      .min(1, 'Tiene que incluir al menos una obra')
      .max(1000),
    trialDays: z
      .number({ required_error: 'Indica los días de prueba' })
      .int('Tiene que ser un número entero')
      .min(1, 'Tiene que ser al menos un día')
      .max(365, 'Son demasiados días'),
    extraTiers: z
      .array(z.object({ upToProjects: z.number().int().min(1).nullable(), unitUsd: usdSchema }))
      .min(1, 'Hace falta al menos un escalón')
      .max(10, 'Son demasiados escalones'),
    unlimitedPriceUsd: usdSchema.nullable(),
  })
  .superRefine((config, ctx) => {
    const issue = (index: number, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['extraTiers', index], message });

    let previous = config.includedProjects;
    config.extraTiers.forEach((tier, index) => {
      const isLast = index === config.extraTiers.length - 1;
      if (isLast && tier.upToProjects !== null) issue(index, 'El último escalón no lleva tope');
      if (!isLast && tier.upToProjects === null) issue(index, 'Sólo el último escalón va sin tope');
      if (tier.upToProjects !== null) {
        if (tier.upToProjects <= previous) issue(index, 'Cada escalón tiene que llegar a más obras');
        previous = tier.upToProjects;
      }
      if (index > 0 && tier.unitUsd > config.extraTiers[index - 1].unitUsd) {
        issue(index, 'Un escalón no puede costar más que el anterior');
      }
    });
  });

/** Publicar una lista nueva. `expectedVersion` frena a dos admins pisándose. */
export const publishPlanConfigSchema = z.object({
  config: planConfigSchema,
  expectedVersion: z.number().int().nullable(),
  note: z.string().trim().max(200).optional(),
});

/**
 * Pago en bolívares que carga el dueño y después revisa un admin.
 *
 * El monto en Bs lo manda el cliente para contrastarlo con lo que cotizó la
 * API —la API nunca lo usa como fuente de verdad: la cotización congelada es
 * la suya—. Así quien revisa ve de un vistazo si pagó de menos.
 */
export const bolivaresPaymentSchema = z.object({
  method: z.enum(['pago_movil', 'transferencia']),
  bank: z.string().trim().min(2, 'Indicá el banco desde el que pagaste').max(80),
  reference: z
    .string()
    .trim()
    .regex(/^\d{4,30}$/, 'La referencia son sólo números (entre 4 y 30)'),
  /** Cédula o RIF de quien pagó: V-12345678, E-…, J-…, G-…, P-… */
  payerId: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[VEJGP]-?\d{5,10}$/, 'Cédula o RIF inválido (ej: V-12345678)'),
  paidOn: dayKeySchema,
  // Llega por multipart (va con el comprobante), así que como string: el
  // coerce vive acá y no en el controller, mismo criterio que los gastos.
  amountBs: z.coerce
    .number({ invalid_type_error: 'El monto es obligatorio' })
    .positive('El monto tiene que ser mayor a cero')
    .max(1_000_000_000, 'El monto es demasiado grande'),
  /**
   * `true` cuando paga durante la prueba para poder crear más de 3 obras: la
   * prueba termina ese día y el plan arranca ya (regla A). Sin esto, un pago
   * anticipado arranca cuando termina la prueba y no se pierde ningún día.
   */
  // `z.coerce.boolean()` convertiría el string "false" en `true`.
  activateNow: z.preprocess((value) => value === true || value === 'true', z.boolean()),
  /**
   * Sólo con `activateNow`, cuando se pasa a Pro para crear la cuarta obra:
   * esa obra, que todavía no existe, entra ya en el primer cobro (plan y
   * extra arrancan el mismo día, sin prorrateo). Pasar a Pro desde la
   * pantalla de Suscripción no la incluye: cobra sólo las obras que hay.
   */
  includeNextProject: z.preprocess((value) => value === true || value === 'true', z.boolean()),
  /** Sin esto se renueva el plan que ya tiene, o Pro si es su primer pago. */
  plan: planCodeSchema.optional(),
});

/**
 * Pago en USDT por Binance Pay, que carga el dueño y confirma un admin. Lo que
 * sale del propio cobro (monto, fecha) es opcional: si no viene, lo pone la API.
 */
export const binancePaymentSchema = z.object({
  orderId: z
    .string()
    .trim()
    .regex(/^\d{6,40}$/, 'El número de orden son sólo números')
    .optional(),
  payerBinanceId: z
    .string()
    .trim()
    .regex(/^\d{6,15}$/, 'El ID de Binance son sólo números')
    .optional(),
  paidOn: dayKeySchema.optional(),
  amountUsdt: z.coerce
    .number({ invalid_type_error: 'El monto es obligatorio' })
    .positive('El monto tiene que ser mayor a cero')
    .max(1_000_000, 'El monto es demasiado grande')
    .optional(),
  activateNow: z.preprocess((value) => value === true || value === 'true', z.boolean()),
  includeNextProject: z.preprocess((value) => value === true || value === 'true', z.boolean()),
  plan: planCodeSchema.optional(),
});

/** Decisión de un admin sobre un pago en bolívares. */
export const reviewSubscriptionPaymentSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('aprobar') }),
  z.object({
    decision: z.literal('rechazar'),
    reason: z.string().trim().min(5, 'Contale al usuario por qué se rechazó').max(500),
  }),
]);

/** Tasa cargada a mano por un admin cuando el BCV no responde. */
export const manualExchangeRateSchema = z.object({
  usd: z
    .number({ invalid_type_error: 'La tasa es obligatoria' })
    .positive('La tasa tiene que ser mayor a cero'),
  valueDate: dayKeySchema,
});

export type BolivaresPaymentInput = z.infer<typeof bolivaresPaymentSchema>;
export type BinancePaymentInput = z.infer<typeof binancePaymentSchema>;
export type ReviewSubscriptionPaymentInput = z.infer<typeof reviewSubscriptionPaymentSchema>;
export type ManualExchangeRateInput = z.infer<typeof manualExchangeRateSchema>;
export type PublishPlanConfigInput = z.infer<typeof publishPlanConfigSchema>;
