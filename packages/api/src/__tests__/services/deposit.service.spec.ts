import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../models/StockMovement.js', () => ({
  StockMovement: {
    find: vi.fn(),
    create: vi.fn(),
    insertMany: vi.fn(),
    deleteMany: vi.fn(),
    aggregate: vi.fn(),
  },
}));
vi.mock('../../models/Expense.js', () => ({ Expense: { create: vi.fn() } }));
vi.mock('../../services/inventory.service.js', () => ({ currentStock: vi.fn() }));

const { StockMovement } = await import('../../models/StockMovement.js');
const { Expense } = await import('../../models/Expense.js');
const { currentStock } = await import('../../services/inventory.service.js');
const { depositLines, importFromDeposit, repairIncompleteTransfers, sendToDeposit } = await import(
  '../../services/deposit.service.js'
);
const { isAppError } = await import('../../utils/errors.js');

const project = { _id: 'obra-a', organization: 'org-1', currency: 'USD' } as never;
const actor = { project, userId: 'user-1' };

const CEMENTO = { itemKey: 'cemento|bolsa', name: 'Cemento', unit: 'bolsa', stock: 10 };

const row = (over: Record<string, unknown>) => ({
  itemKey: 'cemento|bolsa',
  name: 'Cemento',
  unit: 'bolsa',
  kind: 'deposito_ingreso',
  quantity: 20,
  unitCost: 9,
  currency: 'USD',
  originProject: 'obra-z',
  occurredAt: new Date('2026-11-01T10:00:00.000Z'),
  ...over,
});

/** `find(...).select(...).sort(...).lean()`: la lectura del kardex del Depósito. */
function ledgerQuery(rows: unknown[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(rows),
  };
  return chain as never;
}

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(isAppError(error)).toBe(true);
  return error as { code: string };
}

describe('sendToDeposit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(currentStock).mockResolvedValue([CEMENTO] as never);
    vi.mocked(StockMovement.create).mockImplementation((async (doc: object) => ({ _id: 'm', ...doc })) as never);
  });

  it('404 si el material no está en la obra', async () => {
    const error = await rejection(sendToDeposit(actor, { itemKey: 'arena|m3', quantity: 1, unitCost: 0 }));
    expect(error.code).toBe('NOT_FOUND');
    expect(StockMovement.create).not.toHaveBeenCalled();
  });

  it('409 si manda más de lo que hay, y no escribe nada', async () => {
    const error = await rejection(sendToDeposit(actor, { itemKey: CEMENTO.itemKey, quantity: 11, unitCost: 0 }));
    expect(error.code).toBe('CONFLICT');
    expect(StockMovement.create).not.toHaveBeenCalled();
  });

  it('escribe la salida de la obra y el ingreso al Depósito, unidos por el mismo traspaso', async () => {
    await sendToDeposit(actor, { itemKey: CEMENTO.itemKey, quantity: 4, unitCost: 9 });

    const [fromProject, toDeposit] = vi.mocked(StockMovement.create).mock.calls.map(
      ([doc]) => doc as unknown as Record<string, unknown>,
    );
    expect(fromProject).toMatchObject({
      kind: 'desincorporacion',
      project: 'obra-a',
      organization: 'org-1',
      quantity: 4,
      name: 'Cemento',
    });
    expect(toDeposit).toMatchObject({
      kind: 'deposito_ingreso',
      originProject: 'obra-a',
      organization: 'org-1',
      unitCost: 9,
      currency: 'USD',
      exchangeRate: 1,
      quantity: 4,
    });
    expect(toDeposit!.project).toBeUndefined();
    expect(String(fromProject!.transfer)).toBe(String(toDeposit!.transfer));
  });

  it('si falla el ingreso, deshace la salida para no dejar material en tránsito', async () => {
    vi.mocked(StockMovement.create)
      .mockImplementationOnce((async (doc: object) => ({ _id: 'm', ...doc })) as never)
      .mockRejectedValueOnce(new Error('boom'));

    await expect(
      sendToDeposit(actor, { itemKey: CEMENTO.itemKey, quantity: 4, unitCost: 0 }),
    ).rejects.toThrow('boom');

    const first = vi.mocked(StockMovement.create).mock.calls[0]![0] as unknown as { transfer: unknown };
    expect(StockMovement.deleteMany).toHaveBeenCalledWith({ transfer: first.transfer });
  });
});

