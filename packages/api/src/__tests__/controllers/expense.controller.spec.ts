import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * La lista de gastos resuelve los nombres que necesita Finanzas. Lo que se
 * fija acá: una factura de Compras trae el nombre de cada material que paga,
 * porque el contador lee Finanzas sin acceso a Compras.
 */
function query<T>(result: T) {
  return { select: vi.fn().mockResolvedValue(result) };
}

vi.mock('../../models/Expense.js', () => ({ Expense: { find: vi.fn() } }));
vi.mock('../../models/User.js', () => ({ User: { find: vi.fn() } }));
vi.mock('../../models/Provider.js', () => ({ Provider: { find: vi.fn() } }));
vi.mock('../../models/Activity.js', () => ({ Activity: { find: vi.fn() } }));
vi.mock('../../models/MaterialItem.js', () => ({ MaterialItem: { find: vi.fn() } }));
vi.mock('../../services/storage.service.js', () => ({
  signObjectUrl: vi.fn().mockResolvedValue(null),
  deleteObject: vi.fn(),
  uploadProjectDocument: vi.fn(),
  StorageNotConfiguredError: class extends Error {},
}));

const { Expense } = await import('../../models/Expense.js');
const { User } = await import('../../models/User.js');
const { MaterialItem } = await import('../../models/MaterialItem.js');
const { listExpenses } = await import('../../controllers/expense.controller.js');

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function expense(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'e-1',
    project: 'project-1',
    category: 'material',
    description: 'Factura corralón',
    amount: 1000,
    currency: 'ARS',
    exchangeRate: 1,
    spentOn: '2026-10-20',
    registeredBy: 'user-1',
    materials: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('listExpenses — materiales de una factura', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(User.find).mockReturnValue(query([{ _id: 'user-1', name: 'Ana' }]) as never);
  });

  async function list(docs: unknown[]) {
    vi.mocked(Expense.find).mockReturnValue({
      sort: () => ({ limit: vi.fn().mockResolvedValue(docs) }),
    } as never);
    const res = mockRes();
    await listExpenses({ project: { _id: 'project-1' } } as unknown as Request, res);
    return (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0].data.expenses;
  }

  it('trae el nombre de cada material que paga, en una sola consulta', async () => {
    vi.mocked(MaterialItem.find).mockReturnValue(
      query([
        { _id: 'm-1', name: 'Cemento portland' },
        { _id: 'm-2', name: 'Arena gruesa' },
      ]) as never,
    );

    const [result] = await list([expense({ materials: ['m-1', 'm-2'] })]);

    expect(MaterialItem.find).toHaveBeenCalledTimes(1);
    expect(result.materials).toEqual([
      { id: 'm-1', name: 'Cemento portland' },
      { id: 'm-2', name: 'Arena gruesa' },
    ]);
  });

  it('un gasto común no trae materiales ni consulta Compras', async () => {
    const [result] = await list([expense({ category: 'herramienta' })]);

    expect(MaterialItem.find).not.toHaveBeenCalled();
    expect(result.materials).toBeUndefined();
  });

  it('omite un material que ya no existe en vez de inventarle un nombre', async () => {
    vi.mocked(MaterialItem.find).mockReturnValue(query([{ _id: 'm-1', name: 'Cemento' }]) as never);

    const [result] = await list([expense({ materials: ['m-1', 'm-borrado'] })]);

    expect(result.materials).toEqual([{ id: 'm-1', name: 'Cemento' }]);
  });
});
