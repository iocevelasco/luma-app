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
 * - `ilimitado`: se lo asignó un admin de la plataforma. No vence, no se
 *   cobra y no tiene tope de obras.
 */
export type SubscriptionStatus =
  | 'sin_iniciar'
  | 'prueba'
  | 'activa'
  | 'en_revision'
  | 'pago_fallido'
  | 'vencida'
  | 'ilimitado';

export type SubscriptionPaymentMethod = 'stripe' | 'pago_movil' | 'transferencia' | 'binance';

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

/** El plan pago. Ilimitado se compra; la cortesía de un admin es otra cosa (`SubscriptionFacts.unlimited`). */
export type PlanCode = 'pro' | 'unlimited';

/** Un escalón del precio por obra extra. Graduado: cada obra paga el de su posición. */
export interface ExtraProjectTier {
  /** Hasta qué obra activa rige, inclusive. `null`: de ahí en adelante; sólo el último. */
  upToProjects: number | null;
  unitUsd: number;
}

/** Una lista de precios. Se publica en el admin y no se edita: cada cambio es una versión. */
export interface PlanConfig {
  basePriceUsd: number;
  includedProjects: number;
  trialDays: number;
  extraTiers: ExtraProjectTier[];
  /** `null`: el plan Ilimitado no se ofrece en esta versión. */
  unlimitedPriceUsd: number | null;
}

/** `GET /api/admin/plan-config`, una versión publicada. */
export interface PlanVersionSummary {
  version: number;
  config: PlanConfig;
  note: string | null;
  /** ISO 8601. `null` en la versión de fábrica, que no se publicó. */
  createdAt: string | null;
}

/** `GET /api/admin/plan-config`. */
export interface PlanCatalog {
  current: PlanVersionSummary;
  history: PlanVersionSummary[];
  /** Con la tarjeta activa no se publica: los precios de Stripe todavía no siguen al catálogo. */
  publishBlocked: boolean;
}

