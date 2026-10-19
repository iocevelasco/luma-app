import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubscriptionFacts } from '@luma/shared';

vi.mock('../../config/app.config.js', () => ({
  BS_PAYMENT_CONFIG: {
    PAGO_MOVIL: { bank: 'Banesco', phone: '0414-0000000', id: 'J-12345678-9' },
    TRANSFERENCIA: undefined,
  },
}));
vi.mock('../../models/SubscriptionPayment.js', () => ({
  SubscriptionPayment: {
    exists: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));
vi.mock('../../models/Subscription.js', () => ({ Subscription: { updateOne: vi.fn() } }));
vi.mock('../../models/Organization.js', () => ({ Organization: { find: vi.fn() } }));
vi.mock('../../models/User.js', () => ({ User: { find: vi.fn() } }));
vi.mock('../../services/bcv.service.js', () => ({ currentRate: vi.fn() }));
vi.mock('../../services/storage.service.js', () => ({
  deleteObject: vi.fn().mockResolvedValue(undefined),
  signObjectUrl: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../services/subscription.service.js', () => ({
  loadFacts: vi.fn(),
  billableProjects: vi.fn(),
  previousPaidPeriod: vi.fn().mockReturnValue(null),
}));

const { SubscriptionPayment } = await import('../../models/SubscriptionPayment.js');
const { Subscription } = await import('../../models/Subscription.js');
const { currentRate } = await import('../../services/bcv.service.js');
const { deleteObject } = await import('../../services/storage.service.js');
const { loadFacts, billableProjects } = await import('../../services/subscription.service.js');
const svc = await import('../../services/subscription-payment.service.js');

const d = (iso: string) => new Date(iso);
const NOW = d('2026-10-20T15:00:00.000Z');
const RATE = { usd: 881.8769, valueDate: '2026-10-20', source: 'bcv', lastSeenAt: '', stale: false };

const trialFacts: SubscriptionFacts = {
  trialStartedAt: d('2026-10-10T00:00:00.000Z'),
  trialEndsAt: d('2026-11-09T00:00:00.000Z'),
  trialEndedEarlyAt: null,
  periods: [],
  stripe: null,
};

function threeProjects() {
  return ['a', 'b', 'c'].map((id) => ({
    id,
    createdAt: d('2026-10-11T00:00:00.000Z'),
    archivedAt: null,
  }));
}

const input = {
  method: 'pago_movil' as const,
  bank: '  banco de   venezuela ',
  reference: '00123456',
  payerId: 'V-12345678',
  paidOn: '2026-10-20',
  amountBs: 34393.2,
  activateNow: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(currentRate).mockResolvedValue(RATE as never);
  vi.mocked(loadFacts).mockResolvedValue(trialFacts);
  vi.mocked(billableProjects).mockResolvedValue(threeProjects());
  vi.mocked(SubscriptionPayment.exists).mockResolvedValue(null as never);
  vi.mocked(SubscriptionPayment.create).mockImplementation((doc) => Promise.resolve(doc) as never);
});

describe('bolivaresQuote', () => {
  it('en prueba, cotiza el período que arranca al terminar la prueba, a la tasa vigente', async () => {
    const q = await svc.bolivaresQuote('org-1', false, NOW);
    expect(q.quote.periodStart).toBe('2026-11-09T00:00:00.000Z');
    expect(q.quote.totalUsd).toBe(39);
    expect(q.amountBs).toBe(34393.2);
    expect(q.accounts.pagoMovil?.bank).toBe('Banesco');
    expect(q.accounts.transferencia).toBeUndefined();
  });

  it('activar ya, desde la prueba con 3 obras: arranca hoy con la cuarta incluida', async () => {
    const q = await svc.bolivaresQuote('org-1', true, NOW);
    expect(q.quote.periodStart).toBe(NOW.toISOString());
    expect(q.quote.totalUsd).toBe(47);
    expect(q.activatesNow).toBe(true);
  });

  it('sin tasa vigente no cotiza: el pago en Bs se pausa', async () => {
    vi.mocked(currentRate).mockResolvedValue({ ...RATE, stale: true } as never);
    await expect(svc.bolivaresQuote('org-1', false, NOW)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('activar ya fuera de la prueba no tiene sentido', async () => {
    vi.mocked(loadFacts).mockResolvedValue({ ...trialFacts, trialEndsAt: d('2026-10-15T00:00:00Z') });
    await expect(svc.bolivaresQuote('org-1', true, NOW)).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

describe('submitBolivaresPayment', () => {
  it('congela tasa, desglose y monto cotizados por el servidor, y normaliza el banco', async () => {
    const payment = await svc.submitBolivaresPayment({
      organizationId: 'org-1',
      userId: 'user-1',
      input,
      now: NOW,
    });
    expect(payment).toMatchObject({
      status: 'pendiente',
      bcvRate: 881.8769,
      amountBs: 34393.2,
      declaredAmountBs: 34393.2,
      totalUsd: 39,
      bank: 'BANCO DE VENEZUELA',
      submittedAt: NOW,
    });
  });

  it('con otro pago en revisión no deja mandar un segundo', async () => {
    vi.mocked(SubscriptionPayment.exists).mockResolvedValue({ _id: 'x' } as never);
    await expect(
      svc.submitBolivaresPayment({ organizationId: 'org-1', userId: 'user-1', input, now: NOW }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(SubscriptionPayment.create).not.toHaveBeenCalled();
  });

  it('referencia repetida: conflicto, y el comprobante ya subido se borra', async () => {
    vi.mocked(SubscriptionPayment.create).mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    const uploadReceipt = vi.fn().mockResolvedValue({
      key: 'file-1',
      fileName: 'pago.png',
      contentType: 'image/png',
      sizeBytes: 10,
    });

    await expect(
      svc.submitBolivaresPayment({ organizationId: 'org-1', userId: 'user-1', input, uploadReceipt, now: NOW }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(deleteObject).toHaveBeenCalledWith('file-1');
  });

  it('el comprobante se sube recién después de validar todo', async () => {
    vi.mocked(SubscriptionPayment.exists).mockResolvedValue({ _id: 'x' } as never);
    const uploadReceipt = vi.fn();
    await expect(
      svc.submitBolivaresPayment({ organizationId: 'org-1', userId: 'user-1', input, uploadReceipt, now: NOW }),
    ).rejects.toBeDefined();
    expect(uploadReceipt).not.toHaveBeenCalled();
  });
});

describe('reviewSubscriptionPayment', () => {
  const paymentId = '6560f0f0f0f0f0f0f0f0f0f0';
  const pending = (extra: Record<string, unknown> = {}) => ({
    _id: paymentId,
    organization: 'org-1',
    status: 'pendiente',
    activatesNow: false,
    submittedAt: d('2026-10-20T15:00:00.000Z'),
    ...extra,
  });

  beforeEach(() => {
    vi.mocked(SubscriptionPayment.findOneAndUpdate).mockImplementation(
      (_filter, update) => Promise.resolve({ ...(update as { $set: object }).$set }) as never,
    );
  });

  it('aprobar en prueba: el período arranca cuando termina la prueba, no hoy', async () => {
    vi.mocked(SubscriptionPayment.findById).mockResolvedValue(pending() as never);

    const approved = await svc.reviewSubscriptionPayment({
      paymentId,
      adminId: 'admin-1',
      decision: { decision: 'aprobar' },
      now: d('2026-10-21T12:00:00.000Z'),
    });

    expect(approved).toMatchObject({
      status: 'aprobado',
      periodStart: d('2026-11-09T00:00:00.000Z'),
      periodEnd: d('2026-12-09T00:00:00.000Z'),
    });
    expect(Subscription.updateOne).not.toHaveBeenCalled();
  });

  it('aprobar "activar ya" en prueba: arranca al aprobar y corta la prueba ahí', async () => {
    vi.mocked(SubscriptionPayment.findById).mockResolvedValue(pending({ activatesNow: true }) as never);
    const approvedAt = d('2026-10-21T12:00:00.000Z');

    const approved = await svc.reviewSubscriptionPayment({
      paymentId,
      adminId: 'admin-1',
      decision: { decision: 'aprobar' },
      now: approvedAt,
    });

    expect(approved).toMatchObject({ periodStart: approvedAt, periodEnd: d('2026-11-21T12:00:00.000Z') });
    expect(Subscription.updateOne).toHaveBeenCalledWith(
      { organization: 'org-1', trialEndedEarlyAt: null },
      { $set: { trialEndedEarlyAt: approvedAt } },
    );
  });

  it('si entretanto se aprobó otro período, éste va a continuación', async () => {
    vi.mocked(loadFacts).mockResolvedValue({
      ...trialFacts,
      periods: [
        {
          start: d('2026-11-09T00:00:00.000Z'),
          end: d('2026-12-09T00:00:00.000Z'),
          status: 'aprobado',
          submittedAt: d('2026-10-15T00:00:00.000Z'),
        },
        // El propio pago en revisión: no se encadena consigo mismo.
        {
          start: d('2026-12-09T00:00:00.000Z'),
          end: d('2027-01-09T00:00:00.000Z'),
          status: 'pendiente',
          submittedAt: d('2026-10-20T15:00:00.000Z'),
        },
      ],
    });
    vi.mocked(SubscriptionPayment.findById).mockResolvedValue(pending() as never);

    const approved = await svc.reviewSubscriptionPayment({
      paymentId,
      adminId: 'admin-1',
      decision: { decision: 'aprobar' },
      now: d('2026-10-21T12:00:00.000Z'),
    });

    expect(approved).toMatchObject({ periodStart: d('2026-12-09T00:00:00.000Z') });
  });

  it('rechazar guarda el motivo', async () => {
    vi.mocked(SubscriptionPayment.findById).mockResolvedValue(pending() as never);
    const rejected = await svc.reviewSubscriptionPayment({
      paymentId,
      adminId: 'admin-1',
      decision: { decision: 'rechazar', reason: 'La referencia no aparece en el banco' },
    });
    expect(rejected).toMatchObject({
      status: 'rechazado',
      rejectionReason: 'La referencia no aparece en el banco',
    });
  });

  it('un pago ya revisado no se revisa de nuevo', async () => {
    vi.mocked(SubscriptionPayment.findById).mockResolvedValue(pending({ status: 'aprobado' }) as never);
    await expect(
      svc.reviewSubscriptionPayment({ paymentId, adminId: 'admin-1', decision: { decision: 'aprobar' } }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('si otra persona lo revisó al mismo tiempo, conflicto', async () => {
    vi.mocked(SubscriptionPayment.findById).mockResolvedValue(pending() as never);
    vi.mocked(SubscriptionPayment.findOneAndUpdate).mockResolvedValue(null);
    await expect(
      svc.reviewSubscriptionPayment({ paymentId, adminId: 'admin-1', decision: { decision: 'aprobar' } }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('toPaymentSummary', () => {
  it('las líneas salen limpias, sin la maquinaria de Mongoose', async () => {
    // Imita un subdocumento: propiedades internas además de las del esquema.
    const subdoc = Object.assign(Object.create({ $__parent: {} }), {
      kind: 'base',
      quantity: 1,
      unitUsd: 39,
      amountUsd: 39,
      __parentArray: [],
    });
    const summary = await svc.toPaymentSummary({
      _id: 'p1',
      method: 'stripe',
      status: 'aprobado',
      periodStart: d('2026-11-09T00:00:00Z'),
      periodEnd: d('2026-12-09T00:00:00Z'),
      lines: [subdoc],
      submittedAt: d('2026-11-09T00:00:00Z'),
      receipt: null,
    } as never);
    expect(summary.lines).toEqual([{ kind: 'base', quantity: 1, unitUsd: 39, amountUsd: 39 }]);
  });
});

describe('detalles', () => {
  it('hasAmountMismatch avisa a partir de más de un 1% de diferencia', () => {
    const p = (declared: number) => ({ amountBs: 1000, declaredAmountBs: declared }) as never;
    expect(svc.hasAmountMismatch(p(1009))).toBe(false);
    expect(svc.hasAmountMismatch(p(989))).toBe(true);
  });

  it('normalizeBank', () => {
    expect(svc.normalizeBank('  banco  de venezuela ')).toBe('BANCO DE VENEZUELA');
  });
});
