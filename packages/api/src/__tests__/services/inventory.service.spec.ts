import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../models/MaterialItem.js', () => ({ MaterialItem: { find: vi.fn() } }));
vi.mock('../../models/StockMovement.js', () => ({
  StockMovement: { find: vi.fn(), insertMany: vi.fn() },
}));

const { MaterialItem } = await import('../../models/MaterialItem.js');
const { StockMovement } = await import('../../models/StockMovement.js');
const { backfillPurchaseEntries, currentStock, recordPurchaseEntries } = await import(
  '../../services/inventory.service.js'
);

const material = (id: string, over: Record<string, unknown> = {}) => ({
  _id: id,
  project: 'p1',
  status: 'en_obra',
  name: 'Cemento ',
  unit: 'bolsa',
  quantity: 40,
  statusChangedAt: new Date('2026-11-02T08:00:00.000Z'),
  statusChangedBy: 'user-2',
  createdBy: 'user-1',
  updatedAt: new Date('2026-11-03T08:00:00.000Z'),
  ...over,
});

const registered = (...ids: string[]) => ({
  select: vi.fn().mockResolvedValue(ids.map((id) => ({ material: id }))),
});

describe('recordPurchaseEntries', () => {
  beforeEach(() => vi.resetAllMocks());

  it('un material que no está «En obra» no entra al patio', async () => {
    expect(await recordPurchaseEntries([material('m1', { status: 'comprado' })] as never)).toBe(0);
    expect(StockMovement.find).not.toHaveBeenCalled();
    expect(StockMovement.insertMany).not.toHaveBeenCalled();
  });

  it('registra sólo los materiales que todavía no tienen su compra', async () => {
    vi.mocked(StockMovement.find).mockReturnValue(registered('m1') as never);

    const created = await recordPurchaseEntries([material('m1'), material('m2')] as never);

    const [rows] = vi.mocked(StockMovement.insertMany).mock.calls[0]!;
    expect(created).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      project: 'p1',
      material: 'm2',
      kind: 'compra',
      quantity: 40,
      itemKey: 'cemento|bolsa',
      createdBy: 'user-2',
      occurredAt: new Date('2026-11-02T08:00:00.000Z'),
    });
  });

  it('pregunta por la compra de ESOS materiales, no por las de toda la obra', async () => {
    vi.mocked(StockMovement.find).mockReturnValue(registered() as never);
    await recordPurchaseEntries([material('m1')] as never);
    expect(StockMovement.find).toHaveBeenCalledWith({ kind: 'compra', material: { $in: ['m1'] } });
  });

  it('repetir la llamada no duplica: lo ya registrado se saltea', async () => {
    vi.mocked(StockMovement.find).mockReturnValue(registered('m1') as never);
    expect(await recordPurchaseEntries([material('m1')] as never)).toBe(0);
    expect(StockMovement.insertMany).not.toHaveBeenCalled();
  });

  it('un material viejo sin fecha de cambio entra con su última actualización y su creador', async () => {
    vi.mocked(StockMovement.find).mockReturnValue(registered() as never);
    await recordPurchaseEntries([
      material('m1', { statusChangedAt: undefined, statusChangedBy: undefined }),
    ] as never);

    const [rows] = vi.mocked(StockMovement.insertMany).mock.calls[0]!;
    expect(rows[0]).toMatchObject({
      createdBy: 'user-1',
      occurredAt: new Date('2026-11-03T08:00:00.000Z'),
    });
  });

  it('no falla si otro request la registró a la vez (clave duplicada)', async () => {
    vi.mocked(StockMovement.find).mockReturnValue(registered() as never);
    vi.mocked(StockMovement.insertMany).mockRejectedValue({ code: 11000 });
    await expect(recordPurchaseEntries([material('m1')] as never)).resolves.toBe(1);
  });

  it('cualquier otro error sí sube', async () => {
    vi.mocked(StockMovement.find).mockReturnValue(registered() as never);
    vi.mocked(StockMovement.insertMany).mockRejectedValue(new Error('boom'));
    await expect(recordPurchaseEntries([material('m1')] as never)).rejects.toThrow('boom');
  });
});

describe('backfillPurchaseEntries', () => {
  // `reset` y no `clear`: el rechazo del test anterior no puede filtrarse a éste.
  beforeEach(() => vi.resetAllMocks());

  function cursorOf(items: unknown[]) {
    return {
      cursor: () => ({
        async *[Symbol.asyncIterator]() {
          for (const item of items) yield item;
        },
      }),
    };
  }

  it('recorre los materiales en obra y registra los que no tenían entrada', async () => {
    vi.mocked(MaterialItem.find).mockReturnValue(cursorOf([material('m1'), material('m2')]) as never);
    vi.mocked(StockMovement.find).mockReturnValue(registered('m1') as never);

    const run = await backfillPurchaseEntries();

    expect(MaterialItem.find).toHaveBeenCalledWith({ status: 'en_obra' });
    expect(run).toEqual({ materials: 2, created: 1 });
  });

  it('sin materiales en obra no escribe nada', async () => {
    vi.mocked(MaterialItem.find).mockReturnValue(cursorOf([]) as never);
    expect(await backfillPurchaseEntries()).toEqual({ materials: 0, created: 0 });
    expect(StockMovement.insertMany).not.toHaveBeenCalled();
  });
});

describe('currentStock', () => {
  it('suma el kardex (compra menos consumo) sin escribir nada: leer no inserta', async () => {
    vi.clearAllMocks();
    const at = new Date('2026-11-02T08:00:00.000Z');
    vi.mocked(StockMovement.find).mockResolvedValue([
      { itemKey: 'cemento|bolsa', name: 'Cemento', unit: 'bolsa', kind: 'compra', quantity: 40, occurredAt: at },
      { itemKey: 'cemento|bolsa', name: 'Cemento', unit: 'bolsa', kind: 'consumo', quantity: 15, occurredAt: at },
    ] as never);

    const [item] = await currentStock('p1');

    expect(item).toMatchObject({ itemKey: 'cemento|bolsa', stock: 25, received: 40, consumed: 15 });
    expect(MaterialItem.find).not.toHaveBeenCalled();
    expect(StockMovement.insertMany).not.toHaveBeenCalled();
  });
});