/** Una línea del cobro. Todo en dólares; la conversión a Bs va aparte. */
export interface ChargeLine {
  /**
   * - `base`: el plan Pro, con sus obras incluidas.
   * - `unlimited`: el plan Ilimitado, precio fijo y sin extras.
   * - `extra`: las obras activas de un escalón, mes completo por adelantado.
   * - `prorrateo`: una obra extra que se creó a mitad del período anterior,
   *   por los días que le quedaban a ese período.
   */
  kind: 'base' | 'unlimited' | 'extra' | 'prorrateo';
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

/** Lo que costaría cada opción hoy. Lo calcula la API: la UI no repite la cuenta. */
export interface SubscriptionOffer {
  config: PlanConfig;
  /** Pasar a Pro desde hoy, con las obras que hay. */
  proTodayUsd: number;
  /** Pasar a Pro desde hoy para crear una obra más, que entra en el primer cobro. */
  proWithNextProjectUsd: number;
  /** Cuánto suma por mes la próxima obra. `0` si entra en lo incluido o el plan es Ilimitado. */
  nextProjectUsd: number;
  /** `null`: el plan Ilimitado no está disponible. */
  unlimitedUsd: number | null;
}

/** Lo que la UI necesita para mostrar el estado de la suscripción. */
export interface SubscriptionSummary {
  status: SubscriptionStatus;
  /** El plan pago vigente, o `pro` si todavía no pagó. */
  plan: PlanCode;
  offer: SubscriptionOffer;
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

/**
 * La tasa BCV vigente, como la ve quien va a pagar en bolívares.
 *
 * `stale`: hace más de 48 horas que no hay una lectura buena del BCV ni una
 * tasa cargada a mano. El pago en Bs igual usa esta, que es la última guardada.
 */
export interface BcvRate {
  /** Bolívares por dólar, con la precisión que publica el BCV. */
  usd: number;
  /** "Fecha Valor" del BCV, `YYYY-MM-DD`: el día para el que rige. */
  valueDate: string;
  source: 'bcv' | 'manual';
  /** ISO 8601. Última vez que se confirmó. */
  lastSeenAt: string;
  stale: boolean;
}

/**
 * Dónde se recibe el pago en bolívares. Sale de la configuración del servidor
 * (variables de entorno), no del código: cambiar de banco no es un deploy.
 */
export interface BolivaresReceivingAccounts {
  pagoMovil?: { bank: string; phone: string; id: string };
  transferencia?: { bank: string; account: string; holder: string; id: string };
}

/** `GET /api/subscription/quote` — lo que hay que pagar hoy en bolívares. */
export interface BolivaresQuote {
  quote: ChargeQuote;
  rate: BcvRate;
  /** `quote.totalUsd × rate.usd`, redondeado una vez. */
  amountBs: number;
  /** Paga desde la prueba para crear la cuarta obra: la prueba termina al aprobarse. */
  activatesNow: boolean;
  accounts: BolivaresReceivingAccounts;
  plan: PlanCode;
  /** La lista con la que se cotizó; se congela en el pago. `null`: la de antes del catálogo. */
  planVersion: number | null;
  /** Este entorno guarda comprobantes: es obligatorio. Sin storage, la API rechaza el archivo. */
  receiptRequired: boolean;
}

/** A qué cuenta de Binance se manda el pago. Sale de la configuración del servidor. */
export interface BinanceReceivingAccount {
  payId: string;
  name: string;
}

/** `GET /api/subscription/quote/binance` — lo que hay que pagar hoy en USDT. */
export interface BinanceQuote {
  quote: ChargeQuote;
  /** Igual a `quote.totalUsd`: se cobra 1 USDT por dólar, sin cotización. */
  amountUsdt: number;
  activatesNow: boolean;
  account: BinanceReceivingAccount;
  plan: PlanCode;
  planVersion: number | null;
  receiptRequired: boolean;
}

/** `GET /api/admin/payment-setup` — con qué se puede cobrar en este entorno. */
export interface PaymentSetupStatus {
  card: boolean;
  pagoMovil: boolean;
  transferencia: boolean;
  binance: boolean;
  receipts: boolean;
}

/** Lo que se acepta como comprobante del pago en Bs, con la extensión con la que se guarda. */
export const SUBSCRIPTION_RECEIPT_EXTENSIONS: Readonly<Record<string, string>> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export interface SubscriptionReceipt {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  /** URL firmada, de vida corta. `null` si el storage no la pudo firmar. */
  url: string | null;
}

/** Un pago de la suscripción, como lo ve su dueño. */
export interface SubscriptionPaymentSummary {
  id: string;
  method: SubscriptionPaymentMethod;
  status: SubscriptionPaymentStatus;
  periodStart: string;
  periodEnd: string;
  activatesNow: boolean;
  lines: ChargeLine[];
  totalUsd: number;
  bcvRate: number | null;
  rateValueDate: string | null;
  amountBs: number | null;
  declaredAmountBs: number | null;
  /** Sólo en Binance: lo que dice haber enviado. Se contrasta con `totalUsd`. */
  declaredAmountUsdt: number | null;
  /**
   * Lo que dice haber pagado se aleja más de un 1% de lo cotizado. No rechaza
   * nada solo: le avisa a quien revisa que mire con cuidado.
   */
  amountMismatch: boolean;
  bank: string | null;
  reference: string | null;
  payerId: string | null;
  paidOn: string | null;
  receipt: SubscriptionReceipt | null;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

/** El mismo pago en la cola del admin: de qué Empresa es y quién paga. */
export interface AdminSubscriptionPayment extends SubscriptionPaymentSummary {
  organization: { id: string; name: string };
  owner: { id: string; name: string; email: string } | null;
}

/**
 * `GET /api/subscription/me`: el resumen más cómo puede pagar.
 *
 * `card.status` es lo último que informó Stripe (`null` si nunca cargó
 * tarjeta). `card.manageable` = tiene cliente en Stripe, así que el portal
 * (cambiar tarjeta, facturas, baja) tiene algo que mostrar.
 */
export interface SubscriptionOverview extends SubscriptionSummary {
  paymentOptions: { card: boolean; bolivares: boolean; binance: boolean };
  card: { status: StripeSubscriptionStatus | null; manageable: boolean };
}

/**
 * `POST /api/subscription/stripe/checkout`: cómo se abre el pago con tarjeta.
 *
 * - `embedded`: el formulario de Stripe se monta en un modal de Luma, con
 *   Stripe.js y la publishable key.
 * - `hosted`: la página de Stripe, en otra pestaña de navegación. Es lo que
 *   queda cuando el servidor no tiene `STRIPE_PUBLISHABLE_KEY`.
 */
export type StripeCheckoutStart =
  | { mode: 'embedded'; clientSecret: string; publishableKey: string }
  | { mode: 'hosted'; url: string };

/** Una lectura de la tasa, como la ve el admin. */
export interface ExchangeRateRecord {
  id: string;
  source: 'bcv' | 'manual';
  usd: number;
  eur: number | null;
  valueDate: string;
  fetchedAt: string;
  lastSeenAt: string;
  /** Saltó demasiado contra la anterior: se guardó pero no se usa. */
  flagged: boolean;
  flagReason: string | null;
}

/** `GET /api/admin/exchange-rates`. */
export interface ExchangeRatesResponse {
  current: BcvRate | null;
  rates: ExchangeRateRecord[];
}
