import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

vi.mock('../../models/Project.js', () => ({ Project: { find: vi.fn() } }));
vi.mock('../../services/deposit.service.js', () => ({
  depositLedger: vi.fn(),
  depositLines: vi.fn(),
  importFromDeposit: vi.fn(),
  sendToDeposit: vi.fn(),
  movementProjectId: (m: Record<string, unknown>) => {
    const id = m.originProject ?? m.destinationProject;
    return id ? String(id) : null;
  },
  toDepositEntry: (m: Record<string, unknown>) => ({
    itemKey: m.itemKey,
    name: m.name,
    unit: m.unit,
    kind: m.kind,
    quantity: m.quantity,
    unitCost: m.unitCost ?? 0,
    currency: m.currency ?? '',
    projectId: String(m.originProject ?? m.destinationProject ?? '') || null,
    occurredAt: (m.occurredAt as Date).toISOString(),
  }),
}));
vi.mock('../../services/organization.service.js', () => ({ findMyOrganizationId: vi.fn() }));

const { Project } = await import('../../models/Project.js');
const { depositLedger, depositLines, importFromDeposit } = await import(
  '../../services/deposit.service.js'
);
const { findMyOrganizationId } = await import('../../services/organization.service.js');
const { getMyDeposit, importFromDepositHandler } = await import(
  '../../controllers/deposit.controller.js'
);
const { isAppError } = await import('../../utils/errors.js');

function mockNext() {
  return vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
}
function thrownBy(next: ReturnType<typeof mockNext>) {
  const error = next.mock.calls[0]?.[0];
  expect(isAppError(error)).toBe(true);
  return error as { code: string };
}
function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const at = new Date('2026-11-01T10:00:00.000Z');
const ledgerRow = (over: Record<string, unknown>) => ({
  _id: 'm',
  itemKey: 'cemento|bolsa',
  name: 'Cemento',
  unit: 'bolsa',
  kind: 'deposito_ingreso',
  quantity: 20,
  unitCost: 9,
  currency: 'USD',
  occurredAt: at,
  createdBy: 'user-1',
  ...over,
});

describe('importFromDepositHandler', () => {
  const body = {
    lines: [{ itemKey: 'cemento|bolsa', currency: 'USD', quantity: 4 }],
    freight: { amount: 50 },
  };
  const req = (can: (c: string) => boolean, b: unknown = body) =>
    ({ user: { sub: 'user-1' }, project: { _id: 'obra-b' }, body: b, can }) as unknown as Request;

  beforeEach(() => vi.clearAllMocks());

  it('403 si imputa un flete sin poder cargar gastos, y no mueve nada', async () => {
    const next = mockNext();
    await importFromDepositHandler(req(() => false), mockRes(), next);
    expect(thrownBy(next).code).toBe('FORBIDDEN');
    expect(importFromDeposit).not.toHaveBeenCalled();
  });

  it('sin flete no pide expense.write', async () => {
    vi.mocked(importFromDeposit).mockResolvedValue([] as never);
    const next = mockNext();
    await importFromDepositHandler(req(() => false, { lines: body.lines }), mockRes(), next);
    expect(next).not.toHaveBeenCalled();
    expect(importFromDeposit).toHaveBeenCalled();
  });

  it('400 con un cuerpo inválido', async () => {
    const next = mockNext();
    await importFromDepositHandler(req(() => true, { lines: [] }), mockRes(), next);
    expect(thrownBy(next).code).toBe('VALIDATION');
  });
});

describe('getMyDeposit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404 si la persona no es dueña de una Empresa', async () => {
    vi.mocked(findMyOrganizationId).mockResolvedValue(null as never);
    const next = mockNext();
    await getMyDeposit({ user: { sub: 'u' } } as unknown as Request, mockRes(), next);
    expect(thrownBy(next).code).toBe('NOT_FOUND');
  });

  it('devuelve líneas, historial y ahorro por obra destino, con los nombres resueltos', async () => {
    vi.mocked(findMyOrganizationId).mockResolvedValue('org-1' as never);
    vi.mocked(depositLedger).mockResolvedValue([
      ledgerRow({ originProject: 'obra-a' }),
      ledgerRow({
        _id: 'e',
        kind: 'deposito_egreso',
        quantity: 8,
        originProject: undefined,
        destinationProject: 'obra-b',
        occurredAt: new Date('2026-11-02T10:00:00.000Z'),
      }),
    ] as never);
    vi.mocked(depositLines).mockResolvedValue([{ lineKey: 'cemento|bolsa|USD', stock: 12 }] as never);
    vi.mocked(Project.find).mockReturnValue({
      select: vi.fn().mockResolvedValue([
        { _id: 'obra-a', name: 'Obra A' },
        { _id: 'obra-b', name: 'Obra B' },
      ]),
    } as never);

    const res = mockRes();
    await getMyDeposit({ user: { sub: 'u' } } as unknown as Request, res, mockNext());

    const { data } = vi.mocked(res.json).mock.calls[0]![0] as {
      data: {
        lines: unknown[];
        movements: { kind: string; projectName?: string }[];
        savings: unknown[];
      };
    };
    expect(data.lines).toHaveLength(1);
    // El más reciente primero.
    expect(data.movements.map((m) => m.kind)).toEqual(['deposito_egreso', 'deposito_ingreso']);
    expect(data.movements[0]!.projectName).toBe('Obra B');
    expect(data.savings).toEqual([
      { projectId: 'obra-b', projectName: 'Obra B', currency: 'USD', items: 1, saved: 72 },
    ]);
  });
});
