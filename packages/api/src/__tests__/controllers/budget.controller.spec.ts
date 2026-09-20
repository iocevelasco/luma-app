import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * Cubre lo que no puede vivir en Zod: `totalAmount` tiene que coincidir con la
 * suma de los ítems, sólo puede existir un `Budget` vigente por obra, y el
 * índice único (project, version) es la red de contención si dos requests
 * llegan a la vez — mismo patrón que `labor.controller.spec.ts`.
 */
vi.mock('../../models/Budget.js', () => ({
  Budget: { findOne: vi.fn(), create: vi.fn() },
}));
vi.mock('../../models/BudgetLine.js', () => ({
  BudgetLine: { insertMany: vi.fn(), find: vi.fn() },
}));

const { Budget } = await import('../../models/Budget.js');
const { BudgetLine } = await import('../../models/BudgetLine.js');
const { createBudget, getBudget } = await import('../../controllers/budget.controller.js');

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const validLine = { chapter: 'Demolición', name: 'Retiro de escombros', unit: 'global', total: 100 };

function mockReq(overrides: Record<string, unknown> = {}): Request {
  return {
    user: { sub: 'user-1' },
    project: { _id: 'project-1', currency: 'ARS' },
    body: {
      totalAmount: 100,
      lines: [validLine],
      ...overrides,
    },
  } as unknown as Request;
}

describe('createBudget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('400 si totalAmount no coincide con la suma de los ítems', async () => {
    const req = mockReq({ totalAmount: 999 });
    const res = mockRes();

    await createBudget(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Budget.findOne).not.toHaveBeenCalled();
    expect(Budget.create).not.toHaveBeenCalled();
  });

  it('409 si la obra ya tiene un presupuesto', async () => {
    vi.mocked(Budget.findOne).mockResolvedValue({ _id: 'budget-1' } as never);
    const req = mockReq();
    const res = mockRes();

    await createBudget(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(Budget.create).not.toHaveBeenCalled();
  });

  it('409 (no 500) si el índice único rechaza un reintento concurrente', async () => {
    vi.mocked(Budget.findOne).mockResolvedValue(null);
    vi.mocked(Budget.create).mockRejectedValue(
      Object.assign(new Error('duplicate key'), { code: 11000 }),
    );
    const req = mockReq();
    const res = mockRes();

    await createBudget(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('crea el budget copiando la moneda del proyecto y asigna order por índice', async () => {
    vi.mocked(Budget.findOne).mockResolvedValue(null);
    vi.mocked(Budget.create).mockResolvedValue({
      _id: 'budget-1',
      project: 'project-1',
      version: 1,
      currency: 'ARS',
      totalAmount: 300,
      contingencyAmount: 0,
      importMode: 'manual',
      importedBy: 'user-1',
      importedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(BudgetLine.insertMany).mockResolvedValue([] as never);

    const req = mockReq({
      totalAmount: 300,
      lines: [
        { ...validLine, total: 100 },
        { ...validLine, name: 'Item 2', total: 200 },
      ],
    });
    const res = mockRes();

    await createBudget(req, res);

    expect(Budget.create).toHaveBeenCalledWith(
      expect.objectContaining({
        project: 'project-1',
        currency: 'ARS',
        importMode: 'manual',
        importedBy: 'user-1',
      }),
    );
    expect(BudgetLine.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ order: 0, name: 'Retiro de escombros' }),
      expect.objectContaining({ order: 1, name: 'Item 2' }),
    ]);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rechaza sin ítems antes de tocar la base', async () => {
    const req = mockReq({ lines: [] });
    const res = mockRes();

    await createBudget(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Budget.findOne).not.toHaveBeenCalled();
  });
});

describe('getBudget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve budget: null (200, no error) cuando la obra no tiene presupuesto', async () => {
    vi.mocked(Budget.findOne).mockReturnValue({
      sort: vi.fn().mockResolvedValue(null),
    } as never);

    const req = { project: { _id: 'project-1' } } as unknown as Request;
    const res = mockRes();

    await getBudget(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: { budget: null } });
  });
});
