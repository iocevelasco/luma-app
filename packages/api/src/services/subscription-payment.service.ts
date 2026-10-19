import mongoose from 'mongoose';
import {
  addMonths,
  nextPeriodStart,
  quoteCharge,
  subscriptionState,
  usdToBolivares,
  type AdminSubscriptionPayment,
  type BolivaresPaymentInput,
  type BolivaresQuote,
  type BolivaresReceivingAccounts,
  type ChargeQuote,
  type SubscriptionPaymentSummary,
} from '@luma/shared';
import { BS_PAYMENT_CONFIG } from '../config/app.config.js';
import { Organization } from '../models/Organization.js';
import { Subscription } from '../models/Subscription.js';
import {
  SubscriptionPayment,
  type IReceipt,
  type ISubscriptionPayment,
} from '../models/SubscriptionPayment.js';
import { User } from '../models/User.js';
import { badRequest, conflict, notFound, serviceUnavailable } from '../utils/errors.js';
import { currentRate } from './bcv.service.js';
import { deleteObject, signObjectUrl } from './storage.service.js';
import { billableProjects, loadFacts, previousPaidPeriod } from './subscription.service.js';

/**
 * Pagos de la suscripción en bolívares: cotizar, registrar y revisar.
 *
 * Las cuentas (cuánto, desde cuándo, qué obras) son de `@luma/shared/billing`;
 * acá se congelan en un registro y se decide el período al aprobar.
 */

type OrgId = mongoose.Types.ObjectId | string;

/** Diferencia entre lo cotizado y lo que dice haber pagado que ya amerita mirar. */
const AMOUNT_TOLERANCE = 0.01;

export function receivingAccounts(): BolivaresReceivingAccounts {
  return {
    ...(BS_PAYMENT_CONFIG.PAGO_MOVIL ? { pagoMovil: BS_PAYMENT_CONFIG.PAGO_MOVIL } : {}),
    ...(BS_PAYMENT_CONFIG.TRANSFERENCIA ? { transferencia: BS_PAYMENT_CONFIG.TRANSFERENCIA } : {}),
  };
}

/**
 * Lo que se cobra si paga ahora, en dólares.
 *
 * - Normal: el próximo período, que arranca cuando termina lo ya cubierto
 *   (prueba incluida) — pagar antes no pierde días.
 * - `activateNow`: sólo desde la prueba, para crear la cuarta obra. Arranca
 *   hoy, con base + extras completas y sin prorrateo; la cuarta, que todavía
 *   no existe, ya va cobrada.
 */
export async function chargeFor(
  organizationId: OrgId,
  activateNow: boolean,
  now: Date = new Date(),
): Promise<ChargeQuote> {
  const [facts, projects] = await Promise.all([
    loadFacts(organizationId),
    billableProjects(organizationId),
  ]);
  const state = subscriptionState(facts, now);

  if (state.status === 'sin_iniciar') {
    throw badRequest('Tu mes gratis arranca con tu primera obra: todavía no hay nada que pagar.');
  }

  if (activateNow) {
    if (state.status !== 'prueba') {
      throw badRequest('Activar el plan antes de tiempo sólo tiene sentido durante el mes gratis.');
    }
    const withNext = [...projects, { id: 'proxima-obra', createdAt: now, archivedAt: null }];
    return quoteCharge({ periodStart: now, projects: withNext, previousPeriod: null });
  }

  const periodStart = nextPeriodStart(facts, now);
  return quoteCharge({
    periodStart,
    projects,
    previousPeriod: previousPaidPeriod(facts, periodStart),
  });
}

/** La cotización completa en bolívares, con la tasa vigente y dónde pagar. */
export async function bolivaresQuote(
  organizationId: OrgId,
  activateNow: boolean,
  now: Date = new Date(),
): Promise<BolivaresQuote> {
  const accounts = receivingAccounts();
  if (!accounts.pagoMovil && !accounts.transferencia) {
    throw serviceUnavailable('El pago en bolívares todavía no está habilitado.');
  }

  const rate = await currentRate(now);
  if (!rate || rate.stale) {
    throw serviceUnavailable(
      'No tenemos una tasa BCV actualizada en este momento. Probá en unas horas o pagá con tarjeta.',
    );
  }

  const quote = await chargeFor(organizationId, activateNow, now);
  return {
    quote,
    rate,
    amountBs: usdToBolivares(quote.totalUsd, rate.usd),
    activatesNow: activateNow,
    accounts,
  };
}

