import { z } from 'zod';

/**
 * Schemas de la suscripción. Sin imports de `./index.ts`, mismo criterio que
 * `./project.ts`.
 */

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');

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
export type ReviewSubscriptionPaymentInput = z.infer<typeof reviewSubscriptionPaymentSchema>;
export type ManualExchangeRateInput = z.infer<typeof manualExchangeRateSchema>;
