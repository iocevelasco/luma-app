/**
 * Suscripción a Luma: lo que paga el dueño de una Empresa para usar la app.
 *
 * No confundir con `payment.ts`, que son los cobros de una OBRA (cliente →
 * gerente). Esto es la plata que entra a Luma, y no se cruza nunca con la de
 * las obras.
 *
 * Mismo criterio que el resto de la plata del repo: se guardan los HECHOS
 * (cuándo empezó la prueba, qué períodos se pagaron, qué informó Stripe) y el
 * estado se DERIVA siempre — ver `billing/index.ts`.
 */

/**
 * Estado derivado, nunca guardado.
 *
 * - `sin_iniciar`: todavía no creó ninguna obra. Pasa con los invitados: su
 *   mes gratis arranca recién con su primera obra propia.
 * - `prueba`: dentro del mes gratis. Tope de 3 obras activas.
 * - `activa`: hay un período pago que cubre hoy.
 * - `en_revision`: mandó un pago en bolívares y todavía no se aprobó. Sigue
 *   con acceso completo durante la gracia, para que una demora de quien
 *   revisa no lo bloquee.
 * - `pago_fallido`: Stripe no pudo cobrar la renovación. Misma gracia
 *   mientras Stripe reintenta.
 * - `vencida`: nada lo cubre. Las obras quedan en sólo lectura.
 */
export type SubscriptionStatus =
  | 'sin_iniciar'
  | 'prueba'
  | 'activa'
  | 'en_revision'
  | 'pago_fallido'
  | 'vencida';

export type SubscriptionPaymentMethod = 'stripe' | 'pago_movil' | 'transferencia';

export const BOLIVARES_PAYMENT_METHODS = ['pago_movil', 'transferencia'] as const;
export type BolivaresPaymentMethod = (typeof BOLIVARES_PAYMENT_METHODS)[number];

/** Estado de un pago manual en bolívares. Éste sí es un hecho: lo decide una persona. */
export type SubscriptionPaymentStatus = 'pendiente' | 'aprobado' | 'rechazado';

/** Los estados de Stripe que nos importan. El resto se trata como "no cubre". */
export type StripeSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

/** Una línea del cobro. Todo en dólares; la conversión a Bs va aparte. */
export interface ChargeLine {
  /**
   * - `base`: el plan, con 3 obras incluidas.
   * - `extra`: cada obra activa a partir de la cuarta, mes completo por adelantado.
   * - `prorrateo`: una obra extra que se creó a mitad del período anterior,
   *   por los días que le quedaban a ese período.
   */
  kind: 'base' | 'extra' | 'prorrateo';
  quantity: number;
  unitUsd: number;
  amountUsd: number;
  /** Sólo en `prorrateo`: la obra y cuántos días se cobran. */
  projectId?: string;
  days?: number;
}

export interface ChargeQuote {
  /** ISO 8601. */
  periodStart: string;
  periodEnd: string;
  lines: ChargeLine[];
  totalUsd: number;
}

/** Lo que la UI necesita para mostrar el estado de la suscripción. */
export interface SubscriptionSummary {
  status: SubscriptionStatus;
  /** Si puede crear y modificar. `false` = sólo lectura. */
  canWrite: boolean;
  /** ISO 8601. Hasta cuándo tiene acceso de escritura, gracia incluida. */
  accessUntil: string | null;
  trialEndsAt: string | null;
  /** Días enteros que le quedan de prueba, o `null` si no está en prueba. */
  trialDaysLeft: number | null;
  activeProjects: number;
  includedProjects: number;
  /** Lo que se le va a cobrar en la próxima renovación. */
  nextCharge: ChargeQuote | null;
}
