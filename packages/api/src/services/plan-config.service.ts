import {
  DEFAULT_PLAN_CONFIG,
  DEFAULT_PLAN_VERSION,
  LEGACY_PLAN_CONFIG,
  type PlanCatalog,
  type PlanCode,
  type PlanConfig,
  type PlanVersionSummary,
  type PricingSource,
  type PublishPlanConfigInput,
} from '@luma/shared';
import { STRIPE_CONFIG } from '../config/app.config.js';
import { PlanVersion, type IPlanVersion } from '../models/PlanVersion.js';
import { conflict } from '../utils/errors.js';

/**
 * El catálogo de precios: qué lista está vigente y cuál rige cada cobro.
 *
 * Con la tarjeta activa rige lo de antes del catálogo y no se publica: los
 * precios de Stripe todavía no lo siguen, y los dos medios de pago tienen que
 * cobrar lo mismo.
 */

export interface ResolvedPlan {
  version: number | null;
  config: PlanConfig;
}

type PlanVersionFields = Pick<IPlanVersion, 'version' | 'config' | 'note' | 'createdAt'>;

function toSummary(doc: PlanVersionFields): PlanVersionSummary {
  return {
    version: doc.version,
    config: doc.config,
    note: doc.note ?? null,
    createdAt: doc.createdAt.toISOString(),
  };
}

const FACTORY_VERSION: PlanVersionSummary = {
  version: DEFAULT_PLAN_VERSION,
  config: DEFAULT_PLAN_CONFIG,
  note: null,
  createdAt: null,
};

export async function currentPlan(): Promise<ResolvedPlan> {
  if (STRIPE_CONFIG.ENABLED) return { version: null, config: LEGACY_PLAN_CONFIG };
  const latest = await PlanVersion.findOne().sort({ version: -1 }).lean<PlanVersionFields>();
  return latest
    ? { version: latest.version, config: latest.config }
    : { version: DEFAULT_PLAN_VERSION, config: DEFAULT_PLAN_CONFIG };
}

/** La lista de una versión ya pagada. `null`: de antes del catálogo. */
export async function configForVersion(version: number | null | undefined): Promise<PlanConfig> {
  if (version === null || version === undefined) return LEGACY_PLAN_CONFIG;
  if (version === DEFAULT_PLAN_VERSION) return DEFAULT_PLAN_CONFIG;
  const found = await PlanVersion.findOne({ version }).lean<PlanVersionFields>();
  return found?.config ?? (await currentPlan()).config;
}

export interface ResolvedPricing extends ResolvedPlan {
  plan: PlanCode;
}

/** De la regla (`pricingFor`, en shared) a la lista concreta. */
export async function resolvePricing(source: PricingSource): Promise<ResolvedPricing> {
  const resolved =
    source.version === 'current'
      ? await currentPlan()
      : { version: source.version, config: await configForVersion(source.version) };

  if (source.plan === 'unlimited' && resolved.config.unlimitedPriceUsd === null) {
    throw conflict('El plan Ilimitado no está disponible en este momento.');
  }
  return { ...resolved, plan: source.plan };
}

export async function planCatalog(): Promise<PlanCatalog> {
  const [published, current] = await Promise.all([
    PlanVersion.find().sort({ version: -1 }).limit(50).lean<PlanVersionFields[]>(),
    currentPlan(),
  ]);
  const history = [...published.map(toSummary), FACTORY_VERSION];
  const shown = history.find((entry) => entry.version === current.version);

  return {
    // Con la tarjeta activa rige una lista que no está en el historial.
    current: shown ?? { version: 0, config: current.config, note: null, createdAt: null },
    history,
    publishBlocked: STRIPE_CONFIG.ENABLED,
  };
}

export async function publishPlanConfig(
  input: PublishPlanConfigInput,
  adminId: string,
): Promise<PlanVersionSummary> {
  if (STRIPE_CONFIG.ENABLED) {
    throw conflict('Con la tarjeta activa todavía no se pueden publicar precios nuevos.');
  }

  const current = await currentPlan();
  if (input.expectedVersion !== current.version) {
    throw conflict('Otra persona publicó una lista mientras editabas. Recarga para ver la vigente.');
  }

  try {
    const created = await PlanVersion.create({
      version: (current.version ?? DEFAULT_PLAN_VERSION) + 1,
      config: input.config,
      note: input.note || null,
      createdBy: adminId,
    });
    return toSummary(created);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw conflict('Otra persona publicó una lista mientras editabas. Recarga para ver la vigente.');
    }
    throw error;
  }
}
