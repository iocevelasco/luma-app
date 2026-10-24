import mongoose from 'mongoose';
import {
  PLAN,
  activeProjectsAt,
  billableWindows,
  canCreateProject,
  effectiveTrialEnd,
  nextPeriodStart,
  quoteCharge,
  startTrial,
  subscriptionState,
  type BillableProject,
  type CreateProjectDecision,
  type PaidPeriodFact,
  type SubscriptionFacts,
  type SubscriptionState,
  type SubscriptionSummary,
} from '@luma/shared';
import { OrganizationMember } from '../models/OrganizationMember.js';
import { Project } from '../models/Project.js';
import { Subscription, type ISubscription } from '../models/Subscription.js';
import { SubscriptionPayment, type ISubscriptionPayment } from '../models/SubscriptionPayment.js';

/**
 * Puente entre la base y las reglas de `@luma/shared/billing`.
 *
 * Acá sólo se LEEN hechos y se le pregunta a shared qué significan. Ninguna
 * regla de negocio vive en este archivo: si te encontrás escribiendo un `if`
 * sobre días de prueba o cantidad de obras, va en shared, con su test.
 */

type OrgId = mongoose.Types.ObjectId | string;

function toFacts(
  subscription: ISubscription | null,
  payments: Pick<
    ISubscriptionPayment,
    'periodStart' | 'periodEnd' | 'status' | 'submittedAt' | 'lines'
  >[],
): SubscriptionFacts {
  const periods: PaidPeriodFact[] = payments.map((p) => ({
    start: p.periodStart,
    end: p.periodEnd,
    status: p.status,
    submittedAt: p.submittedAt,
    prepaidExtras: (p.lines ?? [])
      .filter((line) => line.kind === 'extra')
      .reduce((sum, line) => sum + line.quantity, 0),
  }));

  if (!subscription) {
    return { trialStartedAt: null, trialEndsAt: null, periods };
  }

  return {
    trialStartedAt: subscription.trialStartedAt,
    trialEndsAt: subscription.trialEndsAt,
    trialEndedEarlyAt: subscription.trialEndedEarlyAt,
    periods,
    stripe:
      subscription.stripeStatus &&
      subscription.stripeCurrentPeriodStart &&
      subscription.stripeCurrentPeriodEnd
        ? {
            status: subscription.stripeStatus,
            currentPeriodStart: subscription.stripeCurrentPeriodStart,
            currentPeriodEnd: subscription.stripeCurrentPeriodEnd,
          }
        : null,
  };
}

/** Los pagos que pueden cubrir algo. Los rechazados no cuentan para nada. */
const LIVE_PAYMENTS = { status: { $in: ['pendiente', 'aprobado'] } };

export async function loadFacts(organizationId: OrgId): Promise<SubscriptionFacts> {
  const [subscription, payments] = await Promise.all([
    Subscription.findOne({ organization: organizationId }),
    SubscriptionPayment.find({ organization: organizationId, ...LIVE_PAYMENTS }).select(
      'periodStart periodEnd status submittedAt lines',
    ),
  ]);
  return toFacts(subscription, payments);
}

export async function stateFor(
  organizationId: OrgId,
  now: Date = new Date(),
): Promise<SubscriptionState> {
  return subscriptionState(await loadFacts(organizationId), now);
}

/**
 * El estado de varias Empresas con dos consultas, no 2×N. Lo usa el listado
 * de obras, donde cada obra puede ser de una Empresa distinta (las obras a
 * las que me invitaron son de otros).
 */
export async function statesFor(
  organizationIds: OrgId[],
  now: Date = new Date(),
): Promise<Map<string, SubscriptionState>> {
  const ids = [...new Set(organizationIds.map(String))];
  const [subscriptions, payments] = await Promise.all([
    Subscription.find({ organization: { $in: ids } }),
    SubscriptionPayment.find({ organization: { $in: ids }, ...LIVE_PAYMENTS }).select(
      'organization periodStart periodEnd status submittedAt lines',
    ),
  ]);

  const subByOrg = new Map(subscriptions.map((s) => [String(s.organization), s]));
  const states = new Map<string, SubscriptionState>();
  for (const id of ids) {
    const own = payments.filter((p) => String(p.organization) === id);
    states.set(id, subscriptionState(toFacts(subByOrg.get(id) ?? null, own), now));
  }
  return states;
}

/**
 * Arranca la prueba de una Empresa. Idempotente: si ya tenía suscripción no
 * la toca — una prueba no se reinicia nunca, ni por un doble click ni por
 * correr la migración dos veces.
 */
export async function startTrialFor(
  organizationId: OrgId,
  ownerId: OrgId,
  now: Date = new Date(),
): Promise<void> {
  const { trialStartedAt, trialEndsAt } = startTrial(now);
  await Subscription.updateOne(
    { organization: organizationId },
    { $setOnInsert: { organization: organizationId, owner: ownerId, trialStartedAt, trialEndsAt } },
    { upsert: true },
  );
}