describe('depositLines', () => {
  it('lee sólo lo que suma, en orden de fecha y sin hidratar', async () => {
    const query = ledgerQuery([]) as unknown as { select: ReturnType<typeof vi.fn>; sort: ReturnType<typeof vi.fn>; lean: ReturnType<typeof vi.fn> };
    vi.mocked(StockMovement.find).mockReturnValue(query as never);
    await depositLines('org-1');
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining('unitCost'));
    expect(query.sort).toHaveBeenCalledWith({ occurredAt: 1, _id: 1 });
    expect(query.lean).toHaveBeenCalled();
  });

  it('suma el kardex del Depósito de la Empresa', async () => {
    vi.mocked(StockMovement.find).mockReturnValue(
      ledgerQuery([
        row({ quantity: 20 }),
        row({ kind: 'deposito_egreso', quantity: 5, originProject: undefined, destinationProject: 'obra-b' }),
      ]),
    );
    const [line] = await depositLines('org-1');
    expect(StockMovement.find).toHaveBeenCalledWith(
      expect.objectContaining({ organization: 'org-1' }),
    );
    expect(line).toMatchObject({ stock: 15, unitCost: 9, currency: 'USD' });
  });
});

describe('importFromDeposit', () => {
  const request = { lines: [{ itemKey: 'cemento|bolsa', currency: 'USD', quantity: 8 }] };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(StockMovement.find).mockReturnValue(ledgerQuery([row({ quantity: 10, unitCost: 9 })]));
    vi.mocked(StockMovement.insertMany).mockImplementation((async (docs: object[]) => docs) as never);
  });

  it('404 si la línea ya no está en el Depósito', async () => {
    const error = await rejection(
      importFromDeposit(actor, { lines: [{ itemKey: 'arena|m3', currency: 'USD', quantity: 1 }] }),
    );
    expect(error.code).toBe('NOT_FOUND');
    expect(StockMovement.insertMany).not.toHaveBeenCalled();
  });

  it('409 si pide más de lo que hay', async () => {
    const error = await rejection(
      importFromDeposit(actor, { lines: [{ ...request.lines[0]!, quantity: 11 }] }),
    );
    expect(error.code).toBe('CONFLICT');
    expect(StockMovement.insertMany).not.toHaveBeenCalled();
  });

  it('el egreso congela el costo de referencia y la entrada a la obra no lleva costo', async () => {
    await importFromDeposit(actor, request);

    const [egresos, entradas] = vi.mocked(StockMovement.insertMany).mock.calls.map(
      ([docs]) => docs as unknown as Record<string, unknown>[],
    );
    expect(egresos![0]).toMatchObject({
      kind: 'deposito_egreso',
      destinationProject: 'obra-a',
      unitCost: 9,
      currency: 'USD',
      exchangeRate: 1,
      quantity: 8,
    });
    expect(entradas![0]).toMatchObject({ kind: 'importacion', project: 'obra-a', quantity: 8 });
    // Costo de compra $0: sin precio, sin factura, sin proveedor.
    expect(entradas![0]).not.toHaveProperty('unitCost');
    expect(Expense.create).not.toHaveBeenCalled();
  });

  it('el flete es un gasto de la obra destino, en su moneda', async () => {
    await importFromDeposit(actor, { ...request, freight: { amount: 50, description: 'Camión' } });

    expect(Expense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        project: 'obra-a',
        category: 'otro',
        description: 'Camión',
        amount: 50,
        currency: 'USD',
        exchangeRate: 1,
        registeredBy: 'user-1',
      }),
    );
  });

  it('si falla el gasto del flete, deshace el traspaso entero', async () => {
    vi.mocked(Expense.create).mockRejectedValue(new Error('boom'));
    await expect(
      importFromDeposit(actor, { ...request, freight: { amount: 50 } }),
    ).rejects.toThrow('boom');

    const [egresos] = vi.mocked(StockMovement.insertMany).mock.calls[0]! as unknown as [
      { transfer: unknown }[],
    ];
    expect(StockMovement.deleteMany).toHaveBeenCalledWith({ transfer: egresos[0]!.transfer });
  });
});

