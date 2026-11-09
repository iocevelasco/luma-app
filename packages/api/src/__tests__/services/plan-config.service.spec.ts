import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PLAN_CONFIG, LEGACY_PLAN_CONFIG } from '@luma/shared';

const stripe = vi.hoisted(() => ({ ENABLED: false }));

vi.mock('../../config/app.config.js', () => ({ STRIPE_CONFIG: stripe }));
vi.mock('../../models/PlanVersion.js', () => ({
  PlanVersion: { findOne: vi.fn(), find: vi.fn(), create: vi.fn() },
}));

const { PlanVersion } = await import('../../models/PlanVersion.js');
const svc = await import('../../services/plan-config.service.js');

const PUBLISHED = {
  version: 3,
  config: { ...DEFAULT_PLAN_CONFIG, basePriceUsd: 45 },
  note: null,
  createdAt: new Date('2026-11-01T00:00:00.000Z'),
};

/** `findOne().sort().lean()` y `findOne().lean()`. */
function latestIs(doc: unknown) {
  const lean = vi.fn().mockResolvedValue(doc);
  vi.mocked(PlanVersion.findOne).mockReturnValue({ sort: () => ({ lean }), lean } as never);
}

describe('plan-config.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stripe.ENABLED = false;
  });

  it('sin nada publicado rige la lista de fábrica', async () => {
    latestIs(null);
    await expect(svc.currentPlan()).resolves.toEqual({ version: 1, config: DEFAULT_PLAN_CONFIG });
  });

  it('rige la última versión publicada', async () => {
    latestIs(PUBLISHED);
    await expect(svc.currentPlan()).resolves.toEqual({ version: 3, config: PUBLISHED.config });
  });

  it('con la tarjeta activa rige lo de antes: los dos medios cobran igual', async () => {
    stripe.ENABLED = true;
    await expect(svc.currentPlan()).resolves.toEqual({ version: null, config: LEGACY_PLAN_CONFIG });
    expect(PlanVersion.findOne).not.toHaveBeenCalled();
  });

  it('un pago de antes del catálogo sigue con su precio', async () => {
    await expect(svc.configForVersion(null)).resolves.toBe(LEGACY_PLAN_CONFIG);
    await expect(svc.configForVersion(1)).resolves.toBe(DEFAULT_PLAN_CONFIG);
  });

  it('no cotiza Ilimitado con una lista que no lo ofrece', async () => {
    await expect(svc.resolvePricing({ plan: 'unlimited', version: null })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('publicar crea la versión siguiente y no toca la anterior', async () => {
    latestIs(null);
    vi.mocked(PlanVersion.create).mockImplementation((async (doc: Record<string, unknown>) => ({
      ...doc,
      createdAt: new Date(),
    })) as never);

    const published = await svc.publishPlanConfig(
      { config: PUBLISHED.config, expectedVersion: 1, note: 'Sube Pro' },
      'admin-1',
    );

    expect(published.version).toBe(2);
    expect(PlanVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ version: 2, createdBy: 'admin-1', note: 'Sube Pro' }),
    );
  });

  it('dos admins no se pisan', async () => {
    latestIs(PUBLISHED);
    await expect(
      svc.publishPlanConfig({ config: PUBLISHED.config, expectedVersion: 1 }, 'admin-1'),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(PlanVersion.create).not.toHaveBeenCalled();
  });

  it('con la tarjeta activa no se publica', async () => {
    stripe.ENABLED = true;
    await expect(
      svc.publishPlanConfig({ config: PUBLISHED.config, expectedVersion: null }, 'admin-1'),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(PlanVersion.create).not.toHaveBeenCalled();
  });
});
