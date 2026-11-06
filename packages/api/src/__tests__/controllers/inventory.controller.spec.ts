import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

/**
 * Las reglas del kardex que no caben en Zod: sólo se saca lo que hay, el
 * material tiene que estar en el inventario y la tarea ser de la obra. Mismo
 * patrón que `material.controller.spec.ts`: modelos y servicio mockeados.
 */
vi.mock('../../models/Activity.js', () => ({ Activity: { findOne: vi.fn() } }));
vi.mock('../../models/StockMovement.js', () => ({
  StockMovement: { create: vi.fn(), find: vi.fn() },
}));
vi.mock('../../services/inventory.service.js', () => ({
  currentStock: vi.fn(),
}));

const { Activity } = await import('../../models/Activity.js');
const { StockMovement } = await import('../../models/StockMovement.js');
const { currentStock } = await import('../../services/inventory.service.js');
const { createMovement, listMovements, listStock } = await import(
  '../../controllers/inventory.controller.js'
);
const { isAppError } = await import('../../utils/errors.js');

const CEMENTO = {
  itemKey: 'cemento|bolsa',
  name: 'Cemento',
  unit: 'bolsa',
  stock: 10,
  received: 40,
  consumed: 30,
  wasted: 0,
  level: 'low',
  lastMovementAt: '2026-11-01T10:00:00.000Z',
};

function mockNext() {
  return vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
}
function thrownBy(next: ReturnType<typeof mockNext>) {
  const error = next.mock.calls[0]?.[0];
  expect(isAppError(error)).toBe(true);
  return error as { code: string; status: number };
}
function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}
function mockReq(body: Record<string, unknown>, extra: Record<string, unknown> = {}): Request {
  return {
    user: { sub: 'user-1' },
    project: { _id: 'project-1' },
    body: { kind: 'consumo', itemKey: 'cemento|bolsa', quantity: 5, receiver: 'Pedro', ...body },
    ...extra,
  } as unknown as Request;
}

function created(over: Record<string, unknown> = {}) {
  return {
    _id: 'mov-1',
    project: 'project-1',
    itemKey: 'cemento|bolsa',
    name: 'Cemento',
    unit: 'bolsa',
    kind: 'consumo',
    quantity: 5,
    receiver: 'Pedro',
    occurredAt: new Date('2026-11-05T10:00:00.000Z'),
    createdBy: 'user-1',
    createdAt: new Date('2026-11-05T10:00:00.000Z'),
    ...over,
  };
}