/** "  banco de venezuela " → "BANCO DE VENEZUELA". Así la referencia repetida se detecta igual. */
export function normalizeBank(bank: string): string {
  return bank.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Registra un pago en Bs como `pendiente`. Cotiza de nuevo en el servidor —lo
 * que mandó el cliente es sólo lo que dice haber pagado— y congela tasa,
 * desglose y monto.
 *
 * `uploadReceipt` sube el comprobante y se llama recién cuando todo lo demás
 * validó: al revés, un pago rechazado deja un archivo huérfano.
 */
export async function submitBolivaresPayment(params: {
  organizationId: OrgId;
  userId: string;
  input: BolivaresPaymentInput;
  uploadReceipt?: () => Promise<IReceipt>;
  now?: Date;
}): Promise<ISubscriptionPayment> {
  const now = params.now ?? new Date();
  const { input } = params;

  const pending = await SubscriptionPayment.exists({
    organization: params.organizationId,
    status: 'pendiente',
  });
  if (pending) {
    throw conflict('Ya tenés un pago en revisión. Esperá a que lo revisemos antes de mandar otro.');
  }

  const { quote, rate, amountBs } = await bolivaresQuote(
    params.organizationId,
    input.activateNow,
    now,
  );

  const receipt = params.uploadReceipt ? await params.uploadReceipt() : null;

  try {
    return await SubscriptionPayment.create({
      organization: params.organizationId,
      method: input.method,
      status: 'pendiente',
      periodStart: new Date(quote.periodStart),
      periodEnd: new Date(quote.periodEnd),
      activatesNow: input.activateNow,
      lines: quote.lines,
      totalUsd: quote.totalUsd,
      bcvRate: rate.usd,
      rateValueDate: rate.valueDate,
      amountBs,
      declaredAmountBs: input.amountBs,
      bank: normalizeBank(input.bank),
      reference: input.reference,
      payerId: input.payerId,
      paidOn: input.paidOn,
      receipt,
      submittedBy: params.userId,
      submittedAt: now,
    });
  } catch (error) {
    if (receipt) await deleteObject(receipt.key).catch(() => undefined);
    if ((error as { code?: number }).code === 11000) {
      throw conflict('Esa referencia de ese banco ya está registrada en otro pago.');
    }
    throw error;
  }
}

/**
 * Un admin aprueba o rechaza. Sólo un pago `pendiente`: revisar dos veces el
 * mismo (dos pestañas, un doble click) no puede aprobarlo dos veces.
 *
 * Al aprobar se fija el período definitivo:
 * - `activatesNow` todavía en prueba: arranca HOY (no al mandarlo: los días
 *   que tardó la revisión los siguió teniendo gratis) y la prueba termina acá.
 * - El resto: encadenado a lo que ya estaba cubierto cuando lo mandó. Si
 *   entretanto se aprobó otro pago, va a continuación y no se pisan.
 */
export async function reviewSubscriptionPayment(params: {
  paymentId: string;
  adminId: string;
  decision: { decision: 'aprobar' } | { decision: 'rechazar'; reason: string };
  now?: Date;
}): Promise<ISubscriptionPayment> {
  const now = params.now ?? new Date();
  if (!mongoose.isValidObjectId(params.paymentId)) throw notFound('No encontramos ese pago.');

  const payment = await SubscriptionPayment.findById(params.paymentId);
  if (!payment) throw notFound('No encontramos ese pago.');
  if (payment.status !== 'pendiente') {
    throw conflict(`Ese pago ya fue ${payment.status}.`);
  }

  const reviewed = { reviewedBy: params.adminId, reviewedAt: now };

  if (params.decision.decision === 'rechazar') {
    return updateIfStillPending(payment._id, {
      ...reviewed,
      status: 'rechazado',
      rejectionReason: params.decision.reason,
    });
  }

  const facts = await loadFacts(payment.organization);
  // Los hechos SIN este pago, que si no se encadenaría consigo mismo. Alcanza
  // con sacar los pendientes: una Empresa tiene uno solo a la vez (lo frena
  // `submitBolivaresPayment`), y es éste.
  const others = { ...facts, periods: facts.periods.filter((p) => p.status !== 'pendiente') };
  const stillInTrial = subscriptionState(others, now).status === 'prueba';

  let periodStart: Date;
  if (payment.activatesNow && stillInTrial) {
    periodStart = now;
    await Subscription.updateOne(
      { organization: payment.organization, trialEndedEarlyAt: null },
      { $set: { trialEndedEarlyAt: now } },
    );
  } else {
    periodStart = nextPeriodStart(others, payment.submittedAt);
  }

  return updateIfStillPending(payment._id, {
    ...reviewed,
    status: 'aprobado',
    periodStart,
    periodEnd: addMonths(periodStart, 1),
  });
}

async function updateIfStillPending(
  id: mongoose.Types.ObjectId | unknown,
  update: Record<string, unknown>,
): Promise<ISubscriptionPayment> {
  const updated = await SubscriptionPayment.findOneAndUpdate(
    { _id: id, status: 'pendiente' },
    { $set: update },
    { new: true },
  );
  if (!updated) throw conflict('Otra persona revisó este pago al mismo tiempo.');
  return updated;
}

// ─────────────────────────────── DTOs ───────────────────────────────

export function hasAmountMismatch(payment: ISubscriptionPayment): boolean {
  if (payment.amountBs == null || payment.declaredAmountBs == null) return false;
  return Math.abs(payment.declaredAmountBs - payment.amountBs) / payment.amountBs > AMOUNT_TOLERANCE;
}

export async function toPaymentSummary(
  payment: ISubscriptionPayment,
): Promise<SubscriptionPaymentSummary> {
  return {
    id: String(payment._id),
    method: payment.method,
    status: payment.status,
    periodStart: payment.periodStart.toISOString(),
    periodEnd: payment.periodEnd.toISOString(),
    activatesNow: payment.activatesNow,
    // Campo por campo: un spread de un subdocumento de Mongoose arrastra su
    // maquinaria interna (`$__parent`, `__parentArray`…) hasta el JSON.
    lines: payment.lines.map((line) => ({
      kind: line.kind,
      quantity: line.quantity,
      unitUsd: line.unitUsd,
      amountUsd: line.amountUsd,
      ...(line.projectId ? { projectId: line.projectId } : {}),
      ...(line.days != null ? { days: line.days } : {}),
    })),
    totalUsd: payment.totalUsd,
    bcvRate: payment.bcvRate,
    rateValueDate: payment.rateValueDate,
    amountBs: payment.amountBs,
    declaredAmountBs: payment.declaredAmountBs,
    amountMismatch: hasAmountMismatch(payment),
    bank: payment.bank,
    reference: payment.reference,
    payerId: payment.payerId,
    paidOn: payment.paidOn,
    receipt: payment.receipt
      ? {
          fileName: payment.receipt.fileName,
          contentType: payment.receipt.contentType,
          sizeBytes: payment.receipt.sizeBytes,
          url: await signObjectUrl(payment.receipt.key).catch(() => null),
        }
      : null,
    submittedAt: payment.submittedAt.toISOString(),
    reviewedAt: payment.reviewedAt?.toISOString() ?? null,
    rejectionReason: payment.rejectionReason,
  };
}

/** Para la cola del admin: cada pago con su Empresa y su dueño, en tres consultas. */
export async function toAdminPayments(
  payments: ISubscriptionPayment[],
): Promise<AdminSubscriptionPayment[]> {
  const orgIds = [...new Set(payments.map((p) => String(p.organization)))];
  const [organizations, subscriptions] = await Promise.all([
    Organization.find({ _id: { $in: orgIds } }).select('name'),
    Subscription.find({ organization: { $in: orgIds } }).select('organization owner'),
  ]);
  const owners = await User.find({ _id: { $in: subscriptions.map((s) => s.owner) } }).select(
    'name email',
  );

  const orgById = new Map(organizations.map((o) => [String(o._id), o]));
  const ownerByOrg = new Map(
    subscriptions.map((s) => [
      String(s.organization),
      owners.find((u) => String(u._id) === String(s.owner)),
    ]),
  );

  return Promise.all(
    payments.map(async (payment) => {
      const orgId = String(payment.organization);
      const owner = ownerByOrg.get(orgId);
      return {
        ...(await toPaymentSummary(payment)),
        organization: { id: orgId, name: orgById.get(orgId)?.name ?? '—' },
        owner: owner ? { id: String(owner._id), name: owner.name, email: owner.email } : null,
      };
    }),
  );
}