/**
 * Las obras de la Empresa como las ve la facturación: cuándo nacieron y cuándo
 * dejaron de estar activas, **incluidas las que están en la papelera**.
 *
 * Una obra eliminada no desaparece de acá: su tramo se cierra al eliminarla, y
 * lo que ya usó se cobra (regla 8 de `@luma/shared/billing`). Y una restaurada
 * es un tramo nuevo desde el día que volvió. Pedirlas aparte —y nombrando
 * `deletedAt`— es lo que hace que el hook de `Project` no las esconda.
 */
export async function billableProjects(organizationId: OrgId): Promise<BillableProject[]> {
  const select = '_id createdAt archivedAt deletedAt trashedPeriods';
  const [live, trashed] = await Promise.all([
    Project.find({ organization: organizationId }).select(select),
    Project.find({ organization: organizationId, deletedAt: { $ne: null } }).select(select),
  ]);
  return [...live, ...trashed].flatMap((p) =>
    billableWindows({
      id: String(p._id),
      createdAt: p.createdAt,
      archivedAt: p.archivedAt ?? null,
      deletedAt: p.deletedAt ?? null,
      trashedPeriods: p.trashedPeriods ?? [],
    }),
  );
}

/**
 * ¿Puede esta Empresa sumar una obra más —crear una o restaurar una—? Sólo
 * mira: no arranca ninguna prueba. Lo usa la papelera para avisar de antemano
 * si restaurar se va a cobrar como extra.
 */
export async function previewProjectCreation(
  organizationId: OrgId,
  now: Date = new Date(),
): Promise<CreateProjectDecision> {
  const [facts, projects] = await Promise.all([
    loadFacts(organizationId),
    billableProjects(organizationId),
  ]);
  return canCreateProject(subscriptionState(facts, now), activeProjectsAt(projects, now));
}

/**
 * ¿Puede esta Empresa crear una obra más? Si es su primera y nunca empezó la
 * prueba (un invitado), se la arranca acá: es la regla C.
 */
export async function decideProjectCreation(
  organizationId: OrgId,
  ownerId: OrgId,
  now: Date = new Date(),
): Promise<CreateProjectDecision> {
  const decision = await previewProjectCreation(organizationId, now);

  if (decision.allowed && decision.startsTrial) {
    await startTrialFor(organizationId, ownerId, now);
  }
  return decision;
}

/** El período pago que termina justo donde arranca el próximo, si lo hay. Para el prorrateo. */
export function previousPaidPeriod(
  facts: SubscriptionFacts,
  periodStart: Date,
): { start: Date; end: Date; prepaidExtras?: number } | null {
  const t = periodStart.getTime();
  const approved = facts.periods.find((p) => p.status === 'aprobado' && p.end.getTime() === t);
  if (approved) {
    return { start: approved.start, end: approved.end, prepaidExtras: approved.prepaidExtras };
  }
  if (facts.stripe && facts.stripe.currentPeriodEnd.getTime() === t) {
    return { start: facts.stripe.currentPeriodStart, end: facts.stripe.currentPeriodEnd };
  }
  return null;
}

/**
 * Una Empresa con obras y sin suscripción: la tenía de antes del sistema de
 * suscripción y no pasó por `migrate-subscriptions`. Recibe lo mismo que le
 * habría dado la migración —el mes gratis desde hoy— en vez de un "tu prueba
 * arranca con tu primera obra" a quien ya tiene obras.
 */
async function healMissingTrial(organizationId: OrgId, now: Date): Promise<boolean> {
  const owner = await OrganizationMember.findOne({
    organization: organizationId,
    role: 'owner',
  }).select('user');
  if (!owner) return false;
  await startTrialFor(organizationId, owner.user, now);
  return true;
}

/** Todo lo que la pantalla de Suscripción necesita, de una vez. */
export async function summaryFor(
  organizationId: OrgId,
  now: Date = new Date(),
): Promise<SubscriptionSummary> {
  const projects = await billableProjects(organizationId);
  let facts = await loadFacts(organizationId);
  let state = subscriptionState(facts, now);

  if (state.status === 'sin_iniciar' && activeProjectsAt(projects, now) > 0) {
    if (await healMissingTrial(organizationId, now)) {
      facts = await loadFacts(organizationId);
      state = subscriptionState(facts, now);
    }
  }

  let nextCharge = null;
  if (state.status !== 'sin_iniciar') {
    const periodStart = nextPeriodStart(facts, now);
    nextCharge = quoteCharge({
      periodStart,
      projects,
      previousPeriod: previousPaidPeriod(facts, periodStart),
    });
  }

  return {
    status: state.status,
    canWrite: state.canWrite,
    accessUntil: state.accessUntil?.toISOString() ?? null,
    // El fin efectivo: si se cortó para crear la cuarta obra, ése.
    trialEndsAt: effectiveTrialEnd(facts)?.toISOString() ?? null,
    trialDaysLeft: state.trialDaysLeft,
    activeProjects: activeProjectsAt(projects, now),
    includedProjects: PLAN.includedProjects,
    nextCharge,
  };
}