describe('compensación de un traspaso que falla', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(currentStock).mockResolvedValue([CEMENTO] as never);
  });

  it('si además falla el borrado de compensación, el error que sube es el original', async () => {
    vi.mocked(StockMovement.create)
      .mockImplementationOnce((async (doc: object) => ({ _id: 'm', ...doc })) as never)
      .mockRejectedValueOnce(new Error('falló el ingreso'));
    vi.mocked(StockMovement.deleteMany).mockRejectedValue(new Error('falló el borrado'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      sendToDeposit(actor, { itemKey: CEMENTO.itemKey, quantity: 4, unitCost: 0 }),
    ).rejects.toThrow('falló el ingreso');
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('repairIncompleteTransfers', () => {
  const now = new Date('2026-11-10T12:00:00.000Z');
  const group = (id: string, over: Record<string, number> = {}) => ({
    _id: id,
    sent: 1,
    deposited: 1,
    exported: 0,
    imported: 0,
    ...over,
  });

  beforeEach(() => vi.clearAllMocks());

  it('sólo mira traspasos con edad suficiente y no tan viejos', async () => {
    vi.mocked(StockMovement.aggregate).mockResolvedValue([] as never);
    await repairIncompleteTransfers(now);

    const [pipeline] = vi.mocked(StockMovement.aggregate).mock.calls[0]! as unknown as [
      { $match: { createdAt: { $gte: Date; $lte: Date } } }[],
    ];
    const { $gte, $lte } = pipeline[0]!.$match.createdAt;
    expect(now.getTime() - $lte.getTime()).toBe(10 * 60 * 1000);
    expect(now.getTime() - $gte.getTime()).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it('deshace un envío al que le falta una de las dos filas, en cualquier sentido', async () => {
    vi.mocked(StockMovement.aggregate).mockResolvedValue([
      group('ok'),
      group('sin-ingreso', { deposited: 0 }),
      group('sin-salida', { sent: 0 }),
    ] as never);
    vi.mocked(StockMovement.deleteMany).mockResolvedValue({ deletedCount: 2 } as never);

    const run = await repairIncompleteTransfers(now);

    expect(StockMovement.deleteMany).toHaveBeenCalledWith({
      transfer: { $in: ['sin-ingreso', 'sin-salida'] },
    });
    expect(run).toEqual({ checked: 3, repaired: 2 });
  });

  it('deshace una importación a medias: egresos sin sus entradas a la obra', async () => {
    vi.mocked(StockMovement.aggregate).mockResolvedValue([
      group('import-ok', { sent: 0, deposited: 0, exported: 2, imported: 2 }),
      group('import-rota', { sent: 0, deposited: 0, exported: 2, imported: 1 }),
    ] as never);
    vi.mocked(StockMovement.deleteMany).mockResolvedValue({ deletedCount: 3 } as never);

    const run = await repairIncompleteTransfers(now);
    expect(StockMovement.deleteMany).toHaveBeenCalledWith({ transfer: { $in: ['import-rota'] } });
    expect(run.repaired).toBe(1);
  });

  it('con todo en orden no borra nada', async () => {
    vi.mocked(StockMovement.aggregate).mockResolvedValue([group('ok')] as never);
    expect(await repairIncompleteTransfers(now)).toEqual({ checked: 1, repaired: 0 });
    expect(StockMovement.deleteMany).not.toHaveBeenCalled();
  });
});