describe('createMovement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(currentStock).mockResolvedValue([CEMENTO] as never);
    vi.mocked(Activity.findOne).mockResolvedValue({ _id: 'a1' } as never);
    vi.mocked(StockMovement.create).mockResolvedValue(created() as never);
  });

  it('registra el consumo con el nombre y la unidad del inventario, no los del request', async () => {
    const res = mockRes();
    const next = mockNext();
    await createMovement(mockReq({ name: 'otro', unit: 'kg' }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(StockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        project: 'project-1',
        itemKey: 'cemento|bolsa',
        name: 'Cemento',
        unit: 'bolsa',
        kind: 'consumo',
        createdBy: 'user-1',
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('409 si se saca más de lo que hay, y no escribe nada', async () => {
    const next = mockNext();
    await createMovement(mockReq({ quantity: 11 }), mockRes(), next);

    expect(thrownBy(next)).toMatchObject({ code: 'CONFLICT', status: 409 });
    expect(StockMovement.create).not.toHaveBeenCalled();
  });

  it('una merma también se frena si no alcanza el stock', async () => {
    const next = mockNext();
    await createMovement(
      mockReq({ kind: 'merma', quantity: 11, reason: 'Fraguó', receiver: 'Ana' }),
      mockRes(),
      next,
    );
    expect(thrownBy(next).code).toBe('CONFLICT');
  });

  it('una devolución no mira el stock: lo suma', async () => {
    const next = mockNext();
    await createMovement(mockReq({ kind: 'devolucion', quantity: 100 }), mockRes(), next);
    expect(next).not.toHaveBeenCalled();
    expect(StockMovement.create).toHaveBeenCalled();
  });

  it('404 si el material no está en el inventario de la obra', async () => {
    const next = mockNext();
    await createMovement(mockReq({ itemKey: 'arena|m3' }), mockRes(), next);
    expect(thrownBy(next)).toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('400 si la tarea no es de esta obra', async () => {
    vi.mocked(Activity.findOne).mockResolvedValue(null);
    const next = mockNext();
    await createMovement(mockReq({ activityId: 'a'.repeat(24) }), mockRes(), next);

    expect(thrownBy(next)).toMatchObject({ code: 'VALIDATION' });
    expect(StockMovement.create).not.toHaveBeenCalled();
  });

  it('la fecha es siempre la del servidor: un occurredAt del cliente se ignora', async () => {
    const next = mockNext();
    await createMovement(mockReq({ occurredAt: '2020-01-01T00:00:00.000Z' }), mockRes(), next);
    expect(next).not.toHaveBeenCalled();
    const [row] = vi.mocked(StockMovement.create).mock.calls[0]! as [{ occurredAt: Date }];
    expect(Date.now() - row.occurredAt.getTime()).toBeLessThan(5000);
  });

  it('400 si falta el receptor de un consumo', async () => {
    const next = mockNext();
    await createMovement(mockReq({ receiver: undefined }), mockRes(), next);
    expect(thrownBy(next).code).toBe('VALIDATION');
  });

  it('401 sin usuario', async () => {
    const next = mockNext();
    await createMovement(mockReq({}, { user: undefined }), mockRes(), next);
    expect(thrownBy(next).code).toBe('UNAUTHENTICATED');
  });
});

describe('listStock', () => {
  it('devuelve el stock recalculado de la obra', async () => {
    vi.mocked(currentStock).mockResolvedValue([CEMENTO] as never);
    const res = mockRes();
    await listStock(mockReq({}), res, mockNext());
    expect(currentStock).toHaveBeenCalledWith('project-1');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { items: [CEMENTO] } });
  });
});

describe('listMovements', () => {
  function findChain(result: unknown[]) {
    const chain = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(result),
    };
    vi.mocked(StockMovement.find).mockReturnValue(chain as never);
    return chain;
  }

  it('arma el filtro con fechas inclusivas, material, tipo y receptor sin distinguir mayúsculas', async () => {
    findChain([]);
    await listMovements(
      mockReq({}, { query: { from: '2026-11-01', to: '2026-11-05', itemKey: 'x|un', kind: 'merma', receiver: 'ped.ro' } }),
      mockRes(),
      mockNext(),
    );

    const filter = vi.mocked(StockMovement.find).mock.calls[0]![0] as Record<string, unknown>;
    expect(filter.project).toBe('project-1');
    expect(filter.occurredAt).toEqual({
      $gte: new Date('2026-11-01T00:00:00.000Z'),
      $lte: new Date('2026-11-05T23:59:59.999Z'),
    });
    expect(filter.itemKey).toBe('x|un');
    expect(filter.kind).toBe('merma');
    // El punto del texto se escapa: no es un comodín.
    expect((filter.receiver as RegExp).test('Pedro')).toBe(false);
    expect((filter.receiver as RegExp).test('PED.RO')).toBe(true);
  });

  it('400 con un filtro mal formado', async () => {
    const next = mockNext();
    await listMovements(mockReq({}, { query: { from: 'ayer' } }), mockRes(), next);
    expect(thrownBy(next).code).toBe('VALIDATION');
  });

  it('el DTO trae quién lo registró y la tarea, ya resueltos', async () => {
    findChain([
      created({ activity: { _id: 'a1', name: 'Losa' }, createdBy: { _id: 'user-1', name: 'Ana' } }),
    ]);
    const res = mockRes();
    await listMovements(mockReq({}, { query: {} }), res, mockNext());

    const body = vi.mocked(res.json).mock.calls[0]![0] as {
      data: { movements: Record<string, unknown>[] };
    };
    expect(body.data.movements[0]).toMatchObject({
      id: 'mov-1',
      activityId: 'a1',
      activityName: 'Losa',
      createdBy: 'user-1',
      createdByName: 'Ana',
      occurredAt: '2026-11-05T10:00:00.000Z',
    });
  });
});
